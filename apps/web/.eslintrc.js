/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  ignorePatterns: [
    "*.config.js",
    ".eslintrc.js",
    "next.config.js",
    "postcss.config.js",
    "tailwind.config.js",
  ],
  rules: {
    // Next.js specific rules
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "error",

    // Import rules
    "import/no-anonymous-default-export": "off",

    // React rules
    "react/jsx-key": ["error", { checkFragmentShorthand: true }],
    "react/jsx-no-useless-fragment": "error",
    "react/self-closing-comp": "error",
  },
};
