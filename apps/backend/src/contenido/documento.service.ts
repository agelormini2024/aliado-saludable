import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../database/prisma.service";
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
 * 1. Multer recibe el archivo y lo guarda en disco (uploads/documentos/)
 * 2. DocumentoService extrae el texto plano del archivo
 * 3. Se guarda en DB el nombre, mimeType, ruta en disco y el texto extraído
 *
 * El texto extraído (`contenido`) es lo que se indexa en EmbeddingDocument (Fase 3)
 * para que el chat IA pueda responder preguntas basadas en el contenido del documento.
 */
@Injectable()
export class DocumentoService {
  constructor(private readonly prisma: PrismaService) {}

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
   * @param autorId - ID del admin que sube el archivo (del JWT)
   * @param archivo - Objeto de archivo de Multer (con path, originalname, mimetype, buffer)
   * @returns El documento creado
   * @throws BadRequestException si el tipo MIME no es PDF ni DOCX
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

    // Guardar el archivo en disco (Multer memoryStorage → escribir manualmente)
    const nombreArchivo = `${Date.now()}-${archivo.originalname.replace(/\s+/g, "_")}`;
    const rutaRelativa = path.join("uploads", "documentos", nombreArchivo);
    const rutaAbsoluta = path.join(process.cwd(), rutaRelativa);

    fs.writeFileSync(rutaAbsoluta, archivo.buffer);

    return this.prisma.documento.create({
      data: {
        nombre: archivo.originalname,
        mimeType: archivo.mimetype,
        contenido,
        archivoPath: rutaRelativa,
        publicado: false,
        autorId,
      },
    });
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
   * Elimina un documento de la BD y su archivo del disco.
   *
   * @param id - ID del documento a eliminar
   */
  async eliminarDocumento(id: string): Promise<Documento> {
    const doc = await this.obtenerDocumento(id, false);

    // Eliminar el archivo físico si existe
    const rutaAbsoluta = path.join(process.cwd(), doc.archivoPath);
    if (fs.existsSync(rutaAbsoluta)) {
      fs.unlinkSync(rutaAbsoluta);
    }

    return this.prisma.documento.delete({ where: { id } });
  }

  /**
   * Devuelve la ruta absoluta del archivo en disco para servirlo como descarga.
   *
   * @param id - ID del documento
   * @param soloPublicado - Si true, solo los publicados son descargables por usuarios
   */
  async obtenerRutaArchivo(id: string, soloPublicado = true): Promise<string> {
    const doc = await this.obtenerDocumento(id, soloPublicado);
    return path.join(process.cwd(), doc.archivoPath);
  }
}
