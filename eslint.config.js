import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),

  // ── Frontend source files (React + browser APIs) ──────────────────────────
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^(?:[A-Z_]|_)",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
    },
  },

  // ── Vercel serverless functions (Node.js 20, ESM) ─────────────────────────
  // api/_lib/*.js  — shared helpers (cors, oauth, store)
  // api/**/*.js    — route handlers
  //
  // These files run in Node.js, not the browser, so they have access to
  // process, console, Buffer, etc.  We also allow empty catch blocks because
  // the store module uses them for graceful in-memory fallbacks.
  {
    files: ["api/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^(?:[A-Z_]|_)",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Serverless store helpers use bare `catch {}` as a graceful fallback
      // before re-trying with the in-memory Map — these are intentional.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
]);
