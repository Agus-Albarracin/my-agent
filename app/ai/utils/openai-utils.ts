import OpenAI from "openai";
import fs from "fs";

let openai: OpenAI | null = null;

/**
 * getClient()
 * ------------
 * Devuelve una única instancia (singleton) del cliente de OpenAI.
 *
 * Razones para usar este patrón:
 * - Evita crear múltiples clientes innecesariamente.
 * - Reduce riesgo de fugas de memoria o conexiones duplicadas.
 * - Garantiza que la API key se toma solo una vez.
 *
 * @throws Error si falta la variable OPENAI_API_KEY
 */
const getClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY missing");
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

// ------------------------------------------------------------------
// 🔼 SUBIR ARCHIVO A OPENAI (sin parsear, sin procesar)
// ------------------------------------------------------------------

/**
 * uploadOpenAIFileService()
 * --------------------------
 * Sube un archivo directamente al File Storage de OpenAI.
 *
 * Este método:
 * - No analiza el archivo.
 * - No intenta interpretarlo.
 * - Solo lo sube tal cual.
 *
 * OpenAI lo guarda con propósito "user_data", que es obligatorio
 * según la documentación del endpoint.
 *
 * @param filePath - Ruta absoluta al archivo temporal en el servidor
 * @param filename - Nombre original del archivo (solo para referencia)
 * @returns openaiFileId, nombre y cantidad de bytes subidos
 */
export async function uploadOpenAIFileService(filePath: string, filename: string) {
  const client = getClient();

  const file = await client.files.create({
    file: fs.createReadStream(filePath),
    purpose: "user_data", // requerido por OpenAI
  });

  return {
    openaiFileId: file.id,
    fileName: filename,
    bytes: file.bytes,
  };
}

// ------------------------------------------------------------------
// 🔼 Analizar documentos usando OpenAI Responses API
// ------------------------------------------------------------------

/**
 * analyzeFilesService()
 * ----------------------
 * Analiza uno o varios archivos previamente subidos a OpenAI.
 *
 * Flujo:
 * 1. Cada archivo se transforma en un bloque `input_file`.
 * 2. La pregunta del usuario va en un bloque `input_text`.
 * 3. Se envía todo junto al endpoint `responses.create()`.
 *
 * Este método permite consultas que combinan múltiples PDFs,
 * imágenes o documentos con una pregunta natural en texto.
 *
 * @param files - Lista de archivos con openaiFileId
 * @param query - Pregunta que el usuario quiere realizar
 * @returns Un resumen o respuesta generada por el modelo
 */
export async function analyzeFilesService(files: any[], query: string) {
  const client = getClient();

  // Convertir cada archivo a bloque input_file
  const fileBlocks = files.map((f) => ({
    type: "input_file" as const, // IMPORTANTÍSIMO
    file_id: f.openaiFileId,
  }));

  // Bloque de texto para la consulta del usuario
  const textBlock = {
    type: "input_text" as const,
    text: query,
  };

  // Construcción de input final para OpenAI
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: [...fileBlocks, textBlock],
      },
    ],
  });

  return {
    summary: response.output_text,
  };
}

/**
 * buildUploadedFilesSystemMessage()
 * ---------------------------------
 * Construye un mensaje tipo "system" avisando al modelo que el usuario
 * subió archivos en esta interacción.
 *
 * Este mensaje permite que GPT:
 * - Sepa que existen archivos disponibles.
 * - Sepa qué IDs usar si necesita herramientas que los procesen.
 * - Genere mejores respuestas o decida cuándo usar análisis de archivos.
 *
 * Si no hay archivos, devuelve null.
 *
 * @param uploadedFiles - Archivos recién subidos con id, nombre y documentId
 * @returns Un system message listo para incluir en el prompt, o null
 */
export function buildUploadedFilesSystemMessage(uploadedFiles: any[]) {
  if (!uploadedFiles.length) return null;

  return {
    role: "system",
    content:
      `📎 El usuario subió ${uploadedFiles.length} archivo(s) en esta interacción.\n` +
      uploadedFiles
        .map(
          (f, i) =>
            `(${i + 1}) ${f.fileName} — openaiFileId: ${f.openaiFileId} — documentId: ${f.documentId}`
        )
        .join("\n") +
      `\nPuedes utilizar una herramienta adecuada si es necesario para procesar estos documentos.`,
  };
}
