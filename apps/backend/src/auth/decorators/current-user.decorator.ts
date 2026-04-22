import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Usuario } from "@prisma/client";

/**
 * @CurrentUser() — decorador de parámetro que extrae el usuario autenticado
 *
 * JwtStrategy adjunta el usuario al objeto `request` cuando el token es válido.
 * Este decorador lo hace accesible de forma limpia en los controllers.
 *
 * @example
 * // En un controller protegido con JwtAuthGuard:
 * @Get('me')
 * getMe(@CurrentUser() usuario: Usuario) {
 *   return usuario;
 * }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Usuario => {
    const request = ctx.switchToHttp().getRequest<{ user: Usuario }>();
    return request.user;
  },
);
