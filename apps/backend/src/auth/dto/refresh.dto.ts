import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

/**
 * RefreshDto — token de refresco para obtener un nuevo access token
 */
export class RefreshDto {
  @ApiProperty({ description: "Refresh token obtenido en login o register" })
  @IsString()
  refreshToken!: string;
}
