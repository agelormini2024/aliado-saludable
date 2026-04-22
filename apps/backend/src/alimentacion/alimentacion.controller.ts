import { Controller, Post, Get, Body, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { AlimentacionService } from "./alimentacion.service";
import { CreateComidaDto } from "./dto/create-comida.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Usuario, RegistroComida } from "@prisma/client";

/**
 * AlimentacionController — endpoints de registro y consulta de comidas
 *
 * Rutas:
 * - POST /alimentacion/comidas             → registrar una comida
 * - GET  /alimentacion/comidas?fecha=...   → comidas del día (default: hoy)
 */
@ApiTags("Alimentación")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("alimentacion")
export class AlimentacionController {
  constructor(private readonly alimentacionService: AlimentacionService) {}

  /**
   * Registra una nueva comida del día.
   *
   * @param usuario - Usuario autenticado (del JWT)
   * @param dto - Datos de la comida
   */
  @ApiOperation({ summary: "Registrar una comida" })
  @ApiResponse({ status: 201, description: "Comida registrada exitosamente" })
  @Post("comidas")
  async crearComida(
    @CurrentUser() usuario: Usuario,
    @Body() dto: CreateComidaDto,
  ): Promise<{ data: RegistroComida }> {
    const registro = await this.alimentacionService.crearComida(usuario.id, dto);
    return { data: registro };
  }

  /**
   * Devuelve todas las comidas registradas para un día específico.
   *
   * @param usuario - Usuario autenticado (del JWT)
   * @param fecha - Fecha a consultar en formato ISO 8601 (ej: "2026-04-21"). Default: hoy.
   */
  @ApiOperation({ summary: "Comidas del día" })
  @ApiQuery({
    name: "fecha",
    required: false,
    description: "Fecha en formato YYYY-MM-DD. Por defecto: hoy.",
  })
  @Get("comidas")
  async listarComidasDelDia(
    @CurrentUser() usuario: Usuario,
    @Query("fecha") fecha?: string,
  ): Promise<{ data: RegistroComida[] }> {
    const comidas = await this.alimentacionService.listarComidasDelDia(usuario.id, fecha);
    return { data: comidas };
  }
}
