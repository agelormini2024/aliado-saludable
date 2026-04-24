-- CreateTable
CREATE TABLE "EmbeddingDocument" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "contenido" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmbeddingDocument_tipo_usuarioId_idx" ON "EmbeddingDocument"("tipo", "usuarioId");
