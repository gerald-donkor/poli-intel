import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma-generated client — not our code, regenerated on every build.
    "lib/generated/**",
    // Installed vendor agent-skill packages — tooling, not application code (AGENTS.md §3).
    ".agents/**",
    // Prototype runtime and browser-openable visual reference (AGENTS.md §2).
    "design_handoff_evibrief/**",
    // Gitignored scratch scripts (.gitignore).
    "fix.js",
    "fix.cjs",
    "test.ts",
  ]),
]);

export default eslintConfig;
