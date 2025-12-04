import fs from "fs";
import OpenAI from "openai";
import { prisma } from "@/prisma/prisma-client";
import { analyzeFilesService } from "@/app/ai/utils/openai-utils";

let openai: OpenAI | null = null;

/* ============================================================
 * 🔌 getClient()
 * Obtiene o inicializa el cliente de OpenAI (singleton).
 * ============================================================ */
export function getClient() {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");

    openai = new OpenAI({ apiKey: key });
  }

  return openai;
}

/* ============================================================
 * 📦 getOrCreateVectorStoreForUser()
 * Devuelve el ID de la Vector Store del usuario.
 * Si no tiene una, crea una nueva y la asocia en la BD.
 * ============================================================ */
export async function getOrCreateVectorStoreForUser(userId: string) {
  const client = getClient();

  // Verificar si el usuario ya tiene una vector store
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vectorStoreId: true },
  });

  if (user?.vectorStoreId) {
    return user.vectorStoreId;
  }

  // Crear nueva vector store para el usuario
  const store = await client.vectorStores.create({
    name: `user-${userId}-store`,
  });

  // Asociarla en BD
  await prisma.user.update({
    where: { id: userId },
    data: { vectorStoreId: store.id },
  });

  return store.id;
}

/* ============================================================
 * 📤 uploadFileToVectorStore()
 * Sube un archivo a la Vector Store del usuario.
 * NO espera a que el procesamiento finalice (es async en OpenAI).
 * ============================================================ */
export async function uploadFileToVectorStore(userId: string, filePath: string) {
  const client = getClient();
  const vectorStoreId = await getOrCreateVectorStoreForUser(userId);

  // Subida del archivo a la vector store
  const batch = await client.vectorStores.fileBatches.uploadAndPoll(
    vectorStoreId,
    { files: [fs.createReadStream(filePath)] }
  );

  return {
    vectorStoreId,
    fileBatchId: batch.id,
    status: "processing", // útil para monitoreo o logs
  };
}

/* ============================================================
 * 🔍 ragQuery()
 * Ejecuta una búsqueda RAG usando la vector store del usuario.
 * Devuelve texto generado por el modelo.
 * ============================================================ */
export async function ragQuery(userId: string, query: string) {
  const client = getClient();

  // Obtener vector store del usuario
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vectorStoreId: true },
  });

  if (!user?.vectorStoreId) {
    return "Todavía no subiste documentos para usar RAG.";
  }

  // Query con file_search + vector store
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

/* ============================================================
 * 🕵️ searchDocuments()
 * Realiza una búsqueda semántica dentro de la Vector Store.
 * Devuelve los resultados con score, contenido y metadata.
 * ============================================================ */
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

/* ============================================================
 * 📝 summarizeLastDocument()
 * Resume o analiza el último documento subido por el usuario
 * usando analyzeFilesService().
 * ============================================================ */
export async function summarizeLastDocument(userId: string, query: string) {
  // Buscar el documento más reciente
  const lastDoc = await prisma.document.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { openaiFileId: true },
  });

  if (!lastDoc) {
    return "Todavía no subiste archivos.";
  }

  // Analizar usando la API de archivos de OpenAI
  return analyzeFilesService(
    [{ openaiFileId: lastDoc.openaiFileId }],
    query
  );
}
