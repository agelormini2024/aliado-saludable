import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

/**
 * DTO para crear un nuevo coach.
 *
 * La operación crea dos registros en la BD:
 * 1. Coach  — perfil profesional (nombre, especialidad, etc.)
 * 2. Usuario — cuenta de login con rol=COACH, vinculada al Coach via coachProfileId
 *
 * El coach usa el mismo sistema de auth que los usuarios (POST /auth/login).
 */
export class CreateCoachDto {
  @ApiProperty({ example: "dra.garcia@aliado.com" })
  @IsEmail({}, { message: "El email no es válido" })
  email!: string;

  @ApiProperty({ example: "Valentina" })
  @IsNotEmpty({ message: "El nombre es requerido" })
  @IsString()
  nombre!: string;

  @ApiProperty({ example: "García" })
  @IsNotEmpty({ message: "El apellido es requerido" })
  @IsString()
  apellido!: string;

  @ApiProperty({ example: "Contraseña123", minLength: 8 })
  @IsNotEmpty({ message: "La contraseña es requerida" })
  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  password!: string;

  @ApiPropertyOptional({ example: "Nutrición clínica" })
  @IsOptional()
  @IsString()
  especialidad?: string;
}
