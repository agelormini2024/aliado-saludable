import { Module } from "@nestjs/common";
import { AlimentacionService } from "./alimentacion.service";
import { AlimentacionController } from "./alimentacion.controller";

/**
 * AlimentacionModule — registro y consulta de comidas del día
 */
@Module({
  controllers: [AlimentacionController],
  providers: [AlimentacionService],
})
export class AlimentacionModule {}
