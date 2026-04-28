import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * DTO para asignar un coach a un paciente.
 *
 * El coachId referencia el ID del perfil de Coach (tabla Coach),
 * no el ID del Usuario-coach. Se usa Coach.id porque es la FK
 * que usa el campo Usuario.coachId en el schema.
 */
export class AsignarCoachDto {
  @ApiProperty({
    description: "ID del perfil de Coach (tabla Coach)",
    example: "clxyz123...",
  })
  @IsNotEmpty({ message: "El coachId es requerido" })
  @IsString()
  coachId!: string;
}
