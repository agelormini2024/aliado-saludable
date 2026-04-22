import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * JwtAuthGuard — protege endpoints requiriendo un Bearer token válido
 *
 * Activa la JwtStrategy de Passport, que verifica el token y popula request.user.
 * Usar en controllers o endpoints individuales:
 *
 * @example
 * @UseGuards(JwtAuthGuard)
 * @Get('perfil')
 * getPerfil(@CurrentUser() usuario: Usuario) { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
