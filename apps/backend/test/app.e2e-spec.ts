import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/ (GET) - Health check", () => {
    return request(app.getHttpServer())
      .get("/api")
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty("message");
        expect(res.body).toHaveProperty("timestamp");
        expect(res.body).toHaveProperty("version");
        expect(res.body.message).toContain("Esli Cosmetics API");
      });
  });

  it("/ping (GET) - Ping endpoint", () => {
    return request(app.getHttpServer()).get("/api/ping").expect(200).expect({
      message: "pong",
    });
  });
});
