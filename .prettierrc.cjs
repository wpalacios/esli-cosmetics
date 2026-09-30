/** @type {import("prettier").Config} */
// Root Prettier config: same rules as shared config but WITHOUT prettier-plugin-tailwindcss
// so that `pnpm format` and lint-staged work from repo root (no tailwind.config at root).
// Apps that use Tailwind (e.g. apps/web) have their own .prettierrc that adds the plugin.
module.exports = {
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "avoid",
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
};
