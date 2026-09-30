/** @type {import("eslint").Linter.Config} */
// Root ESLint config: minimal fallback so lint-staged and ad-hoc eslint from root don't fail.
// Each app/package should have its own .eslintrc (web, backend, utils, ui do).
module.exports = {
  root: true,
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "dist/",
    "build/",
    "coverage/",
    ".turbo/",
    "**/*.config.js",
    "**/*.config.cjs",
    "**/*.config.mjs",
    "eslint.config.js",
    "**/eslint.config.js",
  ],
};
