import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsDateString, Min } from "class-validator";

/**
 * CreateMedidasDto — datos para registrar medidas corporales
 *
 * Todos los campos de medidas son opcionales: el usuario registra
 * solo lo que quiere medir en cada sesión.
 */
export class CreateMedidasDto {
  @ApiProperty({ example: 92, description: "Cintura en cm", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cintura?: number;

  @ApiProperty({ example: 103, description: "Cadera en cm", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cadera?: number;

  @ApiProperty({ example: 95, description: "Pecho en cm", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pecho?: number;

  @ApiProperty({ example: 33, description: "Brazo en cm", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  brazo?: number;

  @ApiProperty({ example: 58, description: "Muslo en cm", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  muslo?: number;

  @ApiProperty({
    example: "2026-04-21",
    description: "Fecha del registro (ISO 8601). Por defecto: hoy.",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;
}
