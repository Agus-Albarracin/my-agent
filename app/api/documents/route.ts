import { NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma-client";
import { uploadFileToVectorStore, ragQuery } from "@/services/rag-services";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { cookies } from "next/headers";

export const POST = async (request: Request) => {
  console.log("📄 POST /api/documents - Inicio");

  // ============================================================
  // 🔐 1. Validar sesión
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
    const contentType = request.headers.get("content-type") || "";
    let title = "";
    let metadata: any = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let fileMime = "";

    // ============================================================
    // 📦 2. Procesar multipart/form-data (opt)
    // ============================================================
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "Debe subir un archivo" },
          { status: 400 }
        );
      }

      title = (form.get("title") as string) || file.name;

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
    // 💾 3. Guardar archivo temporal (NO bloqueante)
    // ============================================================
    const tempPath = path.join(os.tmpdir(), fileName);
    await fs.writeFile(tempPath, fileBuffer);

    // ============================================================
    // ⚡ 4. Ejecutar Upload + RAG en paralelo
    // ============================================================
    const [vectorStoreId, summary] = await Promise.all([
      uploadFileToVectorStore(userId, tempPath),
      ragQuery(
        userId,
        `Resumí el nuevo documento "${title}" en 10 puntos clave.`
      ),
    ]);

    // ============================================================
    // 🗄 5. Guardar documento
    // ============================================================
    const doc = await prisma.document.create({
      data: {
        userId,
        title,
        openaiFileId: fileName,
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
    // 📤 6. Respuesta final
    // ============================================================
    return NextResponse.json({
      success: true,
      documentId: doc.id,
      vectorStoreId: doc.vectorStoreId,
      summary,
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
