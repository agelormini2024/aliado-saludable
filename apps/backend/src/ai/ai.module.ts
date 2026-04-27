import { Module } from "@nestjs/common";
import { RagService } from "./rag.service";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";

/**
 * AiModule — módulo de inteligencia artificial del backend.
 *
 * Contiene:
 * - RagService: indexación y búsqueda vectorial (RAG). Se exporta para que
 *   ProgresoModule, AlimentacionModule y ContenidoModule puedan indexar
 *   sus registros al crearlos.
 * - ChatService: orquesta RAG + GPT-4o-mini para el chat del usuario.
 * - ChatController: expone POST /ai/chat.
 */
@Module({
  controllers: [ChatController],
  providers: [RagService, ChatService],
  exports: [RagService],
})
export class AiModule {}
