import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreatePesoDto } from "./dto/create-peso.dto";
import { CreateMedidasDto } from "./dto/create-medidas.dto";
import { CreateActividadDto } from "./dto/create-actividad.dto";
import { PaginationQueryDto, PaginationMeta } from "./dto/pagination-query.dto";
import { RegistroPeso, RegistroMedidas, RegistroActividad } from "@prisma/client";

/**
 * Tipo genérico para respuestas paginadas.
 * T es el tipo de los items (RegistroPeso, RegistroMedidas, etc.)
 */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * ProgresoService — lógica de negocio para registros de progreso
 *
 * Gestiona tres tipos de registros: peso, medidas corporales y actividad física.
 * Todos los métodos filtran por usuarioId para garantizar que cada usuario
 * solo pueda ver y crear sus propios registros.
 */
@Injectable()
export class ProgresoService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── PESO ────────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo peso para el usuario.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param dto - Datos del registro (peso, fecha opcional, nota opcional)
   * @returns El registro creado
   */
  async crearPeso(usuarioId: string, dto: CreatePesoDto): Promise<RegistroPeso> {
    return this.prisma.registroPeso.create({
      data: {
        usuarioId,
        peso: dto.peso,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        nota: dto.nota,
      },
    });
  }

  /**
   * Devuelve el historial de pesos del usuario, ordenado del más reciente al más antiguo.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param query - Parámetros de paginación (page, limit)
   * @returns Lista paginada de registros de peso
   */
  async listarPesos(
    usuarioId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegistroPeso>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.registroPeso.findMany({
        where: { usuarioId },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.registroPeso.count({ where: { usuarioId } }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── MEDIDAS ─────────────────────────────────────────────────────────────────

  /**
   * Registra nuevas medidas corporales para el usuario.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param dto - Medidas a registrar (todas opcionales)
   * @returns El registro creado
   */
  async crearMedidas(usuarioId: string, dto: CreateMedidasDto): Promise<RegistroMedidas> {
    return this.prisma.registroMedidas.create({
      data: {
        usuarioId,
        cintura: dto.cintura,
        cadera: dto.cadera,
        pecho: dto.pecho,
        brazo: dto.brazo,
        muslo: dto.muslo,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
      },
    });
  }

  /**
   * Devuelve el historial de medidas del usuario.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param query - Parámetros de paginación
   * @returns Lista paginada de registros de medidas
   */
  async listarMedidas(
    usuarioId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegistroMedidas>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.registroMedidas.findMany({
        where: { usuarioId },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.registroMedidas.count({ where: { usuarioId } }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── ACTIVIDAD ───────────────────────────────────────────────────────────────

  /**
   * Registra una sesión de actividad física para el usuario.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param dto - Datos de la actividad (tipo, duración, calorías opcionales, etc.)
   * @returns El registro creado
   */
  async crearActividad(usuarioId: string, dto: CreateActividadDto): Promise<RegistroActividad> {
    return this.prisma.registroActividad.create({
      data: {
        usuarioId,
        tipo: dto.tipo,
        duracion: dto.duracion,
        calorias: dto.calorias,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        nota: dto.nota,
      },
    });
  }

  /**
   * Devuelve el historial de actividad física del usuario.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param query - Parámetros de paginación
   * @returns Lista paginada de registros de actividad
   */
  async listarActividades(
    usuarioId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<RegistroActividad>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.registroActividad.findMany({
        where: { usuarioId },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.registroActividad.count({ where: { usuarioId } }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
