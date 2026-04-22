import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { UpdatePerfilDto } from "./dto/update-perfil.dto";
import { Usuario } from "@prisma/client";

/**
 * UsuariosService — lógica de negocio para gestión de perfil de usuario
 *
 * Por ahora expone solo las operaciones que el propio usuario puede hacer
 * sobre su cuenta. Las operaciones de admin (listar todos, eliminar)
 * se agregan cuando se implemente el panel de administración.
 */
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el perfil completo del usuario autenticado.
   * Se excluye el passwordHash por seguridad.
   *
   * @param id - ID del usuario (obtenido del JWT via @CurrentUser())
   * @returns El usuario sin el campo passwordHash
   */
  async obtenerPerfil(id: string): Promise<Omit<Usuario, "passwordHash">> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      // Omitir el hash de contraseña — nunca debe salir de la capa de datos
      omit: { passwordHash: true },
    });

    return usuario;
  }

  /**
   * Actualiza los datos de perfil opcionales del usuario (altura, meta, fechaNacimiento).
   * Solo el propio usuario puede actualizar su perfil (verificado en el controller).
   *
   * @param id - ID del usuario a actualizar
   * @param dto - Campos a actualizar (todos opcionales)
   * @returns El usuario actualizado sin passwordHash
   */
  async actualizarPerfil(
    id: string,
    dto: UpdatePerfilDto,
  ): Promise<Omit<Usuario, "passwordHash">> {
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: {
        altura: dto.altura,
        meta: dto.meta,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      },
      omit: { passwordHash: true },
    });

    return usuario;
  }
}
