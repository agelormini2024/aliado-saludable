import { PartialType } from "@nestjs/swagger";
import { CreateArticuloDto } from "./create-articulo.dto";

/**
 * UpdateArticuloDto — todos los campos de CreateArticuloDto son opcionales en el PATCH.
 *
 * Usa PartialType de @nestjs/swagger para heredar las decoraciones de Swagger
 * y class-validator de CreateArticuloDto, haciendo todos los campos opcionales.
 * Esto permite publicar/despublicar un artículo sin necesidad de reenviar el contenido.
 */
export class UpdateArticuloDto extends PartialType(CreateArticuloDto) {}
