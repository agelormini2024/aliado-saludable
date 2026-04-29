import { Test, TestingModule } from "@nestjs/testing";
import { AlimentacionService } from "./alimentacion.service";
import { PrismaService } from "../database/prisma.service";
import { RagService } from "../ai/rag.service";

/**
 * Mock de PrismaService para AlimentacionService.
 * Solo usa registroComida (create y findMany).
 */
const mockPrismaService = {
  registroComida: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

/**
 * Mock de RagService.
 * La indexación es fire-and-forget — mockeamos como no-op.
 */
const mockRagService = {
  indexar: jest.fn().mockResolvedValue(undefined),
  textoParaComida: jest.fn().mockReturnValue("Registro de comida de prueba"),
};

/** Registro de comida de prueba */
const comidaCreadaMock = {
  id: "rc-1",
  usuarioId: "u-1",
  momento: "ALMUERZO",
  descripcion: "Pollo con ensalada",
  calorias: 450,
  fecha: new Date("2026-04-28T13:00:00.000Z"),
};

describe("AlimentacionService", () => {
  let service: AlimentacionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlimentacionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RagService, useValue: mockRagService },
      ],
    }).compile();

    service = module.get<AlimentacionService>(AlimentacionService);
    jest.clearAllMocks();
  });

  // ─── crearComida() ──────────────────────────────────────────────────────────

  describe("crearComida()", () => {
    it("crea el registro y lo devuelve", async () => {
      mockPrismaService.registroComida.create.mockResolvedValue(comidaCreadaMock);

      const result = await service.crearComida("u-1", {
        momento: "ALMUERZO",
        descripcion: "Pollo con ensalada",
        calorias: 450,
      });

      expect(result.id).toBe("rc-1");
      expect(result.momento).toBe("ALMUERZO");
      expect(result.calorias).toBe(450);
      expect(mockPrismaService.registroComida.create).toHaveBeenCalledTimes(1);
    });

    it("vincula el registro al usuarioId correcto", async () => {
      mockPrismaService.registroComida.create.mockResolvedValue(comidaCreadaMock);

      await service.crearComida("u-1", {
        momento: "DESAYUNO",
        descripcion: "Avena con frutas",
        calorias: 350,
      });

      const createCall = mockPrismaService.registroComida.create.mock.calls[0][0];
      expect(createCall.data.usuarioId).toBe("u-1");
    });

    it("usa la fecha del DTO cuando se provee, convertida a Date", async () => {
      mockPrismaService.registroComida.create.mockResolvedValue(comidaCreadaMock);

      await service.crearComida("u-1", {
        momento: "CENA",
        descripcion: "Sopa de verduras",
        calorias: 300,
        fecha: "2026-04-20",
      });

      const createCall = mockPrismaService.registroComida.create.mock.calls[0][0];
      expect(createCall.data.fecha).toBeInstanceOf(Date);
      expect(createCall.data.fecha.toISOString()).toContain("2026-04-20");
    });

    it("dispara la indexación RAG de forma asíncrona con tipo COMIDA", async () => {
      mockPrismaService.registroComida.create.mockResolvedValue(comidaCreadaMock);

      await service.crearComida("u-1", {
        momento: "ALMUERZO",
        descripcion: "Pollo con ensalada",
        calorias: 450,
      });

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: "COMIDA",
          referenciaId: "rc-1",
          usuarioId: "u-1",
        }),
      );
    });
  });

  // ─── listarComidasDelDia() ──────────────────────────────────────────────────

  describe("listarComidasDelDia()", () => {
    it("devuelve las comidas del día proporcionado", async () => {
      const comidas = [
        comidaCreadaMock,
        { ...comidaCreadaMock, id: "rc-2", momento: "CENA", calorias: 600 },
      ];
      mockPrismaService.registroComida.findMany.mockResolvedValue(comidas);

      const result = await service.listarComidasDelDia("u-1", "2026-04-28");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("rc-1");
    });

    it("devuelve array vacío si no hay comidas en ese día", async () => {
      mockPrismaService.registroComida.findMany.mockResolvedValue([]);

      const result = await service.listarComidasDelDia("u-1", "2026-04-28");

      expect(result).toEqual([]);
    });

    it("filtra por un rango de 24hs que cubre todo el día (00:00 a 23:59)", async () => {
      mockPrismaService.registroComida.findMany.mockResolvedValue([]);

      await service.listarComidasDelDia("u-1", "2026-04-28");

      const findCall = mockPrismaService.registroComida.findMany.mock.calls[0][0];
      const inicio: Date = findCall.where.fecha.gte;
      const fin: Date = findCall.where.fecha.lte;

      expect(inicio.getHours()).toBe(0);
      expect(inicio.getMinutes()).toBe(0);
      expect(fin.getHours()).toBe(23);
      expect(fin.getMinutes()).toBe(59);
    });

    it("filtra solo por el usuarioId del usuario autenticado", async () => {
      mockPrismaService.registroComida.findMany.mockResolvedValue([]);

      await service.listarComidasDelDia("u-42", "2026-04-28");

      const findCall = mockPrismaService.registroComida.findMany.mock.calls[0][0];
      expect(findCall.where.usuarioId).toBe("u-42");
    });

    it("ordena las comidas por fecha ascendente (cronológico)", async () => {
      mockPrismaService.registroComida.findMany.mockResolvedValue([comidaCreadaMock]);

      await service.listarComidasDelDia("u-1", "2026-04-28");

      const findCall = mockPrismaService.registroComida.findMany.mock.calls[0][0];
      expect(findCall.orderBy).toEqual({ fecha: "asc" });
    });
  });
});
