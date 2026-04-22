import { Module } from "@nestjs/common";
import { UsuariosService } from "./usuarios.service";
import { UsuariosController } from "./usuarios.controller";

/**
 * UsuariosModule — gestión del perfil del usuario autenticado
 *
 * No necesita importar PrismaModule porque ya es @Global() (registrado en AppModule).
 */
@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
