import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsNumber, IsIn, IsDateString, Min } from "class-validator";

/** Momentos del día en que se puede registrar una comida */
export const MOMENTOS_COMIDA = [
  "DESAYUNO",
  "ALMUERZO",
  "MERIENDA",
  "CENA",
  "SNACK",
] as const;
export type MomentoComida = (typeof MOMENTOS_COMIDA)[number];

/**
 * CreateComidaDto — datos para registrar una ingesta del día
 *
 * La descripción es texto libre (sin base de datos nutricional en el MVP).
 * Las calorías son opcionales y estimadas por el usuario.
 */
export class CreateComidaDto {
  @ApiProperty({
    example: "ALMUERZO",
    enum: MOMENTOS_COMIDA,
    description: "Momento del día",
  })
  @IsString()
  @IsIn(MOMENTOS_COMIDA, {
    message: `El momento debe ser uno de: ${MOMENTOS_COMIDA.join(", ")}`,
  })
  momento!: MomentoComida;

  @ApiProperty({ example: "Ensalada con pollo grillado y un vaso de agua" })
  @IsString()
  descripcion!: string;

  @ApiProperty({ example: 450, description: "Calorías estimadas (opcional)", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calorias?: number;

  @ApiProperty({
    example: "2026-04-21",
    description: "Fecha del registro (ISO 8601). Por defecto: hoy.",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;
}
