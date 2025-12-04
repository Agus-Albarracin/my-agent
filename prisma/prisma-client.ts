import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma client
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"], //agregar "query", para ver consultas
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
