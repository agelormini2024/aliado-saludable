/**
 * Script de re-indexación RAG para los usuarios de demo.
 *
 * El seed carga datos directamente en la DB sin pasar por los servicios de NestJS,
 * por lo que los registros no tienen embeddings en EmbeddingDocument. Este script
 * los genera usando la misma lógica que RagService.
 *
 * Cómo correr (desde apps/backend/):
 *   DATABASE_URL="postgresql://..." OPENAI_API_KEY="sk-..." npx ts-node --transpile-only prisma/reindexar-seed.ts
 *
 * O con las variables ya en el .env:
 *   npx ts-node --transpile-only prisma/reindexar-seed.ts
 */

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
/*
Se puede usar import pero el editor tira error aunque funcione al correr el script, por eso dejo el require. Si quieren usar import, descomenten esto y comenten el require de abajo:
* import * as dotenv from "dotenv";
* dotenv.config();
*/

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();


const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

const EMAILS_DEMO = [
  "maria.gonzalez@demo.com",
  "carlos.rodriguez@demo.com",
  "laura.martinez@demo.com",
];

// ─── Helpers de texto (igual que RagService) ────────────────────────────────

function formatFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function textoParaPeso(r: { peso: number; fecha: Date; nota: string | null }): string {
  const nota = r.nota ? `. Nota: ${r.nota}` : "";
  return `El ${formatFecha(r.fecha)} registré un peso de ${r.peso} kg${nota}.`;
}

function textoParaMedidas(r: {
  fecha: Date;
  cintura: number | null;
  cadera: number | null;
  pecho: number | null;
  brazo: number | null;
  muslo: number | null;
}): string {
  const partes: string[] = [];
  if (r.cintura != null) partes.push(`cintura ${r.cintura} cm`);
  if (r.cadera != null) partes.push(`cadera ${r.cadera} cm`);
  if (r.pecho != null) partes.push(`pecho ${r.pecho} cm`);
  if (r.brazo != null) partes.push(`brazo ${r.brazo} cm`);
  if (r.muslo != null) partes.push(`muslo ${r.muslo} cm`);
  const medidas = partes.length > 0 ? partes.join(", ") : "sin medidas registradas";
  return `Medidas corporales del ${formatFecha(r.fecha)}: ${medidas}.`;
}

function textoParaActividad(r: {
  tipo: string;
  fecha: Date;
  duracion: number;
  calorias: number;
  nota: string | null;
}): string {
  const nota = r.nota ? `. Nota: ${r.nota}` : "";
  return `${r.tipo} el ${formatFecha(r.fecha)}: ${r.duracion} minutos de ejercicio, ${r.calorias} calorías quemadas${nota}.`;
}

function textoParaComida(r: {
  momento: string;
  fecha: Date;
  descripcion: string;
  calorias: number;
}): string {
  return `${r.momento} del ${formatFecha(r.fecha)}: ${r.descripcion} (${r.calorias} calorías).`;
}

// ─── Embedding + persistencia ────────────────────────────────────────────────

async function generarEmbedding(texto: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texto.trim().slice(0, 8000),
  });
  return res.data[0].embedding;
}

async function indexar(params: {
  tipo: string;
  referenciaId: string;
  usuarioId: string | null;
  contenido: string;
}): Promise<void> {
  const { tipo, referenciaId, usuarioId, contenido } = params;

  const embedding = await generarEmbedding(contenido);
  const vectorStr = `[${embedding.join(",")}]`;

  const existente = await prisma.embeddingDocument.findFirst({
    where: { tipo, referenciaId },
    select: { id: true },
  });

  if (existente) {
    await prisma.$executeRaw`
      UPDATE "EmbeddingDocument"
      SET contenido   = ${contenido},
          embedding   = ${vectorStr}::vector,
          "updatedAt" = NOW()
      WHERE id = ${existente.id}
    `;
  } else {
    const nuevo = await prisma.embeddingDocument.create({
      data: { tipo, referenciaId, usuarioId, contenido },
      select: { id: true },
    });
    await prisma.$executeRaw`
      UPDATE "EmbeddingDocument"
      SET embedding = ${vectorStr}::vector
      WHERE id = ${nuevo.id}
    `;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Buscando usuarios demo...");

  const usuarios = await prisma.usuario.findMany({
    where: { email: { in: EMAILS_DEMO } },
    select: { id: true, email: true },
  });

  if (usuarios.length === 0) {
    console.error("No se encontraron usuarios demo. Corré el seed primero.");
    process.exit(1);
  }

  console.log(`Usuarios encontrados: ${usuarios.map((u) => u.email).join(", ")}\n`);

  for (const usuario of usuarios) {
    console.log(`── ${usuario.email}`);

    const [pesos, medidas, actividades, comidas] = await Promise.all([
      prisma.registroPeso.findMany({ where: { usuarioId: usuario.id } }),
      prisma.registroMedidas.findMany({ where: { usuarioId: usuario.id } }),
      prisma.registroActividad.findMany({ where: { usuarioId: usuario.id } }),
      prisma.registroComida.findMany({ where: { usuarioId: usuario.id } }),
    ]);

    const total = pesos.length + medidas.length + actividades.length + comidas.length;
    console.log(
      `   ${pesos.length} pesos, ${medidas.length} medidas, ${actividades.length} actividades, ${comidas.length} comidas → ${total} embeddings`,
    );

    let procesados = 0;

    for (const r of pesos) {
      await indexar({ tipo: "PESO", referenciaId: r.id, usuarioId: usuario.id, contenido: textoParaPeso(r) });
      procesados++;
      process.stdout.write(`\r   Procesados: ${procesados}/${total}`);
    }

    for (const r of medidas) {
      await indexar({ tipo: "MEDIDAS", referenciaId: r.id, usuarioId: usuario.id, contenido: textoParaMedidas(r) });
      procesados++;
      process.stdout.write(`\r   Procesados: ${procesados}/${total}`);
    }

    for (const r of actividades) {
      await indexar({ tipo: "ACTIVIDAD", referenciaId: r.id, usuarioId: usuario.id, contenido: textoParaActividad(r) });
      procesados++;
      process.stdout.write(`\r   Procesados: ${procesados}/${total}`);
    }

    for (const r of comidas) {
      await indexar({ tipo: "COMIDA", referenciaId: r.id, usuarioId: usuario.id, contenido: textoParaComida(r) });
      procesados++;
      process.stdout.write(`\r   Procesados: ${procesados}/${total}`);
    }

    console.log(`\r   Listo. ${procesados} embeddings generados.`);
  }

  console.log("\nRe-indexación completa.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
