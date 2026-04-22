import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * PrismaModule — módulo global de acceso a base de datos
 *
 * Al marcarse con @Global(), NestJS lo hace disponible en toda la aplicación
 * sin necesidad de importarlo en cada módulo. Solo se importa una vez en AppModule.
 *
 * Exporta PrismaService para que cualquier service de la app pueda inyectarlo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
