export type UserState =
  | "UNAUTHENTICATED"
  | "REGISTERING"
  | "LOGGING_IN"
  | "AUTHENTICATED"
  | "LOGGING_OUT"
  | "NO_SESSION";

export function detectIntent(message: string): "register" | "login" | "none" {
  const t = message.toLowerCase();

  if (t.includes("registr") || t.includes("crear cuenta")) return "register";
  if (t.includes("ingresar") || t.includes("inicio") || t.includes("entrar")) return "login";

  return "none";
}

/**
 * Determina el próximo estado del usuario según:
 * - si existe o no en la sesión
 * - lo que escribió en el mensaje
 */
export function getNextState(user: any, userMessage: string): UserState {
  const query = userMessage.toLowerCase();

  // 🔐 Detectar logout cuando NO hay usuario
  if (!user && /cerrar sesión|logout|salir/.test(query)) {
    return "NO_SESSION";
  }

  // 🔐 Detectar logout cuando SÍ hay usuario
  if (user && /cerrar sesión|logout|salir/.test(query)) {
    return "LOGGING_OUT";
  }

  // Si ya hay usuario, siempre está autenticado
  if (user) return "AUTHENTICATED";

  // Si no hay usuario, ver intención
  const intent = detectIntent(query);

  if (intent === "register") return "REGISTERING";
  if (intent === "login") return "LOGGING_IN";

  // Si viene "nombre, código"
  if (query.includes(",") && query.split(",").length === 2) {
    return "REGISTERING";
  }

  return "UNAUTHENTICATED";
}
