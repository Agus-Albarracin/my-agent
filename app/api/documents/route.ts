import { NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma-client";
import { uploadFileToVectorStore } from "@/services/rag-services";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { cookies } from "next/headers";
import { uploadOpenAIFileService } from "@/app/ai/utils/openai-utils";

/**
 * ============================================================
 * 📄 POST /api/documents
 * Sube un archivo, lo almacena temporalmente, lo envía a la
 * vector store y también a OpenAI. Finalmente crea un registro
 * en la base de datos asociado al usuario autenticado.
 * ============================================================
 */
export const POST = async (request: Request) => {
  console.log("📄 POST /api/documents - Inicio");

  // ============================================================
  // 🔐 1. Validar sesión del usuario
  // Obtiene la cookie sessionId → busca la sesión en DB.
  // Si no existe o no tiene userId, se rechaza el request.
  // ============================================================
  const sessionId = (await cookies()).get("sessionId")?.value ?? null;

  if (!sessionId) {
    return NextResponse.json(
      { error: "No hay sesión activa" },
      { status: 401 }
    );
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken: sessionId },
    select: { userId: true },
  });

  if (!session?.userId) {
    return NextResponse.json(
      { error: "Sesión inválida o usuario no encontrado" },
      { status: 401 }
    );
  }

  const userId = session.userId;

  try {
    // ============================================================
    // 📦 2. Leer datos de multipart/form-data
    // Extrae archivo, título, tipo MIME y crea un buffer.
    // Si no hay archivo → 400.
    // ============================================================
    const contentType = request.headers.get("content-type") || "";
    let title = "";
    let metadata: any = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let fileMime = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "Debe subir un archivo" },
          { status: 400 }
        );
      }

      // Título opcional, cae en el nombre del archivo
      title = (form.get("title") as string) || file.name;

      // Convertir a Buffer
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      fileName = file.name;
      fileMime = file.type;
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: "No se pudo leer el archivo" },
        { status: 400 }
      );
    }

    // ============================================================
    // 💾 3. Guardar archivo temporal
    // Se almacena en /tmp del sistema para su posterior uso
    // con la vector store y OpenAI.
    // ============================================================
    const tempPath = path.join(os.tmpdir(), fileName);
    await fs.writeFile(tempPath, fileBuffer);

    // ============================================================
    // ⚡ 4. Procesamiento paralelo
    // - Se sube a la vector store (embedding / chunks)
    // - Se sube el archivo a OpenAI (user_data)
    // ============================================================
    await uploadFileToVectorStore(userId, tempPath);

    // const summary = await ragQuery(
    //   userId,
    //   `Resumí el nuevo documento "${title}" en 10 puntos clave.`
    // );

    const uploaded = await uploadOpenAIFileService(tempPath, fileName);

    // ============================================================
    // 🗄 5. Crear registro del documento en la base de datos
    // Se guarda la metadata del archivo y su openaiFileId.
    // ============================================================
    const doc = await prisma.document.create({
      data: {
        userId,
        title,
        openaiFileId: uploaded.openaiFileId,
        size: fileBuffer.length,
        mimeType: fileMime,
        vectorStoreId: "pending",
        metadata,
      },
      select: {
        id: true,
        vectorStoreId: true,
      },
    });

    // ============================================================
    // 📤 6. Respuesta final al cliente
    // Devuelve el ID del documento y el estado inicial de la
    // vector store. (summary opcional)
    // ============================================================
    return NextResponse.json({
      success: true,
      documentId: doc.id,
      vectorStoreId: doc.vectorStoreId,
      // summary,
    });
  } catch (error) {
    console.error("❌ Error en POST /api/documents:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
};

/**
 * ============================================================
 * 📄 GET /api/documents
 * Devuelve la lista de documentos almacenados, ordenados por
 * fecha de creación descendente.
 * ============================================================
 */
export const GET = async () => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        size: true,
        mimeType: true,
        openaiFileId: true,
        vectorStoreId: true,
        metadata: true,
      },
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
