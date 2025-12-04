root@d7337a61ad74:/workspace/my-agent# nl -ba README.md | sed -n '1,200p'
     1  🤖 My Agent
     2
     3  Aplicación web de agente conversacional construida con **Next.js 16** que combina autenticación guiada por chat, **RAG c
on OpenAI**, herramientas personalizadas y streaming en tiempo real.
     4
     5  <div align="center">
     6
     7  ![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js)
     8  ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
     9  ![Prisma](https://img.shields.io/badge/Prisma-6.17-2D3748?style=for-the-badge&logo=prisma)
    10  ![OpenAI](https://img.shields.io/badge/OpenAI-API-412991?style=for-the-badge&logo=openai)
    11
    12  </div>
    13
    14  ---
    15
    16  ## 📋 Tabla de Contenidos
    17
    18  - [Características](#-características)
    19  - [Stack Tecnológico](#-stack-tecnológico)
    20  - [Estructura del Proyecto](#-estructura-del-proyecto)
    21  - [Requisitos Previos](#-requisitos-previos)
    22  - [Instalación](#-instalación)
    23  - [Configuración](#-configuración)
    24  - [Scripts Disponibles](#-scripts-disponibles)
    25  - [Uso](#-uso)
    26  - [Herramientas del Agente](#-herramientas-del-agente)
    27  - [Arquitectura](#-arquitectura)
    28  - [Base de Datos](#-base-de-datos)
    29  - [RAG System](#-rag-system)
    30
    31  ---
    32
    33  ## ✨ Características
    34
    35  ### 🎯 Funcionalidades Principales
    36
    37  - **🔐 Autenticación Conversacional**: login, registro y logout solo con mensajes de chat, administrando cookies de sesi
ón automáticamente.
    38  - **💬 Chat en Tiempo Real**: streaming token-by-token desde el endpoint `/api/agent` con indicadores de procesamiento.
    39  - **📎 Subida de Archivos**: recepción de documentos vía chat para alimentar el RAG y generar resúmenes iniciales.
    40  - **🧠 Memoria Personalizada**: guarda y recupera datos casuales (gustos, recordatorios) vinculados al usuario.
    41  - **📚 RAG con Vector Stores**: subida, búsqueda y resumen de documentos usando OpenAI Vector Stores por usuario.
    42  - **🔧 Tools Inteligentes**: cálculo, clima, chistes, autenticación y consultas RAG ejecutables por el modelo.
    43
    44  ---
    45
    46  ## 🛠 Stack Tecnológico
    47
    48  ### Frontend
    49  - **[Next.js 16](https://nextjs.org/)** (App Router)
    50  - **[React 19](https://react.dev/)**
    51  - **[TypeScript 5](https://www.typescriptlang.org/)**
    52  - **[Tailwind CSS 4](https://tailwindcss.com/)**
    53
    54  ### Backend & AI
    55  - **[OpenAI API](https://platform.openai.com/)** para chat, vector stores y respuestas RAG.
    56  - **Máquina de estados interna** para decidir intents (auth, memorias, flujo casual).
    57  - **Streaming** con `ReadableStream` hacia el cliente.
    58
    59  ### Base de Datos
    60  - **[PostgreSQL](https://www.postgresql.org/)**
    61  - **[Prisma 6](https://www.prisma.io/)**
    62  - **Vector Stores de OpenAI** por usuario para persistir embeddings.
    63
    64  ### Utilidades
    65  - **[Axios](https://axios-http.com/)** para llamadas HTTP.
    66  - **[Lucide React](https://lucide.dev/)** para iconografía.
    67  - **[Radix Slot](https://www.radix-ui.com/)** para composición de UI.
    68
    69  ---
    70
    71  ## 📂 Estructura del Proyecto
    72
    73  ```
    74  my-agent/
    75  │
    76  ├── app/
    77  │   ├── api/
    78  │   │   ├── agent/           # Endpoint principal del chat + tools
    79  │   │   └── documents/       # Subida y listado de documentos
    80  │   ├── ai/                  # Prompts, state machine y router de dominios
    81  │   ├── src/components/      # UI del chat (burbujas, input, loaders)
    82  │   ├── globals.css          # Estilos globales
    83  │   ├── layout.tsx           # Layout raíz
    84  │   └── page.tsx             # Página de chat
    85  │
    86  ├── components/ui/           # Componentes de interfaz reutilizables
    87  ├── prisma/                  # schema.prisma y scripts de seeds/utilidades
    88  ├── services/                # Lógica de herramientas (auth, RAG, clima, memoria)
    89  ├── public/                  # Recursos estáticos
    90  ├── next.config.ts           # Configuración de Next.js
    91  ├── package.json             # Dependencias y scripts
    92  └── tsconfig.json            # Configuración TypeScript
    93  ```
    94
    95  ---
    96
    97  ## 📋 Requisitos Previos
    98
    99  - **Node.js 20.x** o superior
   100  - **npm**
   101  - **PostgreSQL** accesible
   102  - **Cuenta de OpenAI** con `OPENAI_API_KEY`
   103
   104  ---
   105
   106  ## 🚀 Instalación
   107
   108  ### 1. Clonar el repositorio
   109
   110  ```bash
   111  git clone <tu-repositorio>
   112  cd my-agent
   113  ```
   114
   115  ### 2. Instalar dependencias
   116
   117  ```bash
   118  npm install
   119  ```
   120
   121  ### 3. Configurar variables de entorno
   122
   123  Crea un archivo `.env.local` en la raíz:
   124
   125  ```env
   126  DATABASE_URL="postgresql://user:password@host:5432/database"
   127  OPENAI_API_KEY="sk-..."
   128  ```
   129
   130  ### 4. Preparar la base de datos
   131
   132  ```bash
   133  npm run db:generate   # Genera el cliente Prisma
   134  npm run db:migrate    # Ejecuta migraciones en desarrollo
   135  ```
   136
   137  ### 5. Iniciar el servidor de desarrollo
   138
   139  ```bash
   140  npm run dev
   141  ```
   142
   143  La app queda disponible en [http://localhost:3000](http://localhost:3000).
   144
   145  ---
   146
   147  ## ⚙️ Configuración
   148
   149  ### Variables de Entorno
   150
   151  | Variable | Descripción | Requerida |
   152  |----------|-------------|-----------|
   153  | `DATABASE_URL` | Cadena de conexión a PostgreSQL | ✅ |
   154  | `OPENAI_API_KEY` | API Key de OpenAI para chat y vector stores | ✅ |
   155
   156  > Las cookies de sesión se gestionan automáticamente desde el endpoint `/api/agent` tras login o registro.
   157
   158  ### Sesiones y autenticación conversacional
   159  - El endpoint `/api/agent` analiza cada mensaje con una **máquina de estados** para decidir si debe registrar, autentica
r o cerrar sesión.
   160  - Al autenticarse o registrarse se genera un `sessionId` persistido en Prisma y enviado como cookie httpOnly.
   161
   162  ---
   163
   164  ## 📜 Scripts Disponibles
   165
   166  ```bash
   167  npm run dev            # Servidor de desarrollo
   168  npm run build          # Build de producción
   169  npm run start          # Servidor de producción
   170  npm run lint           # Linter (ESLint 9)
   171
   172  # Base de datos
   173  npm run db:generate    # Generar cliente Prisma
   174  npm run db:migrate     # Migraciones de desarrollo
   175  npm run db:migrate:name # Migración nombrada (init por defecto)
   176  npm run db:studio      # Prisma Studio GUI
   177  npm run db:validate    # Validar el schema
   178  npm run db:format      # Formatear el schema
   179  npm run db:status      # Estado de migraciones
   180  npm run db:reset       # Reset duro de la DB
   181  npm run db:seed        # Poblar datos iniciales
   182  npm run db:ping        # Verificar conexión
   183
   184  npm run pret           # Formatear con Prettier
   185  ```
   186
   187  ---
   188
   189  ## 💡 Uso
   190
   191  1. **Abrir la app** en `localhost:3000`.
   192  2. **Iniciar una conversación**: escribe un saludo o tu petición.
   193  3. **Autenticación conversacional**: envía algo como `Soy Ana y mi código es 4321` para crear sesión.
   194  4. **Subir archivos** desde el input del chat para alimentar el RAG.
   195  5. **Consultar documentos**: pregunta con contexto (ej. "busca el último PDF"), el agente decidirá usar `searchDocuments
` o `summarizeLastDocument`.
   196  6. **Cerrar sesión** con un mensaje como "cerrar sesión".
   197
   198  ---
   199
   200  ## 🔧 Herramientas del Agente
root@d7337a61ad74:/workspace/my-agent# nl -ba README.md | sed -n '200,400p'
   200  ## 🔧 Herramientas del Agente
   201
   202  El modelo puede invocar automáticamente estas tools:
   203
   204  1. **🧮 `calculator`**: evalúa expresiones matemáticas.
   205  2. **🌤️ `getWeather`**: clima para una ubicación.
   206  3. **😂 `tellJoke`**: chistes de programación.
   207  4. **📝 `saveUserInfo`**: registra usuario con nombre y código.
   208  5. **🔐 `authenticateUser`**: inicia sesión validando nombre y código.
   209  6. **🚪 `logoutUser`**: finaliza la sesión actual.
   210  7. **💾 `saveUserCasualData`**: guarda memorias cortas (gustos, recordatorios).
   211  8. **📂 `getUserCasualData`**: recupera memorias almacenadas.
   212  9. **🔍 `searchDocuments`**: búsqueda semántica en documentos subidos.
   213  10. **📝 `summarizeLastDocument`**: resume el documento más reciente del usuario.
   214
   215  ---
   216
   217  ## 🏗 Arquitectura
   218
   219  ### Flujo general
   220
   221  ```
   222  Cliente (Next.js) ─► /api/agent ─► Máquina de estados ─► OpenAI (tools)
   223        ▲                 │                 │
   224        │                 ▼                 │
   225        └─ Streaming ◄────┴──── Prisma ◄────┘
   226                            │
   227                            └─ RAG con Vector Stores
   228  ```
   229
   230  1. El cliente envía texto y archivos al endpoint `/api/documents` o `/api/agent`.
   231  2. El backend detecta estado conversacional (auth, memorias, flujo casual) y dominio semántico.
   232  3. Se construye un **system prompt dinámico** combinando estado, contexto y tools disponibles.
   233  4. OpenAI decide si usar tools; los resultados se envían a una segunda llamada **en streaming**.
   234  5. Las respuestas y el historial se guardan en Prisma.
   235
   236  ---
   237
   238  ## 🗄 Base de Datos
   239
   240  Modelos clave en `prisma/schema.prisma`:
   241
   242  - **User**: nombre, código y `vectorStoreId` asociado.
   243  - **Session**: sesiones activas con `sessionToken` y expiración.
   244  - **Message**: historial de conversación y memorias casuales.
   245  - **Document**: metadatos de archivos subidos y relación con vector store.
   246  - **Memory**: almacenamiento estructurado de datos clave/valor por usuario.
   247
   248  Para administrar la DB:
   249
   250  ```bash
   251  npm run db:studio   # GUI
   252  npm run db:migrate  # Nueva migración
   253  npm run db:reset    # Reinicio completo en local
   254  ```
   255
   256  ---
   257
   258  ## 📚 RAG System
   259
   260  1. El usuario sube un archivo al endpoint `/api/documents` (requiere sesión activa).
   261  2. Se envía el archivo a un **Vector Store** dedicado del usuario y se genera un resumen inicial con `ragQuery`.
   262  3. Durante el chat, las herramientas `searchDocuments` y `summarizeLastDocument` consultan el vector store vía OpenAI.
   263  4. Si el usuario no tiene documentos, el agente responde con mensajes de ayuda para subirlos.
   264
   265  ---
   266
   267  ## 📝 Licencia
   268
   269  Proyecto interno para explorar agentes conversacionales con RAG y autenticación por chat.