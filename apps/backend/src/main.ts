import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  console.log(`Backend corriendo en http://localhost:${port}`);
  console.log(`Swagger en http://localhost:${port}/api/docs`);
}

bootstrap();
