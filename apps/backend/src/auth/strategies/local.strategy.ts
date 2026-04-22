import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { Usuario } from "@prisma/client";

/**
 * LocalStrategy — estrategia Passport para autenticación con email/password
 *
 * Passport-local espera por defecto los campos "username" y "password".
 * Aquí lo reconfiguramos para usar "email" como campo de usuario.
 *
 * Esta estrategia se activa cuando se usa LocalAuthGuard en el endpoint de login.
 * Passport llama a `validate()` con las credenciales del body, y si retorna
 * un valor no-nulo, lo adjunta como `request.user`.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Decirle a passport-local que el campo de usuario se llama "email"
    super({ usernameField: "email" });
  }

  /**
   * Verifica las credenciales del usuario.
   * Passport llama este método automáticamente cuando se usa LocalAuthGuard.
   *
   * @param email - Email enviado en el body del request
   * @param password - Contraseña en texto plano (Passport la extrae del body)
   * @returns El usuario si las credenciales son válidas
   * @throws UnauthorizedException si el email no existe o la contraseña es incorrecta
   */
  async validate(email: string, password: string): Promise<Usuario> {
    const usuario = await this.authService.validarCredenciales(email, password);
    if (!usuario) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    return usuario;
  }
}
