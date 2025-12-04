// services/messages.service.ts
import { prisma } from "@/prisma/prisma-client";

export async function saveMessage(userId: string | null, role: string, content: string) {
  return prisma.message.create({
    data: {
      userId,
      role,
      content,
    },
  });
}

export async function getLastMessages(userId: string | null) {
  if (!userId) return [];

  const msgs = await prisma.message.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 20, // solo los últimos 20 para optimizar
  });

  return msgs.map((m: any) => ({
    role: m.role as any,
    content: m.content,
  }));
}
