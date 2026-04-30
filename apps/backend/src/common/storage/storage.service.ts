import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * StorageService — wrapper sobre Supabase Storage para subir, bajar y eliminar archivos.
 *
 * Centraliza toda la interacción con el bucket "documentos" de Supabase Storage.
 * El bucket es privado: los archivos solo se acceden a través de este servicio,
 * que requiere la service role key (nunca expuesta al cliente).
 *
 * Por qué Supabase Storage en lugar de disco local:
 * - Render tiene un filesystem efímero — los archivos se pierden en cada deploy.
 * - Supabase Storage persiste los archivos y escala sin configuración adicional.
 * - En dev local se puede usar el mismo bucket o un bucket de prueba.
 */
@Injectable()
export class StorageService {
  private readonly client: SupabaseClient;
  private readonly logger = new Logger(StorageService.name);

  /** Nombre del bucket en Supabase Storage donde se guardan los documentos */
  private readonly BUCKET = "documentos";

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>("SUPABASE_URL"),
      config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  /**
   * Sube un archivo al bucket "documentos".
   *
   * @param storagePath - Ruta dentro del bucket (ej: "1234567890-guia.pdf")
   * @param buffer - Contenido del archivo en memoria (viene de Multer memoryStorage)
   * @param mimeType - Content-Type del archivo ("application/pdf" o "...wordprocessingml...")
   * @returns La misma `storagePath` que se recibió, para guardarla en la BD
   * @throws Error si Supabase devuelve un error en la subida
   */
  async upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { error } = await this.client.storage
      .from(this.BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (error) {
      throw new Error(`Error al subir archivo a Storage: ${error.message}`);
    }

    return storagePath;
  }

  /**
   * Elimina un archivo del bucket "documentos".
   *
   * Si el archivo no existe, Supabase devuelve un error que se loguea como warning
   * pero no se propaga — eliminar algo que ya no existe no es un error crítico.
   *
   * @param storagePath - Ruta dentro del bucket (tal como se guardó en `Documento.archivoPath`)
   */
  async delete(storagePath: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.BUCKET)
      .remove([storagePath]);

    if (error) {
      this.logger.warn(`No se pudo eliminar archivo de Storage (${storagePath}): ${error.message}`);
    }
  }

  /**
   * Descarga un archivo del bucket y lo devuelve como Buffer.
   *
   * El servicio descarga el archivo server-side y lo devuelve al controller para
   * que lo envíe al cliente. Así el cliente nunca necesita acceder directamente
   * a Supabase Storage — el JWT guard de la API sigue siendo el único control de acceso.
   *
   * @param storagePath - Ruta dentro del bucket (tal como se guardó en `Documento.archivoPath`)
   * @returns El contenido del archivo como Buffer
   * @throws Error si el archivo no existe o Supabase falla
   */
  async download(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(this.BUCKET)
      .download(storagePath);

    if (error) {
      throw new Error(`Error al descargar archivo de Storage (${storagePath}): ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
