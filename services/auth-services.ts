// services/auth.service.ts
import { prisma } from "@/prisma/prisma-client";
import { cookies } from "next/headers";

// ---- REGISTRO / saveUserInfo ----
export async function registerUser(name: string, code: string) {
  const existing = await prisma.user.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (existing) {
    return {
      userId: existing.id,
      message: `Bienvenido!!! ${existing.name}, ¿en qué puedo ayudarte hoy?`,
    };
  }

  const user = await prisma.user.create({
    data: { name, code },
    select: { id: true, name: true },
  });

  return {
    userId: user.id,
    message: `Tu usuario ${name} se registró correctamente y ha iniciado sesión.`,
  };
}

// ---- LOGIN / authenticateUser ----
export async function authenticateUser(name: string, code: string) {
  const user = await prisma.user.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      code,
    },
    select: { id: true, name: true, code: true },
  });

  if (!user) {
    return {
      authenticated: false,
      message: "Nombre o código incorrecto.",
    };
  }

  return {
    authenticated: true,
    userId: user.id,
    name: user.name,
    code: user.code,
    message: `Bienvenido ${user.name}!`,
  };
}

// ---- LOGOUT ----
export async function logoutUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (!sessionId) {
    return { loggedOut: false, message: "No hay sesión activa para cerrar." };
  }

  await prisma.session.deleteMany({
    where: { sessionToken: sessionId },
  });

  cookieStore.set({
    name: "sessionId",
    value: "",
    maxAge: 0,
    path: "/",
  });

  return { loggedOut: true, message: "Has cerrado sesión correctamente." };
}
