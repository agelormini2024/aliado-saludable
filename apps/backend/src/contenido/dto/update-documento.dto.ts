import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, MaxLength } from "class-validator";

/**
 * UpdateDocumentoDto — campos editables de un documento ya cargado.
 *
 * El archivo en sí no se puede reemplazar via PATCH (habría que eliminar y re-subir).
 * Solo se puede editar el nombre visible y el estado de publicación.
 */
export class UpdateDocumentoDto {
  @ApiProperty({
    example: "Guía de alimentación saludable",
    description: "Nombre visible del documento (máx. 200 caracteres)",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiProperty({
    example: true,
    description: "Si el documento está publicado y visible para los usuarios",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}
