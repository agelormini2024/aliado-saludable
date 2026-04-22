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
│       ├── layout.tsx
│       ├── pacientes/
│       └── pacientes/[id]/
├── components/
│   ├── providers.tsx            # QueryClientProvider + ReactQueryDevtools
│   ├── dashboard/
│   │   ├── Sidebar.tsx          # bg-forest, rounded-r-3xl, overlay mobile, amber active bar
│   │   ├── MobileHeader.tsx     # lg:hidden, hamburger, logo, avatar inicial
│   │   └── PesoChart.tsx        # Recharts AreaChart — importar con dynamic({ ssr: false })
│   └── chat/                    # ChatInterface, MessageBubble (Fase 3)
├── hooks/                       # Tanstack Query hooks por entidad
│   ├── useProgreso.ts           # usePesos, useMedidas, useActividad, useResumenCalorias
│   ├── useAlimentacion.ts       # useComidasDelDia(fecha?)
│   ├── useContenido.ts          # (Fase 3)
│   └── useChat.ts               # (Fase 3)
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
- [x] Tests unitarios de auth (9 tests: register, validarCredenciales, refresh, logout)
- [x] bcryptjs en lugar de bcrypt (evita dependencia de binding nativo no compilable)

### Fase 2 — Dashboard + Progreso ✅
- [x] **Home/Landing page atractiva** — `/` Server Component, Fraunces + DM Sans, paleta crema/bosque/ámbar, animaciones CSS scroll-driven
- [x] Frontend base: layout con sidebar (bg-forest, rounded-r-3xl), auth guard con mounted check anti-hydration, Zustand stores, Axios + Tanstack Query
- [x] Dashboard con gráfico de peso (Recharts AreaChart, dynamic SSR-off), tarjetas de métricas, balance calórico diario y resumen semanal
- [x] Registro de peso y medidas — `/progreso`, tabs Peso/Medidas, formularios RHF+Zod, historial con timeline
- [x] Registro de actividad física — `/actividad`, selector visual de tipo (5 botones), calorías requeridas, historial con badges por tipo
- [x] Registro de comidas — `/alimentacion`, selector de momento, textarea libre, calorías requeridas, navegador de fechas (prev/next), vista del día agrupada por momento
- [x] **Balance calórico** — `calorias` NOT NULL en schema, endpoint `GET /progreso/resumen-calorias`, tarjeta "Balance de hoy" en dashboard (consumidas / quemadas / neto)

### Fase 3 — Contenido + Chat IA 🔄
- [x] **T1: Backend módulo de artículos** — CRUD completo, RBAC (ADMIN escribe, USUARIO lee), paginación + filtro por categoría, Swagger decorado
- [x] **T1b: Documentos PDF/.docx** — upload multipart, extracción de texto (pdf-parse / mammoth), almacenamiento en disco, descarga del original; modelo `Documento` en schema
- [ ] T2: pgvector: compilar desde fuente en macOS 13, migración + EmbeddingDocument
- [ ] T3: RAG: indexación de registros del usuario + artículos + documentos
- [ ] T4: Chat IA backend (POST /ai/chat, sin streaming en MVP)
- [ ] T5: Frontend: sección de artículos + documentos (`/contenido`)
- [ ] T6: Frontend: interfaz de chat (`/chat`)

### Fase 4 — Panel Coach ⬜
- [ ] Backend: módulo coaches, asignación de pacientes
- [ ] Frontend: panel coach con lista de pacientes y gráficos de progreso
- [ ] Notificaciones básicas (nuevo registro del paciente)

### Fase 5 — Hardening + Deploy DEMO ⬜
- [ ] Rate limiting + logging estructurado
- [ ] Tests E2E básicos
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
