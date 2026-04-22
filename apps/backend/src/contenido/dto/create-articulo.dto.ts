import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsIn, IsOptional, IsBoolean, MaxLength } from "class-validator";

/**
 * CreateArticuloDto — datos para crear un artículo de contenido.
 *
 * Solo los usuarios con rol ADMIN pueden usar este DTO.
 * El campo `autorId` se extrae del JWT (no del body) para evitar suplantación.
 */
export class CreateArticuloDto {
  @ApiProperty({ example: "5 consejos para comer mejor", description: "Título del artículo (máx. 200 caracteres)" })
  @IsString()
  @IsNotEmpty({ message: "El título es requerido" })
  @MaxLength(200)
  titulo!: string;

  @ApiProperty({
    example: "El desayuno es la comida más importante del día...",
    description: "Contenido completo en markdown",
  })
  @IsString()
  @IsNotEmpty({ message: "El contenido es requerido" })
  contenido!: string;

  @ApiProperty({
    example: "NUTRICION",
    enum: ["NUTRICION", "EJERCICIO", "BIENESTAR"],
    description: "Categoría del artículo",
  })
  @IsString()
  @IsIn(["NUTRICION", "EJERCICIO", "BIENESTAR"], {
    message: "La categoría debe ser NUTRICION, EJERCICIO o BIENESTAR",
  })
  categoria!: string;

  @ApiProperty({
    example: false,
    description: "Si el artículo está publicado y visible para los usuarios. Default: false",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}
