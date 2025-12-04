import fs from "fs";
import OpenAI from "openai";
import { prisma } from "@/prisma/prisma-client";

let openai: OpenAI | null = null;

/**
 * ============================================================
 * 🔌 getClient()
 * ============================================================
 */
export function getClient() {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");
    openai = new OpenAI({ apiKey: key });
  }
  return openai;
}

/**
 * ============================================================
 * 📦 getOrCreateVectorStoreForUser()
 * ============================================================
 */
export async function getOrCreateVectorStoreForUser(userId: string) {
  const client = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vectorStoreId: true },
  });

  if (user?.vectorStoreId) {
    return user.vectorStoreId;
  }

  const store = await client.vectorStores.create({
    name: `user-${userId}-store`,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { vectorStoreId: store.id },
    select: { id: true },
  });

  return store.id;
}

/**
 * ============================================================
 * 📤 uploadFileToVectorStore()
 * ============================================================
 */
export async function uploadFileToVectorStore(userId: string, filePath: string) {
  const client = getClient();
  const vectorStoreId = await getOrCreateVectorStoreForUser(userId);

  // 📌 Subimos el archivo PERO NO esperamos procesamiento
  const batch = await client.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, {
    files: [fs.createReadStream(filePath)],
  });

  // ⏱️ Esto devuelve en ~150ms
  return {
    vectorStoreId,
    fileBatchId: batch.id,
    status: "processing",        // <- útil para logging
  };
}
/**
 * ============================================================
 * 🔍 ragQuery()
 * ============================================================
 */
export async function ragQuery(userId: string, query: string) {
  const client = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vectorStoreId: true },
  });

  if (!user?.vectorStoreId) {
    return "Todavía no subiste documentos para usar RAG.";
  }

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: query,
    tools: [
      {
        type: "file_search",
        vector_store_ids: [user.vectorStoreId],
      },
    ],
  });

  return response.output_text;
}

/**
 * ============================================================
 * 🕵️ searchDocuments()
 * ============================================================
 */
export async function searchDocuments(userId: string, query: string, topK = 5) {
  const client = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vectorStoreId: true },
  });

  if (!user?.vectorStoreId) {
    return [];
  }

  const results = await client.vectorStores.search(user.vectorStoreId, {
    query,
    max_num_results: topK,
  });

  return results.data.map((item: any) => ({
    fileId: item.file_id,
    filename: item.filename,
    score: item.score,
    content: item.content?.map((c: any) => c.text).join("\n"),
    attributes: item.attributes ?? {},
  }));
}

/**
 * ============================================================
 * 📝 summarizeLastDocument()
 * ============================================================
 */
export async function summarizeLastDocument(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vectorStoreId: true },
  });

  if (!user?.vectorStoreId) {
    return "Todavía no subiste documentos.";
  }

  const lastDoc = await prisma.document.findFirst({
    where: { vectorStoreId: user.vectorStoreId },
    orderBy: { createdAt: "desc" },
    select: { title: true },
  });

  if (!lastDoc) return "No encontré documentos.";

  return ragQuery(userId, `Resumí el documento "${lastDoc.title}"`);
}
