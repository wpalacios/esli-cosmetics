import { registerAs } from "@nestjs/config";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required but not set. " +
      "Set JWT_SECRET in your .env file or environment before starting the server."
  );
}

if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    "JWT_REFRESH_SECRET environment variable is required but not set. " +
      "Set JWT_REFRESH_SECRET in your .env file or environment before starting the server."
  );
}

const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

export default registerAs("jwt", () => ({
  secret: jwtSecret,
  // Default to 7 days (604800 seconds) to match cookie expiration
  // This ensures tokens don't expire before cookies, preventing redirect issues
  expiresIn: Number.parseInt(process.env.JWT_EXPIRES_IN || "604800", 10), // 7 days (60*60*24*7)
  refreshSecret: jwtRefreshSecret,
  // Default to 30 days (2592000 seconds) for refresh tokens
  refreshExpiresIn: Number.parseInt(
    process.env.JWT_REFRESH_EXPIRES_IN || "2592000", // 30 days (60*60*24*30)
    10
  ),
}));
