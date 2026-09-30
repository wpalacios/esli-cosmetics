/**
 * Validates that required environment variables for authentication are set.
 * This helps catch configuration issues early.
 */
export function validateAuthEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check API URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    errors.push(
      "NEXT_PUBLIC_API_URL is missing. " +
        "Set it in your .env.local file (e.g., http://localhost:3001)."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Logs environment validation errors in development
 */
export function logAuthEnvErrors(): void {
  if (process.env.NODE_ENV === "development") {
    const validation = validateAuthEnv();
    if (!validation.valid) {
      console.error(
        "⚠️ Authentication Environment Variables Validation Failed:"
      );
      validation.errors.forEach(error => {
        console.error(`  ❌ ${error}`);
      });
      console.error(
        "\n💡 Make sure your .env.local file has the correct values."
      );
      console.error("   See apps/web/env.template for reference.\n");
    }
  }
}
