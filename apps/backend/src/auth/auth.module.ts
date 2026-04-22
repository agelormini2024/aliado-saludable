import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

/**
 * AuthModule — módulo de autenticación completo
 *
 * Registra:
 * - PassportModule con la estrategia por defecto "jwt"
 * - JwtModule con configuración dinámica desde variables de entorno
 * - LocalStrategy y JwtStrategy como providers de Passport
 * - AuthService y AuthController
 *
 * Los guards (JwtAuthGuard, RolesGuard) no se registran aquí porque
 * se importan directamente donde se usan — NestJS los crea on-demand.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),

    // JwtModule.registerAsync lee la config de forma asíncrona para poder
    // usar ConfigService (que carga las variables de entorno)
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          // El tipo de expiresIn en @nestjs/jwt espera StringValue (del package ms).
          // Casteamos porque el valor proviene de una variable de entorno (string puro).
          expiresIn: config.getOrThrow<string>("JWT_EXPIRES_IN") as "15m",
        },
      }),
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
