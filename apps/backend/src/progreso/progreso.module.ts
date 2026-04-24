import { Module } from "@nestjs/common";
import { ProgresoService } from "./progreso.service";
import { ProgresoController } from "./progreso.controller";
import { AiModule } from "../ai/ai.module";

/**
 * ProgresoModule — registros de peso, medidas y actividad física
 *
 * Importa AiModule para que ProgresoService pueda indexar cada registro
 * en EmbeddingDocument via RagService (RAG del chat IA).
 */
@Module({
  imports: [AiModule],
  controllers: [ProgresoController],
  providers: [ProgresoService],
})
export class ProgresoModule {}
