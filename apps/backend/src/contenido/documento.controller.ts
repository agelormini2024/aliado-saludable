import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { Response } from "express";
import { DocumentoService, DocumentosResult, MIME_TYPES_PERMITIDOS } from "./documento.service";
import { UpdateDocumentoDto } from "./dto/update-documento.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Usuario, RolUsuario, Documento } from "@prisma/client";

/**
 * DocumentoController — endpoints de carga y gestión de documentos (PDF/.docx).
 *
 * El archivo se recibe via multipart/form-data. NestJS usa Multer con memoryStorage
 * (el buffer está disponible en memoria) y DocumentoService lo persiste en disco
 * y extrae el texto para RAG.
 *
 * Rutas:
 * - POST   /contenido/documentos              → subir documento (solo ADMIN)
 * - GET    /contenido/documentos              → listar documentos
 * - GET    /contenido/documentos/:id          → detalle de un documento
 * - PATCH  /contenido/documentos/:id          → editar nombre / publicar (solo ADMIN)
 * - DELETE /contenido/documentos/:id          → eliminar (solo ADMIN)
 * - GET    /contenido/documentos/:id/descargar → descargar archivo original
 */
@ApiTags("Contenido")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("contenido")
export class DocumentoController {
  constructor(private readonly documentoService: DocumentoService) {}

  // ─── CARGA ───────────────────────────────────────────────────────────────────

  /**
   * Sube un archivo PDF o DOCX. Multer lo mantiene en memoria (memoryStorage)
   * para que DocumentoService pueda leer el buffer y extraer el texto antes
   * de escribirlo en disco.
   */
  @ApiOperation({ summary: "Subir documento PDF o DOCX (solo ADMIN)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "Archivo PDF o DOCX",
    schema: {
      type: "object",
      properties: {
        archivo: { type: "string", format: "binary" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Documento cargado y texto extraído exitosamente" })
  @ApiResponse({ status: 400, description: "Tipo de archivo no soportado o sin contenido extraíble" })
  @ApiResponse({ status: 403, description: "Acceso denegado — se requiere rol ADMIN" })
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @UseInterceptors(
    FileInterceptor("archivo", {
      // memoryStorage: el buffer queda disponible en archivo.buffer
      // sin guardar nada en disco — DocumentoService decide la ruta final
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máximo
      fileFilter: (_req, file, callback) => {
        if ((MIME_TYPES_PERMITIDOS as readonly string[]).includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              "Solo se aceptan archivos PDF (.pdf) o Word (.docx)",
            ),
            false,
          );
        }
      },
    }),
  )
  @Post("documentos")
  async subirDocumento(
    @CurrentUser() usuario: Usuario,
    @UploadedFile() archivo: Express.Multer.File,
  ): Promise<{ data: Documento }> {
    if (!archivo) {
      throw new BadRequestException("No se recibió ningún archivo. Enviá el campo 'archivo' como multipart/form-data.");
    }

    const documento = await this.documentoService.crearDocumento(usuario.id, archivo);
    return { data: documento };
  }

  // ─── LECTURA ─────────────────────────────────────────────────────────────────

  /**
   * Lista documentos. Usuarios ven solo publicados; Admin ve todos.
   */
  @ApiOperation({ summary: "Listar documentos (publicados para usuarios, todos para admin)" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @Get("documentos")
  async listarDocumentos(
    @CurrentUser() usuario: Usuario,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<DocumentosResult> {
    const esAdmin = usuario.rol === RolUsuario.ADMIN;

    return this.documentoService.listarDocumentos({
      soloPublicados: !esAdmin,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    });
  }

  /**
   * Devuelve el detalle de un documento, incluyendo el texto extraído.
   */
  @ApiOperation({ summary: "Detalle de un documento" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  @Get("documentos/:id")
  async obtenerDocumento(
    @CurrentUser() usuario: Usuario,
    @Param("id") id: string,
  ): Promise<{ data: Documento }> {
    const esAdmin = usuario.rol === RolUsuario.ADMIN;
    const doc = await this.documentoService.obtenerDocumento(id, !esAdmin);
    return { data: doc };
  }

  /**
   * Sirve el archivo original para descarga directa.
   * Usa el nombre original del archivo como Content-Disposition.
   */
  @ApiOperation({ summary: "Descargar archivo original del documento" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  @Get("documentos/:id/descargar")
  async descargarDocumento(
    @CurrentUser() usuario: Usuario,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const esAdmin = usuario.rol === RolUsuario.ADMIN;
    const rutaAbsoluta = await this.documentoService.obtenerRutaArchivo(id, !esAdmin);
    const doc = await this.documentoService.obtenerDocumento(id, !esAdmin);

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.nombre)}"`);
    res.setHeader("Content-Type", doc.mimeType);
    res.sendFile(rutaAbsoluta);
  }

  // ─── ESCRITURA (solo ADMIN) ───────────────────────────────────────────────────

  /**
   * Edita el nombre visible o el estado de publicación de un documento.
   */
  @ApiOperation({ summary: "Actualizar nombre / publicar documento (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  @ApiResponse({ status: 403, description: "Acceso denegado — se requiere rol ADMIN" })
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Patch("documentos/:id")
  async actualizarDocumento(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentoDto,
  ): Promise<{ data: Documento }> {
    const doc = await this.documentoService.actualizarDocumento(id, dto);
    return { data: doc };
  }

  /**
   * Elimina el documento de la BD y su archivo del disco.
   */
  @ApiOperation({ summary: "Eliminar documento (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del documento" })
  @ApiResponse({ status: 404, description: "Documento no encontrado" })
  @ApiResponse({ status: 403, description: "Acceso denegado — se requiere rol ADMIN" })
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Delete("documentos/:id")
  async eliminarDocumento(@Param("id") id: string): Promise<{ data: Documento }> {
    const doc = await this.documentoService.eliminarDocumento(id);
    return { data: doc };
  }
}
