const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["next/core-web-vitals", require.resolve("./base.js")],
  env: {
    browser: true,
    es2022: true,
  },
  plugins: ["react", "react-hooks"],
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  rules: {
    // React specific rules
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/jsx-uses-react": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-key": ["error", { checkFragmentShorthand: true }],
    "react/jsx-no-useless-fragment": "error",

    // Next.js specific
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "error",
  },
};
