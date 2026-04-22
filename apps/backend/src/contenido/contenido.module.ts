import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ContenidoController } from "./contenido.controller";
import { ContenidoService } from "./contenido.service";
import { DocumentoController } from "./documento.controller";
import { DocumentoService } from "./documento.service";

/**
 * ContenidoModule — módulo de artículos y documentos informativos.
 *
 * Gestiona el contenido editorial de la plataforma:
 * - Artículos: creados por el Admin via form (texto markdown)
 * - Documentos: archivos PDF/.docx subidos por el Admin; el texto se extrae
 *   automáticamente y se indexa en EmbeddingDocument para el RAG (Fase 3)
 *
 * MulterModule se configura con memoryStorage para que el buffer del archivo
 * esté disponible en DocumentoService antes de escribirlo en disco.
 *
 * ContenidoService y DocumentoService se exportan para que el módulo de IA
 * (Fase 3) pueda acceder al contenido al construir el contexto RAG.
 */
@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ContenidoController, DocumentoController],
  providers: [ContenidoService, DocumentoService],
  exports: [ContenidoService, DocumentoService],
})
export class ContenidoModule {}
