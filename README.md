# Aliado Saludable

Plataforma web SaaS para seguimiento de salud y pérdida de peso, con chat IA personalizado mediante RAG (Retrieval-Augmented Generation). Diseñada para usuarios finales y profesionales de la salud (coaches/nutricionistas) con un modelo multi-tenant.

**Demo en producción:** https://aliado-saludable-frontend.vercel.app

---

## Características principales

- **Seguimiento de progreso** — registro de peso, medidas corporales y actividad física con gráficos históricos
- **Registro de alimentación** — comidas diarias con balance calórico (consumidas vs. quemadas)
- **Chat IA con RAG** — responde preguntas usando el historial real del usuario + artículos y documentos del sistema
- **Panel de coach** — los nutricionistas/entrenadores monitorean el progreso de sus pacientes
- **Panel de administrador** — gestión de coaches, pacientes y contenido informativo
- **Contenido informativo** — artículos y documentos PDF/.docx subidos por el admin, accesibles para todos los usuarios

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | NestJS (TypeScript) |
| Frontend | Next.js 15 (TypeScript, App Router) |
| Base de datos | PostgreSQL + Prisma ORM |
| Búsqueda vectorial | pgvector + OpenAI embeddings |
| Autenticación | JWT (access + refresh tokens) + RBAC |
| Estado del cliente | Tanstack Query + Zustand |
| Estilos | Tailwind CSS v4 |
| Formularios | React Hook Form + Zod |
| IA | OpenAI gpt-4o-mini + text-embedding-3-small |
| Storage (archivos) | Supabase Storage |
| Monorepo | Turborepo + pnpm workspaces |

---

## Estructura del repositorio

```
aliado-saludable/
├── apps/
│   ├── backend/          # NestJS API REST
│   │   ├── src/
│   │   │   ├── auth/           # JWT, refresh tokens, guards, RBAC
│   │   │   ├── usuarios/       # Perfil de usuario
│   │   │   ├── progreso/       # Peso, medidas, actividad física
│   │   │   ├── alimentacion/   # Registro de comidas
│   │   │   ├── contenido/      # Artículos y documentos PDF/.docx
│   │   │   ├── ai/             # Chat IA + RAG (embeddings + búsqueda vectorial)
│   │   │   ├── coaches/        # Panel del coach
│   │   │   ├── admin/          # Gestión de coaches y pacientes
│   │   │   └── common/         # StorageService, filtros, paginación
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts         # Datos de demo
│   └── frontend/         # Next.js App Router
│       ├── app/
│       │   ├── page.tsx        # Landing pública
│       │   ├── (auth)/         # Login y registro
│       │   ├── (dashboard)/    # Dashboard principal (usuario, coach, admin)
│       │   └── (coach)/        # Panel exclusivo de coaches
│       ├── components/
│       ├── hooks/              # Tanstack Query hooks
│       ├── stores/             # Zustand (auth + UI)
│       └── lib/                # Axios, helpers de fecha
└── packages/
    └── tsconfig/         # Configuración TypeScript compartida
```

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| `USUARIO` | Dashboard, progreso, alimentación, chat IA, contenido |
| `COACH` | Todo lo anterior + panel `/coach/pacientes` para ver el progreso de sus pacientes |
| `ADMIN` | Todo lo anterior + `/admin/coaches` y `/admin/pacientes` para gestión, y CRUD de contenido |

---

## Cómo correr el proyecto localmente

### Requisitos previos

- Node.js >= 20
- pnpm >= 10
- PostgreSQL con extensión `pgvector` instalada
- Cuenta de OpenAI (para embeddings y chat)

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd aliado-saludable
pnpm install
```

### 2. Configurar variables de entorno del backend

Crear `apps/backend/.env`:

```env
# Base de datos
DATABASE_URL="postgresql://usuario:password@localhost:5432/aliado_saludable?schema=public"

# Auth
JWT_SECRET=tu_jwt_secret_muy_largo
JWT_REFRESH_SECRET=tu_refresh_secret_muy_largo
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend (para CORS)
FRONTEND_URL=http://localhost:3000

# IA
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini

# Supabase Storage (para archivos PDF/.docx)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### 3. Configurar variables de entorno del frontend

Crear `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Configurar la base de datos

```bash
# Habilitar pgvector (solo una vez, requiere la extensión instalada)
psql aliado_saludable -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Aplicar migraciones
cd apps/backend
npx prisma migrate deploy

# (Opcional) Cargar datos de demo
npx prisma db seed
```

### 5. Correr en desarrollo

```bash
# Desde la raíz del monorepo
pnpm dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- Swagger docs: http://localhost:3001/api/docs

---

## Deploy en producción

El stack de producción usa:
- **Base de datos:** Supabase (PostgreSQL + pgvector nativo + Storage para archivos)
- **Backend:** Render (plan Starter, sin cold starts)
- **Frontend:** Vercel

### Variables de entorno en Render (backend)

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL del Session pooler de Supabase **con puerto 5432** (no 6543) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://tu-frontend.vercel.app` (sin trailing slash) |
| `JWT_SECRET` | secreto largo y aleatorio |
| `JWT_REFRESH_SECRET` | secreto largo y aleatorio |
| `OPENAI_API_KEY` | tu clave de OpenAI |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key de Supabase |

> **Importante:** Usar el Session pooler de Supabase (puerto 5432), no el Transaction pooler (puerto 6543). Prisma usa prepared statements que el modo Transaction no soporta.

### Build y start en Render

```
Build command: npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @aliado/backend build
Start command: node apps/backend/dist/main.js
```

### Variables de entorno en Vercel (frontend)

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL del backend en Render |

### Crear el primer usuario ADMIN

1. Registrarse desde la app con tu email
2. Ejecutar en el SQL Editor de Supabase:

```sql
UPDATE "Usuario" SET rol = 'ADMIN' WHERE email = 'tu@email.com';
```

---

## Datos de demo

El seed crea 3 usuarios con 30 días de datos realistas:

| Email | Nombre | Peso inicial → meta |
|---|---|---|
| maria.gonzalez@demo.com | María González | 84 kg → 68 kg |
| carlos.rodriguez@demo.com | Carlos Rodríguez | 97 kg → 82 kg |
| laura.martinez@demo.com | Laura Martínez | 71 kg → 63 kg |

Contraseña para todos: `Demo1234!`

Cada usuario tiene: 11 registros de peso (tendencia descendente), 3 tomas de medidas, 15 sesiones de actividad y ~28 comidas distribuidas en 8 días.

---

## Tests

```bash
# Todos los tests unitarios del backend
cd apps/backend
pnpm test

# Un módulo específico
pnpm test auth
pnpm test contenido
```

108 tests unitarios distribuidos en 8 suites cubriendo todos los servicios de negocio: auth, progreso, alimentación, contenido, documentos, coaches y admin.

---

## Decisiones de arquitectura relevantes

- **RAG fire-and-forget:** la indexación de embeddings nunca bloquea al usuario. Si OpenAI falla, el error se loguea pero la operación del usuario (registrar peso, guardar comida, etc.) siempre tiene éxito.
- **Historial del chat en localStorage:** el contexto del asistente viene del RAG, no del historial de la UI. Cada request al backend es independiente. Límite de 100 mensajes en el cliente.
- **Calorías obligatorias:** `calorias` es `NOT NULL` en actividad y comidas. El balance calórico diario es una feature central del dashboard y del contexto RAG — sin datos consistentes, no funciona.
- **Sin Redis:** el rate limiting usa un store en memoria (suficiente para el MVP). Se reinicia al reiniciar el proceso.
- **Logging estructurado:** `nestjs-pino` en JSON en producción, `pino-pretty` en desarrollo.
- **Rate limiting:** 100 req/60s por IP globalmente; 5 req/60s en endpoints de autenticación.
