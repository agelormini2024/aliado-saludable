import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsDateString, Min, Max } from "class-validator";

/**
 * CreatePesoDto — datos para registrar un nuevo peso
 */
export class CreatePesoDto {
  @ApiProperty({ example: 87.3, description: "Peso en kilogramos" })
  @IsNumber()
  @Min(20)
  @Max(500)
  peso!: number;

  @ApiProperty({
    example: "2026-04-21",
    description: "Fecha del registro (ISO 8601). Por defecto: hoy.",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ example: "Me sentí bien hoy", required: false })
  @IsOptional()
  nota?: string;
}
