import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { Usuario } from "@prisma/client";

/**
 * Payload que se codifica dentro del JWT access token.
 * Contiene solo los datos necesarios para identificar al usuario
 * sin tener que ir a la base de datos en cada request.
 */
export interface JwtPayload {
  /** ID del usuario (cuid) */
  sub: string;
  /** Email del usuario */
  email: string;
  /** Rol del usuario para RBAC */
  rol: string;
}

/**
 * JwtStrategy — estrategia Passport para autenticación con Bearer token
 *
 * Se activa en cada endpoint protegido con JwtAuthGuard.
 * Extrae el JWT del header Authorization, lo verifica con JWT_SECRET,
 * y luego llama a `validate()` con el payload decodificado.
 *
 * El resultado de `validate()` se adjunta como `request.user`,
 * accesible luego con el decorador @CurrentUser().
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Extrae el token del header: "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Si el token expiró, Passport lanza 401 automáticamente
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  /**
   * Se llama con el payload ya decodificado del JWT (después de verificar la firma).
   * Aquí buscamos el usuario en la BD para tener datos frescos (por si fue desactivado).
   *
   * @param payload - Datos decodificados del JWT (JwtPayload)
   * @returns El Usuario completo desde la base de datos
   * @throws UnauthorizedException si el usuario no existe
   */
  async validate(payload: JwtPayload): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });

    if (!usuario) {
      throw new UnauthorizedException("Usuario no encontrado");
    }

    return usuario;
  }
}
