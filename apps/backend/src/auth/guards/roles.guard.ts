import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolUsuario } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Usuario } from "@prisma/client";

/**
 * RolesGuard — verifica que el usuario autenticado tenga el rol requerido
 *
 * Debe usarse DESPUÉS de JwtAuthGuard (que ya verificó el token y populó request.user).
 * Lee los roles permitidos del metadato @Roles() y los compara con el rol del usuario.
 *
 * Si el endpoint no tiene @Roles(), este guard permite el acceso por defecto.
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(RolUsuario.ADMIN)
 * @Delete(':id')
 * eliminar() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Evalúa si el usuario tiene el rol necesario para acceder al endpoint.
   *
   * @param context - Contexto de ejecución (contiene el request con el usuario)
   * @returns true si el acceso está permitido, false si debe rechazarse (403)
   */
  canActivate(context: ExecutionContext): boolean {
    // Leer los roles requeridos del decorador @Roles()
    const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay @Roles(), no hay restricción de rol — se permite el acceso
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: Usuario }>();
    const usuario = request.user;

    return rolesRequeridos.includes(usuario.rol);
  }
}
