import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { PrismaService } from "./common/prisma/prisma.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ValidationException } from "./common/exceptions/api.exception";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get configuration service
  const configService = app.get(ConfigService);
  const port = configService.get<number>("port", 3001);

  // Enable CORS for frontend applications
  const defaultCorsOrigins = [
    "http://localhost:3000",
    "http://localhost:3100",
    "http://localhost:19006",
    "exp://localhost:19000",
  ];
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(origin => origin.trim())
    : defaultCorsOrigins;
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Enable cookie parser middleware
  app.use(cookieParser());

  // Global prefix and versioning
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: errors => {
        // Customize validation error messages
        const messages = errors.map(error => {
          const constraints = error.constraints || {};
          return Object.values(constraints).join(", ");
        });
        return new ValidationException(messages);
      },
    })
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Esli Cosmetics API")
    .setDescription(
      "Backend API for Esli Cosmetics - POS, Inventory, and E-commerce System"
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth"
    )
    .addTag("Authentication", "User authentication and authorization")
    .addTag("Users", "User management")
    .addTag("Roles", "Role management")
    .addTag("Permissions", "Permission management")
    .addTag("Categories", "Product category management")
    .addTag("Health", "Health check endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Setup Prisma shutdown hooks
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks();

  await app.listen(port);

}

bootstrap().catch(error => {
  console.error("❌ Failed to start the application:", error);
  process.exit(1);
});
