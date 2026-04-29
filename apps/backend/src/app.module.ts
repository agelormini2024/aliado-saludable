import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsuariosModule } from "./usuarios/usuarios.module";
import { ProgresoModule } from "./progreso/progreso.module";
import { AlimentacionModule } from "./alimentacion/alimentacion.module";
import { ContenidoModule } from "./contenido/contenido.module";
import { AiModule } from "./ai/ai.module";
import { CoachesModule } from "./coaches/coaches.module";
import { AdminModule } from "./admin/admin.module";

/**
 * AppModule — módulo raíz de la aplicación
 *
 * Importa todos los módulos de funcionalidad en orden de dependencia:
 * 1. ConfigModule   → variables de entorno (global)
 * 2. LoggerModule   → logging estructurado con Pino (global)
 * 3. ThrottlerModule → rate limiting por IP (global, guard registrado como APP_GUARD)
 * 4. PrismaModule   → base de datos (global)
 * 5. AuthModule     → autenticación y autorización
 * 6. UsuariosModule, ProgresoModule, AlimentacionModule → funcionalidad de negocio
 * 7. ContenidoModule → artículos informativos (Fase 3)
 * 8. AiModule → RAG y chat IA (Fase 3)
 * 9. CoachesModule → panel de gestión de pacientes para coaches (Fase 4)
 */
@Module({
  imports: [
    // ConfigModule.forRoot hace que ConfigService esté disponible globalmente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    /**
     * LoggerModule (nestjs-pino) — reemplaza el Logger nativo de NestJS con Pino.
     *
     * En desarrollo (NODE_ENV !== "production") usa pino-pretty para salida legible.
     * En producción emite JSON puro por stdout, listo para ser parseado por Render/Logtail.
     *
     * Cada request HTTP queda logueado automáticamente con:
     * método, ruta, status code y duración en ms.
     */
    LoggerModule.forRoot({
      pinoHttp: {
        // Nivel mínimo de log: "info" en prod, "debug" en dev para más verbosidad
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        // Redondear la duración del request al ms entero
        customSuccessMessage: (req, res) =>
          `${req.method} ${req.url} → ${res.statusCode}`,
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                // pino-pretty solo en desarrollo — transforma el JSON en salida legible y coloreada
                target: "pino-pretty",
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: "HH:MM:ss",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
      },
    }),

    /**
     * ThrottlerModule — rate limiting global por IP.
     *
     * Perfil "default": 100 requests cada 60 segundos para toda la API.
     * Los endpoints de auth sobreescriben con el perfil "auth" (5 req / 60 s)
     * usando el decorador @Throttle({ auth: { limit: 5, ttl: 60000 } }).
     *
     * Sin Redis (D6): el store es en memoria (default del módulo).
     * Las cuentas se reinician al reiniciar el proceso — suficiente para el MVP.
     */
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000, // ventana de 60 segundos (en ms)
        limit: 100,  // 100 requests por IP por ventana
      },
      {
        name: "auth",
        ttl: 60_000, // ventana de 60 segundos
        limit: 5,    // máximo 5 intentos de login/register/refresh por IP por ventana
      },
    ]),

    // PrismaModule es @Global() — inyecta PrismaService en toda la app sin necesidad
    // de importarlo explícitamente en cada módulo
    PrismaModule,

    AuthModule,
    UsuariosModule,
    ProgresoModule,
    AlimentacionModule,
    ContenidoModule,
    AiModule,
    CoachesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    /**
     * ThrottlerGuard registrado como guard global vía APP_GUARD.
     * Aplica automáticamente a todos los endpoints sin necesidad de @UseGuards().
     * Los endpoints que necesitan límites distintos usan @Throttle() para sobreescribir.
     * Los endpoints que no deben ser limitados usan @SkipThrottle().
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
