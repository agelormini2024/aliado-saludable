import { Test, TestingModule } from "@nestjs/testing";
import { ProgresoService } from "./progreso.service";
import { PrismaService } from "../database/prisma.service";
import { RagService } from "../ai/rag.service";

/**
 * Mock de PrismaService para ProgresoService.
 *
 * ProgresoService usa registroPeso, registroMedidas, registroActividad
 * y registroComida (solo para agregate en resumenCalorias).
 *
 * Los listados y resumenCalorias usan la forma de array de $transaction:
 *   prisma.$transaction([query1, query2])
 * El mock la implementa con Promise.all para que los mocks individuales
 * de findMany/count/aggregate se resuelvan normalmente.
 */
const mockPrismaService = {
  registroPeso: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  registroMedidas: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  registroActividad: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  registroComida: {
    aggregate: jest.fn(),
  },
  $transaction: jest.fn(),
};

/**
 * Mock de RagService.
 *
 * La indexación es fire-and-forget — el servicio la llama sin await.
 * Mockeamos indexar como no-op para que no exploten los tests,
 * y los helpers textoParaX para que devuelvan strings válidos.
 */
const mockRagService = {
  indexar: jest.fn().mockResolvedValue(undefined),
  textoParaPeso: jest.fn().mockReturnValue("Registro de peso de prueba"),
  textoParaMedidas: jest.fn().mockReturnValue("Registro de medidas de prueba"),
  textoParaActividad: jest.fn().mockReturnValue("Registro de actividad de prueba"),
};

/** Registro de peso de prueba */
const pesoCreadoMock = {
  id: "rp-1",
  usuarioId: "u-1",
  peso: 85.3,
  fecha: new Date("2026-04-28"),
  nota: "Mañana en ayunas",
};

/** Registro de medidas de prueba */
const medidasCreadasMock = {
  id: "rm-1",
  usuarioId: "u-1",
  cintura: 90,
  cadera: 100,
  pecho: 95,
  brazo: 35,
  muslo: 58,
  fecha: new Date("2026-04-28"),
};

/** Registro de actividad de prueba */
const actividadCreadaMock = {
  id: "ra-1",
  usuarioId: "u-1",
  tipo: "CAMINATA",
  duracion: 45,
  calorias: 280,
  fecha: new Date("2026-04-28"),
  nota: null,
};

describe("ProgresoService", () => {
  let service: ProgresoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgresoService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RagService, useValue: mockRagService },
      ],
    }).compile();

    service = module.get<ProgresoService>(ProgresoService);
    jest.clearAllMocks();

    // La forma de array: prisma.$transaction([p1, p2]) → Promise.all([p1, p2])
    // Los mocks individuales de findMany/count/aggregate ya están configurados
    // por test, y Promise.all los resuelve en el mismo orden.
    mockPrismaService.$transaction.mockImplementation(
      (queries: Promise<unknown>[]) => Promise.all(queries),
    );
  });

  // ─── crearPeso() ────────────────────────────────────────────────────────────

  describe("crearPeso()", () => {
    it("crea el registro y lo devuelve", async () => {
      mockPrismaService.registroPeso.create.mockResolvedValue(pesoCreadoMock);

      const result = await service.crearPeso("u-1", { peso: 85.3, nota: "Mañana en ayunas" });

      expect(result.id).toBe("rp-1");
      expect(result.peso).toBe(85.3);
      expect(mockPrismaService.registroPeso.create).toHaveBeenCalledTimes(1);
    });

    it("usa la fecha del DTO cuando se provee", async () => {
      mockPrismaService.registroPeso.create.mockResolvedValue(pesoCreadoMock);

      await service.crearPeso("u-1", { peso: 85.3, fecha: "2026-04-28" });

      const createCall = mockPrismaService.registroPeso.create.mock.calls[0][0];
      const fechaEnviada: Date = createCall.data.fecha;
      // Debe ser un Date, no un string
      expect(fechaEnviada).toBeInstanceOf(Date);
      expect(fechaEnviada.toISOString()).toContain("2026-04-28");
    });

    it("dispara la indexación en RAG de forma asíncrona", async () => {
      mockPrismaService.registroPeso.create.mockResolvedValue(pesoCreadoMock);

      await service.crearPeso("u-1", { peso: 85.3 });

      // Aunque sea fire-and-forget, el mock se resuelve sincrónicamente
      // y podemos verificar que se llamó con los parámetros correctos
      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "PESO", referenciaId: "rp-1", usuarioId: "u-1" }),
      );
    });
  });

  // ─── listarPesos() ──────────────────────────────────────────────────────────

  describe("listarPesos()", () => {
    it("devuelve los registros con metadatos de paginación correctos", async () => {
      const pesos = [pesoCreadoMock, { ...pesoCreadoMock, id: "rp-2", peso: 84.8 }];
      mockPrismaService.registroPeso.findMany.mockResolvedValue(pesos);
      mockPrismaService.registroPeso.count.mockResolvedValue(2);

      const result = await service.listarPesos("u-1", { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it("calcula totalPages correctamente con múltiples páginas", async () => {
      mockPrismaService.registroPeso.findMany.mockResolvedValue([pesoCreadoMock]);
      mockPrismaService.registroPeso.count.mockResolvedValue(45);

      const result = await service.listarPesos("u-1", { page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(3); // ceil(45 / 20)
    });

    it("devuelve array vacío e items=0 cuando no hay registros", async () => {
      mockPrismaService.registroPeso.findMany.mockResolvedValue([]);
      mockPrismaService.registroPeso.count.mockResolvedValue(0);

      const result = await service.listarPesos("u-1", { page: 1, limit: 20 });

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ─── crearMedidas() ─────────────────────────────────────────────────────────

  describe("crearMedidas()", () => {
    it("crea el registro con las medidas proporcionadas", async () => {
      mockPrismaService.registroMedidas.create.mockResolvedValue(medidasCreadasMock);

      const result = await service.crearMedidas("u-1", {
        cintura: 90,
        cadera: 100,
        pecho: 95,
        brazo: 35,
        muslo: 58,
      });

      expect(result.id).toBe("rm-1");
      expect(result.cintura).toBe(90);
      expect(mockPrismaService.registroMedidas.create).toHaveBeenCalledTimes(1);
    });

    it("dispara la indexación en RAG con tipo MEDIDAS", async () => {
      mockPrismaService.registroMedidas.create.mockResolvedValue(medidasCreadasMock);

      await service.crearMedidas("u-1", { cintura: 90 });

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "MEDIDAS", referenciaId: "rm-1" }),
      );
    });
  });

  // ─── listarMedidas() ────────────────────────────────────────────────────────

  describe("listarMedidas()", () => {
    it("devuelve los registros paginados", async () => {
      mockPrismaService.registroMedidas.findMany.mockResolvedValue([medidasCreadasMock]);
      mockPrismaService.registroMedidas.count.mockResolvedValue(1);

      const result = await service.listarMedidas("u-1", { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─── crearActividad() ───────────────────────────────────────────────────────

  describe("crearActividad()", () => {
    it("crea el registro de actividad y lo devuelve", async () => {
      mockPrismaService.registroActividad.create.mockResolvedValue(actividadCreadaMock);

      const result = await service.crearActividad("u-1", {
        tipo: "CAMINATA",
        duracion: 45,
        calorias: 280,
      });

      expect(result.id).toBe("ra-1");
      expect(result.tipo).toBe("CAMINATA");
      expect(result.calorias).toBe(280);
    });

    it("dispara la indexación en RAG con tipo ACTIVIDAD", async () => {
      mockPrismaService.registroActividad.create.mockResolvedValue(actividadCreadaMock);

      await service.crearActividad("u-1", { tipo: "GYM", duracion: 60, calorias: 400 });

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "ACTIVIDAD", referenciaId: "ra-1" }),
      );
    });
  });

  // ─── listarActividades() ────────────────────────────────────────────────────

  describe("listarActividades()", () => {
    it("devuelve los registros paginados", async () => {
      mockPrismaService.registroActividad.findMany.mockResolvedValue([actividadCreadaMock]);
      mockPrismaService.registroActividad.count.mockResolvedValue(1);

      const result = await service.listarActividades("u-1", { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─── resumenCalorias() ──────────────────────────────────────────────────────

  describe("resumenCalorias()", () => {
    it("devuelve 0/0/0 cuando no hay registros del día (_sum.calorias = null)", async () => {
      // Prisma devuelve null en _sum cuando no hay filas que agregar
      mockPrismaService.registroComida.aggregate.mockResolvedValue({ _sum: { calorias: null } });
      mockPrismaService.registroActividad.aggregate.mockResolvedValue({ _sum: { calorias: null } });

      const result = await service.resumenCalorias("u-1");

      expect(result).toEqual({ consumidas: 0, quemadas: 0, balance: 0 });
    });

    it("suma correctamente las calorías del día", async () => {
      mockPrismaService.registroComida.aggregate.mockResolvedValue({ _sum: { calorias: 1800 } });
      mockPrismaService.registroActividad.aggregate.mockResolvedValue({ _sum: { calorias: 320 } });

      const result = await service.resumenCalorias("u-1");

      expect(result.consumidas).toBe(1800);
      expect(result.quemadas).toBe(320);
      expect(result.balance).toBe(1480); // superávit
    });

    it("puede devolver balance negativo (déficit calórico)", async () => {
      mockPrismaService.registroComida.aggregate.mockResolvedValue({ _sum: { calorias: 1200 } });
      mockPrismaService.registroActividad.aggregate.mockResolvedValue({ _sum: { calorias: 1500 } });

      const result = await service.resumenCalorias("u-1");

      expect(result.balance).toBe(-300); // déficit
    });

    it("filtra por la fecha proporcionada, no por hoy", async () => {
      mockPrismaService.registroComida.aggregate.mockResolvedValue({ _sum: { calorias: 2000 } });
      mockPrismaService.registroActividad.aggregate.mockResolvedValue({ _sum: { calorias: 500 } });

      await service.resumenCalorias("u-1", "2026-04-15");

      // El aggregate de comidas debe haberse llamado con un filtro de fecha
      const comidaCall = mockPrismaService.registroComida.aggregate.mock.calls[0][0];
      expect(comidaCall.where.fecha).toBeDefined();
      expect(comidaCall.where.fecha.gte).toBeInstanceOf(Date);
      expect(comidaCall.where.fecha.lte).toBeInstanceOf(Date);
    });

    it("el rango de fecha cubre todo el día (00:00:00 a 23:59:59)", async () => {
      mockPrismaService.registroComida.aggregate.mockResolvedValue({ _sum: { calorias: 0 } });
      mockPrismaService.registroActividad.aggregate.mockResolvedValue({ _sum: { calorias: 0 } });

      await service.resumenCalorias("u-1", "2026-04-15");

      const comidaCall = mockPrismaService.registroComida.aggregate.mock.calls[0][0];
      const inicio: Date = comidaCall.where.fecha.gte;
      const fin: Date = comidaCall.where.fecha.lte;

      expect(inicio.getHours()).toBe(0);
      expect(inicio.getMinutes()).toBe(0);
      expect(fin.getHours()).toBe(23);
      expect(fin.getMinutes()).toBe(59);
    });
  });
});
