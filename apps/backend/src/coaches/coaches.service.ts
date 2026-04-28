import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  RegistroPeso,
  RegistroMedidas,
  RegistroActividad,
  RegistroComida,
  Usuario,
} from "@prisma/client";

/**
 * Datos básicos de un paciente que el coach ve en la lista.
 * Incluye el último peso registrado y un indicador de actividad reciente.
 */
export interface ResumenPacienteLista {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  meta: number | null;
  ultimoPeso: { peso: number; fecha: Date } | null;
  /** Cantidad de registros (peso + comidas + actividad) en los últimos 7 días */
  actividadReciente: number;
  /** Fecha del registro más reciente de cualquier tipo */
  ultimaActividad: Date | null;
}

/**
 * Resumen completo de un paciente para la vista de detalle del coach.
 */
export interface ResumenPacienteDetalle {
  usuario: Omit<Usuario, "passwordHash">;
  /** Últimos 10 registros de peso ordenados del más reciente al más antiguo */
  ultimosPesos: RegistroPeso[];
  /** Último registro de medidas */
  ultimasMedidas: RegistroMedidas | null;
  /** Últimos 7 registros de actividad */
  actividadReciente: RegistroActividad[];
  /** Registros de comida de hoy */
  comidasHoy: RegistroComida[];
  /** Balance calórico de hoy */
  balanceHoy: { consumidas: number; quemadas: number; balance: number };
}

/**
 * CoachesService — lógica de negocio del panel de coach
 *
 * Provee acceso al listado y detalle de los pacientes asignados al coach.
 * Todos los métodos verifican que el usuario sea efectivamente un coach con
 * perfil de Coach configurado, y que el paciente solicitado le pertenezca.
 */
@Injectable()
export class CoachesService {
  private readonly logger = new Logger(CoachesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el perfil de Coach del usuario autenticado.
   * Lanza NotFoundException si el usuario no tiene perfil de coach configurado.
   *
   * @param coachUsuarioId - ID del Usuario con rol=COACH
   * @returns El perfil de Coach con sus pacientes
   */
  private async obtenerPerfilCoach(coachUsuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: coachUsuarioId },
      include: {
        coachProfile: {
          include: { pacientes: true },
        },
      },
    });

    if (!usuario?.coachProfile) {
      throw new NotFoundException(
        "Este usuario no tiene un perfil de coach configurado. " +
          "El administrador debe crear el perfil desde el panel de admin.",
      );
    }

    return usuario.coachProfile;
  }

  /**
   * Devuelve la lista de pacientes asignados al coach autenticado,
   * enriquecida con el último peso y un indicador de actividad reciente.
   *
   * @param coachUsuarioId - ID del Usuario con rol=COACH
   * @returns Lista de pacientes con datos resumidos
   */
  async misPacientes(coachUsuarioId: string): Promise<ResumenPacienteLista[]> {
    const perfil = await this.obtenerPerfilCoach(coachUsuarioId);

    const pacienteIds = perfil.pacientes.map((p) => p.id);

    if (pacienteIds.length === 0) return [];

    // Traer los pacientes con sus últimos registros en paralelo
    const pacientes = await this.prisma.usuario.findMany({
      where: { id: { in: pacienteIds } },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        meta: true,
        registrosPeso: {
          orderBy: { fecha: "desc" },
          take: 1,
          select: { peso: true, fecha: true },
        },
      },
    });

    // Calcular actividad reciente de los últimos 7 días para cada paciente
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const resultados = await Promise.all(
      pacientes.map(async (p) => {
        const [cantPesos, cantComidas, cantActividad] = await Promise.all([
          this.prisma.registroPeso.count({
            where: { usuarioId: p.id, fecha: { gte: hace7Dias } },
          }),
          this.prisma.registroComida.count({
            where: { usuarioId: p.id, fecha: { gte: hace7Dias } },
          }),
          this.prisma.registroActividad.count({
            where: { usuarioId: p.id, fecha: { gte: hace7Dias } },
          }),
        ]);

        // Fecha del último registro de cualquier tipo
        const ultimosRegistros = await this.prisma.registroPeso.findFirst({
          where: { usuarioId: p.id },
          orderBy: { fecha: "desc" },
          select: { fecha: true },
        });

        return {
          id: p.id,
          nombre: p.nombre,
          apellido: p.apellido,
          email: p.email,
          meta: p.meta,
          ultimoPeso: p.registrosPeso[0] ?? null,
          actividadReciente: cantPesos + cantComidas + cantActividad,
          ultimaActividad: ultimosRegistros?.fecha ?? null,
        } satisfies ResumenPacienteLista;
      }),
    );

    return resultados;
  }

  /**
   * Devuelve el resumen completo de un paciente para la vista de detalle.
   * Verifica que el paciente esté asignado al coach antes de devolver datos.
   *
   * @param coachUsuarioId - ID del Usuario con rol=COACH
   * @param pacienteId - ID del Usuario paciente
   * @returns Resumen completo con pesos, medidas, actividad y balance calórico
   * @throws NotFoundException si el paciente no existe
   * @throws ForbiddenException si el paciente no está asignado a este coach
   */
  async resumenPaciente(
    coachUsuarioId: string,
    pacienteId: string,
  ): Promise<ResumenPacienteDetalle> {
    const perfil = await this.obtenerPerfilCoach(coachUsuarioId);

    // Verificar que el paciente pertenece a este coach
    const esSuPaciente = perfil.pacientes.some((p) => p.id === pacienteId);
    if (!esSuPaciente) {
      throw new ForbiddenException(
        "Este paciente no está asignado a tu perfil de coach.",
      );
    }

    const paciente = await this.prisma.usuario.findUnique({
      where: { id: pacienteId },
    });

    if (!paciente) throw new NotFoundException("Paciente no encontrado");

    // Definir rango de "hoy" en hora local — usar el inicio y fin del día UTC
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    // Traer todos los datos en paralelo
    const [ultimosPesos, ultimasMedidas, actividadReciente, comidasHoy, actividadHoy] =
      await Promise.all([
        this.prisma.registroPeso.findMany({
          where: { usuarioId: pacienteId },
          orderBy: { fecha: "desc" },
          take: 10,
        }),
        this.prisma.registroMedidas.findFirst({
          where: { usuarioId: pacienteId },
          orderBy: { fecha: "desc" },
        }),
        this.prisma.registroActividad.findMany({
          where: { usuarioId: pacienteId },
          orderBy: { fecha: "desc" },
          take: 7,
        }),
        this.prisma.registroComida.findMany({
          where: { usuarioId: pacienteId, fecha: { gte: hoyInicio, lte: hoyFin } },
          orderBy: { fecha: "asc" },
        }),
        this.prisma.registroActividad.findMany({
          where: { usuarioId: pacienteId, fecha: { gte: hoyInicio, lte: hoyFin } },
        }),
      ]);

    const consumidas = comidasHoy.reduce((acc, c) => acc + c.calorias, 0);
    const quemadas = actividadHoy.reduce((acc, a) => acc + a.calorias, 0);

    // Excluir passwordHash del objeto de usuario devuelto al frontend
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _pw, ...usuarioSinHash } = paciente;

    return {
      usuario: usuarioSinHash,
      ultimosPesos,
      ultimasMedidas,
      actividadReciente,
      comidasHoy,
      balanceHoy: { consumidas, quemadas, balance: consumidas - quemadas },
    };
  }
}
