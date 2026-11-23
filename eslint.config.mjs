import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,

  {
    files: ["esbuild.config.mjs"],
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
    },
  },

  {
    files: ["src/**/*.ts"],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module"
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        activeDocument: "readonly",
        activeWindow: "readonly",
        createEl: "readonly"
      }
    },

    plugins: {
      "@typescript-eslint": tsPlugin
    },

    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off"
    }
  }
];