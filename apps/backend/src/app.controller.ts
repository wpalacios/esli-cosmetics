import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "./modules/auth/decorators/public.decorator";

@ApiTags("Health")
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({
    status: 200,
    description: "API is healthy",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        timestamp: { type: "string" },
        version: { type: "string" },
        environment: { type: "string" },
      },
    },
  })
  getHealth() {
    return {
      message: "Esli Cosmetics API is running",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };
  }

  @Public()
  @Get("ping")
  @ApiOperation({ summary: "Simple ping endpoint" })
  @ApiResponse({
    status: 200,
    description: "Pong response",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
  })
  ping() {
    return { message: "pong" };
  }
}
