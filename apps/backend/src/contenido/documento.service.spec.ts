import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { DocumentoService } from "./documento.service";
import { PrismaService } from "../database/prisma.service";
import { RagService } from "../ai/rag.service";
import { StorageService } from "../common/storage/storage.service";
import { Documento } from "@prisma/client";

/**
 * Mockear pdf-parse y mammoth antes de que el módulo los requiera.
 *
 * DocumentoService los carga con require() a nivel de módulo, y Jest intercepta
 * el registry de módulos antes de cualquier import/require cuando se usa jest.mock().
 * Las llamadas a jest.mock() se "hoistean" automáticamente al inicio del archivo.
 */
jest.mock("pdf-parse", () =>
  jest.fn().mockResolvedValue({ text: "Texto extraído del PDF de prueba" }),
);
jest.mock("mammoth", () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: "Texto extraído del DOCX de prueba" }),
}));

/**
 * Mock de PrismaService para DocumentoService.
 *
 * DocumentoService usa documento (create, findFirst, findMany, count, update, delete)
 * y $transaction en forma de array (count + findMany en paralelo) para listarDocumentos.
 */
const mockPrismaService = {
  documento: {
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
 * DocumentoService usa: indexar (fire-and-forget), textoParaDocumento, eliminarPorReferencia.
 */
const mockRagService = {
  indexar: jest.fn().mockResolvedValue(undefined),
  textoParaDocumento: jest.fn().mockReturnValue("Texto del documento de prueba"),
  eliminarPorReferencia: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock de StorageService.
 *
 * Reemplaza a `fs` — en la nueva implementación todos los archivos
 * van a Supabase Storage en lugar del disco local (ver D10 revisado en Fase 5).
 * upload() devuelve la misma ruta que recibe; delete() y download() son noop.
 */
const mockStorageService = {
  upload: jest.fn().mockResolvedValue("1234567890-guia-nutricion.pdf"),
  delete: jest.fn().mockResolvedValue(undefined),
  download: jest.fn().mockResolvedValue(Buffer.from("contenido del archivo")),
};

/** Documento de prueba tal como lo devuelve Prisma */
const documentoMock: Documento = {
  id: "doc-1",
  nombre: "guia-nutricion.pdf",
  mimeType: "application/pdf",
  contenido: "Texto extraído del PDF de prueba",
  archivoPath: "1234567890-guia-nutricion.pdf",
  publicado: false,
  autorId: "admin-1",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-01"),
};

/**
 * Archivo Multer simulado (memoryStorage — el buffer ya está en memoria, sin path en disco).
 * DocumentoService recibe este objeto de Multer para PDFs.
 */
const archivoMulterMock = {
  buffer: Buffer.from("contenido simulado del archivo PDF"),
  originalname: "guia-nutricion.pdf",
  mimetype: "application/pdf",
  fieldname: "file",
  encoding: "7bit",
  size: 1024,
  destination: "",
  filename: "",
  path: "",
  stream: null,
} as unknown as Express.Multer.File;

describe("DocumentoService", () => {
  let service: DocumentoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentoService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RagService, useValue: mockRagService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<DocumentoService>(DocumentoService);
    jest.clearAllMocks();

    // listarDocumentos usa $transaction en forma array: [count, findMany]
    mockPrismaService.$transaction.mockImplementation(
      (queries: Promise<unknown>[]) => Promise.all(queries),
    );
  });

  // ─── crearDocumento() ───────────────────────────────────────────────────────

  describe("crearDocumento()", () => {
    it("extrae el texto del PDF, lo sube a Storage y persiste en BD", async () => {
      mockPrismaService.documento.create.mockResolvedValue(documentoMock);

      const result = await service.crearDocumento("admin-1", archivoMulterMock);

      expect(result.id).toBe("doc-1");
      expect(result.nombre).toBe("guia-nutricion.pdf");
      expect(mockStorageService.upload).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.documento.create).toHaveBeenCalledTimes(1);
    });

    it("crea el documento con publicado=false por defecto", async () => {
      mockPrismaService.documento.create.mockResolvedValue(documentoMock);

      await service.crearDocumento("admin-1", archivoMulterMock);

      const createCall = mockPrismaService.documento.create.mock.calls[0][0];
      expect(createCall.data.publicado).toBe(false);
    });

    it("vincula el documento al autorId del admin autenticado", async () => {
      mockPrismaService.documento.create.mockResolvedValue(documentoMock);

      await service.crearDocumento("admin-99", archivoMulterMock);

      const createCall = mockPrismaService.documento.create.mock.calls[0][0];
      expect(createCall.data.autorId).toBe("admin-99");
    });

    it("dispara la indexación RAG de forma asíncrona con tipo DOCUMENTO", async () => {
      mockPrismaService.documento.create.mockResolvedValue(documentoMock);

      await service.crearDocumento("admin-1", archivoMulterMock);

      expect(mockRagService.indexar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: "DOCUMENTO",
          referenciaId: "doc-1",
          usuarioId: null,
        }),
      );
    });

    it("lanza BadRequestException para un tipo MIME no soportado", async () => {
      const archivoInvalido = {
        ...archivoMulterMock,
        mimetype: "image/png",
        originalname: "foto.png",
      } as unknown as Express.Multer.File;

      await expect(service.crearDocumento("admin-1", archivoInvalido)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("procesa archivos DOCX correctamente con mammoth", async () => {
      const archivoDocx = {
        ...archivoMulterMock,
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        originalname: "guia.docx",
      } as unknown as Express.Multer.File;

      const docxMock = {
        ...documentoMock,
        mimeType: archivoDocx.mimetype,
        nombre: "guia.docx",
      };
      mockPrismaService.documento.create.mockResolvedValue(docxMock);

      const result = await service.crearDocumento("admin-1", archivoDocx);

      expect(result.nombre).toBe("guia.docx");
      expect(mockPrismaService.documento.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── listarDocumentos() ─────────────────────────────────────────────────────

  describe("listarDocumentos()", () => {
    it("devuelve solo los publicados cuando soloPublicados=true (modo usuario)", async () => {
      const docPublicado = { ...documentoMock, publicado: true };
      mockPrismaService.documento.count.mockResolvedValue(1);
      mockPrismaService.documento.findMany.mockResolvedValue([docPublicado]);

      const result = await service.listarDocumentos({ soloPublicados: true });

      expect(result.items).toHaveLength(1);
      const countCall = mockPrismaService.documento.count.mock.calls[0][0];
      expect(countCall.where.publicado).toBe(true);
    });

    it("devuelve todos los documentos cuando soloPublicados=false (modo admin)", async () => {
      const docBorrador = { ...documentoMock, id: "doc-2", publicado: false };
      mockPrismaService.documento.count.mockResolvedValue(2);
      mockPrismaService.documento.findMany.mockResolvedValue([documentoMock, docBorrador]);

      const result = await service.listarDocumentos({ soloPublicados: false });

      expect(result.items).toHaveLength(2);
      const countCall = mockPrismaService.documento.count.mock.calls[0][0];
      expect(countCall.where.publicado).toBeUndefined();
    });

    it("calcula correctamente los metadatos de paginación", async () => {
      mockPrismaService.documento.count.mockResolvedValue(42);
      mockPrismaService.documento.findMany.mockResolvedValue([documentoMock]);

      const result = await service.listarDocumentos({ page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.total).toBe(42);
      expect(result.meta.totalPages).toBe(5); // ceil(42 / 10)
    });
  });

  // ─── obtenerDocumento() ─────────────────────────────────────────────────────

  describe("obtenerDocumento()", () => {
    it("devuelve el documento cuando existe", async () => {
      const docPublicado = { ...documentoMock, publicado: true };
      mockPrismaService.documento.findFirst.mockResolvedValue(docPublicado);

      const result = await service.obtenerDocumento("doc-1");

      expect(result.id).toBe("doc-1");
    });

    it("lanza NotFoundException si el documento no existe", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(null);

      await expect(service.obtenerDocumento("inexistente")).rejects.toThrow(NotFoundException);
    });

    it("devuelve el documento aunque no esté publicado cuando soloPublicado=false (modo admin)", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock); // publicado: false

      const result = await service.obtenerDocumento("doc-1", false);

      expect(result.publicado).toBe(false);
    });
  });

  // ─── actualizarDocumento() ──────────────────────────────────────────────────

  describe("actualizarDocumento()", () => {
    it("lanza NotFoundException si el documento no existe", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(null);

      await expect(
        service.actualizarDocumento("inexistente", { nombre: "nuevo.pdf" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("actualiza el nombre y devuelve el documento actualizado", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock);
      const actualizado = { ...documentoMock, nombre: "nuevo-nombre.pdf" };
      mockPrismaService.documento.update.mockResolvedValue(actualizado);

      const result = await service.actualizarDocumento("doc-1", { nombre: "nuevo-nombre.pdf" });

      expect(result.nombre).toBe("nuevo-nombre.pdf");
      expect(mockPrismaService.documento.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "doc-1" } }),
      );
    });

    it("puede cambiar solo el estado publicado sin modificar el nombre", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock);
      mockPrismaService.documento.update.mockResolvedValue({ ...documentoMock, publicado: true });

      const result = await service.actualizarDocumento("doc-1", { publicado: true });

      expect(result.publicado).toBe(true);
    });
  });

  // ─── eliminarDocumento() ────────────────────────────────────────────────────

  describe("eliminarDocumento()", () => {
    it("lanza NotFoundException si el documento no existe", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(null);

      await expect(service.eliminarDocumento("inexistente")).rejects.toThrow(NotFoundException);
    });

    it("llama a eliminarPorReferencia con el ID del documento", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock);
      mockPrismaService.documento.delete.mockResolvedValue(documentoMock);

      await service.eliminarDocumento("doc-1");

      expect(mockRagService.eliminarPorReferencia).toHaveBeenCalledWith("doc-1");
    });

    it("elimina los embeddings antes de borrar el documento en BD", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock);
      mockPrismaService.documento.delete.mockResolvedValue(documentoMock);

      await service.eliminarDocumento("doc-1");

      const ragCallOrder = mockRagService.eliminarPorReferencia.mock.invocationCallOrder[0];
      const deleteCallOrder = mockPrismaService.documento.delete.mock.invocationCallOrder[0];
      expect(ragCallOrder).toBeLessThan(deleteCallOrder);
    });

    it("llama a storageService.delete con la ruta del archivo en el bucket", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock);
      mockPrismaService.documento.delete.mockResolvedValue(documentoMock);

      await service.eliminarDocumento("doc-1");

      expect(mockStorageService.delete).toHaveBeenCalledWith(documentoMock.archivoPath);
    });

    it("devuelve el documento eliminado", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(documentoMock);
      mockPrismaService.documento.delete.mockResolvedValue(documentoMock);

      const result = await service.eliminarDocumento("doc-1");

      expect(result.id).toBe("doc-1");
    });
  });

  // ─── obtenerBufferArchivo() ─────────────────────────────────────────────────

  describe("obtenerBufferArchivo()", () => {
    it("descarga el archivo de Storage y devuelve el buffer con el documento", async () => {
      const docPublicado = { ...documentoMock, publicado: true };
      mockPrismaService.documento.findFirst.mockResolvedValue(docPublicado);
      const bufferEsperado = Buffer.from("contenido del archivo");
      mockStorageService.download.mockResolvedValue(bufferEsperado);

      const { buffer, doc } = await service.obtenerBufferArchivo("doc-1");

      expect(buffer).toEqual(bufferEsperado);
      expect(doc.id).toBe("doc-1");
      expect(mockStorageService.download).toHaveBeenCalledWith(docPublicado.archivoPath);
    });

    it("lanza NotFoundException si el documento no existe o no está publicado", async () => {
      mockPrismaService.documento.findFirst.mockResolvedValue(null);

      await expect(service.obtenerBufferArchivo("inexistente")).rejects.toThrow(NotFoundException);
    });
  });
});
