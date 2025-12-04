import fs from "fs";
import OpenAI from "openai";
import { prisma } from "@/prisma/prisma-client";

let openai: OpenAI | null = null;

/**
 * ============================================================
 * 🔌 getClient()
 * ============================================================
 * Devuelve una instancia singleton del cliente de OpenAI.
 *
 * - Evita inicializar el cliente en cada request.
 * - Toma la API Key desde variables de entorno.
 * - Si falta la API key, se lanza un error explícito.
 *
 * @returns {OpenAI} Cliente OpenAI inicializado.
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
 * Obtiene el Vector Store asociado al usuario.
 * Si no existe, crea uno nuevo en OpenAI y lo guarda en la DB.
 *
 * Flujo:
 * 1. Busca el usuario en prisma.
 * 2. Si ya tiene vectorStoreId → lo devuelve.
 * 3. Si NO, crea un vector store en OpenAI.
 * 4. Guarda el ID del nuevo vector store en el usuario.
 *
 * @param {string} userId - ID del usuario en la base de datos.
 * @returns {Promise<string>} ID del vector store.
 */
export async function getOrCreateVectorStoreForUser(userId: string) {
  const client = getClient();

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user?.vectorStoreId) {
    return user.vectorStoreId;
  }

  // Crear nuevo vector store para este usuario
  const store = await client.vectorStores.create({
    name: `user-${userId}-store`,
  });

  // Guardar ID en la BD
  await prisma.user.update({
    where: { id: userId },
    data: { vectorStoreId: store.id },
  });

  return store.id;
}

/**
 * ============================================================
 * 📤 uploadFileToVectorStore()
 * ============================================================
 * Sube un archivo al vector store del usuario.
 *
 * - OpenAI se encarga del chunking y embeddings automáticamente.
 * - Usa `uploadAndPoll`, que espera a que el procesamiento termine.
 *
 * @param {string} userId - ID del usuario dueño del vector store.
 * @param {string} filePath - Ruta del archivo local a subir.
 * @returns {Promise<string>} ID del vector store usado.
 */
export async function uploadFileToVectorStore(userId: string, filePath: string) {
  const client = getClient();
  const vectorStoreId = await getOrCreateVectorStoreForUser(userId);

  // Subir archivo al vector store
  await client.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, {
    files: [fs.createReadStream(filePath)],
  });

  return vectorStoreId;
}

/**
 * ============================================================
 * 🔍 ragQuery()
 * ============================================================
 * Ejecuta una consulta RAG usando el `file_search` tool.
 *
 * - Pregunta al modelo.
 * - El modelo puede usar el vector store para buscar contexto.
 * - Devuelve un texto final que mezcla modelo + documentos.
 *
 * @param {string} userId - Usuario dueño del vector store.
 * @param {string} query - Pregunta del usuario.
 * @returns {Promise<string>} Respuesta generada por RAG.
 */
export async function ragQuery(userId: string, query: string) {
  const client = getClient();

  const user = await prisma.user.findUnique({ where: { id: userId } });

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
 * Realiza una búsqueda vectorial manual en el vector store.
 *
 * - Devuelve los documentos más similares (topK).
 * - Útil para previews, listados, o dashboards.
 *
 * @param {string} userId - Usuario dueño del vector store.
 * @param {string} query - Texto a buscar.
 * @param {number} [topK=5] - Cantidad de resultados deseados.
 * @returns {Promise<Array>} Lista de documentos relevantes.
 */
export async function searchDocuments(userId: string, query: string, topK = 5) {
  const client = getClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
 * Resume el último documento subido por el usuario.
 *
 * Flujo:
 * 1. Verifica si el usuario tiene vector store.
 * 2. Busca el último documento asociado.
 * 3. Ejecuta una consulta RAG pidiendo el resumen.
 *
 * @param {string} userId - Usuario dueño de los documentos.
 * @returns {Promise<string>} Resumen del documento.
 */
export async function summarizeLastDocument(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.vectorStoreId) {
    return "Todavía no subiste documentos.";
  }

  const lastDoc = await prisma.document.findFirst({
    where: { vectorStoreId: user.vectorStoreId },
    orderBy: { createdAt: "desc" },
  });

  if (!lastDoc) return "No encontré documentos.";

  return ragQuery(userId, `Resumí el documento "${lastDoc.title}"`);
}
