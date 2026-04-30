import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RagService } from "../ai/rag.service";
import { StorageService } from "../common/storage/storage.service";
import { UpdateDocumentoDto } from "./dto/update-documento.dto";
import { Documento } from "@prisma/client";

// pdf-parse y mammoth no tienen typings perfectos — se importan con require
// para evitar problemas de interop con el sistema de módulos de NestJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

/** Tipos MIME aceptados para la carga de documentos */
export const MIME_TYPES_PERMITIDOS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** Resultado paginado de documentos */
export interface DocumentosResult {
  items: Documento[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * DocumentoService — lógica para cargar y gestionar documentos (PDF/.docx).
 *
 * El flujo de carga es:
 * 1. Multer recibe el archivo y lo mantiene en memoria (memoryStorage)
 * 2. DocumentoService extrae el texto plano del buffer
 * 3. StorageService sube el archivo a Supabase Storage (bucket "documentos")
 * 4. Se guarda en BD el nombre, mimeType, ruta en Storage y el texto extraído
 *
 * Por qué Supabase Storage en lugar de disco local (D10 revisado para Fase 5):
 * El filesystem de Render es efímero — se resetea en cada deploy. Supabase Storage
 * persiste los archivos y los sirve correctamente en producción.
 *
 * El texto extraído (`contenido`) es lo que se indexa en EmbeddingDocument
 * para que el chat IA pueda responder preguntas basadas en el contenido del documento.
 */
@Injectable()
export class DocumentoService {
  private readonly logger = new Logger(DocumentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Extrae el texto plano de un archivo PDF o DOCX.
   *
   * @param buffer - Contenido del archivo en memoria
   * @param mimeType - Tipo MIME del archivo para determinar el parser
   * @throws BadRequestException si el tipo MIME no está soportado o la extracción falla
   */
  async extraerTexto(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === "application/pdf") {
      const resultado = await pdfParse(buffer);
      return resultado.text.trim();
    }

    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const resultado = await mammoth.extractRawText({ buffer });
      return resultado.value.trim();
    }

    throw new BadRequestException(
      `Tipo de archivo no soportado: ${mimeType}. Solo se aceptan PDF y DOCX.`,
    );
  }

  /**
   * Procesa un archivo recién subido por Multer y lo persiste en la BD.
   *
   * Flujo: extraer texto → subir a Supabase Storage → guardar en BD → indexar en RAG.
   *
   * @param autorId - ID del admin que sube el archivo (del JWT)
   * @param archivo - Objeto de archivo de Multer (memoryStorage: el buffer ya está en memoria)
   * @returns El documento creado
   * @throws BadRequestException si el tipo MIME no es PDF ni DOCX, o si el documento está vacío
   */
  async crearDocumento(
    autorId: string,
    archivo: Express.Multer.File,
  ): Promise<Documento> {
    const contenido = await this.extraerTexto(archivo.buffer, archivo.mimetype);

    if (!contenido) {
      throw new BadRequestException(
        "No se pudo extraer texto del archivo. Verificá que el documento no esté vacío o protegido.",
      );
    }

    // Nombre único dentro del bucket — timestamp + nombre original sin espacios
    const storagePath = `${Date.now()}-${archivo.originalname.replace(/\s+/g, "_")}`;
    await this.storageService.upload(storagePath, archivo.buffer, archivo.mimetype);

    const documento = await this.prisma.documento.create({
      data: {
        nombre: archivo.originalname,
        mimeType: archivo.mimetype,
        contenido,
        archivoPath: storagePath,
        publicado: false,
        autorId,
      },
    });

    this.ragService
      .indexar({
        tipo: "DOCUMENTO",
        referenciaId: documento.id,
        usuarioId: null,
        contenido: this.ragService.textoParaDocumento(documento),
      })
      .catch((err) => this.logger.error(`Error indexando documento ${documento.id}:`, err));

    return documento;
  }

  /**
   * Lista documentos con paginación.
   *
   * @param soloPublicados - true para usuarios (solo ven publicados), false para admin (ve todos)
   * @param page - Número de página (empieza en 1)
   * @param limit - Registros por página (max 100)
   */
  async listarDocumentos(options: {
    soloPublicados?: boolean;
    page?: number;
    limit?: number;
  }): Promise<DocumentosResult> {
    const { soloPublicados = true, page = 1, limit = 20 } = options;

    const where: Record<string, unknown> = {};
    if (soloPublicados) where.publicado = true;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.documento.count({ where }),
      this.prisma.documento.findMany({
        where,
        // No incluir `contenido` en el listado — puede ser muy grande
        select: {
          id: true,
          nombre: true,
          mimeType: true,
          publicado: true,
          autorId: true,
          archivoPath: true,
          createdAt: true,
          updatedAt: true,
          // contenido se omite para mantener la respuesta liviana
          contenido: false,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items as unknown as Documento[],
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Devuelve un documento por su ID, incluyendo el contenido extraído.
   *
   * @param id - ID del documento
   * @param soloPublicado - Si true, lanza NotFoundException si no está publicado
   */
  async obtenerDocumento(id: string, soloPublicado = true): Promise<Documento> {
    const doc = await this.prisma.documento.findFirst({
      where: {
        id,
        ...(soloPublicado ? { publicado: true } : {}),
      },
    });

    if (!doc) {
      throw new NotFoundException(`Documento con id "${id}" no encontrado`);
    }

    return doc;
  }

  /**
   * Actualiza el nombre visible o el estado de publicación de un documento.
   *
   * @param id - ID del documento a actualizar
   * @param dto - Campos a actualizar
   */
  async actualizarDocumento(id: string, dto: UpdateDocumentoDto): Promise<Documento> {
    await this.obtenerDocumento(id, false);

    return this.prisma.documento.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
      },
    });
  }

  /**
   * Elimina un documento de la BD, sus embeddings de RAG y su archivo de Supabase Storage.
   *
   * @param id - ID del documento a eliminar
   */
  async eliminarDocumento(id: string): Promise<Documento> {
    const doc = await this.obtenerDocumento(id, false);

    // Eliminar embeddings antes de borrar el documento en BD
    await this.ragService.eliminarPorReferencia(id);

    // Eliminar el archivo de Supabase Storage (si falla, solo se loguea un warning)
    await this.storageService.delete(doc.archivoPath);

    return this.prisma.documento.delete({ where: { id } });
  }

  /**
   * Descarga el archivo de Supabase Storage y lo devuelve como Buffer.
   *
   * El controller usa este buffer para enviarlo directamente al cliente,
   * sin exponer URLs de Supabase ni requerir acceso directo al bucket.
   *
   * @param id - ID del documento
   * @param soloPublicado - Si true, solo los publicados son descargables por usuarios
   */
  async obtenerBufferArchivo(id: string, soloPublicado = true): Promise<{ buffer: Buffer; doc: Documento }> {
    const doc = await this.obtenerDocumento(id, soloPublicado);
    const buffer = await this.storageService.download(doc.archivoPath);
    return { buffer, doc };
  }
}
