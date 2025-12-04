import { prisma } from "@/prisma/prisma-client";

export async function buildDynamicContext(user: any) {
 if (!user) return "";

  // Buscar en paralelo (rápido)
  const [messages, memories] = await Promise.all([
    prisma.message.findMany({
      where: { userId: user.id, role: { not: "memory" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { role: true, content: true },
    }),

    prisma.memory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { key: true, value: true },
    }),
  ]);

  const memoryText =
    memories.length > 0
      ? memories.map((m) => `${m.key}: ${m.value}`).join(" | ")
      : "";

  const historyText = messages
    .slice()
    .reverse()
    .map((m) => `${m.role}: ${m.content}`)
    .join(" || ");

  return `
=== CONTEXTO DINÁMICO (SIN LLM) ===
Usuario: ${user.name}
Memorias: ${memoryText || "(ninguna)"}
Historial reciente: ${historyText || "(vacío)"}
====================================
  `.trim();
}
