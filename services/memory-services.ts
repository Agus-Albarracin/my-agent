// services/memory.service.ts
import { prisma } from "@/prisma/prisma-client";
import { cookies } from "next/headers";

/**
 * Normaliza claves de memoria.
 * Convierte a formato determinístico: "papa_auto_marca"
 */
export function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Obtiene el userId actual desde la cookie de sesión
 */
async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionId },
  });

  return session?.userId ?? null;
}

/**
 * Guarda o actualiza un dato de memoria del usuario.
 *
 * Reemplaza completamente el viejo sistema basado en `Message`.
 */
export async function saveMemory(key: string, value: string) {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, message: "No hay sesión activa." };

  const finalKey = normalizeKey(key);

  await prisma.memory.upsert({
    where: { userId_key: { userId, key: finalKey } },
    update: { value },
    create: { userId, key: finalKey, value },
  });

  return { success: true, key: finalKey, value };
}

/**
 * Recupera memoria por clave.
 *
 * Devuelve:
 *  - null si no existe
 *  - string si existe
 */
export async function getMemory(key: string) {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const finalKey = normalizeKey(key);

  const row = await prisma.memory.findUnique({
    where: { userId_key: { userId, key: finalKey } },
  });

  return row?.value ?? null;
}

/**
 * Devuelve TODAS las memorias del usuario actual.
 * Útil para depurar, pero normalmente no se usa en producción.
 */
export async function getAllMemories() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  return prisma.memory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}
