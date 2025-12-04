import { NextResponse } from "next/server";
import OpenAI from "openai";
import { tools } from "./tools";
import { runTool } from "./runTools";
import { prisma } from "@/prisma/prisma-client";
import { cookies } from "next/headers";
import crypto from "crypto";

// Máquina de estados + prompts base por estado del usuario
import { getNextState } from "@/app/ai/state-machine";
import { promptAuthenticated } from "@/app/ai/prompts";

// Router semántico (memory / auth / casual)
import { detectDomainLLM } from "@/app/ai/router";

// Constructor del SYSTEM PROMPT dinámico (state + domain)
import { buildSystemPrompt } from "@/app/ai/buildPromts";

// Capa 3: Contexto dinámico enriquecido
import { buildDynamicContext } from "@/app/ai/context/context";

/**
 * Limpia el historial sacando:
 * - mensajes de tipo "memory"
 * - mensajes nulos o vacíos
 *
 * Importante: estos mensajes no deben enviarse al modelo porque:
 * - ensucian el contexto
 * - hacen que los prompts se mezclen
 * - pueden generar tool calls incorrectas
 */
function sanitizeMessages(messages: any[]) {
  return messages
    .filter(
      (m) =>
        m.role !== "memory" && // no enviar memorias
        m.content !== null &&
        m.content !== undefined
    )
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * ============================================================
 * 🔥 MAIN ROUTE — Punto central del agente
 * ============================================================
 *
 * Este endpoint implementa TODA la lógica del agente conversacional:
 *
 * - Manejo de sesión
 * - Máquina de estados (login/logout/register/authenticated)
 * - Detección de dominio (memory/auth/casual)
 * - Construcción dinámica del SYSTEM PROMPT
 * - Contexto dinámico (memorias + historial relevante)
 * - Soporte para herramientas con tool_choice:auto
 * - Manejo de 2 etapas del modelo (first → tool → final)
 * - Persistencia total (usuario, mensajes, memorias)
 *
 * Es un pipeline profesional estilo "OpenAI Assistant Architecture".
 */
export async function POST(req: Request) {
  try {
    // ------------------------------------------------------------
    // 0) VALIDACIÓN DE API KEY
    // ------------------------------------------------------------
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable de entorno OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    // Extraemos el mensaje ingresado por el usuario
    const { query } = await req.json();
    console.log("Incoming query:", query);

    // ------------------------------------------------------------
    // 1) SESIÓN: leemos la cookie y resolvemos el usuario autenticado
    // ------------------------------------------------------------
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value || null;

    let user = null;

    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { sessionToken: sessionId },
        include: { user: true },
      });

      if (session?.user) {
        user = session.user;
        console.log("🔐 Usuario autenticado:", user.name);
      }
    } else {
      console.log("🔓 No hay sesión activa");
    }

    // ------------------------------------------------------------
    // 2) MÁQUINA DE ESTADOS — determina:
    // UNAUTHENTICATED / REGISTERING / LOGGING_IN / AUTHENTICATED / LOGGING_OUT
    // ------------------------------------------------------------
    const state = getNextState(user, query);
    console.log("🧠 Estado detectado:", state);

    // ------------------------------------------------------------
    // 3) DETECCIÓN DE DOMINIO (memory / authentication / casual)
    // ------------------------------------------------------------
    const domain = await detectDomainLLM(query);
    console.log("🧭 Dominio detectado:", domain);

    // ------------------------------------------------------------
    // 4) Construcción dinámica del SYSTEM PROMPT
    // (statePrompt + coreRules + toolRules + domainPrompt)
    // ------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(state, domain, user);

    // ------------------------------------------------------------
    // 5) Historial del usuario
    // ------------------------------------------------------------
    let history = [];

    if (user?.id) {
      const msgs = await prisma.message.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        take: 20,
      });

      history = msgs.map((m: any) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
    }

    // Guardamos el mensaje del usuario en la base
    await prisma.message.create({
      data: {
        role: "user",
        content: query,
        userId: user?.id ?? null,
      },
    });

    // Volvemos a cargar historial actualizado
    const historyFromDB = user
      ? await prisma.message.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        })
      : [];

    // Limpiamos historial para el modelo
    const safeHistory = sanitizeMessages(historyFromDB);

    // ------------------------------------------------------------
    // 6) Capa 3: Contexto dinámico (memorias relevantes + resumen natural)
    // ------------------------------------------------------------
    const dynamicContext = await buildDynamicContext(user, query);

    // ------------------------------------------------------------
    // 7) PRIMERA LLAMADA AL MODELO
    // (razonamiento inicial + posible tool_call)
    // ------------------------------------------------------------
    const first = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: dynamicContext },
        ...safeHistory,
        { role: "user", content: query },
      ],
      tools,
      tool_choice: "auto",
    });

    const msg = first.choices[0].message;

    // ------------------------------------------------------------
    // 8) SI HAY tool_calls — ejecutamos herramientas
    // ------------------------------------------------------------
    if (msg.tool_calls?.length) {
      let justLoggedInUser = null;

      // Ejecutamos TODAS las tool calls en paralelo
      const results = await Promise.all(
        msg.tool_calls.map(async (call: any) => {
          const args = JSON.parse(call.function.arguments || "{}");
          const result = await runTool(call.function.name, args);

          // Detectamos autenticación exitosa
          if (call.function.name === "authenticateUser" && result.authenticated) {
            justLoggedInUser = {
              id: result.userId,
              name: result.name,
              code: result.code,
            };
          }

          // Crear sesión si corresponde
          if (
            call.function.name !== "logoutUser" &&
            ((call.function.name === "saveUserInfo" && result.userId) ||
              (call.function.name === "authenticateUser" && result.authenticated))
          ) {
            const session = await prisma.session.create({
              data: {
                userId: result.userId,
                sessionToken: crypto.randomUUID(),
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
              },
            });

            cookieStore.set({
              name: "sessionId",
              value: session.sessionToken,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: 60 * 60 * 24 * 30,
            });
          }

          return {
            tool_call_id: call.id,
            name: call.function.name,
            result,
          };
        })
      );

      // ------------------------------------------------------------
      // 9) SEGUNDA LLAMADA
      // El modelo responde usando datos de herramientas
      // ------------------------------------------------------------
      const secondSystemPrompt = justLoggedInUser
        ? promptAuthenticated(justLoggedInUser)
        : systemPrompt;

      const final = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: secondSystemPrompt },
          { role: "user", content: query },
          msg,
          ...results.map((r) => ({
            role: "tool" as const,
            tool_call_id: r.tool_call_id,
            content: JSON.stringify(r.result),
          })),
        ],
      });

      // Guardamos la respuesta final del assistant
      await prisma.message.create({
        data: {
          role: "assistant",
          content: final.choices[0].message?.content || "",
          userId: user?.id ?? null,
        },
      });

      return NextResponse.json({
        answer: final.choices[0].message?.content,
        trace: {
          tool_calls: msg.tool_calls,
          results,
        },
      });
    }

    // ------------------------------------------------------------
    // 10) SI NO HAY tool call → respuesta directa
    // ------------------------------------------------------------
    return NextResponse.json({ answer: msg.content });

  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
