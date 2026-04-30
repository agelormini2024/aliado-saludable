import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

/**
 * StorageModule — provee StorageService para interactuar con Supabase Storage.
 *
 * Se importa explícitamente en los módulos que necesiten subir o bajar archivos.
 * Actualmente solo ContenidoModule lo usa (para documentos PDF/.docx).
 *
 * ConfigModule debe estar disponible globalmente (ya lo registra AppModule con isGlobal: true)
 * para que StorageService pueda inyectar ConfigService.
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
