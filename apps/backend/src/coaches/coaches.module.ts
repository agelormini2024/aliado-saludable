import { Module } from "@nestjs/common";
import { CoachesService } from "./coaches.service";
import { CoachesController } from "./coaches.controller";

/**
 * CoachesModule — panel de gestión de pacientes para coaches
 *
 * Expone endpoints protegidos por rol COACH para que los coaches
 * puedan consultar el listado y el progreso de sus pacientes asignados.
 *
 * PrismaService se inyecta automáticamente (PrismaModule es @Global).
 */
@Module({
  controllers: [CoachesController],
  providers: [CoachesService],
})
export class CoachesModule {}
