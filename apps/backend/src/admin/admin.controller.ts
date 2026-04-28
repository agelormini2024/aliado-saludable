import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from "@nestjs/swagger";
import { RolUsuario } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminService } from "./admin.service";
import { CreateCoachDto } from "./dto/create-coach.dto";
import { UpdateCoachDto } from "./dto/update-coach.dto";
import { AsignarCoachDto } from "./dto/asignar-coach.dto";

/**
 * AdminController — endpoints exclusivos del rol ADMIN
 *
 * Gestiona la creación de coaches y la asignación de pacientes.
 * Todos los endpoints requieren autenticación y rol ADMIN.
 *
 * Rutas:
 *   POST   /admin/coaches                               → crear coach
 *   GET    /admin/coaches                               → listar coaches
 *   PATCH  /admin/coaches/:id                           → editar coach
 *   POST   /admin/coaches/:id/convertir-a-paciente      → convertir coach a usuario regular
 *   GET    /admin/pacientes                             → listar pacientes
 *   POST   /admin/pacientes/:id/asignar-coach           → asignar coach a paciente
 *   DELETE /admin/pacientes/:id/asignar-coach           → desasignar coach de paciente
 */
@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── COACHES ───────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo coach. Genera el perfil Coach y la cuenta de Usuario (rol=COACH)
   * en una sola operación transaccional.
   */
  @ApiOperation({ summary: "Crear un nuevo coach" })
  @ApiResponse({ status: 201, description: "Coach creado exitosamente" })
  @ApiResponse({ status: 409, description: "El email ya está registrado" })
  @Post("coaches")
  async crearCoach(@Body() dto: CreateCoachDto) {
    const resultado = await this.adminService.crearCoach(dto);
    return { data: resultado };
  }

  /**
   * Lista todos los coaches registrados con su conteo de pacientes.
   */
  @ApiOperation({ summary: "Listar todos los coaches" })
  @Get("coaches")
  async listarCoaches() {
    const coaches = await this.adminService.listarCoaches();
    return { data: coaches };
  }

  /**
   * Actualiza los datos de un coach (especialidad, nombre y/o apellido).
   * Los cambios en nombre/apellido se sincronizan al Usuario vinculado.
   *
   * @param id - ID del perfil de Coach
   */
  @ApiOperation({ summary: "Editar datos de un coach" })
  @ApiParam({ name: "id", description: "ID del perfil de Coach" })
  @ApiResponse({ status: 200, description: "Coach actualizado" })
  @ApiResponse({ status: 404, description: "Coach no encontrado" })
  @Patch("coaches/:id")
  async editarCoach(@Param("id") coachId: string, @Body() dto: UpdateCoachDto) {
    const resultado = await this.adminService.editarCoach(coachId, dto);
    return { data: resultado };
  }

  /**
   * Convierte un coach en usuario regular (paciente).
   * Desafecta todos sus pacientes y elimina el perfil de Coach.
   * El Usuario vinculado sigue existiendo con rol=USUARIO.
   *
   * @param id - ID del perfil de Coach a convertir
   */
  @ApiOperation({ summary: "Convertir coach a paciente" })
  @ApiParam({ name: "id", description: "ID del perfil de Coach" })
  @ApiResponse({ status: 200, description: "Coach convertido a paciente" })
  @ApiResponse({ status: 404, description: "Coach no encontrado" })
  @HttpCode(HttpStatus.OK)
  @Post("coaches/:id/convertir-a-paciente")
  async convertirAPaciente(@Param("id") coachId: string) {
    const resultado = await this.adminService.convertirAPaciente(coachId);
    return { data: resultado };
  }

  // ─── PACIENTES ─────────────────────────────────────────────────────────────

  /**
   * Lista todos los usuarios con rol=USUARIO, incluyendo a qué coach están asignados.
   */
  @ApiOperation({ summary: "Listar todos los pacientes (usuarios con rol=USUARIO)" })
  @Get("pacientes")
  async listarPacientes() {
    const pacientes = await this.adminService.listarPacientes();
    return { data: pacientes };
  }

  /**
   * Asigna un coach a un paciente.
   * Si el paciente ya tenía coach, lo reemplaza.
   *
   * @param id - ID del paciente (Usuario)
   */
  @ApiOperation({ summary: "Asignar coach a un paciente" })
  @ApiParam({ name: "id", description: "ID del paciente (Usuario)" })
  @ApiResponse({ status: 200, description: "Coach asignado exitosamente" })
  @Post("pacientes/:id/asignar-coach")
  async asignarCoach(@Param("id") pacienteId: string, @Body() dto: AsignarCoachDto) {
    const resultado = await this.adminService.asignarCoach(pacienteId, dto);
    return { data: resultado };
  }

  /**
   * Desasigna el coach de un paciente (deja Usuario.coachId en null).
   *
   * @param id - ID del paciente (Usuario)
   */
  @ApiOperation({ summary: "Desasignar coach de un paciente" })
  @ApiParam({ name: "id", description: "ID del paciente (Usuario)" })
  @ApiResponse({ status: 200, description: "Coach desasignado exitosamente" })
  @HttpCode(HttpStatus.OK)
  @Delete("pacientes/:id/asignar-coach")
  async desasignarCoach(@Param("id") pacienteId: string) {
    const resultado = await this.adminService.desasignarCoach(pacienteId);
    return { data: resultado };
  }
}
