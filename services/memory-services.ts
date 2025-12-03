// services/memory.service.ts
import { prisma } from "@/prisma/prisma-client";
import { cookies } from "next/headers";

// Normaliza claves como: usuario.color_favorito / hermano.auto_color
const normalizeKey = (key: string) => key.toLowerCase().trim();

/**
 * Guarda memoria en la tabla Message como tipo "assistant"
 */
export async function saveMemory(key: string, value: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (!sessionId) return { success: false, message: "No hay sesión activa." };

  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionId },
  });

  if (!session) return { success: false, message: "Sesión inválida." };

  const finalKey = normalizeKey(key);

  // Buscar si ya existe ese dato
  const existing = await prisma.message.findFirst({
    where: { userId: session.userId, key: finalKey },
  });

  if (existing) {
    await prisma.message.update({
      where: { id: existing.id },
      data: { value },
    });
  } else {
    await prisma.message.create({
      data: {
        userId: session.userId,
        role: "memory",
        key: finalKey,
        value,
        content: "",
      },
    });
  }

  return { success: true, key: finalKey, value };
}

/**
 * Recupera memoria desde la tabla Message
 */
export async function getMemory(key: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (!sessionId) return { found: false, message: "No hay sesión activa." };

  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionId },
  });

  if (!session) return { found: false, message: "Sesión inválida." };

  const finalKey = normalizeKey(key);

  const data = await prisma.message.findFirst({
    where: { userId: session.userId, key: finalKey },
  });

  if (!data) return { found: false, message: "Dato no encontrado." };

  return { found: true, key: finalKey, value: data.value };
}
