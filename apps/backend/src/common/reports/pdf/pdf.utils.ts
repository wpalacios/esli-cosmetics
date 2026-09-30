import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Deterministically defines the base path for assets.
 * Follows NestJS best practices by using __dirname relative to the compiled file location.
 *
 * This matches the pattern used in app.module.ts: join(__dirname, "..", "assets")
 * Since this file is deeper in the directory structure (common/reports/pdf/),
 * we go up 3 levels instead of 1 to reach the base directory (dist/ or src/).
 *
 * File structure:
 * - Source: src/common/reports/pdf/pdf.utils.ts
 * - Compiled: dist/src/common/reports/pdf/pdf.utils.js
 * - Assets: dist/assets/ (copied by nest-cli.json during build)
 *
 * In both development and production, __dirname correctly points to the file's directory,
 * so we can use the same relative path resolution without NODE_ENV checks.
 */
const getAssetsPath = (): string => {
  // Go up 3 levels from current file location to reach base directory (dist/ or src/)
  // Then into assets/ folder
  // This works in both development (ts-node) and production (compiled) because
  // __dirname always points to the directory containing the current file
  const assetsPath = path.join(__dirname, "..", "..", "..", "assets");

  if (fs.existsSync(assetsPath)) {
    return assetsPath;
  }

  // Fallback: Check backend root level (handles edge cases in monorepo deployments)
  const backendRootPath = path.join(__dirname, "..", "..", "..", "..", "..");
  const fallbackDistPath = path.join(backendRootPath, "dist", "assets");
  const fallbackSrcPath = path.join(backendRootPath, "src", "assets");

  if (fs.existsSync(fallbackDistPath)) {
    return fallbackDistPath;
  }

  if (fs.existsSync(fallbackSrcPath)) {
    return fallbackSrcPath;
  }

  // If all checks fail, provide detailed error message
  const checkedPaths = [assetsPath, fallbackDistPath, fallbackSrcPath];
  const nodeEnv = process.env.NODE_ENV || "undefined";
  const pathsList = checkedPaths.map(p => `  - ${p}`).join("\n");

  throw new Error(
    `[PDF CRITICAL] Assets folder not found.\n` +
      `NODE_ENV: ${nodeEnv}\n` +
      `Checked paths:\n${pathsList}\n` +
      `Current __dirname: ${__dirname}`
  );
};

export const ASSETS_BASE_DIR = getAssetsPath();

// Derived paths
export const IMAGES_DIR = path.join(ASSETS_BASE_DIR, "images");
export const FONTS_DIR = path.join(ASSETS_BASE_DIR, "fonts");
export const PDF_LOGO_PATH = path.join(IMAGES_DIR, "esli-cosmetics-logo.png");

/**
 * Returns the logo as a base64-encoded PNG string.
 */
export function getLogoBase64(): string | null {
  try {
    if (!fs.existsSync(PDF_LOGO_PATH)) {
      return null;
    }
    const bitmap = fs.readFileSync(PDF_LOGO_PATH);
    return `data:image/png;base64,${bitmap.toString("base64")}`;
  } catch (error) {
    // Re-throw with context for better error tracking
    throw new Error(
      `Failed to load logo from ${PDF_LOGO_PATH}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Finds the font file by filename
 */
export const findFont = (filename: string, fallback: string): string => {
  const fullPath = path.join(FONTS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    return fallback;
  }
  return fullPath;
};
