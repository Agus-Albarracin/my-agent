// tools/runTool.ts
import { getWeather } from "@/services/weather-services";
import { registerUser, authenticateUser, logoutUser } from "@/services/auth-services";
import { saveMemory, getMemory } from "@/services/memory-services";
import { searchDocuments, summarizeLastDocument } from "@/services/rag-services";

export async function runTool(name: string, args: any) {
  console.log("🔧 Ejecutando tool:", name);

  switch (name) {
    case "calculator":
      try {
        return eval(args.expression);
      } catch {
        return "Error al evaluar la expresión";
      }

    case "getWeather":
      return await getWeather(args.location);

    case "tellJoke":
      return [
        "¿Por qué los programadores prefieren el modo oscuro? Porque la luz atrae bugs.",
        "Hay 10 tipos de personas: las que entienden binario y las que no.",
        "Te contaría un chiste sobre UDP, pero puede que no lo recibas.",
      ][Math.floor(Math.random() * 3)];

    case "saveUserInfo":
      return await registerUser(args.name, args.code);

    case "authenticateUser":
      return await authenticateUser(args.name, args.code);

    case "logoutUser":
      return await logoutUser();

    case "saveUserCasualData":
      return await saveMemory(args.key, args.value);

    case "getUserCasualData":
      return await getMemory(args.key);

    case "searchDocuments":
      return searchDocuments(args.id, args.query, args.topK ?? 5);

    case "summarizeLastDocument":
      return summarizeLastDocument(args.userId);

    default:
      return { error: `Tool no implementada: ${name}` };
  }
}
