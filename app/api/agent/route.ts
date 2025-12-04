import { NextResponse } from "next/server";
import OpenAI from "openai";
import { tools } from "./tools";
import { runTool } from "./runTools";
import { prisma } from "@/prisma/prisma-client";
import { cookies } from "next/headers";
import crypto from "crypto";

// Arquitectura interna del asistente
import { getNextState } from "@/app/ai/state-machine";
import { promptAuthenticated } from "@/app/ai/prompts";
import { detectDomainLLM } from "@/app/ai/router";
import { buildSystemPrompt } from "@/app/ai/buildPromts";

// Contexto dinámico (memorias + historial reciente)
import { buildDynamicContext } from "@/app/ai/context/context";

// Sanitización y mensajes especiales para archivos
import { buildUploadedFilesSystemMessage } from "@/app/ai/utils/openai-utils";

/** Cliente OpenAI */
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * ============================================================================
 * POST /api/agent
 * ============================================================================
 * Endpoint principal que procesa cada mensaje enviado desde el chat.
 *
 * Responsabilidades:
 * - Manejar sesión del usuario
 * - Definir estado conversacional (login/register/auth/logout)
 * - Detectar dominio semántico (casual, auth, memory)
 * - Construir el SYSTEM PROMPT dinámico para el modelo
 * - Ejecutar tools si el modelo las solicita (RAG, auth, memoria…)
 * - Realizar streaming token-por-token hacia el frontend
 * - Persistir historial de la conversación
 */
export async function POST(req: Request) {
  try {
    // ------------------------------------------------------------------------
    // 0) Validación mínima de seguridad
    // ------------------------------------------------------------------------
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Falta la variable OPENAI_API_KEY" }, { status: 500 });
    }

    // Input del usuario (texto + archivos procesados antes)
    const { query, uploadedFiles = [] } = await req.json();
    console.log("📥 uploadedFiles:", uploadedFiles);

    // ------------------------------------------------------------------------
    // 1) SESIÓN — Intentar obtener el usuario autenticado
    // ------------------------------------------------------------------------
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value ?? null;

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
    }

    // ------------------------------------------------------------------------
    // 2) MÁQUINA DE ESTADOS — Determina intención del usuario
    // ------------------------------------------------------------------------
    const state = getNextState(user, query);
    console.log("🧠 Estado detectado:", state);

    // ------------------------------------------------------------------------
    // 3) DETECCIÓN DE DOMINIO — Contexto semántico
    // ------------------------------------------------------------------------
    const domain = await detectDomainLLM(query);
    console.log("🧭 Dominio detectado:", domain);

    // ------------------------------------------------------------------------
    // 4) Construcción del SYSTEM PROMPT
    //    Combina: reglas globales + estado + dominio + tools
    // ------------------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(state, domain, user);

    // Guardar mensaje del usuario
    prisma.message.create({
      data: { role: "user", content: query, userId: user?.id ?? null },
    });

    // ------------------------------------------------------------------------
    // 6) CONTEXTO DINÁMICO (ultra rápido, sin LLM)
    //    Memorias + historial reciente del usuario
    // ------------------------------------------------------------------------
    const dynamicContext = await buildDynamicContext(user);

    // Mensaje especial si se enviaron archivos
    const uploadedFilesSystemMessage = buildUploadedFilesSystemMessage(uploadedFiles);

    // ------------------------------------------------------------------------
    // 7) PRIMERA LLAMADA — Razonamiento + tool_choice
    // ------------------------------------------------------------------------
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: dynamicContext },
    ];

    if (uploadedFilesSystemMessage) {
      messages.push(uploadedFilesSystemMessage);
    }

    messages.push({ role: "user", content: query });

    const first = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
    });

    const msg = first.choices[0].message;

    // ------------------------------------------------------------------------
    // 8) TOOL CALLS — El modelo decidió ejecutar herramientas
    // ------------------------------------------------------------------------
    let justLoggedInUser = null;
    let results: any[] = [];
    const toolCalls = msg.tool_calls ?? [];

    if (toolCalls.length > 0) {
      results = await Promise.all(
        toolCalls.map(async (call: any) => {
          const args = JSON.parse(call.function.arguments || "{}");

          // Ejecutar herramienta real
          const result = await runTool(call.function.name, {
            ...args,
            userId: user?.id ?? null,
          });

          // Caso especial: usuario recién autenticado
          if (call.function.name === "authenticateUser" && result.authenticated) {
            justLoggedInUser = {
              id: result.userId,
              name: result.name,
              code: result.code,
            };
          }

          // Crear nueva sesión si corresponde
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
    }

    // ------------------------------------------------------------------------
    // 9) SEGUNDA LLAMADA — SIEMPRE STREAMING
    // ------------------------------------------------------------------------
    const secondSystemPrompt = justLoggedInUser
      ? promptAuthenticated(justLoggedInUser)
      : systemPrompt;

    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
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

    // STREAM al frontend
    let fullText = "";
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }

        // Persistir respuesta del asistente
        await prisma.message.create({
          data: {
            role: "assistant",
            content: fullText,
            userId: user?.id ?? null,
          },
        });

        controller.close();
      },
    });

    // Respuesta final (STREAM)
    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
