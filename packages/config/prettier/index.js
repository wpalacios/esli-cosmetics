/** @type {import("prettier").Config} */
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
  plugins: [require.resolve("prettier-plugin-tailwindcss")],
  tailwindConfig: "./tailwind.config.js",
  tailwindFunctions: ["clsx", "cn", "cva"],
};
