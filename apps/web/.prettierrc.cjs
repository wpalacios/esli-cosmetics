/** @type {import("prettier").Config} */
// Web app: use shared config including Tailwind plugin (tailwind.config.js is in this directory).
module.exports = {
  ...require("../../packages/config/prettier/index.js"),
  tailwindConfig: "./tailwind.config.js",
};
