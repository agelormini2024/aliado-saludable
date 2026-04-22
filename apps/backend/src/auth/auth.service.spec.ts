import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../database/prisma.service";
import * as bcrypt from "bcryptjs";

/**
 * Mock de PrismaService.
 *
 * Usamos un mock completo para que los tests no necesiten una BD real.
 * Cada test configura los métodos que necesita con jest.fn().mockResolvedValue().
 *
 * Patrón: si un método no se configura en el test, lanza un error claro
 * en lugar de devolver undefined silenciosamente.
 */
const mockPrismaService = {
  usuario: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

/**
 * Mock de JwtService.
 * sign() devuelve un token fijo para simplificar las aserciones.
 */
const mockJwtService = {
  sign: jest.fn().mockReturnValue("mock-access-token"),
};

/**
 * Mock de ConfigService.
 * getOrThrow() devuelve valores fijos de dev.
 */
const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue("test-secret"),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Limpiar todos los mocks entre tests para evitar contaminación
    jest.clearAllMocks();
  });

  // ─── REGISTER ──────────────────────────────────────────────────────────────

  describe("register()", () => {
    it("debería crear un usuario y devolver tokens", async () => {
      // Arrange: el email no existe, la creación retorna el nuevo usuario
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.usuario.create.mockResolvedValue({
        id: "cuid-1",
        email: "ana@ejemplo.com",
        nombre: "Ana",
        apellido: "García",
        passwordHash: "hash",
        rol: "USUARIO",
        coachId: null,
        altura: null,
        fechaNacimiento: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.register({
        email: "ana@ejemplo.com",
        nombre: "Ana",
        apellido: "García",
        password: "MiContraseña123",
      });

      // Assert
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(mockPrismaService.usuario.create).toHaveBeenCalledTimes(1);
    });

    it("debería lanzar ConflictException si el email ya está registrado", async () => {
      // Arrange: el usuario ya existe
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: "cuid-1",
        email: "ana@ejemplo.com",
      });

      // Act & Assert
      await expect(
        service.register({
          email: "ana@ejemplo.com",
          nombre: "Ana",
          apellido: "García",
          password: "MiContraseña123",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("debería hashear la contraseña antes de guardarla", async () => {
      // Arrange
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);
      mockPrismaService.usuario.create.mockResolvedValue({
        id: "cuid-1",
        email: "ana@ejemplo.com",
        nombre: "Ana",
        apellido: "García",
        passwordHash: "hash",
        rol: "USUARIO",
        coachId: null,
        altura: null,
        fechaNacimiento: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      // Act
      await service.register({
        email: "ana@ejemplo.com",
        nombre: "Ana",
        apellido: "García",
        password: "MiContraseña123",
      });

      // Assert: el campo passwordHash no debe ser la contraseña en claro
      const llamadaCreate = mockPrismaService.usuario.create.mock.calls[0][0];
      expect(llamadaCreate.data.passwordHash).not.toBe("MiContraseña123");

      // Verificar que el hash es válido con bcrypt
      const esHashValido = await bcrypt.compare(
        "MiContraseña123",
        llamadaCreate.data.passwordHash,
      );
      expect(esHashValido).toBe(true);
    });
  });

  // ─── VALIDAR CREDENCIALES ───────────────────────────────────────────────────

  describe("validarCredenciales()", () => {
    it("debería retornar el usuario si las credenciales son correctas", async () => {
      // Arrange: crear un hash real para comparar
      const passwordHash = await bcrypt.hash("MiContraseña123", 10);
      const usuarioMock = {
        id: "cuid-1",
        email: "ana@ejemplo.com",
        passwordHash,
      };
      mockPrismaService.usuario.findUnique.mockResolvedValue(usuarioMock);

      // Act
      const result = await service.validarCredenciales("ana@ejemplo.com", "MiContraseña123");

      // Assert
      expect(result).toEqual(usuarioMock);
    });

    it("debería retornar null si el usuario no existe", async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      const result = await service.validarCredenciales("noexiste@test.com", "pass");
      expect(result).toBeNull();
    });

    it("debería retornar null si la contraseña es incorrecta", async () => {
      const passwordHash = await bcrypt.hash("PasswordCorrecto", 10);
      mockPrismaService.usuario.findUnique.mockResolvedValue({
        id: "cuid-1",
        email: "ana@ejemplo.com",
        passwordHash,
      });

      const result = await service.validarCredenciales("ana@ejemplo.com", "PasswordIncorrecto");
      expect(result).toBeNull();
    });
  });

  // ─── REFRESH ────────────────────────────────────────────────────────────────

  describe("refresh()", () => {
    it("debería lanzar UnauthorizedException si no hay tokens en la BD", async () => {
      // Arrange: no hay refresh tokens activos
      mockPrismaService.refreshToken.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(service.refresh("token-invalido")).rejects.toThrow(UnauthorizedException);
    });

    it("debería lanzar UnauthorizedException si el token no coincide con ninguno en BD", async () => {
      // Arrange: hay un token en BD pero es diferente al enviado
      const hashDistinto = await bcrypt.hash("otro-token-diferente", 10);
      mockPrismaService.refreshToken.findMany.mockResolvedValue([
        {
          id: "rt-1",
          token: hashDistinto,
          usuarioId: "cuid-1",
          expiresAt: new Date(Date.now() + 86400000),
          usuario: { id: "cuid-1", email: "ana@ejemplo.com" },
        },
      ]);

      // Act & Assert
      await expect(service.refresh("token-que-no-coincide")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────

  describe("logout()", () => {
    it("debería eliminar todos los refresh tokens del usuario", async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await service.logout("cuid-1");

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { usuarioId: "cuid-1" },
      });
    });
  });
});
