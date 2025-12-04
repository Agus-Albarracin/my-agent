import { NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma-client";
import { uploadFileToVectorStore } from "@/services/rag-services";
import os from "os";
import path from "path";
import fs from "fs";
import { ragQuery } from "@/services/rag-services";
import { cookies } from "next/headers";

/**
 * ============================================================
 * 📄 POST /api/documents
 * ============================================================
 * Sube un archivo al servidor, lo procesa con OpenAI Vector Store
 * (RAG), lo guarda en la base de datos y devuelve un resumen del mismo.
 *
 * FLUJO:
 * 1. Verifica que exista una sesión activa.
 * 2. Obtiene el usuario asociado al sessionId.
 * 3. Lee `multipart/form-data` para recibir el archivo.
 * 4. Guarda el archivo temporalmente en el filesystem.
 * 5. Envía el archivo al Vector Store (OpenAI hace embeddings + chunking).
 * 6. Registra el documento en la base de datos.
 * 7. Ejecuta un resumen automático vía RAG.
 * 8. Devuelve el ID del documento, el Vector Store y el resumen generado.
 *
 * RESPUESTAS:
 *  - 200: subida exitosa + resumen RAG.
 *  - 400: archivo faltante o inválido.
 *  - 401: sesión inválida o inexistente.
 *  - 500: error interno.
 */
export const POST = async (request: Request) => {
  console.log("📄 POST /api/documents - Inicio");

  // ============================================================
  // 🔐 1. Validar sesión usando cookie "sessionId"
  // ============================================================
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value || null;

  if (!sessionId) {
    return NextResponse.json({ error: "No hay sesión activa, login requerido" }, { status: 401 });
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionId },
    include: { user: true },
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Sesión inválida o usuario no encontrado" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const contentType = request.headers.get("content-type") || "";

    let title = "";
    let metadata: any = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let fileMime = "";

    // ============================================================
    // 📦 2. Manejo de multipart/form-data
    // ============================================================
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "Debe subir un archivo" }, { status: 400 });
      }

      title = (form.get("title") as string) || file.name;

      // Convertir File → Buffer
      const buffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(buffer);

      fileName = file.name;
      fileMime = file.type;
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 });
    }

    // ============================================================
    // 💾 3. Guardado temporal en /tmp (necesario para streaming)
    // ============================================================
    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, fileBuffer);

    console.log("📤 Subiendo archivo al Vector Store...");

    // ============================================================
    // 🧠 4. Subir archivo al Vector Store (RAG encoding)
    // ============================================================
    const vectorStoreId = await uploadFileToVectorStore(userId, tempPath);

    console.log("✨ Archivo procesado en Vector Store:", vectorStoreId);

    // ============================================================
    // 🗄 5. Guardar metadatos del documento en la base de datos
    // ============================================================
    const doc = await prisma.document.create({
      data: {
        userId,
        title,
        openaiFileId: fileName,
        size: fileBuffer.length,
        mimeType: fileMime,
        vectorStoreId,
        metadata,
      },
    });

    // ============================================================
    // 🤖 6. Resumen automático usando RAG
    // ============================================================
    const summary = await ragQuery(
      userId,
      `Resumí el nuevo documento "${title}" en 10 puntos clave.`
    );

    // ============================================================
    // 📤 7. Respuesta final
    // ============================================================
    return NextResponse.json({
      success: true,
      documentId: doc.id,
      vectorStoreId,
      summary,
    });
  } catch (error) {
    console.error("❌ Error en POST /api/documents:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
};

/**
 * ============================================================
 * 📄 GET /api/documents
 * ============================================================
 * Obtiene el listado de todos los documentos almacenados.
 *
 * - Ordenados por fecha (más recientes primero).
 * - NO requiere autenticación (dependiendo de tu diseño actual).
 *
 * RESPUESTAS:
 *  - 200: lista de documentos.
 *  - 500: error interno.
 */
export const GET = async () => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      documents,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
};
