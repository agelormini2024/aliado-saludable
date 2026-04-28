import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";

/**
 * AdminModule — panel de administración de la plataforma
 *
 * Expone endpoints exclusivos para el rol ADMIN:
 * - Gestión de coaches (crear, listar)
 * - Gestión de asignaciones (asignar/desasignar coach a paciente)
 * - Listado de pacientes
 *
 * PrismaService se inyecta automáticamente (PrismaModule es @Global).
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
