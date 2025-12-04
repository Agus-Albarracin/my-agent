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

// Sanitización del historial y construcción de archivos
import { sanitizeMessages, buildUploadedFilesSystemMessage } from "@/app/ai/utils/openai-utils";

/**
 * ============================================================
 * 🔥 MAIN ROUTE — Punto central del agente conversacional
 * ============================================================
 *
 * Este endpoint es la **capa de orquestación principal** del sistema.
 * Implementa una arquitectura estilo **"OpenAI Assistant Architecture"**
 * con:
 *
 * - Manejo de sesión del usuario (login/logout)
 * - Máquina de estados: Register / Login / Authenticated / Logout
 * - Router semántico con LLM para determinar el dominio del mensaje
 * - Construcción dinámica del SYSTEM PROMPT
 * - Contexto dinámico inteligente (memorias + historial reciente)
 * - Soporte completo de herramientas (tool_choice:auto)
 * - Dos llamadas al modelo (razonamiento → herramienta → respuesta final)
 * - Persistencia total en la base (mensajes, estado del usuario, sesiones)
 * - Manejo de archivos subidos por el cliente
 *
 * Es el corazón del agente: todo pasa por aquí.
 */

/** Cliente central de OpenAI */
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    // Cuerpo de la request
    const { query, uploadedFiles = [] } = await req.json();
    console.log("📥 uploadedFiles:", uploadedFiles);
    console.log("Incoming query:", query);

    // ------------------------------------------------------------
    // 1) SESIÓN: leemos la cookie "sessionId"
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
    // 2) MÁQUINA DE ESTADOS DEL USUARIO
    // ------------------------------------------------------------
    /**
     * Determina en qué estado está el usuario:
     *
     * - UNAUTHENTICATED       → sin sesión
     * - REGISTERING           → creando cuenta
     * - LOGGING_IN            → autenticándose
     * - AUTHENTICATED         → sesión normal
     * - LOGGING_OUT           → cerrando sesión
     */
    const state = getNextState(user, query);
    console.log("🧠 Estado detectado:", state);

    // ------------------------------------------------------------
    // 3) DETECCIÓN DE DOMINIO DEL MENSAJE
    // ------------------------------------------------------------
    /**
     * detectDomainLLM permite identificar:
     * - "memory"  → quiere recordar/datos personales
     * - "auth"    → login / datos sensibles
     * - "casual"  → conversación normal
     */
    const domain = await detectDomainLLM(query);
    console.log("🧭 Dominio detectado:", domain);

    // ------------------------------------------------------------
    // 4) Construcción del SYSTEM PROMPT dinámico
    // ------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(state, domain, user);

    // ------------------------------------------------------------
    // 5) Historial reciente del usuario
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

    // Guardar el mensaje en DB
    await prisma.message.create({
      data: {
        role: "user",
        content: query,
        userId: user?.id ?? null,
      },
    });

    // Releer historial completo y sanitizarlo
    const historyFromDB = user
      ? await prisma.message.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const safeHistory = sanitizeMessages(historyFromDB);

    // ------------------------------------------------------------
    // 6) Contexto dinámico enriquecido (memorias + análisis)
    // ------------------------------------------------------------
    const dynamicContext = await buildDynamicContext(user, query);

    // Mensaje especial para archivos subidos por el usuario
    const uploadedFilesSystemMessage = buildUploadedFilesSystemMessage(uploadedFiles);

    // ------------------------------------------------------------
    // 7) PRIMERA LLAMADA AL MODELO
    // ------------------------------------------------------------
    /**
     * Esta llamada ejecuta:
     * - razonamiento inicial
     * - decide si invocar herramientas
     * - planifica respuesta
     */
    const first = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: dynamicContext },
        ...(uploadedFilesSystemMessage ? [uploadedFilesSystemMessage] : []),
        ...safeHistory,
        { role: "user", content: query },
      ],
      tools,
      tool_choice: "auto",
    });

    const msg = first.choices[0].message;

    // ------------------------------------------------------------
    // 8) MANEJO DE tool_calls
    // ------------------------------------------------------------
    /**
     * Si el modelo invoca herramientas, ejecutamos sus funciones
     * y luego hacemos una segunda llamada al modelo pasándole
     * los resultados.
     */
    if (msg.tool_calls?.length) {
      let justLoggedInUser = null;

      const results = await Promise.all(
        msg.tool_calls.map(async (call: any) => {
          const args = JSON.parse(call.function.arguments || "{}");

          // Ejecutar herramienta real
          const result = await runTool(call.function.name, {
            ...args,
            userId: user?.id ?? null,
          });

          // Si se acaba de loguear → preparar nuevo STATE PROMPT
          if (call.function.name === "authenticateUser" && result.authenticated) {
            justLoggedInUser = {
              id: result.userId,
              name: result.name,
              code: result.code,
            };
          }

          // Crear sesión persistente si corresponde
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
      // 9) SEGUNDA LLAMADA DEL MODELO
      // ------------------------------------------------------------
      /**
       * El modelo ahora recibe:
       * - prompt actualizado (si hubo login)
       * - input original
       * - tool_call original
       * - resultados de herramientas
       */
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

      // Persistir respuesta del assistant
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
    // 10) RESPUESTA DIRECTA SIN HERRAMIENTAS
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
