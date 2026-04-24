import { Module } from "@nestjs/common";
import { AlimentacionService } from "./alimentacion.service";
import { AlimentacionController } from "./alimentacion.controller";
import { AiModule } from "../ai/ai.module";

/**
 * AlimentacionModule — registro y consulta de comidas del día
 *
 * Importa AiModule para que AlimentacionService pueda indexar cada comida
 * en EmbeddingDocument via RagService (RAG del chat IA).
 */
@Module({
  imports: [AiModule],
  controllers: [AlimentacionController],
  providers: [AlimentacionService],
})
export class AlimentacionModule {}
