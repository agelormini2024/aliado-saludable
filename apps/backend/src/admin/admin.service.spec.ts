import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { PrismaService } from "../database/prisma.service";
import { RolUsuario } from "@prisma/client";

/**
 * Mock de PrismaService para AdminService.
 *
 * AdminService usa: usuario, coach, refreshToken y $transaction.
 * La estrategia para $transaction: mockear la función para que llame
 * al callback con el mismo objeto mock como `tx`. Así los métodos
 * invocados dentro de la transacción (tx.coach.create, tx.usuario.update, etc.)
 * son los mismos mocks y se pueden verificar con expect().
 */
const mockPrismaService = {
  usuario: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  coach: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  refreshToken: {
    deleteMany: jest.fn(),
  },
  /**
   * $transaction ejecuta el callback con el mismo mockPrismaService como `tx`.
   * Se redefine en cada test que lo necesita para devolver el valor correcto.
   */
  $transaction: jest.fn(),
};

/** Coach de prueba tal como lo devuelve prisma.coach.findUnique */
const coachMock = {
  id: "coach-id",
  nombre: "Carlos",
  apellido: "López",
  email: "carlos@test.com",
  passwordHash: "hash",
  especialidad: "Nutrición",
  createdAt: new Date("2026-01-01"),
  usuarioCoach: { id: "usuario-coach-id", email: "carlos@test.com", nombre: "Carlos", apellido: "López" },
  _count: { pacientes: 3 },
};

/** Paciente de prueba tal como lo devuelve prisma.usuario.findUnique */
const pacienteMock = {
  id: "paciente-id",
  nombre: "Ana",
  apellido: "García",
  email: "ana@test.com",
  passwordHash: "hash",
  rol: RolUsuario.USUARIO,
  coachId: null,
  createdAt: new Date("2026-01-01"),
};

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();

    // Por defecto, $transaction llama al callback con el mock como tx.
    // Tests individuales pueden sobreescribir esto si necesitan un valor de retorno específico.
    mockPrismaService.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrismaService) => Promise<unknown>) => fn(mockPrismaService),
    );
  });

  // ─── crearCoach() ───────────────────────────────────────────────────────────

  describe("crearCoach()", () => {
    const dto = {
      nombre: "Carlos",
      apellido: "López",
      email: "carlos@test.com",
      password: "Segura123!",
      especialidad: "Nutrición",
    };

    it("lanza ConflictException si el email ya existe como Usuario", async () => {
      // Usuario con ese email ya existe; el coach no
      mockPrismaService.usuario.findUnique.mockResolvedValue({ id: "u-1", email: dto.email });
      mockPrismaService.coach.findUnique.mockResolvedValue(null);

      await expect(service.crearCoach(dto)).rejects.toThrow(ConflictException);
    });

    it("lanza ConflictException si el email ya existe como Coach", async () => {
      // No hay usuario pero sí coach con ese email
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.coach.findUnique.mockResolvedValue({ id: "c-1", email: dto.email });

      await expect(service.crearCoach(dto)).rejects.toThrow(ConflictException);
    });

    it("crea el Coach y el Usuario en una transacción y los devuelve", async () => {
      // Email libre en ambas tablas
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.coach.findUnique.mockResolvedValue(null);

      const coachCreado = { id: "coach-nuevo", email: dto.email, nombre: dto.nombre, apellido: dto.apellido, especialidad: dto.especialidad };
      const usuarioCreado = { id: "usuario-nuevo", email: dto.email, nombre: dto.nombre, apellido: dto.apellido, rol: RolUsuario.COACH, coachProfileId: "coach-nuevo", createdAt: new Date() };

      mockPrismaService.coach.create.mockResolvedValue(coachCreado);
      mockPrismaService.usuario.create.mockResolvedValue(usuarioCreado);

      const result = await service.crearCoach(dto);

      expect(result.coach.id).toBe("coach-nuevo");
      expect(result.usuario.rol).toBe(RolUsuario.COACH);
      // La transacción debe haberse ejecutado una vez
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it("hashea la contraseña antes de crear el Coach y el Usuario", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.coach.findUnique.mockResolvedValue(null);
      mockPrismaService.coach.create.mockResolvedValue({ id: "c-1", email: dto.email });
      mockPrismaService.usuario.create.mockResolvedValue({ id: "u-1", email: dto.email, rol: RolUsuario.COACH, coachProfileId: "c-1", createdAt: new Date() });

      await service.crearCoach(dto);

      // La contraseña en claro NO debe pasarse directamente a prisma
      const coachCreateCall = mockPrismaService.coach.create.mock.calls[0][0];
      expect(coachCreateCall.data.passwordHash).not.toBe(dto.password);
      expect(coachCreateCall.data.passwordHash).toBeDefined();
    });
  });

  // ─── listarCoaches() ────────────────────────────────────────────────────────

  describe("listarCoaches()", () => {
    it("devuelve la lista de coaches sin exponer passwordHash", async () => {
      mockPrismaService.coach.findMany.mockResolvedValue([
        { ...coachMock, passwordHash: "hash-que-no-debe-exponerse" },
      ]);

      const result = await service.listarCoaches();

      expect(result).toHaveLength(1);
      expect((result[0] as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result[0].nombre).toBe("Carlos");
    });

    it("devuelve array vacío si no hay coaches", async () => {
      mockPrismaService.coach.findMany.mockResolvedValue([]);

      const result = await service.listarCoaches();

      expect(result).toEqual([]);
    });
  });

  // ─── editarCoach() ──────────────────────────────────────────────────────────

  describe("editarCoach()", () => {
    it("lanza NotFoundException si el coach no existe", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue(null);

      await expect(service.editarCoach("id-inexistente", { especialidad: "Fitness" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("actualiza solo la especialidad sin tocar el Usuario vinculado", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue(coachMock);

      const coachActualizado = { ...coachMock, especialidad: "Fitness" };
      mockPrismaService.coach.update.mockResolvedValue(coachActualizado);

      await service.editarCoach("coach-id", { especialidad: "Fitness" });

      // Como no se envió nombre ni apellido, el usuario NO debe actualizarse
      expect(mockPrismaService.usuario.update).not.toHaveBeenCalled();
    });

    it("sincroniza el nombre al Usuario vinculado cuando se actualiza", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue(coachMock);

      const coachActualizado = { ...coachMock, nombre: "Karl", passwordHash: "hash" };
      mockPrismaService.coach.update.mockResolvedValue(coachActualizado);
      mockPrismaService.usuario.update.mockResolvedValue({});

      await service.editarCoach("coach-id", { nombre: "Karl" });

      // El Usuario vinculado debe actualizarse también
      expect(mockPrismaService.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: coachMock.usuarioCoach.id },
          data: expect.objectContaining({ nombre: "Karl" }),
        }),
      );
    });
  });

  // ─── convertirAPaciente() ───────────────────────────────────────────────────

  describe("convertirAPaciente()", () => {
    it("lanza NotFoundException si el coach no existe", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue(null);

      await expect(service.convertirAPaciente("id-inexistente")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lanza NotFoundException si el coach no tiene usuario vinculado", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue({
        ...coachMock,
        usuarioCoach: null, // sin usuario de login
      });

      await expect(service.convertirAPaciente("coach-id")).rejects.toThrow(NotFoundException);
    });

    it("ejecuta la transacción completa y devuelve los datos del usuario resultante", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue(coachMock);
      mockPrismaService.usuario.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.usuario.update.mockResolvedValue({});
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.coach.delete.mockResolvedValue({});

      const result = await service.convertirAPaciente("coach-id");

      expect(result.usuarioId).toBe(coachMock.usuarioCoach.id);
      expect(result.email).toBe(coachMock.usuarioCoach.email);
      expect(result.pacientesDesafectados).toBe(3); // _count.pacientes del mock
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it("desafecta todos los pacientes del coach antes de eliminarlo", async () => {
      mockPrismaService.coach.findUnique.mockResolvedValue(coachMock);
      mockPrismaService.usuario.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.usuario.update.mockResolvedValue({});
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.coach.delete.mockResolvedValue({});

      await service.convertirAPaciente("coach-id");

      // Verificar que se desafectaron los pacientes (coachId → null)
      expect(mockPrismaService.usuario.updateMany).toHaveBeenCalledWith({
        where: { coachId: "coach-id" },
        data: { coachId: null },
      });
    });
  });

  // ─── asignarCoach() ─────────────────────────────────────────────────────────

  describe("asignarCoach()", () => {
    it("lanza NotFoundException si el paciente no existe", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.coach.findUnique.mockResolvedValue(coachMock);

      await expect(
        service.asignarCoach("paciente-inexistente", { coachId: "coach-id" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("lanza NotFoundException si el coach no existe", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(pacienteMock);
      mockPrismaService.coach.findUnique.mockResolvedValue(null);

      await expect(
        service.asignarCoach("paciente-id", { coachId: "coach-inexistente" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("asigna el coach al paciente y devuelve el usuario actualizado", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(pacienteMock);
      mockPrismaService.coach.findUnique.mockResolvedValue(coachMock);

      const pacienteActualizado = {
        ...pacienteMock,
        coachId: "coach-id",
        coach: { id: "coach-id", nombre: "Carlos", apellido: "López" },
      };
      mockPrismaService.usuario.update.mockResolvedValue(pacienteActualizado);

      const result = await service.asignarCoach("paciente-id", { coachId: "coach-id" });

      expect(result.coachId).toBe("coach-id");
      expect(mockPrismaService.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "paciente-id" },
          data: { coachId: "coach-id" },
        }),
      );
    });
  });

  // ─── desasignarCoach() ──────────────────────────────────────────────────────

  describe("desasignarCoach()", () => {
    it("lanza NotFoundException si el paciente no existe", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(service.desasignarCoach("paciente-inexistente")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("desasigna el coach del paciente (establece coachId = null)", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(pacienteMock);
      mockPrismaService.usuario.update.mockResolvedValue({ ...pacienteMock, coachId: null });

      const result = await service.desasignarCoach("paciente-id");

      expect(result.coachId).toBeNull();
      expect(mockPrismaService.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "paciente-id" },
          data: { coachId: null },
        }),
      );
    });
  });
});
