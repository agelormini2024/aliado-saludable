import { IsString, IsNotEmpty, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * ChatDto — body del endpoint POST /ai/chat.
 *
 * La pregunta se limita a 2000 caracteres para evitar prompts excesivamente
 * largos que aumenten el costo de la API de OpenAI.
 */
export class ChatDto {
  @ApiProperty({
    description: "Pregunta o mensaje del usuario para el asistente de salud",
    example: "¿Cuánto bajé de peso este mes?",
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  pregunta!: string;
}
