import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { ContenidoService, ArticulosResult } from "./contenido.service";
import { CreateArticuloDto } from "./dto/create-articulo.dto";
import { UpdateArticuloDto } from "./dto/update-articulo.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Usuario, RolUsuario, Articulo } from "@prisma/client";

/**
 * ContenidoController — endpoints de gestión y lectura de artículos.
 *
 * Todos los endpoints requieren autenticación (JwtAuthGuard).
 * Las rutas de escritura (POST, PATCH, DELETE) requieren además rol ADMIN (RolesGuard).
 *
 * Rutas:
 * - GET  /contenido/articulos        → lista artículos (publicados para USUARIO, todos para ADMIN)
 * - GET  /contenido/articulos/:id    → detalle de un artículo
 * - POST /contenido/articulos        → crear artículo (solo ADMIN)
 * - PATCH /contenido/articulos/:id   → editar artículo (solo ADMIN)
 * - DELETE /contenido/articulos/:id  → eliminar artículo (solo ADMIN)
 */
@ApiTags("Contenido")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("contenido")
export class ContenidoController {
  constructor(private readonly contenidoService: ContenidoService) {}

  // ─── LECTURA ─────────────────────────────────────────────────────────────────

  /**
   * Lista artículos con filtro opcional por categoría y paginación.
   * Los usuarios solo ven artículos publicados; el Admin ve todos.
   */
  @ApiOperation({ summary: "Listar artículos (publicados para usuarios, todos para admin)" })
  @ApiQuery({ name: "categoria", required: false, enum: ["NUTRICION", "EJERCICIO", "BIENESTAR"] })
  @ApiQuery({ name: "page", required: false, description: "Número de página (default: 1)" })
  @ApiQuery({ name: "limit", required: false, description: "Registros por página, máx 100 (default: 20)" })
  @Get("articulos")
  async listarArticulos(
    @CurrentUser() usuario: Usuario,
    @Query("categoria") categoria?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<ArticulosResult> {
    const esAdmin = usuario.rol === RolUsuario.ADMIN;

    return this.contenidoService.listarArticulos({
      soloPublicados: !esAdmin,
      categoria,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    });
  }

  /**
   * Devuelve el contenido completo de un artículo.
   * El Admin puede ver artículos no publicados; los usuarios solo ven los publicados.
   */
  @ApiOperation({ summary: "Obtener detalle de un artículo" })
  @ApiParam({ name: "id", description: "ID del artículo" })
  @ApiResponse({ status: 404, description: "Artículo no encontrado" })
  @Get("articulos/:id")
  async obtenerArticulo(
    @CurrentUser() usuario: Usuario,
    @Param("id") id: string,
  ): Promise<{ data: Articulo }> {
    const esAdmin = usuario.rol === RolUsuario.ADMIN;
    const articulo = await this.contenidoService.obtenerArticulo(id, !esAdmin);
    return { data: articulo };
  }

  // ─── ESCRITURA (solo ADMIN) ───────────────────────────────────────────────────

  /**
   * Crea un nuevo artículo. El autorId se extrae automáticamente del JWT.
   * El artículo queda no publicado por defecto hasta que se use PATCH.
   */
  @ApiOperation({ summary: "Crear artículo (solo ADMIN)" })
  @ApiResponse({ status: 201, description: "Artículo creado exitosamente" })
  @ApiResponse({ status: 403, description: "Acceso denegado — se requiere rol ADMIN" })
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Post("articulos")
  async crearArticulo(
    @CurrentUser() usuario: Usuario,
    @Body() dto: CreateArticuloDto,
  ): Promise<{ data: Articulo }> {
    const articulo = await this.contenidoService.crearArticulo(usuario.id, dto);
    return { data: articulo };
  }

  /**
   * Actualiza campos de un artículo existente.
   * Permite publicar un artículo enviando solo { publicado: true }.
   */
  @ApiOperation({ summary: "Actualizar artículo (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del artículo a actualizar" })
  @ApiResponse({ status: 404, description: "Artículo no encontrado" })
  @ApiResponse({ status: 403, description: "Acceso denegado — se requiere rol ADMIN" })
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Patch("articulos/:id")
  async actualizarArticulo(
    @Param("id") id: string,
    @Body() dto: UpdateArticuloDto,
  ): Promise<{ data: Articulo }> {
    const articulo = await this.contenidoService.actualizarArticulo(id, dto);
    return { data: articulo };
  }

  /**
   * Elimina un artículo definitivamente. Acción irreversible.
   */
  @ApiOperation({ summary: "Eliminar artículo (solo ADMIN)" })
  @ApiParam({ name: "id", description: "ID del artículo a eliminar" })
  @ApiResponse({ status: 404, description: "Artículo no encontrado" })
  @ApiResponse({ status: 403, description: "Acceso denegado — se requiere rol ADMIN" })
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Delete("articulos/:id")
  async eliminarArticulo(@Param("id") id: string): Promise<{ data: Articulo }> {
    const articulo = await this.contenidoService.eliminarArticulo(id);
    return { data: articulo };
  }
}
