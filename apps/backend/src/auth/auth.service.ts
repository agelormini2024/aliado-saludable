import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { Usuario } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { JwtPayload } from "./strategies/jwt.strategy";

/**
 * Estructura de tokens devuelta al cliente tras login o registro.
 * El access token tiene vida corta (15min), el refresh token tiene 7 días.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * AuthService — lógica de autenticación y gestión de tokens
 *
 * Responsabilidades:
 * - Registrar nuevos usuarios (hash de password, tokens iniciales)
 * - Validar credenciales de login
 * - Generar access tokens (JWT de corta duración)
 * - Emitir y rotar refresh tokens (almacenados en BD como hash)
 * - Invalidar tokens en logout
 *
 * Seguridad:
 * - Las contraseñas se hashean con bcrypt (salt rounds = 12)
 * - Los refresh tokens se almacenan como hash en la BD (nunca en claro)
 * - La rotación de refresh tokens previene ataques de replay
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // bcrypt recomienda 10-12 rounds como balance entre seguridad y performance
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registra un nuevo usuario en la plataforma.
   *
   * @param dto - Datos del formulario de registro (email, nombre, apellido, password)
   * @returns Los tokens de acceso y refresco del nuevo usuario
   * @throws ConflictException si el email ya está registrado
   *
   * @example
   * const tokens = await authService.register({
   *   email: 'ana@ejemplo.com',
   *   nombre: 'Ana',
   *   apellido: 'García',
   *   password: 'MiContraseña123'
   * });
   */
  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (existente) {
      throw new ConflictException("El email ya está registrado");
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        apellido: dto.apellido,
        passwordHash,
        rol: dto.rol ?? "USUARIO",
      },
    });

    this.logger.log(`Nuevo usuario registrado: ${usuario.email}`);
    return this.generarTokens(usuario);
  }

  /**
   * Valida las credenciales de un usuario (usado por LocalStrategy).
   *
   * @param email - Email ingresado en el formulario de login
   * @param password - Contraseña en texto plano
   * @returns El usuario si las credenciales son válidas, null si no lo son
   */
  async validarCredenciales(email: string, password: string): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return null;

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValido) return null;

    return usuario;
  }

  /**
   * Genera y devuelve tokens para un usuario ya autenticado (llamado desde el controller de login).
   * LocalStrategy ya validó las credenciales antes de llegar aquí.
   *
   * @param usuario - El usuario verificado por LocalStrategy
   * @returns Access token y refresh token
   */
  async login(usuario: Usuario): Promise<AuthTokens> {
    return this.generarTokens(usuario);
  }

  /**
   * Rota el refresh token: invalida el actual y emite uno nuevo.
   *
   * La rotación previene que un token robado pueda usarse más de una vez:
   * si el atacante usa el token antes que el usuario legítimo, el siguiente
   * intento del usuario fallará (token no encontrado en BD) y sabrá que
   * hubo una brecha.
   *
   * @param refreshToken - El refresh token actual (en texto plano, como lo envía el cliente)
   * @returns Nuevos access y refresh tokens
   * @throws UnauthorizedException si el token no existe o expiró
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    // Buscar el token hasheado en la BD
    const tokenHash = await bcrypt.hash(refreshToken, this.BCRYPT_ROUNDS);

    // Buscamos por hash — necesitamos comparar con bcrypt.compare
    // porque bcrypt genera un salt distinto cada vez
    const registros = await this.prisma.refreshToken.findMany({
      where: {
        usuarioId: { not: null },
        expiresAt: { gt: new Date() },
      },
      include: { usuario: true },
    });

    let tokenEncontrado: (typeof registros)[0] | null = null;

    for (const registro of registros) {
      const coincide = await bcrypt.compare(refreshToken, registro.token);
      if (coincide) {
        tokenEncontrado = registro;
        break;
      }
    }

    if (!tokenEncontrado || !tokenEncontrado.usuario) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    // Eliminar el token usado (rotación)
    await this.prisma.refreshToken.delete({ where: { id: tokenEncontrado.id } });

    return this.generarTokens(tokenEncontrado.usuario);
  }

  /**
   * Invalida todos los refresh tokens del usuario (logout completo).
   *
   * @param usuarioId - ID del usuario que hace logout
   */
  async logout(usuarioId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { usuarioId } });
    this.logger.log(`Logout de usuario: ${usuarioId}`);
  }

  /**
   * Genera un access token (JWT) y un refresh token para el usuario dado.
   * El refresh token se almacena hasheado en la BD.
   *
   * @param usuario - El usuario para el que se generan los tokens
   * @returns Access token (JWT) y refresh token (string opaco)
   */
  private async generarTokens(usuario: Usuario): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };

    // Access token: JWT firmado con JWT_SECRET, expira en JWT_EXPIRES_IN (15m)
    const accessToken = this.jwtService.sign(payload);

    // Refresh token: string aleatorio seguro (UUID-like via crypto)
    // No es un JWT porque no necesita contener datos — solo es un identificador
    const refreshTokenPlain = this.generarTokenAleatorio();
    const refreshTokenHash = await bcrypt.hash(refreshTokenPlain, this.BCRYPT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenHash,
        usuarioId: usuario.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshTokenPlain };
  }

  /**
   * Genera un string aleatorio de 64 caracteres hex para usar como refresh token.
   * Usa crypto.randomBytes que es criptográficamente seguro.
   */
  private generarTokenAleatorio(): string {
    return require("crypto").randomBytes(32).toString("hex");
  }
}
