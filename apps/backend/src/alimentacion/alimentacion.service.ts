import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateComidaDto } from "./dto/create-comida.dto";
import { RegistroComida } from "@prisma/client";

/**
 * AlimentacionService — lógica para registros de comidas
 *
 * Permite registrar lo que el usuario comió en cada momento del día
 * y consultar los registros de un día específico.
 */
@Injectable()
export class AlimentacionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una ingesta del usuario.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param dto - Datos de la comida (momento, descripción, calorías opcionales)
   * @returns El registro creado
   */
  async crearComida(usuarioId: string, dto: CreateComidaDto): Promise<RegistroComida> {
    return this.prisma.registroComida.create({
      data: {
        usuarioId,
        momento: dto.momento,
        descripcion: dto.descripcion,
        calorias: dto.calorias,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
      },
    });
  }

  /**
   * Devuelve todas las comidas del usuario para un día específico.
   * Si no se pasa fecha, devuelve las de hoy.
   *
   * El filtro usa un rango de 24hs que cubre todo el día en la zona horaria
   * del servidor (UTC). Para una app multiregión se debería parametrizar el timezone.
   *
   * @param usuarioId - ID del usuario autenticado
   * @param fecha - Fecha a consultar (ISO 8601, ej: "2026-04-21"). Default: hoy.
   * @returns Lista de registros del día, ordenados por hora de registro
   */
  async listarComidasDelDia(usuarioId: string, fecha?: string): Promise<RegistroComida[]> {
    const diaBase = fecha ? new Date(fecha) : new Date();

    // Construir rango: desde 00:00:00 hasta 23:59:59 del día pedido
    const inicioDia = new Date(diaBase);
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date(diaBase);
    finDia.setHours(23, 59, 59, 999);

    return this.prisma.registroComida.findMany({
      where: {
        usuarioId,
        fecha: {
          gte: inicioDia,
          lte: finDia,
        },
      },
      orderBy: { fecha: "asc" },
    });
  }
}
