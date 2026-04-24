import { Module } from "@nestjs/common";
import { RagService } from "./rag.service";

/**
 * AiModule — módulo de inteligencia artificial del backend.
 *
 * Agrupa los servicios de IA que son reutilizados por otros módulos:
 * - RagService: indexación y búsqueda vectorial (RAG)
 *
 * Se importa en ProgresoModule, AlimentacionModule y ContenidoModule
 * para que sus servicios puedan llamar a RagService.indexar()
 * después de guardar cada registro.
 *
 * En Fase 4 (Chat IA), se agrega ChatService a este módulo.
 */
@Module({
  providers: [RagService],
  exports: [RagService],
})
export class AiModule {}
