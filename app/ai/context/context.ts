import OpenAI from "openai";
import { prisma } from "@/prisma/prisma-client";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function buildDynamicContext(user: any, query: string) {
  if (!user) return "";

  // Traemos todo el historial útil
  const messages = await prisma.message.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 50, // ← configurable
  });

  // Traemos memorias
  const memories = await prisma.memory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const memoryText = memories.map((m) => `${m.key}: ${m.value}`).join("\n");
  const historyText = messages
    .filter((m) => m.role !== "memory")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Pedimos a GPT que produzca un mini contexto NATURAL
  const extraction = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Tu tarea es generar un BREVE contexto en texto plano que ayude al modelo
a entender la situación actual. NO inventes nada.

Instrucciones:
- Resume SOLO lo relevante para entender la pregunta actual.
- Incluye pequeñas referencias a memorias útiles si aportan contexto.
- NO incluyas datos irrelevantes.
- NO mezcles temas.
- NO des recomendaciones.
- NO respondas al usuario.
- Producí un texto breve (máximo 3-5 oraciones).
`,
      },
      {
        role: "assistant",
        content: `
MEMORIAS DEL USUARIO:
${memoryText || "(no hay memorias guardadas)"}

HISTORIAL RECIENTE:
${historyText || "(no hay historial previo)"}
`,
      },
      {
        role: "user",
        content: `Generá contexto para responder: "${query}"`,
      },
    ],
  });

  const context = extraction.choices[0].message?.content || "";

  return `
=== CONTEXTO DINÁMICO ===
${context.trim()}
=========================
  `.trim();
}
