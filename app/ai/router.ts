import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function detectDomainLLM(
  query: string
): Promise<"memory" | "authentication" | "casual"> {

  const q = query.toLowerCase();

  // Detecta referencias al historial, NO usar memory
  if (/dame| necesito| genera| escribi |me dijiste|dijiste|que dijiste|antes|recién|hace un rato|la lista|que escribiste|que me diste/i.test(q)) {
    return "casual";
  }

  // =============================
  // LLM Solo si no matcheó arriba
  // =============================
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Clasifica el mensaje del usuario en una sola categoría:
- "memory" si intenta recordar, consultar o guardar información de cualquier tipo.
- "authentication" si habla de login, registro, logout o verificación.
- "casual" para cualquier conversación normal.

Tu respuesta debe ser SOLO una palabra: memory, authentication o casual.
        `,
      },
      { role: "user", content: query },
    ],
  });

  const category = response.choices[0].message.content?.trim()?.toLowerCase();

  if (category === "memory" || category === "authentication") {
    return category;
  }

  return "casual";
}

