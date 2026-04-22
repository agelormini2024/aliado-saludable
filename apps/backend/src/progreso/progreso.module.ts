import { Module } from "@nestjs/common";
import { ProgresoService } from "./progreso.service";
import { ProgresoController } from "./progreso.controller";

/**
 * ProgresoModule — registros de peso, medidas y actividad física
 */
@Module({
  controllers: [ProgresoController],
  providers: [ProgresoService],
})
export class ProgresoModule {}
