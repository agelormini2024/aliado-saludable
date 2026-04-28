import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateCoachDto } from "./dto/create-coach.dto";
import { UpdateCoachDto } from "./dto/update-coach.dto";
import { AsignarCoachDto } from "./dto/asignar-coach.dto";
import { RolUsuario } from "@prisma/client";
import * as bcrypt from "bcryptjs";

/** Rondas de bcrypt — mismo valor que AuthService para consistencia */
const BCRYPT_ROUNDS = 12;

/**
 * AdminService — lógica de negocio del panel de administración
 *
 * Gestiona la creación de coaches y la asignación de pacientes.
 * Todos los métodos son exclusivos del rol ADMIN.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── COACHES ─────────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo coach en el sistema.
   *
   * La operación crea dos registros en una transacción:
   * 1. `Coach` — perfil profesional con nombre, email y especialidad
   * 2. `Usuario` — cuenta de login con `rol=COACH` y `coachProfileId` apuntando al Coach
   *
   * Esto permite que el coach se loguee via POST /auth/login (mismo flujo que usuarios)
   * y que el sistema pueda navegar: usuarioCoach.coachProfile.pacientes
   *
   * @param dto - Datos del nuevo coach
   * @returns El perfil de Coach creado junto con el Usuario vinculado
   * @throws ConflictException si el email ya está en uso (Usuario o Coach)
   */
  async crearCoach(dto: CreateCoachDto) {
    // Verificar unicidad del email en ambas tablas antes de crear
    const [usuarioExistente, coachExistente] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { email: dto.email } }),
      this.prisma.coach.findUnique({ where: { email: dto.email } }),
    ]);

    if (usuarioExistente || coachExistente) {
      throw new ConflictException("El email ya está registrado en la plataforma");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Transacción: los dos registros se crean juntos o no se crea ninguno
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear el perfil profesional de Coach
      const coach = await tx.coach.create({
        data: {
          email: dto.email,
          nombre: dto.nombre,
          apellido: dto.apellido,
          passwordHash,
          especialidad: dto.especialidad,
        },
      });

      // 2. Crear el Usuario con rol=COACH vinculado al perfil de Coach
      const usuario = await tx.usuario.create({
        data: {
          email: dto.email,
          nombre: dto.nombre,
          apellido: dto.apellido,
          passwordHash,
          rol: RolUsuario.COACH,
          coachProfileId: coach.id,
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          rol: true,
          coachProfileId: true,
          createdAt: true,
        },
      });

      return { coach, usuario };
    });

    this.logger.log(`Coach creado: ${dto.email} (coachId=${resultado.coach.id})`);
    return resultado;
  }

  /**
   * Devuelve la lista de todos los coaches con el conteo de pacientes asignados.
   *
   * @returns Lista de perfiles Coach con su usuarioCoach y cantidad de pacientes
   */
  async listarCoaches() {
    const coaches = await this.prisma.coach.findMany({
      include: {
        usuarioCoach: {
          select: { id: true, email: true, nombre: true, apellido: true, rol: true },
        },
        _count: { select: { pacientes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Excluir passwordHash del resultado
    return coaches.map(({ passwordHash: _pw, ...coach }) => coach);
  }

  /**
   * Actualiza los datos de un coach (especialidad y/o nombre/apellido).
   *
   * Si se modifican nombre o apellido, el cambio se sincroniza también al
   * Usuario vinculado (usuarioCoach) en la misma transacción para mantener
   * consistencia entre las dos tablas.
   *
   * @param coachId - ID del perfil de Coach a editar
   * @param dto - Campos a actualizar (todos opcionales)
   * @returns El perfil de Coach actualizado (sin passwordHash)
   * @throws NotFoundException si el coach no existe
   */
  async editarCoach(coachId: string, dto: UpdateCoachDto) {
    const coach = await this.prisma.coach.findUnique({
      where: { id: coachId },
      include: { usuarioCoach: { select: { id: true } } },
    });

    if (!coach) throw new NotFoundException("Coach no encontrado");

    const coachData: { nombre?: string; apellido?: string; especialidad?: string } = {};
    if (dto.nombre !== undefined) coachData.nombre = dto.nombre;
    if (dto.apellido !== undefined) coachData.apellido = dto.apellido;
    if (dto.especialidad !== undefined) coachData.especialidad = dto.especialidad;

    const coachActualizado = await this.prisma.$transaction(async (tx) => {
      // Actualizar perfil Coach
      const updated = await tx.coach.update({
        where: { id: coachId },
        data: coachData,
        include: {
          usuarioCoach: { select: { id: true, email: true, nombre: true, apellido: true } },
          _count: { select: { pacientes: true } },
        },
      });

      // Sincronizar nombre/apellido al Usuario vinculado si corresponde
      const usuarioId = coach.usuarioCoach?.id;
      const hayNombreOApellido = dto.nombre !== undefined || dto.apellido !== undefined;
      if (usuarioId && hayNombreOApellido) {
        await tx.usuario.update({
          where: { id: usuarioId },
          data: {
            ...(dto.nombre !== undefined && { nombre: dto.nombre }),
            ...(dto.apellido !== undefined && { apellido: dto.apellido }),
          },
        });
      }

      return updated;
    });

    this.logger.log(`Coach ${coachId} actualizado`);
    const { passwordHash: _pw, ...result } = coachActualizado;
    return result;
  }

  /**
   * Convierte un coach en usuario regular (paciente).
   *
   * La operación es atómica y realiza en orden:
   * 1. Desafecta todos los pacientes asignados al coach (coachId → null)
   * 2. Cambia el rol del Usuario vinculado de COACH a USUARIO
   * 3. Elimina el vínculo coachProfileId del Usuario
   * 4. Limpia los RefreshTokens con coachId (si hubiera alguno del modelo viejo)
   * 5. Elimina el perfil Coach
   *
   * El Usuario sigue existiendo y puede continuar usando la plataforma como paciente.
   *
   * @param coachId - ID del perfil de Coach a convertir
   * @returns Datos del Usuario resultante
   * @throws NotFoundException si el coach o su usuario vinculado no existen
   */
  async convertirAPaciente(coachId: string) {
    const coach = await this.prisma.coach.findUnique({
      where: { id: coachId },
      include: {
        usuarioCoach: { select: { id: true, email: true, nombre: true, apellido: true } },
        _count: { select: { pacientes: true } },
      },
    });

    if (!coach) throw new NotFoundException("Coach no encontrado");
    if (!coach.usuarioCoach) {
      throw new NotFoundException("El coach no tiene una cuenta de usuario vinculada");
    }

    const usuarioCoachId = coach.usuarioCoach.id;
    const cantidadPacientes = coach._count.pacientes;

    await this.prisma.$transaction(async (tx) => {
      // 1. Desafectar todos los pacientes del coach
      await tx.usuario.updateMany({
        where: { coachId },
        data: { coachId: null },
      });

      // 2 y 3. Cambiar rol del Usuario a USUARIO y limpiar coachProfileId
      await tx.usuario.update({
        where: { id: usuarioCoachId },
        data: { rol: RolUsuario.USUARIO, coachProfileId: null },
      });

      // 4. Limpiar refresh tokens del modelo Coach si hubiera (compatibilidad con schema)
      await tx.refreshToken.deleteMany({ where: { coachId } });

      // 5. Eliminar el perfil Coach
      await tx.coach.delete({ where: { id: coachId } });
    });

    this.logger.log(
      `Coach ${coachId} convertido a paciente (usuarioId=${usuarioCoachId}, pacientes desafectados=${cantidadPacientes})`,
    );

    return {
      usuarioId: usuarioCoachId,
      email: coach.usuarioCoach.email,
      pacientesDesafectados: cantidadPacientes,
    };
  }

  // ─── PACIENTES ────────────────────────────────────────────────────────────────

  /**
   * Devuelve la lista de todos los usuarios con rol=USUARIO.
   * Útil para que el admin seleccione pacientes al asignarlos a un coach.
   *
   * @returns Lista de usuarios sin datos sensibles
   */
  async listarPacientes() {
    return this.prisma.usuario.findMany({
      where: { rol: RolUsuario.USUARIO },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        meta: true,
        coachId: true,
        coach: {
          select: { id: true, nombre: true, apellido: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Asigna un coach a un paciente (establece Usuario.coachId).
   * Si el paciente ya tenía otro coach, lo reemplaza.
   *
   * @param pacienteId - ID del Usuario paciente
   * @param dto - Contiene el coachId del perfil de Coach
   * @throws NotFoundException si el paciente o el coach no existen
   */
  async asignarCoach(pacienteId: string, dto: AsignarCoachDto) {
    const [paciente, coach] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: pacienteId } }),
      this.prisma.coach.findUnique({ where: { id: dto.coachId } }),
    ]);

    if (!paciente) throw new NotFoundException("Paciente no encontrado");
    if (!coach) throw new NotFoundException("Coach no encontrado");

    const actualizado = await this.prisma.usuario.update({
      where: { id: pacienteId },
      data: { coachId: dto.coachId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        coachId: true,
        coach: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    this.logger.log(
      `Paciente ${pacienteId} asignado al coach ${dto.coachId}`,
    );
    return actualizado;
  }

  /**
   * Desasigna el coach de un paciente (establece Usuario.coachId = null).
   *
   * @param pacienteId - ID del Usuario paciente
   * @throws NotFoundException si el paciente no existe
   */
  async desasignarCoach(pacienteId: string) {
    const paciente = await this.prisma.usuario.findUnique({
      where: { id: pacienteId },
    });

    if (!paciente) throw new NotFoundException("Paciente no encontrado");

    const actualizado = await this.prisma.usuario.update({
      where: { id: pacienteId },
      data: { coachId: null },
      select: { id: true, email: true, nombre: true, apellido: true, coachId: true },
    });

    this.logger.log(`Coach desasignado del paciente ${pacienteId}`);
    return actualizado;
  }
}
