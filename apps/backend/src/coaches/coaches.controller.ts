import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { RolUsuario, Usuario } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CoachesService } from "./coaches.service";

/**
 * CoachesController — endpoints del panel de coach
 *
 * Todos los endpoints requieren autenticación y rol COACH.
 * El coach solo puede ver los pacientes que tiene asignados.
 *
 * Endpoints:
 *   GET /coaches/mis-pacientes         → lista resumida de sus pacientes
 *   GET /coaches/pacientes/:id/resumen → detalle completo de un paciente
 */
@ApiTags("Coaches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.COACH)
@Controller("coaches")
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  /**
   * Devuelve la lista de pacientes asignados al coach autenticado.
   * Incluye el último peso registrado y un indicador de actividad de los últimos 7 días.
   */
  @ApiOperation({ summary: "Listar pacientes del coach autenticado" })
  @Get("mis-pacientes")
  async misPacientes(@CurrentUser() usuario: Usuario) {
    const pacientes = await this.coachesService.misPacientes(usuario.id);
    return { data: pacientes };
  }

  /**
   * Devuelve el resumen completo de un paciente específico.
   * El paciente debe estar asignado al coach autenticado.
   *
   * @param id - ID del paciente
   */
  @ApiOperation({ summary: "Resumen completo de un paciente" })
  @ApiParam({ name: "id", description: "ID del paciente (Usuario)" })
  @Get("pacientes/:id/resumen")
  async resumenPaciente(
    @CurrentUser() usuario: Usuario,
    @Param("id") pacienteId: string,
  ) {
    const resumen = await this.coachesService.resumenPaciente(usuario.id, pacienteId);
    return { data: resumen };
  }
}
