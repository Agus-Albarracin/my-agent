import { NextResponse } from "next/server";
import OpenAI from "openai";
import { tools } from "./tools";
import { runTool } from "./runTools";
import { prisma } from "@/prisma/prisma-client";
import { cookies } from "next/headers";
import crypto from "crypto";

// Máquina de estados + prompts
import { getNextState } from "@/app/ai/state-machine";
import { getPromptForState } from "@/app/ai/getPromt";
import { promptAuthenticated } from "@/app/ai/prompts";

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

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable de entorno OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const { query } = await req.json();
    console.log("Incoming query:", query);

    // ==============================================================
    // 🔐 0) Leer sesión desde cookie
    // ==============================================================
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

    // ==============================================================
    // MÁQUINA DE ESTADOS
    // ==============================================================
    const state = getNextState(user, query);
    console.log("🧠 Estado detectado:", state);

    // ==============================================================
    // PROMPT SEGÚN ESTADO
    // ==============================================================
    const systemPrompt = getPromptForState(state, user);

    // ============================================================
    // 1) Recrear context y enviar historial.
    // ============================================================

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

    // Guardar el nuevo mensaje del usuario en la base
    await prisma.message.create({
      data: {
        role: "user",
        content: query,
        userId: user?.id ?? null,
      },
    });

    const historyFromDB = user
      ? await prisma.message.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        })
      : [];

    // 2) Sanear historial (elimina nulls y role memory)
    const safeHistory = sanitizeMessages(historyFromDB);

    // ============================================================
    // 1) Primera llamada
    // ============================================================

    const first = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...safeHistory,
        { role: "user", content: query },
      ],
      tools,
      tool_choice: "auto",
    });

    const msg = first.choices[0].message;

    // ============================================================
    // 2) Si GPT quiere llamar a herramientas
    // ============================================================
    if (msg.tool_calls?.length) {
      let justLoggedInUser = null;

      const results = await Promise.all(
        msg.tool_calls.map(async (call: any) => {
          const args = JSON.parse(call.function.arguments || "{}");
          const result = await runTool(call.function.name, args);

          // Detecta login exitoso
          if (call.function.name === "authenticateUser" && result.authenticated) {
            justLoggedInUser = {
              id: result.userId,
              name: result.name,
              code: result.code,
            };
          }

          // Crear sesión (excepto logout)
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

      // ============================================================
      // 3) Segunda llamada
      // ============================================================

      // Si se acaba de loguear → promptAuthenticated
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

      return NextResponse.json({
        answer: final.choices[0].message?.content,
        trace: {
          tool_calls: msg.tool_calls,
          results,
        },
      });
    }

    // ============================================================
    // 4) Si no hay tool call → respuesta directa
    // ============================================================
    return NextResponse.json({ answer: msg.content });
  } catch (err: any) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
