import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../database/prisma.service";
import type {
  RegistroPeso,
  RegistroMedidas,
  RegistroActividad,
  RegistroComida,
  Articulo,
  Documento,
} from "@prisma/client";

/**
 * Fragmento recuperado por la búsqueda vectorial.
 * `distancia` es la distancia coseno (<=>): 0 = idéntico, 2 = opuesto.
 */
export interface ResultadoBusqueda {
  id: string;
  tipo: string;
  referenciaId: string;
  usuarioId: string | null;
  contenido: string;
  distancia: number;
}

/**
 * RagService — núcleo del sistema RAG (Retrieval-Augmented Generation).
 *
 * Responsabilidades:
 * 1. **Generación de texto**: convierte registros de Prisma a texto natural
 *    listo para vectorizar (ej: "El 23 de abril registré 87 kg")
 * 2. **Indexación**: llama a OpenAI Embeddings y persiste el vector en
 *    EmbeddingDocument via $executeRaw (Prisma no soporta el tipo vector nativo)
 * 3. **Búsqueda**: dado un texto de consulta, devuelve los fragmentos más
 *    similares mezclando historial personal del usuario con contenido global
 *
 * El campo `embedding` usa `Unsupported("vector(1536)")` en el schema de Prisma,
 * por lo que toda lectura/escritura del vector se hace via $queryRaw / $executeRaw.
 * Para los campos escalares sí se usa Prisma ORM normalmente.
 *
 * La indexación se llama desde los servicios de negocio de forma "fire-and-forget"
 * (sin await) para que un error de OpenAI no rompa la operación principal del usuario.
 */
@Injectable()
export class RagService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(RagService.name);
  private readonly embeddingModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>("OPENAI_API_KEY"),
    });
    this.embeddingModel =
      this.config.get<string>("OPENAI_EMBEDDING_MODEL") ?? "text-embedding-3-small";
  }

  // ─── Texto natural por tipo de registro ──────────────────────────────────────

  /**
   * Formatea una fecha de Prisma como texto legible en español argentino.
   * "23 de abril de 2026"
   */
  private formatFecha(fecha: Date): string {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(fecha);
  }

  /**
   * Texto indexable para un registro de peso.
   * Ejemplo: "El 23 de abril de 2026 registré un peso de 87.3 kg."
   */
  textoParaPeso(registro: RegistroPeso): string {
    const fecha = this.formatFecha(registro.fecha);
    const nota = registro.nota ? `. Nota: ${registro.nota}` : "";
    return `El ${fecha} registré un peso de ${registro.peso} kg${nota}.`;
  }

  /**
   * Texto indexable para medidas corporales.
   * Solo incluye las medidas que no son null.
   * Ejemplo: "Medidas corporales del 23 de abril de 2026: cintura 90 cm, cadera 100 cm."
   */
  textoParaMedidas(registro: RegistroMedidas): string {
    const fecha = this.formatFecha(registro.fecha);
    const partes: string[] = [];
    if (registro.cintura != null) partes.push(`cintura ${registro.cintura} cm`);
    if (registro.cadera != null) partes.push(`cadera ${registro.cadera} cm`);
    if (registro.pecho != null) partes.push(`pecho ${registro.pecho} cm`);
    if (registro.brazo != null) partes.push(`brazo ${registro.brazo} cm`);
    if (registro.muslo != null) partes.push(`muslo ${registro.muslo} cm`);
    const medidas = partes.length > 0 ? partes.join(", ") : "sin medidas registradas";
    return `Medidas corporales del ${fecha}: ${medidas}.`;
  }

  /**
   * Texto indexable para un registro de actividad física.
   * Ejemplo: "GYM el 23 de abril de 2026: 60 minutos de ejercicio, 400 calorías quemadas."
   */
  textoParaActividad(registro: RegistroActividad): string {
    const fecha = this.formatFecha(registro.fecha);
    const nota = registro.nota ? `. Nota: ${registro.nota}` : "";
    return `${registro.tipo} el ${fecha}: ${registro.duracion} minutos de ejercicio, ${registro.calorias} calorías quemadas${nota}.`;
  }

  /**
   * Texto indexable para un registro de comida.
   * Ejemplo: "ALMUERZO del 23 de abril de 2026: ensalada con pollo (450 calorías)."
   */
  textoParaComida(registro: RegistroComida): string {
    const fecha = this.formatFecha(registro.fecha);
    return `${registro.momento} del ${fecha}: ${registro.descripcion} (${registro.calorias} calorías).`;
  }

  /**
   * Texto indexable para un artículo editorial.
   * El contenido se trunca a 6000 chars (~1500 tokens) para no exceder el límite
   * de text-embedding-3-small (8191 tokens).
   */
  textoParaArticulo(articulo: Articulo): string {
    const contenidoTruncado = articulo.contenido.slice(0, 6000);
    return `${articulo.titulo}\n\n${contenidoTruncado}`;
  }

  /**
   * Texto indexable para un documento PDF/DOCX.
   * El contenido extraído también se trunca a 6000 chars.
   */
  textoParaDocumento(documento: Documento): string {
    const contenidoTruncado = documento.contenido.slice(0, 6000);
    return `Documento: ${documento.nombre}\n\n${contenidoTruncado}`;
  }

  // ─── Embedding ────────────────────────────────────────────────────────────────

  /**
   * Llama a la API de OpenAI para vectorizar un texto.
   * Usa text-embedding-3-small que produce vectores de 1536 dimensiones.
   *
   * @param texto - Texto a vectorizar (se trunca automáticamente a 8000 chars)
   * @returns Array de 1536 floats
   */
  async generarEmbedding(texto: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: texto.trim().slice(0, 8000),
    });
    return response.data[0].embedding;
  }

  // ─── Indexación ───────────────────────────────────────────────────────────────

  /**
   * Indexa (o re-indexa) un fragmento de contenido en EmbeddingDocument.
   *
   * Flujo:
   * 1. Genera el embedding via OpenAI
   * 2. Si ya existe un EmbeddingDocument para (tipo, referenciaId) → actualiza
   * 3. Si no existe → crea el registro con Prisma (genera el cuid) y luego
   *    setea el campo vector con $executeRaw (Prisma ORM no puede escribir vector(1536))
   *
   * @param tipo - "PESO" | "MEDIDAS" | "ACTIVIDAD" | "COMIDA" | "ARTICULO" | "DOCUMENTO"
   * @param referenciaId - ID del registro original
   * @param usuarioId - ID del usuario; null para contenido global (artículos, documentos)
   * @param contenido - Texto plano a vectorizar y guardar
   */
  async indexar(params: {
    tipo: string;
    referenciaId: string;
    usuarioId: string | null;
    contenido: string;
  }): Promise<void> {
    const { tipo, referenciaId, usuarioId, contenido } = params;

    const embedding = await this.generarEmbedding(contenido);
    const vectorStr = `[${embedding.join(",")}]`;

    const existente = await this.prisma.embeddingDocument.findFirst({
      where: { tipo, referenciaId },
      select: { id: true },
    });

    if (existente) {
      await this.prisma.$executeRaw`
        UPDATE "EmbeddingDocument"
        SET contenido    = ${contenido},
            embedding    = ${vectorStr}::vector,
            "updatedAt"  = NOW()
        WHERE id = ${existente.id}
      `;
    } else {
      // Crear el registro con Prisma para obtener el cuid generado automáticamente
      const nuevo = await this.prisma.embeddingDocument.create({
        data: { tipo, referenciaId, usuarioId, contenido },
        select: { id: true },
      });
      // Setear el vector separado porque Prisma no puede escribir el tipo vector(1536)
      await this.prisma.$executeRaw`
        UPDATE "EmbeddingDocument"
        SET embedding = ${vectorStr}::vector
        WHERE id = ${nuevo.id}
      `;
    }
  }

  /**
   * Elimina todos los EmbeddingDocuments asociados a un registro original.
   * Llamar cuando se elimina un artículo, documento u otro registro indexado.
   *
   * @param referenciaId - ID del registro que fue eliminado
   */
  async eliminarPorReferencia(referenciaId: string): Promise<void> {
    await this.prisma.embeddingDocument.deleteMany({ where: { referenciaId } });
  }

  // ─── Búsqueda vectorial ───────────────────────────────────────────────────────

  /**
   * Recupera los fragmentos de contenido más similares a una consulta.
   *
   * La búsqueda mezcla:
   * - Historial personal del usuario (peso, medidas, actividad, comidas)
   * - Contenido global (artículos y documentos — usuarioId IS NULL)
   *
   * Usa el operador <=> de pgvector (distancia coseno).
   * Un valor de 0 indica vectores idénticos; 2 indica vectores opuestos.
   *
   * @param consulta - Pregunta o texto del usuario
   * @param usuarioId - ID del usuario autenticado
   * @param limite - Cantidad máxima de fragmentos a devolver (default: 10)
   * @returns Lista de fragmentos ordenados de más a menos relevante
   */
  async buscarSimilares(
    consulta: string,
    usuarioId: string,
    limite = 10,
  ): Promise<ResultadoBusqueda[]> {
    const embedding = await this.generarEmbedding(consulta);
    const vectorStr = `[${embedding.join(",")}]`;

    return this.prisma.$queryRaw<ResultadoBusqueda[]>`
      SELECT
        id,
        tipo,
        "referenciaId",
        "usuarioId",
        contenido,
        (embedding <=> ${vectorStr}::vector) AS distancia
      FROM "EmbeddingDocument"
      WHERE ("usuarioId" = ${usuarioId} OR "usuarioId" IS NULL)
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limite}
    `;
  }
}
