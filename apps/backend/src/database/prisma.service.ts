import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * PrismaService — cliente de base de datos singleton
 *
 * Extiende PrismaClient para integrarlo con el ciclo de vida de NestJS.
 * Al ser un singleton (providido en PrismaModule), toda la aplicación
 * comparte una única conexión al pool de PostgreSQL.
 *
 * Ciclo de vida:
 * - onModuleInit: abre la conexión al arrancar el módulo
 * - onModuleDestroy: cierra la conexión limpiamente al apagar la app
 *
 * @example
 * // En cualquier service:
 * constructor(private readonly prisma: PrismaService) {}
 * const usuario = await this.prisma.usuario.findUnique({ where: { id } });
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Se llama automáticamente cuando NestJS inicializa el módulo.
   * Abre la conexión al pool de PostgreSQL.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Conectado a PostgreSQL");
  }

  /**
   * Se llama automáticamente cuando NestJS apaga la aplicación.
   * Cierra la conexión limpiamente para evitar conexiones colgadas.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log("Desconectado de PostgreSQL");
  }
}
