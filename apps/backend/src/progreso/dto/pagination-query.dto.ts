import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

/**
 * PaginationQueryDto — parámetros de paginación reutilizables
 *
 * Se usa en todos los endpoints de listado (peso, medidas, actividad, comidas).
 * class-transformer convierte los strings de la query string a números.
 */
export class PaginationQueryDto {
  @ApiProperty({ example: 1, description: "Número de página (empieza en 1)", required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, description: "Registros por página (max 100)", required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Estructura de metadatos de paginación incluida en cada respuesta de listado.
 */
export interface PaginationMeta {
  /** Página actual */
  page: number;
  /** Registros por página */
  limit: number;
  /** Total de registros en la BD para esta consulta */
  total: number;
  /** Total de páginas */
  totalPages: number;
}
