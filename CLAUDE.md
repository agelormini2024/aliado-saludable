# CLAUDE.md — Aliado Saludable

Este archivo es la fuente de la verdad del proyecto.
Se actualiza al finalizar cada fase.

---

## Contexto del Proyecto

**Aliado Saludable** es una plataforma web SaaS orientada a personas que enfrentan
dificultades para bajar de peso. El nombre refleja la filosofía del producto:
no es un juez ni un tracker frío — es un compañero en el proceso.

**Origen**: propuesta proactiva para una búsqueda publicada en Workana.
El diferenciador principal frente a otros candidatos es el **Chat IA con RAG**
alimentado con el historial real del usuario (peso, medidas, comidas, actividad).

### Roles de usuario

| Rol | Descripción |
|---|---|
| `USUARIO` | Persona que quiere bajar de peso. Registra su progreso, usa el chat IA, lee artículos. |
| `COACH` | Nutricionista o entrenador que monitorea el progreso de sus pacientes desde un panel propio. |
| `ADMIN` | Administrador de la plataforma. Gestiona usuarios, coaches y contenido. |

El modelo multi-tenant con rol de Coach es el diferenciador B2B:
hace la plataforma vendible a profesionales de salud, no solo a usuarios finales.

### Modelo de negocio (a definir con el cliente)

La plataforma está pensada para soportar **Freemium**:
- Plan gratuito: seguimiento básico de peso + artículos
- Plan premium: chat IA + seguimiento completo + acceso a coach
- Plan coach: panel de gestión de pacientes

Esta decisión no bloquea el MVP — se implementa en fases posteriores.

---

## Stack Tecnológico

Mismo stack que EUCAR v2 para mantener consistencia y velocidad de desarrollo.

| Capa | Tecnología |
|---|---|
| Backend | NestJS (TypeScript) |
| Frontend | Next.js (TypeScript, App Router) |
| Base de datos | PostgreSQL + Prisma ORM |
| Autenticación | NestJS Passport + JWT (access + refresh tokens) |
| Estado del cliente | Tanstack Query (server state) + Zustand (UI state) |
| Estilos | Tailwind CSS + Material-UI |
| Formularios | React Hook Form + Zod |
| IA / Chat | OpenAI gpt-4o-mini + text-embedding-3-small + pgvector (RAG) |
| Monorepo | Turborepo |
| CI | GitHub Actions |
| Infra local dev | Homebrew (PostgreSQL, sin Redis — no se usa) |
| Deploy demo | Vercel (frontend) + Render (backend) + Supabase (DB) |

---

## Decisiones Técnicas — Ya Tomadas (no reabrir)

**D1: Monorepo con Turborepo**
Mismo patrón que EUCAR v2. Frontend y backend en el mismo repo.

**D2: API REST en NestJS, sin Server Actions**
Next.js es SPA pura que consume la API. Reutilizable desde futuros clientes móviles.

**D3: OpenAI siempre (dev y prod)**
`LLM_PROVIDER=openai` es el único valor válido. No hay modo Ollama.

**D4: pgvector en PostgreSQL existente**
No se agrega una vector DB separada. Misma decisión que EUCAR v2.

**D5: IDs como String/cuid**
Consistente con EUCAR v2. Evita colisiones y facilita migraciones.

**D6: Sin Redis**
No se usa caché distribuida en esta versión. Se eliminó del stack en EUCAR v2 y aplica igual acá.

**D7: Rol COACH desde el inicio**
El panel de coach no es una fase posterior — el modelo de datos lo soporta desde la migración inicial.
Construir la UI del coach puede ser posterior, pero el schema debe contemplarlo.

**D8: tsconfig extends usa rutas relativas**
Igual que EUCAR v2. Los editores no resuelven nombres de paquete de workspaces.

**D9: Calorías requeridas en actividad y comidas**
`calorias` es `NOT NULL` en `RegistroActividad` y `RegistroComida`. El campo es obligatorio en los formularios y en los DTOs del backend. La razón es que el balance calórico diario (consumidas vs. quemadas) es una feature central del dashboard y del contexto RAG del chat IA — sin datos consistentes, la feature no funciona. No volver a hacerlo opcional.

**D11: pgvector con Prisma — campo Unsupported + raw queries**
El tipo `vector(1536)` no es soportado nativamente por Prisma. Se declara como `Unsupported("vector(1536)")` en el schema. Toda escritura del vector se hace via `$executeRaw` (UPDATE SET embedding = $1::vector). Toda lectura con `<=>` se hace via `$queryRaw`. El cuid lo genera `prisma.embeddingDocument.create()` y luego se actualiza el vector con un segundo `$executeRaw`.

**D12: RAG con fire-and-forget — indexación nunca bloquea al usuario**
El método `ragService.indexar()` se llama sin `await` en todos los servicios que escriben datos. Los errores de OpenAI (cuota, red, etc.) se loguean via `.catch(err => this.logger.error(...))` pero no se propagan. Un fallo de indexación nunca causa un 500 en la operación del usuario.

**D14: Route group `(coach)` requiere subcarpeta `coach/` para el segmento de URL**
Las páginas del panel coach van en `app/(coach)/coach/pacientes/...`, no en `app/(coach)/pacientes/...`.
El route group `(coach)` es invisible en la URL — solo aporta el layout. La carpeta `coach/` dentro de él es la que genera el prefijo `/coach` en la URL. Mismo patrón que `(dashboard)` donde las páginas están en `(dashboard)/dashboard/`, `(dashboard)/progreso/`, etc.

**D15: Invalidación cruzada de cache en asignarCoach / desasignarCoach**
`useAsignarCoach` y `useDesasignarCoach` invalidan tanto `["admin-pacientes"]` como `["admin-coaches"]` en `onSuccess`. Sin esto, el `_count.pacientes` de las tarjetas de coaches no se actualiza al asignar/desasignar desde `/admin/pacientes`.

**D16: Coaches acceden a su panel desde el Sidebar del dashboard**
El `Sidebar.tsx` del área autenticada (`(dashboard)`) muestra una sección "Coach" con link a `/coach/pacientes` cuando `usuario.rol === "COACH"`. No se redirige al coach automáticamente al loguear — puede usar el dashboard de usuario (su propio progreso) y el panel coach desde el mismo sidebar.

**D17: Mockear módulos Node con exports non-configurable en Jest**
Los exports nativos del módulo `fs` (`writeFileSync`, `existsSync`, `unlinkSync`) son `configurable: false` — `jest.spyOn()` lanza `Cannot redefine property`. Solución: `jest.mock('fs', () => ({ ...jest.requireActual('fs'), writeFileSync: jest.fn(), existsSync: jest.fn(), unlinkSync: jest.fn() }))` a nivel de módulo. Las llamadas a `jest.mock()` se hoistean automáticamente al inicio del archivo por el compilador de Jest. Lo mismo aplica para dependencias cargadas con `require()` a nivel de módulo en el servicio (ej: `pdf-parse`, `mammoth`): usar `jest.mock('pdf-parse', () => jest.fn().mockResolvedValue(...))` antes de cualquier import.

Tras `jest.clearAllMocks()` en `beforeEach`, las implementaciones de los mocks globales sobreviven pero los call counts se resetean. Si un mock global tiene un default sensible (ej: `existsSync` retorna `false` por defecto), reafirmarlo en `beforeEach` para que tests que lo cambien a `true` no contaminen los siguientes.

**D13: Historial del chat en localStorage (no en el backend)**
El historial visible en `/chat` es estado local del componente, persistido en `localStorage` bajo la clave `"aliado-chat-history"`. Límite: 100 mensajes. Cada request al backend es independiente — el contexto del asistente viene del RAG, no del historial de la UI. El campo `timestamp` se serializa como string ISO y se revive con `new Date()` al cargar.

**D10: Documentos PDF/.docx como fuente RAG junto a los artículos**
El Admin puede subir documentos en `POST /contenido/documentos` (multipart/form-data). El texto se extrae en el servidor con `pdf-parse` (PDF) y `mammoth` (DOCX) y se guarda en `Documento.contenido`. Los archivos físicos se guardan en `uploads/documentos/`. En Fase 5 (deploy) se migra a Supabase Storage cambiando solo el servicio de storage. En RAG se indexan con `tipo = "DOCUMENTO"` igual que los artículos.

---

## Arquitectura del Backend (NestJS)

```
backend/
├── src/
│   ├── app.module.ts
│   ├── config/                  # ConfigModule, validación de env vars
│   ├── database/                # PrismaModule (singleton)
│   ├── auth/
│   │   ├── strategies/          # local.strategy.ts, jwt.strategy.ts
│   │   ├── guards/              # jwt-auth.guard.ts, roles.guard.ts
│   │   └── decorators/          # @Roles(), @CurrentUser()
│   ├── usuarios/                # CRUD de usuarios + gestión de perfil
│   ├── coaches/                 # Panel coach: lista de pacientes, progreso
│   ├── progreso/
│   │   ├── peso.service.ts      # Registro de peso con fecha
│   │   ├── medidas.service.ts   # Cintura, cadera, etc.
│   │   └── actividad.service.ts # Registro de actividad física
│   ├── alimentacion/
│   │   ├── comidas.service.ts   # Registro de comidas del día
│   │   └── alimentos.service.ts # Catálogo básico de alimentos con calorías
│   ├── contenido/
│   │   ├── contenido.service.ts  # Artículos: CRUD admin + listado público con paginación
│   │   ├── contenido.controller.ts
│   │   ├── documento.service.ts  # Documentos PDF/.docx: upload, extracción de texto, CRUD
│   │   ├── documento.controller.ts
│   │   └── dto/                  # create-articulo, update-articulo, update-documento
│   ├── ai/
│   │   ├── chat.service.ts      # Orquesta RAG → prompt → stream
│   │   ├── rag.service.ts       # Embeddings + búsqueda vectorial
│   │   └── context-builder.service.ts
│   └── common/
│       ├── filters/
│       ├── interceptors/
│       ├── pagination/
│       └── decorators/
```

### Convenciones (igual que EUCAR v2)
- Cada módulo: `controller` → `service` → `prisma` directo (sin capa repository)
- Response wrapper: `{ data: T, meta?: PaginationMeta }`
- Global exception filter estandariza todos los errores
- Guards en orden: `JwtAuthGuard` → `RolesGuard`
- Swagger en desarrollo (`/api/docs`)

---

## Arquitectura del Frontend (Next.js)

### Decisiones técnicas tomadas en Fase 2

- **Auth guard**: mounted check en `(dashboard)/layout.tsx` — evita hydration flash con Zustand/localStorage
- **Rutas**: `/dashboard` (no `/`) para no conflictuar con la landing en `app/page.tsx`
- **Progreso y Actividad separados**: `/progreso` (peso + medidas con tabs) y `/actividad` (actividad física)
- **Alimentación**: navegador de fechas prev/next; vista del día agrupada por momento
- **Gráfico de peso**: Recharts con `dynamic({ ssr: false })` — evita errores de DOM en SSR
- **Responses**: `/progreso/*` (paginados) y `/alimentacion/*` devuelven `{ data: T }`; la excepción es que los endpoints de listado paginado devuelven `PaginatedResult<T>` directamente sin wrapper
- **tsconfig paths**: `"@/*": ["./*"]` (raíz del frontend, no `./src/*`)
- **Calorías obligatorias**: `calorias` requerido en actividad y comidas (ver D9) — formularios con error explícito, sin valor opcional
- **Balance calórico**: `GET /progreso/resumen-calorias?fecha=YYYY-MM-DD` → `{ data: { consumidas, quemadas, balance } }`. Hook `useResumenCalorias(fecha?)`. Se invalida con `queryKey: ["resumen-calorias"]` al guardar comida o actividad.
- **Timezone**: nunca usar `new Date().toISOString().split("T")[0]` para obtener "hoy" — devuelve fecha UTC. Usar `todayLocal()` de `lib/date.ts` que usa `getFullYear/getMonth/getDate` (hora local). Aplica en hooks `useResumenCalorias`, `useComidasDelDia` y en los `getTodayISO()` de los formularios de progreso, actividad y alimentación.
- **Chat localStorage**: historial de mensajes en `localStorage["aliado-chat-history"]` (límite 100). `leerHistorial()` como lazy initializer de `useState`. `Date` se serializa como string ISO y se revive al cargar. Botón "Nueva conversación" limpia estado + storage.
- **PesoChart label**: el último punto del gráfico muestra una tarjeta SVG (`UltimoLabel`) siempre visible con el peso actual. Requiere `isFinite(cx) && isFinite(cy)` como guard porque Recharts pasa `NaN` en el primer render. El margen superior del chart es `top: 56` para que la tarjeta no se corte.
- **DateNavigator (alimentación)**: cuando es hoy muestra "Hoy · 22 abr." (no solo "Hoy") para que siempre sea visible la fecha real.

```
frontend/
├── app/
│   ├── page.tsx                 # Landing pública — Server Component, animaciones CSS
│   ├── layout.tsx               # RootLayout con Fraunces + DM Sans, Providers
│   ├── globals.css              # Tailwind v4 @theme tokens + keyframes
│   ├── (auth)/
│   │   ├── layout.tsx           # Centrado con blobs decorativos
│   │   ├── login/page.tsx       # RHF+Zod → POST /auth/login → GET /usuarios/me
│   │   └── register/page.tsx    # RHF+Zod → POST /auth/register → GET /usuarios/me
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Auth guard (mounted check) + Sidebar + MobileHeader
│   │   ├── dashboard/page.tsx   # Métricas, gráfico Recharts, balance calórico, resumen semanal
│   │   ├── progreso/page.tsx    # Tabs Peso/Medidas — formularios + historial timeline
│   │   ├── actividad/page.tsx   # Selector visual de tipo + historial con badges
│   │   ├── alimentacion/page.tsx # Selector de momento + DateNavigator + vista del día
│   │   ├── chat/                # Chat IA (Fase 3)
│   │   ├── contenido/           # Artículos y guías (Fase 3)
│   │   └── perfil/              # Datos del usuario + metas (Fase 3+)
│   └── (coach)/                 # Panel exclusivo para coaches (Fase 4)
│       ├── layout.tsx           # Auth guard doble: sin token → /login; rol≠COACH → /dashboard
│       └── coach/               # Segmento de URL "coach" (la carpeta (coach) es invisible en la URL)
│           └── pacientes/
│               ├── page.tsx     # Lista de pacientes del coach → /coach/pacientes
│               └── [id]/
│                   ├── page.tsx            # Detalle de paciente → /coach/pacientes/[id]
│                   └── _PesoChartCoach.tsx # Recharts sin SSR (componente privado de la ruta)
├── components/
│   ├── providers.tsx            # QueryClientProvider + ReactQueryDevtools
│   ├── dashboard/
│   │   ├── Sidebar.tsx          # bg-forest, rounded-r-3xl; sección "Coach" para COACH, sección "Admin" para ADMIN
│   │   ├── MobileHeader.tsx     # lg:hidden, hamburger, logo, avatar inicial
│   │   └── PesoChart.tsx        # Recharts AreaChart — importar con dynamic({ ssr: false })
│   ├── coach/
│   │   └── CoachSidebar.tsx     # bg-forest, badge "Panel Coach", nav: "Mis Pacientes", link "← Mi Dashboard"
│   └── chat/                    # (no hay componentes separados — todo en la page)
├── lib/
│   ├── api.ts                   # Axios con baseURL NEXT_PUBLIC_API_URL, interceptor Bearer
│   └── date.ts                  # todayLocal() — fecha local YYYY-MM-DD (no usar toISOString)
├── hooks/                       # Tanstack Query hooks por entidad
│   ├── useProgreso.ts           # usePesos, useMedidas, useActividad, useResumenCalorias
│   ├── useAlimentacion.ts       # useComidasDelDia(fecha?)
│   ├── useContenido.ts          # useArticulos, useArticulo, useDocumentos (Fase 3 T5)
│   ├── useChat.ts               # useChatMutation → POST /ai/chat; interfaz ChatMessage
│   ├── useAdmin.ts              # useCoaches, usePacientes, useCrearCoach, useEditarCoach, useConvertirAPaciente, useAsignarCoach, useDesasignarCoach
│   └── useCoach.ts              # useMisPacientes, useResumenPaciente
└── stores/                      # Zustand — SOLO UI state
    ├── auth.store.ts            # persist en localStorage ("aliado-auth"), AuthUsuario
    └── ui.store.ts              # sidebarOpen
```

---

## Schema Prisma — Diseño inicial

```prisma
model Usuario {
  id            String    @id @default(cuid())
  email         String    @unique
  nombre        String
  apellido      String
  passwordHash  String
  rol           RolUsuario @default(USUARIO)
  coachId       String?   // si tiene coach asignado
  coach         Coach?    @relation(fields: [coachId], references: [id])
  altura        Float?    // en cm
  fechaNacimiento DateTime?
  meta          Float?    // peso objetivo en kg
  registrosPeso RegistroPeso[]
  registrosMedidas RegistroMedidas[]
  registrosActividad RegistroActividad[]
  registrosComida RegistroComida[]
  refreshTokens RefreshToken[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Coach {
  id            String    @id @default(cuid())
  email         String    @unique
  nombre        String
  apellido      String
  passwordHash  String
  especialidad  String?
  pacientes     Usuario[]
  refreshTokens RefreshToken[]
  createdAt     DateTime  @default(now())
}

enum RolUsuario {
  USUARIO
  COACH
  ADMIN
}

model RegistroPeso {
  id        String   @id @default(cuid())
  usuarioId String
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  peso      Float    // en kg
  fecha     DateTime @default(now())
  nota      String?
}

model RegistroMedidas {
  id        String   @id @default(cuid())
  usuarioId String
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  cintura   Float?   // en cm
  cadera    Float?
  pecho     Float?
  brazo     Float?
  muslo     Float?
  fecha     DateTime @default(now())
}

model RegistroActividad {
  id          String   @id @default(cuid())
  usuarioId   String
  usuario     Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tipo        String   // "CAMINATA" | "GYM" | "NATACION" | "CICLISMO" | "OTRO"
  duracion    Int      // en minutos
  calorias    Int      // requerido — habilita el balance calórico diario (ver D9)
  fecha       DateTime @default(now())
  nota        String?
}

model RegistroComida {
  id          String   @id @default(cuid())
  usuarioId   String
  usuario     Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  momento     String   // "DESAYUNO" | "ALMUERZO" | "MERIENDA" | "CENA" | "SNACK"
  descripcion String   // texto libre — sin base de datos nutricional en MVP
  calorias    Int      // requerido — habilita el balance calórico diario (ver D9)
  fecha       DateTime @default(now())
}

model Articulo {
  id          String   @id @default(cuid())
  titulo      String
  contenido   String   // texto largo en markdown
  categoria   String   // "NUTRICION" | "EJERCICIO" | "BIENESTAR"
  publicado   Boolean  @default(false)
  autorId     String?  // admin que lo escribió
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Documento {
  id          String   @id @default(cuid())
  nombre      String   // nombre original del archivo (ej: "guia-alimentacion.pdf")
  mimeType    String   // "application/pdf" | "...wordprocessingml.document"
  contenido   String   // texto extraído del archivo — lo que se indexa en RAG
  archivoPath String   // ruta relativa en disco (para servir la descarga)
  publicado   Boolean  @default(false)
  autorId     String?  // ID del admin que lo subió
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model EmbeddingDocument {
  id           String   @id @default(cuid())
  tipo         String   // "PESO" | "MEDIDAS" | "ACTIVIDAD" | "COMIDA" | "ARTICULO" | "DOCUMENTO"
  referenciaId String
  usuarioId    String?  // null para artículos y documentos (son globales)
  contenido    String   // texto plano para búsqueda
  embedding    Unsupported("vector(1536)")?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  usuarioId String?
  coachId   String?
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## RAG — Fuentes de contenido (decisión pendiente)

El Chat IA debe poder responder tanto sobre el historial personal del usuario
como sobre contenido informativo general (nutrición, ejercicio, bienestar).

Hay dos enfoques para alimentar el RAG con contenido informativo:

**Opción A — Carga de documentos (MVP)**: Coach o Admin sube PDFs/artículos al sistema.
El sistema los fragmenta y genera embeddings. Control total, sin dependencias externas.

**Opción B — Web scraping de URLs predefinidas (fase posterior)**: un cron job visita
URLs confiables predefinidas por el Admin, extrae el texto y actualiza los embeddings.
Más automatizado pero más frágil (cambios en los sitios rompen el scraping).

**Decisión**: Opción A implementada en Fase 3. El sistema soporta dos tipos de contenido global:
- **Artículos** (texto markdown creado via form) → `tipo = "ARTICULO"` en EmbeddingDocument
- **Documentos** (PDF/.docx subidos por el Admin) → `tipo = "DOCUMENTO"` en EmbeddingDocument

El texto se extrae automáticamente con `pdf-parse` (PDF) y `mammoth` (DOCX). Los archivos se guardan en `uploads/documentos/` localmente; en Fase 5 se migra a Supabase Storage.
Cuando se agregue scraping, simplemente se agrega `tipo = "DOCUMENTO_WEB"` sin tocar el resto del sistema. El campo `usuarioId = null` indica que el contenido es global (no pertenece a un usuario particular).

---

## RAG — Qué se indexa y para qué

| Tipo | Contenido indexado | Para qué sirve |
|---|---|---|
| `PESO` | "El día 15/04 pesé 87.3kg, bajé 0.4kg desde el registro anterior" | "¿Cuánto bajé este mes?" |
| `MEDIDAS` | "Cintura: 92cm, Cadera: 103cm — registro del 10/04" | "¿Cómo cambió mi cintura?" |
| `ACTIVIDAD` | "Caminata de 45 minutos el 12/04, estimé 280 calorías" | "¿Cuántos días hice ejercicio?" |
| `COMIDA` | "Almuerzo del 14/04: ensalada con pollo, aprox 450 cal" | "¿Qué comí esta semana?" |
| `ARTICULO` | Texto completo del artículo (global, no por usuario) | Preguntas sobre nutrición/ejercicio |
| `DOCUMENTO` | Texto extraído del PDF/.docx (global, no por usuario) | Preguntas sobre el contenido del documento |

El Chat IA combina:
- **Estadísticas en tiempo real**: peso actual, meta, días registrados, tendencia
- **RAG personal**: top-10 registros relevantes del usuario
- **RAG global**: artículos relacionados con la pregunta

---

## Variables de Entorno

```env
# Base de datos
DATABASE_URL="postgresql://alejandrogelormini@localhost:5432/aliado_saludable?schema=public"

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# IA
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
```

---

## Roadmap de Implementación

### Fase 0 — Setup ✅
- [x] Inicializar Turborepo con `apps/backend` (NestJS) y `apps/frontend` (Next.js)
- [x] Configurar packages/tsconfig y packages/types
- [x] ESLint v9, Prettier, tsconfig compartido con rutas relativas
- [x] GitHub Actions: lint + test en paralelo
- [x] Base de datos `aliado_saludable` creada en PostgreSQL local
- [x] `turbo lint` y `turbo build` pasan sin errores

### Fase 1 — Backend Core ✅
- [x] Schema Prisma + migración inicial (EmbeddingDocument diferido a Fase 3 — pgvector requiere compilación manual en macOS 13)
- [x] Auth completo: JWT + refresh tokens + RBAC (USUARIO / COACH / ADMIN)
- [x] Módulos: usuarios, progreso (peso + medidas + actividad), alimentación
- [x] Swagger docs (decoradores en todos los controllers, accesible en /api/docs)
- [x] Tests unitarios de auth — `auth.service.spec.ts`: 9 tests (register, validarCredenciales, refresh, logout)
- [x] bcryptjs en lugar de bcrypt (evita dependencia de binding nativo no compilable)

### Fase 2 — Dashboard + Progreso ✅
- [x] **Home/Landing page atractiva** — `/` Server Component, Fraunces + DM Sans, paleta crema/bosque/ámbar, animaciones CSS scroll-driven
- [x] Frontend base: layout con sidebar (bg-forest, rounded-r-3xl), auth guard con mounted check anti-hydration, Zustand stores, Axios + Tanstack Query
- [x] Dashboard con gráfico de peso (Recharts AreaChart, dynamic SSR-off), tarjetas de métricas, balance calórico diario y resumen semanal
- [x] Registro de peso y medidas — `/progreso`, tabs Peso/Medidas, formularios RHF+Zod, historial con timeline
- [x] Registro de actividad física — `/actividad`, selector visual de tipo (5 botones), calorías requeridas, historial con badges por tipo
- [x] Registro de comidas — `/alimentacion`, selector de momento, textarea libre, calorías requeridas, navegador de fechas (prev/next), vista del día agrupada por momento
- [x] **Balance calórico** — `calorias` NOT NULL en schema, endpoint `GET /progreso/resumen-calorias`, tarjeta "Balance de hoy" en dashboard (consumidas / quemadas / neto)
- [x] Tests unitarios de progreso y alimentación — `progreso.service.spec.ts`: 14 tests (crearPeso/Medidas/Actividad con RAG fire-and-forget, listarX con paginación, resumenCalorias null→0/déficit/rango 24hs); `alimentacion.service.spec.ts`: 8 tests (crearComida con fecha/RAG/usuarioId, listarComidasDelDia con rango 24hs y orden asc)

### Fase 3 — Contenido + Chat IA ✅
- [x] **T1: Backend módulo de artículos** — CRUD completo, RBAC (ADMIN escribe, USUARIO lee), paginación + filtro por categoría, Swagger decorado
- [x] **T1b: Documentos PDF/.docx** — upload multipart, extracción de texto (pdf-parse 1.1.1 / mammoth), almacenamiento en disco, descarga del original; modelo `Documento` en schema
- [x] **T2: pgvector** — compilado desde fuente (v0.8.0, macOS 13), extension habilitada, modelo `EmbeddingDocument` con `embedding Unsupported("vector(1536)")`, migración aplicada
- [x] **T3: RAG** — `RagService` con indexación fire-and-forget en Progreso, Alimentacion, Contenido y Documento; búsqueda vectorial con operador `<=>` via `$queryRaw`
- [x] **T4: Chat IA backend** — `POST /ai/chat` (JwtAuthGuard), RAG + GPT-4o-mini, system prompt en español rioplatense, sin streaming en MVP
- [x] **T5: Frontend sección `/contenido`** — artículos con filtro por categoría + CRUD admin (crear/editar/eliminar via modal RHF+Zod); documentos con descarga blob autenticada + CRUD admin (upload fetch nativo, toggle publicado, eliminar); hooks `useArticulos`, `useArticulo`, `useDocumentos`; detalle de artículo en `/contenido/[id]` con markdown básico
- [x] **T6: Frontend chat `/chat`** — interfaz de mensajería completa; historial persistido en localStorage (`"aliado-chat-history"`, límite 100 msgs); burbujas usuario/asistente; indicador de escritura; sugerencias en estado vacío; botón "Nueva conversación"
- [x] Tests unitarios de contenido — `contenido.service.spec.ts`: 21 tests (crearArticulo con RAG/autorId/publicado default, listarArticulos con soloPublicados/categoría/paginación, obtenerArticulo con 404/borrador, actualizarArticulo con re-indexación RAG solo si cambia texto, eliminarArticulo con RAG antes de delete); `documento.service.spec.ts`: 21 tests (crearDocumento con extracción pdf-parse/mammoth mockeados, writeFileSync mockeado via `jest.mock('fs')`, RAG fire-and-forget, MIME inválido; listarDocumentos; actualizarDocumento; eliminarDocumento con unlinkSync condicional y RAG antes de delete)

### Fase 4 — Panel Coach ✅ (T7 descartada)
- [x] **T1: Migración schema** — `coachProfileId String? @unique` en `Usuario`; relaciones nombradas `"PacienteDeCoach"` y `"PerfilDelCoach"`; migración via SQL manual + `prisma migrate resolve --applied`
- [x] **T2: Backend CoachesModule** — `GET /coaches/mis-pacientes` (lista + último peso + actividadReciente 7 días); `GET /coaches/pacientes/:id/resumen` (últimos 10 pesos, última medida, 7 actividades, comidas hoy, balance calórico hoy). Valida que el paciente pertenezca al coach.
- [x] **T3: Backend AdminModule** — `POST /admin/coaches` (transacción: crea Coach + Usuario rol=COACH); `GET /admin/coaches`; `PATCH /admin/coaches/:id` (edita + sincroniza al Usuario); `POST /admin/coaches/:id/convertir-a-paciente` (transacción 4 pasos); `GET /admin/pacientes`; `POST|DELETE /admin/pacientes/:id/asignar-coach`
- [x] **T4: Frontend layout coach** — `CoachSidebar` (bg-forest, badge "Panel Coach", link "← Mi Dashboard"); `(coach)/layout.tsx` (auth guard doble); `Sidebar.tsx` del dashboard con sección "Coach" para rol=COACH y sección "Admin" para rol=ADMIN
- [x] **T4b: Frontend panel admin** — `/admin/coaches` (drawer lateral con editar especialidad, lista pacientes del coach, zona de peligro + modal confirmación "Convertir a Paciente", modal crear coach RHF+Zod); `/admin/pacientes` (dropdown + asignar/quitar coach por fila, loading por paciente); `hooks/useAdmin.ts`
- [x] **T5: Frontend lista de pacientes** — `/coach/pacientes`: grid de tarjetas con avatar, último peso + fecha relativa local, badge actividadReciente (verde/ámbar/rojo), botón "Ver detalle"; states: loading skeletons, error, empty; `hooks/useCoach.ts`
- [x] **T6: Frontend detalle de paciente** — `/coach/pacientes/[id]`: cabecera con meta y altura, gráfico Recharts (AreaChart + gradiente + label último punto), medidas corporales (solo las no-null), balance calórico hoy (verde/rojo), actividad reciente con emojis, comidas de hoy; manejo 403/404 vs error genérico
- [x] Tests unitarios de coaches y admin — `coaches.service.spec.ts`: 8 tests (misPacientes sin perfil/sin pacientes/con actividad, resumenPaciente forbidden/sin passwordHash/balance calórico); `admin.service.spec.ts`: 15 tests (crearCoach conflicto email/transacción/hash password, listarCoaches sin passwordHash, editarCoach sincroniza Usuario, convertirAPaciente transacción 4 pasos, asignarCoach/desasignarCoach)
- [ ] **T7: Notificaciones básicas** — descartada para el MVP (no agrega valor para la demo de Workana)

### Tests Unitarios — Estado Final (pre-Fase 5)
**107 tests, 8 suites, todos pasando.** Cobertura de todos los servicios de negocio relevantes para la demo:

| Suite | Tests |
|---|---|
| `auth/auth.service.spec.ts` | 9 |
| `coaches/coaches.service.spec.ts` | 8 |
| `admin/admin.service.spec.ts` | 15 |
| `progreso/progreso.service.spec.ts` | 14 |
| `alimentacion/alimentacion.service.spec.ts` | 8 |
| `contenido/contenido.service.spec.ts` | 21 |
| `contenido/documento.service.spec.ts` | 21 |
| `app.controller.spec.ts` | 1 |

Pendiente menor: `usuarios/usuarios.service.spec.ts` (CRUD de perfil — no bloqueante para demo). Frontend sin tests (no bloqueante).

### Fase 5 — Hardening + Deploy DEMO ⬜
- [ ] Rate limiting + logging estructurado
- [ ] Tests E2E básicos (los unitarios ya están completos — 107 tests)
- [ ] Deploy: Supabase + Render + Vercel
- [ ] Demo lista para presentar en Workana

---

## Reglas para esta Conversación

- Idioma: español siempre
- No escribir código hasta que se confirme el inicio de cada fase
- Al iniciar cada fase, confirmar el plan antes de implementar
- Seguir las convenciones de NestJS estándar
- Cada feature debe tener tests antes de ser considerada completa
- No reabrir decisiones técnicas ya tomadas
- Explicaciones didácticas cuando aparecen conceptos o patrones nuevos
- **Usar JSDoc y comentarios didácticos en todo el código**: cada clase, método, función,
  interfaz y tipo debe tener su JSDoc explicando qué hace, por qué existe y cómo usarlo.
  El objetivo es que cualquier desarrollador pueda entender el código sin contexto previo.
