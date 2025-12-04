🤖 My Agent

Aplicación web de agente conversacional construida con **Next.js 16** que combina autenticación guiada por chat, **RAG con OpenAI**, herramientas personalizadas y streaming en tiempo real.

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6.17-2D3748?style=for-the-badge&logo=prisma)
![OpenAI](https://img.shields.io/badge/OpenAI-API-412991?style=for-the-badge&logo=openai)

</div>

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Scripts Disponibles](#-scripts-disponibles)
- [Uso](#-uso)
- [Herramientas del Agente](#-herramientas-del-agente)
- [Arquitectura](#-arquitectura)
- [Base de Datos](#-base-de-datos)
- [RAG System](#-rag-system)

---

## ✨ Características

### 🎯 Funcionalidades Principales

- **🔐 Autenticación Conversacional**: login, registro y logout solo con mensajes de chat, administrando cookies de sesión automáticamente.
- **💬 Chat en Tiempo Real**: streaming token-by-token desde el endpoint `/api/agent` con indicadores de procesamiento.
- **📎 Subida de Archivos**: recepción de documentos vía chat para alimentar el RAG y generar resúmenes iniciales.
- **🧠 Memoria Personalizada**: guarda y recupera datos casuales (gustos, recordatorios) vinculados al usuario.
- **📚 RAG con Vector Stores**: subida, búsqueda y resumen de documentos usando OpenAI Vector Stores por usuario.
- **🔧 Tools Inteligentes**: cálculo, clima, chistes, autenticación y consultas RAG ejecutables por el modelo.

---

## 🛠 Stack Tecnológico

### Frontend
- **[Next.js 16](https://nextjs.org/)** (App Router)
- **[React 19](https://react.dev/)**
- **[TypeScript 5](https://www.typescriptlang.org/)**
- **[Tailwind CSS 4](https://tailwindcss.com/)**

### Backend & AI
- **[OpenAI API](https://platform.openai.com/)** para chat, vector stores y respuestas RAG.
- **Máquina de estados interna** para decidir intents (auth, memorias, flujo casual).
- **Streaming** con `ReadableStream` hacia el cliente.

### Base de Datos
- **[PostgreSQL](https://www.postgresql.org/)**
- **[Prisma 6](https://www.prisma.io/)**
- **Vector Stores de OpenAI** por usuario para persistir embeddings.

### Utilidades
- **[Axios](https://axios-http.com/)** para llamadas HTTP.
- **[Lucide React](https://lucide.dev/)** para iconografía.
- **[Radix Slot](https://www.radix-ui.com/)** para composición de UI.

---

## 📂 Estructura del Proyecto

```
my-agent/
│
├── app/
│   ├── api/
│   │   ├── agent/           # Endpoint principal del chat + tools
│   │   └── documents/       # Subida y listado de documentos
│   ├── ai/                  # Prompts, state machine y router de dominios
│   ├── src/components/      # UI del chat (burbujas, input, loaders)
│   ├── globals.css          # Estilos globales
│   ├── layout.tsx           # Layout raíz
│   └── page.tsx             # Página de chat
│
├── components/ui/           # Componentes de interfaz reutilizables
├── prisma/                  # schema.prisma y scripts de seeds/utilidades
├── services/                # Lógica de herramientas (auth, RAG, clima, memoria)
├── public/                  # Recursos estáticos
├── next.config.ts           # Configuración de Next.js
├── package.json             # Dependencias y scripts
└── tsconfig.json            # Configuración TypeScript
```

---

## 📋 Requisitos Previos

- **Node.js 20.x** o superior
- **npm**
- **PostgreSQL** accesible
- **Cuenta de OpenAI** con `OPENAI_API_KEY`

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd my-agent
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env y .env.local` en la raíz:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
```

```env.local
DATABASE_URL="postgresql://user:password@host:5432/database"
OPENAI_API_KEY="sk-..."
OPENWEATHER_KEY="c27b9..."
```

### 4. Preparar la base de datos

```bash
npm run db:generate   # Genera el cliente Prisma
npm run db:migrate    # Ejecuta migraciones en desarrollo
```

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

La app queda disponible en [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | ✅ |
| `OPENAI_API_KEY` | API Key de OpenAI para chat y vector stores | ✅ |
| `OPENWEATHER_KEY` | API Key de Open Weather para recuperar el clima de los países | ✅ |


> Las cookies de sesión se gestionan automáticamente desde el endpoint `/api/agent` tras login o registro.

### Sesiones y autenticación conversacional
- El endpoint `/api/agent` analiza cada mensaje con una **máquina de estados** para decidir si debe registrar, autenticar o cerrar sesión.
- Al autenticarse o registrarse se genera un `sessionId` persistido en Prisma y enviado como cookie httpOnly.

---

## 📜 Scripts Disponibles

```bash
npm run dev            # Servidor de desarrollo
npm run build          # Build de producción
npm run start          # Servidor de producción
npm run lint           # Linter (ESLint 9)

# Base de datos
npm run db:generate    # Generar cliente Prisma
npm run db:migrate     # Migraciones de desarrollo
npm run db:migrate:name # Migración nombrada (init por defecto)
npm run db:studio      # Prisma Studio GUI
npm run db:validate    # Validar el schema
npm run db:format      # Formatear el schema
npm run db:status      # Estado de migraciones
npm run db:reset       # Reset duro de la DB
npm run db:seed        # Poblar datos iniciales
npm run db:ping        # Verificar conexión

npm run pret           # Formatear con Prettier
```

---

## 💡 Uso

1. **Abrir la app** en `localhost:3000`.
2. **Iniciar una conversación**: escribe un saludo o tu petición.
3. **Autenticación conversacional**: envía algo como `Soy Ana y mi código es 4321` para crear sesión.
4. **Subir archivos** desde el input del chat para alimentar el RAG.
5. **Consultar documentos**: pregunta con contexto (ej. "busca el último PDF"), el agente decidirá usar `searchDocuments` o `summarizeLastDocument`.
6. **Cerrar sesión** con un mensaje como "cerrar sesión".

---

## 🔧 Herramientas del Agente

El modelo puede invocar automáticamente estas tools:

1. **🧮 `calculator`**: evalúa expresiones matemáticas.
2. **🌤️ `getWeather`**: clima para una ubicación.
3. **😂 `tellJoke`**: chistes de programación.
4. **📝 `saveUserInfo`**: registra usuario con nombre y código.
5. **🔐 `authenticateUser`**: inicia sesión validando nombre y código.
6. **🚪 `logoutUser`**: finaliza la sesión actual.
7. **💾 `saveUserCasualData`**: guarda memorias cortas (gustos, recordatorios).
8. **📂 `getUserCasualData`**: recupera memorias almacenadas.
9. **🔍 `searchDocuments`**: búsqueda semántica en documentos subidos.
10. **📝 `summarizeLastDocument`**: resume el documento más reciente del usuario.

---

## 🏗 Arquitectura

### Flujo general

```
Cliente (Next.js) ─► /api/agent ─► Máquina de estados ─► OpenAI (tools)
      ▲                 │                 │
      │                 ▼                 │
      └─ Streaming ◄────┴──── Prisma ◄────┘
                          │
                          └─ RAG con Vector Stores
```

1. El cliente envía texto y archivos al endpoint `/api/documents` o `/api/agent`.
2. El backend detecta estado conversacional (auth, memorias, flujo casual) y dominio semántico.
3. Se construye un **system prompt dinámico** combinando estado, contexto y tools disponibles.
4. OpenAI decide si usar tools; los resultados se envían a una segunda llamada **en streaming**.
5. Las respuestas y el historial se guardan en Prisma.

---

## 🗄 Base de Datos

Modelos clave en `prisma/schema.prisma`:

- **User**: nombre, código y `vectorStoreId` asociado.
- **Session**: sesiones activas con `sessionToken` y expiración.
- **Message**: historial de conversación y memorias casuales.
- **Document**: metadatos de archivos subidos y relación con vector store.
- **Memory**: almacenamiento estructurado de datos clave/valor por usuario.

Para administrar la DB:

```bash
npm run db:studio   # GUI
npm run db:migrate  # Nueva migración
npm run db:reset    # Reinicio completo en local
```

---

## 📚 RAG System

1. El usuario sube un archivo al endpoint /api/documents (requiere sesión activa).
El backend valida la sesión, almacena el archivo temporalmente y lo sube tanto a OpenAI como a la Vector Store del usuario.
2. Cada usuario tiene una Vector Store personal.
Si no existe, se crea automáticamente mediante getOrCreateVectorStoreForUser() y se asocia en la base de datos.
3. Durante el chat, el agente puede usar RAG a través de tres herramientas en el archivo de servicios para RAG.
4. Si el usuario no tiene documentos, las funciones RAG devuelven mensajes claros como
"Todavía no subiste documentos para usar RAG", permitiendo que el agente guíe al usuario para subir archivos.

---

## 📝 Licencia

Proyecto interno para explorar agentes conversacionales con RAG y autenticación por chat.
