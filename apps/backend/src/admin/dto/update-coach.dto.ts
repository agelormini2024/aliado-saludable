import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsNotEmpty } from "class-validator";

/**
 * DTO para actualizar los datos de un coach existente.
 *
 * Todos los campos son opcionales — solo se actualizan los que se envíen.
 * Los cambios en nombre/apellido se sincronizan automáticamente al Usuario vinculado.
 */
export class UpdateCoachDto {
  @ApiPropertyOptional({ description: "Nombre del coach" })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El nombre no puede estar vacío" })
  nombre?: string;

  @ApiPropertyOptional({ description: "Apellido del coach" })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "El apellido no puede estar vacío" })
  apellido?: string;

  @ApiPropertyOptional({ description: "Especialidad profesional", example: "Nutricionista clínica" })
  @IsOptional()
  @IsString()
  especialidad?: string;
}
