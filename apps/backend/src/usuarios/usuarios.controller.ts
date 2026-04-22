import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { UsuariosService } from "./usuarios.service";
import { UpdatePerfilDto } from "./dto/update-perfil.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Usuario } from "@prisma/client";

/**
 * UsuariosController — endpoints de gestión del perfil propio
 *
 * Todos los endpoints requieren autenticación (JwtAuthGuard).
 * El usuario solo puede operar sobre su propio perfil — no hay acceso
 * a perfiles ajenos desde estos endpoints.
 *
 * Rutas:
 * - GET  /usuarios/me   → obtener perfil propio
 * - PATCH /usuarios/me  → actualizar altura, meta, fecha de nacimiento
 */
@ApiTags("Usuarios")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("usuarios")
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * Devuelve el perfil completo del usuario autenticado.
   *
   * @param usuario - El usuario extraído del JWT (via @CurrentUser())
   */
  @ApiOperation({ summary: "Obtener mi perfil" })
  @ApiResponse({ status: 200, description: "Perfil del usuario autenticado" })
  @Get("me")
  async obtenerPerfil(
    @CurrentUser() usuario: Usuario,
  ): Promise<{ data: Omit<Usuario, "passwordHash"> }> {
    const perfil = await this.usuariosService.obtenerPerfil(usuario.id);
    return { data: perfil };
  }

  /**
   * Actualiza los datos de perfil opcionales del usuario autenticado.
   *
   * @param usuario - El usuario extraído del JWT
   * @param dto - Campos a actualizar
   */
  @ApiOperation({ summary: "Actualizar mi perfil (altura, meta, fecha de nacimiento)" })
  @ApiResponse({ status: 200, description: "Perfil actualizado" })
  @Patch("me")
  async actualizarPerfil(
    @CurrentUser() usuario: Usuario,
    @Body() dto: UpdatePerfilDto,
  ): Promise<{ data: Omit<Usuario, "passwordHash"> }> {
    const perfil = await this.usuariosService.actualizarPerfil(usuario.id, dto);
    return { data: perfil };
  }
}
