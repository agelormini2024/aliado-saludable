import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, IsOptional, IsIn } from "class-validator";

/**
 * RegisterDto — datos necesarios para crear una nueva cuenta
 *
 * Se valida automáticamente por el ValidationPipe global antes de llegar
 * al controller. Si algún campo falla, NestJS devuelve 400 Bad Request.
 */
export class RegisterDto {
  @ApiProperty({ example: "ana@ejemplo.com", description: "Email único del usuario" })
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  email!: string;

  @ApiProperty({ example: "Ana" })
  @IsString()
  nombre!: string;

  @ApiProperty({ example: "García" })
  @IsString()
  apellido!: string;

  @ApiProperty({ example: "MiContraseña123", minLength: 8 })
  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  password!: string;

  /**
   * Rol opcional. Por defecto es USUARIO.
   * Solo se usa en tests o si el admin crea cuentas de coach.
   */
  @ApiProperty({ enum: ["USUARIO", "COACH", "ADMIN"], required: false, default: "USUARIO" })
  @IsOptional()
  @IsIn(["USUARIO", "COACH", "ADMIN"])
  rol?: "USUARIO" | "COACH" | "ADMIN";
}
