import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from "@nestjs/swagger";
import { ChatService } from "./chat.service";
import { ChatDto } from "./dto/chat.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Usuario } from "@prisma/client";

/**
 * ChatController — endpoint del asistente de salud con IA.
 *
 * Expone un único endpoint POST /ai/chat que:
 * 1. Valida el body (pregunta no vacía, máximo 2000 chars)
 * 2. Requiere autenticación JWT
 * 3. Delega a ChatService para el procesamiento RAG + LLM
 * 4. Devuelve la respuesta en formato { data: { respuesta: string } }
 *
 * Sin streaming en el MVP — la respuesta se devuelve completa.
 * En una versión futura se puede agregar SSE o WebSocket para streaming.
 */
@ApiTags("Chat IA")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("ai")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Envía una pregunta al asistente de salud IA.
   *
   * El asistente tiene acceso al historial del usuario (peso, medidas, actividad,
   * comidas) y al contenido editorial (artículos y documentos), recuperados via
   * búsqueda vectorial (RAG) sobre EmbeddingDocument.
   *
   * @param usuario - Usuario autenticado extraído del JWT
   * @param dto - Body con la pregunta del usuario
   * @returns Respuesta del asistente IA
   */
  @ApiOperation({ summary: "Enviar una pregunta al asistente de salud IA" })
  @ApiBody({ type: ChatDto })
  @ApiResponse({
    status: 201,
    description: "Respuesta del asistente generada exitosamente",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            respuesta: { type: "string", example: "Bajaste 2.3 kg este mes, ¡muy bien!" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "No autenticado" })
  @Post("chat")
  async chat(
    @CurrentUser() usuario: Usuario,
    @Body() dto: ChatDto,
  ): Promise<{ data: { respuesta: string } }> {
    const respuesta = await this.chatService.responder(usuario, dto.pregunta);
    return { data: { respuesta } };
  }
}
