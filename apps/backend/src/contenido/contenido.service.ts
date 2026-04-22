import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateArticuloDto } from "./dto/create-articulo.dto";
import { UpdateArticuloDto } from "./dto/update-articulo.dto";
import { Articulo } from "@prisma/client";

/**
 * Resultado paginado de artículos, consistente con PaginatedResult de otros módulos.
 */
export interface ArticulosResult {
  items: Articulo[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * ContenidoService — lógica para gestión de artículos informativos.
 *
 * Los artículos son el contenido editorial de la plataforma: guías y consejos
 * sobre nutrición, ejercicio y bienestar. El Admin los crea y los publica;
 * los usuarios autenticados los leen.
 *
 * En Fase 3, este servicio se extenderá para indexar artículos en
 * EmbeddingDocument al publicarlos, alimentando el RAG del chat IA.
 */
@Injectable()
export class ContenidoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un nuevo artículo. Por defecto queda no publicado hasta que el
   * Admin lo publique explícitamente via PATCH.
   *
   * @param autorId - ID del admin que crea el artículo (extraído del JWT)
   * @param dto - Datos del artículo
   * @returns El artículo creado
   */
  async crearArticulo(autorId: string, dto: CreateArticuloDto): Promise<Articulo> {
    return this.prisma.articulo.create({
      data: {
        titulo: dto.titulo,
        contenido: dto.contenido,
        categoria: dto.categoria,
        publicado: dto.publicado ?? false,
        autorId,
      },
    });
  }

  /**
   * Lista artículos con paginación y filtro opcional por categoría.
   *
   * @param soloPublicados - true para usuarios (solo ven publicados), false para admin (ve todos)
   * @param categoria - Filtro opcional: "NUTRICION" | "EJERCICIO" | "BIENESTAR"
   * @param page - Número de página (empieza en 1)
   * @param limit - Registros por página (max 100)
   * @returns Lista paginada de artículos con metadatos de paginación
   */
  async listarArticulos(options: {
    soloPublicados?: boolean;
    categoria?: string;
    page?: number;
    limit?: number;
  }): Promise<ArticulosResult> {
    const { soloPublicados = true, categoria, page = 1, limit = 20 } = options;

    const where: Record<string, unknown> = {};
    if (soloPublicados) where.publicado = true;
    if (categoria) where.categoria = categoria;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.articulo.count({ where }),
      this.prisma.articulo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Devuelve un artículo por su ID.
   *
   * @param id - ID del artículo
   * @param soloPublicado - Si true (modo usuario), lanza NotFoundException si el artículo no está publicado.
   *                        Si false (modo admin), devuelve el artículo sin importar su estado.
   * @throws NotFoundException si el artículo no existe o no está publicado (según el parámetro)
   */
  async obtenerArticulo(id: string, soloPublicado = true): Promise<Articulo> {
    const articulo = await this.prisma.articulo.findFirst({
      where: {
        id,
        ...(soloPublicado ? { publicado: true } : {}),
      },
    });

    if (!articulo) {
      throw new NotFoundException(`Artículo con id "${id}" no encontrado`);
    }

    return articulo;
  }

  /**
   * Actualiza uno o más campos de un artículo existente.
   * Solo envía los campos que vienen en el DTO (PATCH parcial).
   *
   * @param id - ID del artículo a actualizar
   * @param dto - Campos a actualizar (todos opcionales — puede ser solo { publicado: true })
   * @throws NotFoundException si el artículo no existe
   * @returns El artículo actualizado
   */
  async actualizarArticulo(id: string, dto: UpdateArticuloDto): Promise<Articulo> {
    // Verificar existencia antes de intentar la actualización (admin ve no publicados también)
    await this.obtenerArticulo(id, false);

    return this.prisma.articulo.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.contenido !== undefined ? { contenido: dto.contenido } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.publicado !== undefined ? { publicado: dto.publicado } : {}),
      },
    });
  }

  /**
   * Elimina un artículo definitivamente.
   * En Fase 3, también deberá eliminar los EmbeddingDocuments asociados.
   *
   * @param id - ID del artículo a eliminar
   * @throws NotFoundException si el artículo no existe
   * @returns El artículo eliminado (útil para confirmar en la respuesta)
   */
  async eliminarArticulo(id: string): Promise<Articulo> {
    await this.obtenerArticulo(id, false);

    return this.prisma.articulo.delete({ where: { id } });
  }
}
