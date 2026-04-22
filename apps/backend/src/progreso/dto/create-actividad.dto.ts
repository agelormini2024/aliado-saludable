import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, IsIn, IsDateString, Min } from "class-validator";

/** Tipos de actividad física soportados */
export const TIPOS_ACTIVIDAD = ["CAMINATA", "GYM", "NATACION", "CICLISMO", "OTRO"] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

/**
 * CreateActividadDto — datos para registrar una sesión de actividad física
 *
 * Las calorías son requeridas: permiten calcular el balance calórico diario
 * que se muestra en el dashboard y se usará como contexto en el chat IA.
 */
export class CreateActividadDto {
  @ApiProperty({
    example: "CAMINATA",
    enum: TIPOS_ACTIVIDAD,
    description: "Tipo de actividad física",
  })
  @IsString()
  @IsIn(TIPOS_ACTIVIDAD, {
    message: `El tipo debe ser uno de: ${TIPOS_ACTIVIDAD.join(", ")}`,
  })
  tipo!: TipoActividad;

  @ApiProperty({ example: 45, description: "Duración en minutos" })
  @IsNumber()
  @Min(1)
  duracion!: number;

  @ApiProperty({ example: 280, description: "Calorías estimadas quemadas" })
  @IsNumber()
  @Min(0)
  calorias!: number;

  @ApiProperty({ example: "2026-04-21", required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ example: "Caminé por el parque", required: false })
  @IsOptional()
  nota?: string;
}
