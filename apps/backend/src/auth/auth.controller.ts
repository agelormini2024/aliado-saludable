import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { AuthService, AuthTokens } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Usuario } from "@prisma/client";

/**
 * AuthController — endpoints públicos de autenticación
 *
 * Rutas:
 * - POST /auth/register  → crear cuenta y recibir tokens
 * - POST /auth/login     → iniciar sesión con email/password
 * - POST /auth/refresh   → rotar el refresh token
 * - POST /auth/logout    → cerrar sesión (requiere JWT válido)
 */
@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registra un nuevo usuario y devuelve sus tokens.
   *
   * @param dto - Datos de registro (email, nombre, apellido, password)
   * @returns Access token y refresh token
   */
  @ApiOperation({ summary: "Registrar nueva cuenta" })
  @ApiResponse({ status: 201, description: "Cuenta creada, tokens devueltos" })
  @ApiResponse({ status: 409, description: "El email ya está registrado" })
  @Post("register")
  async register(@Body() dto: RegisterDto): Promise<{ data: AuthTokens }> {
    const tokens = await this.authService.register(dto);
    return { data: tokens };
  }

  /**
   * Inicia sesión con email y password.
   * LocalAuthGuard llama a LocalStrategy.validate() antes de llegar aquí.
   * Si las credenciales son inválidas, Passport devuelve 401 automáticamente.
   *
   * @param usuario - El usuario verificado por LocalAuthGuard (viene de request.user)
   * @returns Access token y refresh token
   */
  @ApiOperation({ summary: "Iniciar sesión" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: "Login exitoso, tokens devueltos" })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(@CurrentUser() usuario: Usuario): Promise<{ data: AuthTokens }> {
    const tokens = await this.authService.login(usuario);
    return { data: tokens };
  }

  /**
   * Rota el refresh token y devuelve un nuevo par de tokens.
   *
   * @param dto - El refresh token actual
   * @returns Nuevos access token y refresh token
   */
  @ApiOperation({ summary: "Refrescar access token" })
  @ApiResponse({ status: 200, description: "Tokens renovados" })
  @ApiResponse({ status: 401, description: "Refresh token inválido o expirado" })
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(@Body() dto: RefreshDto): Promise<{ data: AuthTokens }> {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return { data: tokens };
  }

  /**
   * Cierra sesión: elimina todos los refresh tokens del usuario en la BD.
   * Requiere un access token válido para identificar al usuario.
   *
   * @param usuario - El usuario autenticado (extraído del JWT por JwtAuthGuard)
   */
  @ApiOperation({ summary: "Cerrar sesión" })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: "Sesión cerrada" })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@CurrentUser() usuario: Usuario): Promise<{ data: { message: string } }> {
    await this.authService.logout(usuario.id);
    return { data: { message: "Sesión cerrada exitosamente" } };
  }
}
