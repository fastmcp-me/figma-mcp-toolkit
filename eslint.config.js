import pluginJs from "@eslint/js";
import prettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  pluginJs.configs.recommended,
  prettier, // Disables conflicting ESLint rules
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error", // Shows Prettier issues as ESLint errors
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "@typescript-eslint/no-unused-vars": ["error"],
    },
  },
];
