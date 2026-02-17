/**
 * Shared ESLint base config exported by `@livon/config/eslint/base.cjs`.
 *
 * @see https://livon.tech/docs/packages/config
 */
module.exports = [
  {
    ignores: ["dist", "build", "coverage", "node_modules"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-object-spread": "error",
      "max-params": ["warn", 2],
      "func-style": ["warn", "expression", { "allowArrowFunctions": true }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ForStatement",
          message: "Use declarative array methods instead of for-loops.",
        },
        {
          selector: "ForInStatement",
          message: "Use Object.entries/keys with declarative methods instead of for..in.",
        },
        {
          selector: "ForOfStatement",
          message: "Use declarative array methods instead of for..of.",
        },
        {
          selector: "WhileStatement",
          message: "Use recursion or declarative iteration instead of while.",
        },
        {
          selector: "DoWhileStatement",
          message: "Use recursion or declarative iteration instead of do..while.",
        },
        {
          selector: "ClassDeclaration",
          message: "Use functional modules and data, not classes.",
        },
        {
          selector: "ClassExpression",
          message: "Use functional modules and data, not classes.",
        },
        {
          selector: "ThisExpression",
          message: "Do not use this; pass explicit inputs through parameters/closures.",
        },
      ]
    }
  }
];
