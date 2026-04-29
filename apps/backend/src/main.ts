import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Creamos la app sin el logger por defecto de NestJS para que pino tome el control
  // desde el primer momento (incluyendo los mensajes de arranque del framework)
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Reemplaza el logger nativo de NestJS con la instancia de Pino configurada en AppModule
  app.useLogger(app.get(PinoLogger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" });

  const config = new DocumentBuilder()
    .setTitle("Aliado Saludable API")
    .setDescription("API para la plataforma Aliado Saludable")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  // Usamos el Logger nativo de NestJS (que ya está redirigido a Pino)
  const logger = new Logger("Bootstrap");
  logger.log(`Backend corriendo en http://localhost:${port}`);
  logger.log(`Swagger en http://localhost:${port}/api/docs`);
}

bootstrap();
