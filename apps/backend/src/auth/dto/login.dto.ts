import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

/**
 * LoginDto — credenciales para iniciar sesión
 */
export class LoginDto {
  @ApiProperty({ example: "ana@ejemplo.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "MiContraseña123" })
  @IsString()
  password!: string;
}
