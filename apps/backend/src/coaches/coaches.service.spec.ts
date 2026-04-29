import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { CoachesService } from "./coaches.service";
import { PrismaService } from "../database/prisma.service";

/**
 * Mock de PrismaService para CoachesService.
 *
 * CoachesService accede a: usuario, registroPeso, registroComida,
 * registroActividad y registroMedidas. Cada método se configura por test
 * usando mockResolvedValue / mockResolvedValueOnce.
 */
const mockPrismaService = {
  usuario: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  registroPeso: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  registroComida: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  registroActividad: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  registroMedidas: {
    findFirst: jest.fn(),
  },
};

/** Perfil de coach de prueba (sin pacientes) */
const coachPerfilVacio = {
  id: "coach-id",
  pacientes: [] as { id: string }[],
};

/** Perfil de coach con un paciente asignado */
const coachPerfilConPaciente = {
  id: "coach-id",
  pacientes: [{ id: "paciente-1" }],
};

/** Usuario con perfil de coach que tiene pacientes */
const usuarioCoachConPaciente = {
  id: "coach-usuario-id",
  coachProfile: coachPerfilConPaciente,
};

/** Fila de paciente tal como la devuelve prisma.usuario.findMany */
const pacienteMock = {
  id: "paciente-1",
  nombre: "Ana",
  apellido: "García",
  email: "ana@test.com",
  meta: 65,
  registrosPeso: [{ peso: 70.5, fecha: new Date("2026-04-28") }],
};

/** Usuario paciente completo (con passwordHash, para simular findUnique) */
const pacienteCompletaMock = {
  id: "paciente-1",
  nombre: "Ana",
  apellido: "García",
  email: "ana@test.com",
  passwordHash: "hash-secreto-que-no-debe-exponerse",
  altura: 165,
  fechaNacimiento: null,
  meta: 60,
  rol: "USUARIO",
  coachId: "coach-id",
  coachProfileId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-04-01"),
};

describe("CoachesService", () => {
  let service: CoachesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CoachesService>(CoachesService);
    jest.clearAllMocks();
  });

  // ─── misPacientes() ─────────────────────────────────────────────────────────

  describe("misPacientes()", () => {
    it("lanza NotFoundException cuando el usuario no tiene perfil de coach", async () => {
      // El usuario existe pero sin coachProfile (o directamente null)
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(service.misPacientes("usuario-sin-perfil")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza NotFoundException cuando el usuario tiene coachProfile = null", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: "coach-usuario-id",
        coachProfile: null, // usuario existe pero sin perfil profesional
      });

      await expect(service.misPacientes("coach-usuario-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("devuelve array vacío si el coach no tiene pacientes asignados", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: "coach-usuario-id",
        coachProfile: coachPerfilVacio,
      });

      const result = await service.misPacientes("coach-usuario-id");

      expect(result).toEqual([]);
      // No debe haber consultas adicionales si no hay pacientes
      expect(mockPrismaService.usuario.findMany).not.toHaveBeenCalled();
    });

    it("devuelve la lista de pacientes con actividad reciente calculada", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(usuarioCoachConPaciente);
      mockPrismaService.usuario.findMany.mockResolvedValue([pacienteMock]);

      // Conteos de actividad reciente (últimos 7 días)
      mockPrismaService.registroPeso.count.mockResolvedValue(3);
      mockPrismaService.registroComida.count.mockResolvedValue(5);
      mockPrismaService.registroActividad.count.mockResolvedValue(2);
      mockPrismaService.registroPeso.findFirst.mockResolvedValue({
        fecha: new Date("2026-04-28"),
      });

      const result = await service.misPacientes("coach-usuario-id");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("paciente-1");
      expect(result[0].nombre).toBe("Ana");
      // actividadReciente = suma de los tres conteos
      expect(result[0].actividadReciente).toBe(10); // 3 + 5 + 2
    });

    it("devuelve ultimoPeso = null si el paciente no tiene registros de peso", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(usuarioCoachConPaciente);
      mockPrismaService.usuario.findMany.mockResolvedValue([
        { ...pacienteMock, registrosPeso: [] }, // sin registros
      ]);

      mockPrismaService.registroPeso.count.mockResolvedValue(0);
      mockPrismaService.registroComida.count.mockResolvedValue(0);
      mockPrismaService.registroActividad.count.mockResolvedValue(0);
      mockPrismaService.registroPeso.findFirst.mockResolvedValue(null);

      const result = await service.misPacientes("coach-usuario-id");

      expect(result[0].ultimoPeso).toBeNull();
      expect(result[0].actividadReciente).toBe(0);
    });
  });

  // ─── resumenPaciente() ──────────────────────────────────────────────────────

  describe("resumenPaciente()", () => {
    it("lanza NotFoundException cuando el coach no tiene perfil", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.resumenPaciente("coach-sin-perfil", "paciente-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("lanza ForbiddenException cuando el paciente no está asignado al coach", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: "coach-usuario-id",
        coachProfile: {
          id: "coach-id",
          pacientes: [{ id: "otro-paciente-distinto" }],
        },
      });

      await expect(
        service.resumenPaciente("coach-usuario-id", "paciente-que-no-le-pertenece"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("no expone passwordHash del paciente en la respuesta", async () => {
      // Primera llamada: obtener perfil del coach con su lista de pacientes
      mockPrismaService.usuario.findUnique
        .mockResolvedValueOnce(usuarioCoachConPaciente)
        // Segunda llamada: obtener datos completos del paciente (incluye passwordHash)
        .mockResolvedValueOnce(pacienteCompletaMock);

      mockPrismaService.registroPeso.findMany.mockResolvedValue([]);
      mockPrismaService.registroMedidas.findFirst.mockResolvedValue(null);
      // registroActividad.findMany se llama dos veces: actividadReciente y actividadHoy
      mockPrismaService.registroActividad.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.registroComida.findMany.mockResolvedValue([]);

      const result = await service.resumenPaciente("coach-usuario-id", "paciente-1");

      // El campo passwordHash no debe aparecer en la respuesta al frontend
      expect((result.usuario as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.usuario.id).toBe("paciente-1");
    });

    it("calcula correctamente el balance calórico de hoy", async () => {
      mockPrismaService.usuario.findUnique
        .mockResolvedValueOnce(usuarioCoachConPaciente)
        .mockResolvedValueOnce(pacienteCompletaMock);

      mockPrismaService.registroPeso.findMany.mockResolvedValue([]);
      mockPrismaService.registroMedidas.findFirst.mockResolvedValue(null);
      mockPrismaService.registroActividad.findMany
        .mockResolvedValueOnce([]) // actividadReciente (últimas 7)
        .mockResolvedValueOnce([  // actividadHoy
          { id: "ra-1", calorias: 300 },
          { id: "ra-2", calorias: 150 },
        ]);
      mockPrismaService.registroComida.findMany.mockResolvedValue([
        { id: "rc-1", calorias: 400, momento: "DESAYUNO" },
        { id: "rc-2", calorias: 650, momento: "ALMUERZO" },
        { id: "rc-3", calorias: 200, momento: "MERIENDA" },
      ]);

      const result = await service.resumenPaciente("coach-usuario-id", "paciente-1");

      expect(result.balanceHoy.consumidas).toBe(1250); // 400 + 650 + 200
      expect(result.balanceHoy.quemadas).toBe(450);    // 300 + 150
      expect(result.balanceHoy.balance).toBe(800);     // 1250 - 450
    });

    it("devuelve balance calórico en 0 cuando no hay registros del día", async () => {
      mockPrismaService.usuario.findUnique
        .mockResolvedValueOnce(usuarioCoachConPaciente)
        .mockResolvedValueOnce(pacienteCompletaMock);

      mockPrismaService.registroPeso.findMany.mockResolvedValue([]);
      mockPrismaService.registroMedidas.findFirst.mockResolvedValue(null);
      mockPrismaService.registroActividad.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.registroComida.findMany.mockResolvedValue([]);

      const result = await service.resumenPaciente("coach-usuario-id", "paciente-1");

      expect(result.balanceHoy).toEqual({ consumidas: 0, quemadas: 0, balance: 0 });
    });

    it("devuelve ultimasMedidas = null cuando el paciente no tiene medidas registradas", async () => {
      mockPrismaService.usuario.findUnique
        .mockResolvedValueOnce(usuarioCoachConPaciente)
        .mockResolvedValueOnce(pacienteCompletaMock);

      mockPrismaService.registroPeso.findMany.mockResolvedValue([]);
      mockPrismaService.registroMedidas.findFirst.mockResolvedValue(null);
      mockPrismaService.registroActividad.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaService.registroComida.findMany.mockResolvedValue([]);

      const result = await service.resumenPaciente("coach-usuario-id", "paciente-1");

      expect(result.ultimasMedidas).toBeNull();
    });
  });
});
