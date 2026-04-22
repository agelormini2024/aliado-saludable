import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsNumber, IsDateString, Min, Max } from "class-validator";

/**
 * UpdatePerfilDto — datos opcionales para actualizar el perfil del usuario
 *
 * Todos los campos son opcionales: el usuario puede actualizar solo
 * los que desee sin tocar el resto.
 */
export class UpdatePerfilDto {
  @ApiProperty({ example: 170, description: "Altura en centímetros", required: false })
  @IsOptional()
  @IsNumber()
  @Min(50, { message: "La altura debe ser mayor a 50cm" })
  @Max(250, { message: "La altura debe ser menor a 250cm" })
  altura?: number;

  @ApiProperty({ example: 75.5, description: "Peso objetivo en kilogramos", required: false })
  @IsOptional()
  @IsNumber()
  @Min(20, { message: "El peso objetivo debe ser mayor a 20kg" })
  @Max(500)
  meta?: number;

  @ApiProperty({
    example: "1990-05-15",
    description: "Fecha de nacimiento (ISO 8601)",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;
}
