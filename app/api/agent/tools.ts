// tools/tools.ts
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const tools: ChatCompletionTool[] = [
  // ==== Calculadora ====
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Evalúa expresiones matemáticas básicas",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string" },
        },
        required: ["expression"],
      },
    },
  },

  // ==== Clima ====
  {
    type: "function",
    function: {
      name: "getWeather",
      description: "Obtiene el clima actual para una ubicación",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
    },
  },

  // ==== Chistes ====
  {
    type: "function",
    function: {
      name: "tellJoke",
      description: "Devuelve un chiste aleatorio de programación",
      parameters: { type: "object", properties: {} },
    },
  },

  // ==== Guardar Datos del Usuario ====
  {
    type: "function",
    function: {
      name: "saveUserInfo",
      description: "Registra un usuario con name, y code.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          code: { type: "string" },
        },
        required: ["name", "code"],
      },
    },
  },

  // ==== Autenticación por chat ====
  {
    type: "function",
    function: {
      name: "authenticateUser",
      description: "Autentica a un usuario usando su nombre y code.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          code: { type: "string" },
        },
        required: ["name", "code"],
      },
    },
  },

  // ==== Logout ====
  {
    type: "function",
    function: {
      name: "logoutUser",
      description: "Cierra la sesión del usuario actual eliminando su sessionToken.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  // ==== Guardar Información Casual ====
  {
    type: "function",
    function: {
      name: "saveUserCasualData",
      description:
        "Guarda los datos personalizado del usuario, como color favorito, alergias, objetos nombrados, relaciones y adjetivos sobre el contexto que se esta hablando.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
  },

  // ==== Obtener Información Casual ====
  {
    type: "function",
    function: {
      name: "getUserCasualData",
      description: "Obtiene un dato guardado anteriormente.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
        },
        required: ["key"],
      },
    },
  },
];
