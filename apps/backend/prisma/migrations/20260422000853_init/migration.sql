-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('USUARIO', 'COACH', 'ADMIN');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'USUARIO',
    "coachId" TEXT,
    "altura" DOUBLE PRECISION,
    "fechaNacimiento" TIMESTAMP(3),
    "meta" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "especialidad" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPeso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,

    CONSTRAINT "RegistroPeso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroMedidas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cintura" DOUBLE PRECISION,
    "cadera" DOUBLE PRECISION,
    "pecho" DOUBLE PRECISION,
    "brazo" DOUBLE PRECISION,
    "muslo" DOUBLE PRECISION,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroMedidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroActividad" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL,
    "calorias" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,

    CONSTRAINT "RegistroActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroComida" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "momento" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "calorias" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroComida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Articulo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT,
    "coachId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_email_key" ON "Coach"("email");

-- CreateIndex
CREATE INDEX "RegistroPeso_usuarioId_fecha_idx" ON "RegistroPeso"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "RegistroMedidas_usuarioId_fecha_idx" ON "RegistroMedidas"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "RegistroActividad_usuarioId_fecha_idx" ON "RegistroActividad"("usuarioId", "fecha");

-- CreateIndex
CREATE INDEX "RegistroComida_usuarioId_fecha_idx" ON "RegistroComida"("usuarioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPeso" ADD CONSTRAINT "RegistroPeso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroMedidas" ADD CONSTRAINT "RegistroMedidas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroActividad" ADD CONSTRAINT "RegistroActividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroComida" ADD CONSTRAINT "RegistroComida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
