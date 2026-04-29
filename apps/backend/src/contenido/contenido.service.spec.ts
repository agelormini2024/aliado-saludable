import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ContenidoService } from "./contenido.service";
import { PrismaService } from "../database/prisma.service";
import { RagService } from "../ai/rag.service";
import { Articulo } from "@prisma/client";

/**
 * Mock de PrismaService para ContenidoService.
 *
 * ContenidoService usa articulo (create, findFirst, findMany, count, update, delete)
 * y $transaction en forma de array (count + findMany en paralelo) para listarArticulos.
 */
const mockPrismaService = {
  articulo: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

/**
 * Mock de RagService.
 * ContenidoService usa: indexar (fire-and-forget), textoParaArticulo, eliminarPorReferencia.
 */
const mockRagService = {
  indexar: jest.fn().mockResolvedValue(undefined),
  textoParaArticulo: jest.fn().mockReturnValue("Texto del artículo de prueba"),
  eliminarPorReferencia: jest.fn().mockResolvedValue(undefined),
};

/** Artículo de prueba tal como lo devuelve Prisma */
const articuloMock: Articulo = {
  id: "art-1",
  titulo: "Guía de nutrición básica",
  contenido: "El contenido del artículo sobre nutrición...",
  categoria: "NUTRICION",
  publicado: true,
  autorId: "admin-1",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-01"),
};

describe("ContenidoService", () => {
  let service: ContenidoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContenidoService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RagService, useValue: mockRagService },
      ],
    }).compile();

    service = module.get<ContenidoService>(ContenidoService);
    jest.clearAllMocks();

    // listarArticulos usa $transaction en forma array: [count, findMany]
    mockPrismaService.$transaction.mockImplementation(
      (queries: Promise<unknown>[]) => Promise.all(queries),
    );
  });

  // ─── crearArticulo() ────────────────────────────────────────────────────────

  describe("crearArticulo()", () => {
    it("crea el artículo y lo devuelve", async () => {
      mockPrismaService.articulo.create.mockResolvedValue(articuloMock);

      const result = await service.crearArticulo("admin-1", {
        titulo: "Guía de nutrición básica",
        contenido: "El contenido...",
        categoria: "NUTRICION",
      });

      expect(result.id).toBe("art-1");
      expect(result.titulo).toBe("Guía de nutrición básica");
      expect(mockPrismaService.articulo.create).toHaveBeenCalledTimes(1);
    });

    it("vincula el artículo al autorId del admin autenticado", async () => {
      mockPrismaService.articulo.create.mockResolvedValue(articuloMock);

      await service.crearArticulo("admin-99", {
        titulo: "Test",
        contenido: "Contenido",
        categoria: "BIENESTAR",
      });

      const createCall = mockPrismaService.articulo.create.mock.calls[0][0];
      expect(createCall.data.autorId).toBe("admin-99");
    });

    it("crea el artículo con publicado=false cuando el DTO no lo especifica", async () => {
      mockPrismaService.articulo.create.mockResolvedValue({ ...articuloMock, publicado: false });

      await service.crearArticulo("admin-1", {
        titulo: "Borrador",
        contenido: "Contenido",
        categoria: "EJERCICIO",
        // publicado no está en el DTO → se aplica ?? false
      });

      const createCall = mockPrismaService.articulo.create.mock.calls[0][0];
      expect(createCall.data.publicado).toBe(false);
    });

    it("dispara la indexación RAG de forma asíncrona con tipo ARTICULO", async () => {
      mockPrismaService.articulo.create.mockResolvedValue(articuloMock);

      await service.crearArticulo("admin-1", {
        titulo: "Guía",
        contenido: "Contenido",
        categoria: "NUTRICION",
      });

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: "ARTICULO",
          referenciaId: "art-1",
          usuarioId: null,
        }),
      );
    });
  });

  // ─── listarArticulos() ──────────────────────────────────────────────────────

  describe("listarArticulos()", () => {
    it("devuelve solo los publicados cuando soloPublicados=true (modo usuario)", async () => {
      mockPrismaService.articulo.count.mockResolvedValue(1);
      mockPrismaService.articulo.findMany.mockResolvedValue([articuloMock]);

      const result = await service.listarArticulos({ soloPublicados: true });

      expect(result.items).toHaveLength(1);
      // El where enviado a count debe filtrar por publicado: true
      const countCall = mockPrismaService.articulo.count.mock.calls[0][0];
      expect(countCall.where.publicado).toBe(true);
    });

    it("devuelve todos los artículos cuando soloPublicados=false (modo admin)", async () => {
      const borrador = { ...articuloMock, id: "art-2", publicado: false };
      mockPrismaService.articulo.count.mockResolvedValue(2);
      mockPrismaService.articulo.findMany.mockResolvedValue([articuloMock, borrador]);

      const result = await service.listarArticulos({ soloPublicados: false });

      expect(result.items).toHaveLength(2);
      // El where NO debe incluir publicado cuando soloPublicados=false
      const countCall = mockPrismaService.articulo.count.mock.calls[0][0];
      expect(countCall.where.publicado).toBeUndefined();
    });

    it("aplica el filtro de categoría cuando se especifica", async () => {
      mockPrismaService.articulo.count.mockResolvedValue(1);
      mockPrismaService.articulo.findMany.mockResolvedValue([articuloMock]);

      await service.listarArticulos({ soloPublicados: true, categoria: "NUTRICION" });

      const countCall = mockPrismaService.articulo.count.mock.calls[0][0];
      expect(countCall.where.categoria).toBe("NUTRICION");
    });

    it("calcula correctamente los metadatos de paginación", async () => {
      mockPrismaService.articulo.count.mockResolvedValue(45);
      mockPrismaService.articulo.findMany.mockResolvedValue([articuloMock]);

      const result = await service.listarArticulos({ page: 2, limit: 20 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.total).toBe(45);
      expect(result.meta.totalPages).toBe(3); // ceil(45 / 20)
    });
  });

  // ─── obtenerArticulo() ──────────────────────────────────────────────────────

  describe("obtenerArticulo()", () => {
    it("devuelve el artículo cuando existe y está publicado", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);

      const result = await service.obtenerArticulo("art-1");

      expect(result.id).toBe("art-1");
    });

    it("lanza NotFoundException si el artículo no existe", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(null);

      await expect(service.obtenerArticulo("inexistente")).rejects.toThrow(NotFoundException);
    });

    it("lanza NotFoundException si el artículo existe pero no está publicado (modo soloPublicado=true)", async () => {
      // Prisma devuelve null porque el where incluye publicado: true pero el artículo es borrador
      mockPrismaService.articulo.findFirst.mockResolvedValue(null);

      await expect(service.obtenerArticulo("art-borrador", true)).rejects.toThrow(NotFoundException);
    });

    it("devuelve el artículo aunque no esté publicado cuando soloPublicado=false (modo admin)", async () => {
      const borrador = { ...articuloMock, publicado: false };
      mockPrismaService.articulo.findFirst.mockResolvedValue(borrador);

      const result = await service.obtenerArticulo("art-1", false);

      expect(result.publicado).toBe(false);
    });
  });

  // ─── actualizarArticulo() ───────────────────────────────────────────────────

  describe("actualizarArticulo()", () => {
    it("lanza NotFoundException si el artículo no existe", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(null);

      await expect(
        service.actualizarArticulo("inexistente", { titulo: "Nuevo" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("actualiza los campos y devuelve el artículo actualizado", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      const actualizado = { ...articuloMock, titulo: "Nuevo título" };
      mockPrismaService.articulo.update.mockResolvedValue(actualizado);

      const result = await service.actualizarArticulo("art-1", { titulo: "Nuevo título" });

      expect(result.titulo).toBe("Nuevo título");
      expect(mockPrismaService.articulo.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "art-1" } }),
      );
    });

    it("re-indexa el RAG cuando cambia el título", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      mockPrismaService.articulo.update.mockResolvedValue({ ...articuloMock, titulo: "Nuevo" });

      await service.actualizarArticulo("art-1", { titulo: "Nuevo" });

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "ARTICULO", referenciaId: "art-1" }),
      );
    });

    it("re-indexa el RAG cuando cambia el contenido", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      mockPrismaService.articulo.update.mockResolvedValue({
        ...articuloMock,
        contenido: "Contenido actualizado",
      });

      await service.actualizarArticulo("art-1", { contenido: "Contenido actualizado" });

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "ARTICULO", referenciaId: "art-1" }),
      );
    });

    it("NO re-indexa el RAG si solo cambia publicado (sin cambio de texto)", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      mockPrismaService.articulo.update.mockResolvedValue({ ...articuloMock, publicado: true });

      await service.actualizarArticulo("art-1", { publicado: true });

      // Solo cambió publicado — no hay re-indexación de texto
      expect(mockRagService.indexar).not.toHaveBeenCalled();
    });
  });

  // ─── eliminarArticulo() ─────────────────────────────────────────────────────

  describe("eliminarArticulo()", () => {
    it("lanza NotFoundException si el artículo no existe", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(null);

      await expect(service.eliminarArticulo("inexistente")).rejects.toThrow(NotFoundException);
    });

    it("llama a eliminarPorReferencia con el ID del artículo", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      mockPrismaService.articulo.delete.mockResolvedValue(articuloMock);

      await service.eliminarArticulo("art-1");

      expect(mockRagService.eliminarPorReferencia).toHaveBeenCalledWith("art-1");
    });

    it("elimina los embeddings antes de borrar el artículo en BD", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      mockPrismaService.articulo.delete.mockResolvedValue(articuloMock);

      await service.eliminarArticulo("art-1");

      // El RAG debe limpiarse antes que el delete (verificado por invocationCallOrder)
      const ragCallOrder = mockRagService.eliminarPorReferencia.mock.invocationCallOrder[0];
      const deleteCallOrder = mockPrismaService.articulo.delete.mock.invocationCallOrder[0];
      expect(ragCallOrder).toBeLessThan(deleteCallOrder);
    });

    it("devuelve el artículo eliminado", async () => {
      mockPrismaService.articulo.findFirst.mockResolvedValue(articuloMock);
      mockPrismaService.articulo.delete.mockResolvedValue(articuloMock);

      const result = await service.eliminarArticulo("art-1");

      expect(result.id).toBe("art-1");
    });
  });
});
