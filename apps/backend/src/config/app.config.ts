export default () => ({
  port: Number.parseInt(process.env.PORT, 10) || 3001,
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    // Default to 7 days (604800 seconds) to match cookie expiration
    expiresIn: Number.parseInt(process.env.JWT_EXPIRES_IN || "604800", 10), // 7 days (60*60*24*7)
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    // Default to 30 days for refresh tokens
    refreshExpiresIn: Number.parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN || "2592000",
      10
    ), // 30 days (60*60*24*30)
  },
  app: {
    name: "Esli Cosmetics API",
    version: "1.0.0",
    description: "Esli Cosmetics Backend API - NestJS with Prisma",
    environment: process.env.NODE_ENV || "development",
  },
  prisma: {
    studioPort: parseInt(process.env.PRISMA_STUDIO_PORT, 10) || 5555,
  },
});
