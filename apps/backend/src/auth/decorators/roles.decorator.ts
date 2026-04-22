import { SetMetadata } from "@nestjs/common";
import { RolUsuario } from "@prisma/client";

/**
 * Clave de metadato usada por RolesGuard para leer los roles requeridos.
 * Se define como constante para evitar strings mágicos.
 */
export const ROLES_KEY = "roles";

/**
 * @Roles() — decorador que define qué roles pueden acceder a un endpoint
 *
 * RolesGuard lee este metadato y lo compara con el rol del usuario autenticado.
 * Siempre debe usarse junto a JwtAuthGuard (que popula request.user).
 *
 * @param roles - Uno o más roles permitidos
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(RolUsuario.ADMIN)
 * @Delete(':id')
 * eliminarUsuario(@Param('id') id: string) { ... }
 */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
