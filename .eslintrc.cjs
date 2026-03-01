/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
  root: true,
  extends: [
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/node",
    "@remix-run/eslint-config/jest-testing-library",
    "prettier",
  ],
  globals: {
    shopify: "readonly"
  },
  plugins: ["@shopify/eslint-plugin"],
  rules: {
    "import/order": "error",
    "import/newline-after-import": "error",
    "padding-line-between-statements": [
      "error",
      { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*" },
      { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"] },
      { "blankLine": "always", "prev": "*", "next": "return" },
      { "blankLine": "always", "prev": "*", "next": "export" },
      { "blankLine": "never", "prev": "export", "next": "export" },
      { "blankLine": "always", "prev": "*", "next": "block-like" },
      { "blankLine": "always", "prev": "block-like", "next": "*" }
    ]
  }
};
