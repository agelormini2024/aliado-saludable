import { Controller, Post, Get, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { ProgresoService, PaginatedResult } from "./progreso.service";
import { CreatePesoDto } from "./dto/create-peso.dto";
import { CreateMedidasDto } from "./dto/create-medidas.dto";
import { CreateActividadDto } from "./dto/create-actividad.dto";
import { PaginationQueryDto } from "./dto/pagination-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Usuario, RegistroPeso, RegistroMedidas, RegistroActividad } from "@prisma/client";

/**
 * ProgresoController — endpoints de registro y consulta de progreso
 *
 * Todos los endpoints requieren autenticación (JwtAuthGuard).
 * El usuarioId se extrae siempre del JWT — el usuario no puede registrar
 * progreso a nombre de otro usuario.
 *
 * Rutas:
 * - POST /progreso/peso          → registrar nuevo peso
 * - GET  /progreso/peso          → historial de pesos (paginado)
 * - POST /progreso/medidas       → registrar medidas
 * - GET  /progreso/medidas       → historial de medidas (paginado)
 * - POST /progreso/actividad     → registrar actividad física
 * - GET  /progreso/actividad     → historial de actividad (paginado)
 */
@ApiTags("Progreso")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("progreso")
export class ProgresoController {
  constructor(private readonly progresoService: ProgresoService) {}

  // ─── PESO ────────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: "Registrar nuevo peso" })
  @ApiResponse({ status: 201, description: "Peso registrado exitosamente" })
  @Post("peso")
  async crearPeso(
    @CurrentUser() usuario: Usuario,
    @Body() dto: CreatePesoDto,
  ): Promise<{ data: RegistroPeso }> {
    const registro = await this.progresoService.crearPeso(usuario.id, dto);
    return { data: registro };
  }

  @ApiOperation({ summary: "Historial de pesos (paginado)" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @Get("peso")
  async listarPesos(
    @CurrentUser() usuario: Usuario,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegistroPeso>> {
    return this.progresoService.listarPesos(usuario.id, query);
  }

  // ─── MEDIDAS ─────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: "Registrar medidas corporales" })
  @ApiResponse({ status: 201, description: "Medidas registradas exitosamente" })
  @Post("medidas")
  async crearMedidas(
    @CurrentUser() usuario: Usuario,
    @Body() dto: CreateMedidasDto,
  ): Promise<{ data: RegistroMedidas }> {
    const registro = await this.progresoService.crearMedidas(usuario.id, dto);
    return { data: registro };
  }

  @ApiOperation({ summary: "Historial de medidas (paginado)" })
  @Get("medidas")
  async listarMedidas(
    @CurrentUser() usuario: Usuario,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegistroMedidas>> {
    return this.progresoService.listarMedidas(usuario.id, query);
  }

  // ─── ACTIVIDAD ───────────────────────────────────────────────────────────────

  @ApiOperation({ summary: "Registrar actividad física" })
  @ApiResponse({ status: 201, description: "Actividad registrada exitosamente" })
  @Post("actividad")
  async crearActividad(
    @CurrentUser() usuario: Usuario,
    @Body() dto: CreateActividadDto,
  ): Promise<{ data: RegistroActividad }> {
    const registro = await this.progresoService.crearActividad(usuario.id, dto);
    return { data: registro };
  }

  @ApiOperation({ summary: "Historial de actividad física (paginado)" })
  @Get("actividad")
  async listarActividades(
    @CurrentUser() usuario: Usuario,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegistroActividad>> {
    return this.progresoService.listarActividades(usuario.id, query);
  }
}
