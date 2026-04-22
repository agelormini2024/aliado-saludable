import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsuariosModule } from "./usuarios/usuarios.module";
import { ProgresoModule } from "./progreso/progreso.module";
import { AlimentacionModule } from "./alimentacion/alimentacion.module";

/**
 * AppModule — módulo raíz de la aplicación
 *
 * Importa todos los módulos de funcionalidad en orden de dependencia:
 * 1. ConfigModule  → variables de entorno (global)
 * 2. PrismaModule  → base de datos (global)
 * 3. AuthModule    → autenticación y autorización
 * 4. UsuariosModule, ProgresoModule, AlimentacionModule → funcionalidad de negocio
 */
@Module({
  imports: [
    // ConfigModule.forRoot hace que ConfigService esté disponible globalmente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // PrismaModule es @Global() — inyecta PrismaService en toda la app sin necesidad
    // de importarlo explícitamente en cada módulo
    PrismaModule,

    AuthModule,
    UsuariosModule,
    ProgresoModule,
    AlimentacionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
