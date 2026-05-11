# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript single-page app for local work tracking. Application code lives in `src/`. The main entry point is `src/main.tsx`, primary UI is in `src/app/App.tsx`, and shared app data hooks are in `src/app/useWorkData.ts`.

Domain logic is grouped under `src/modules/`, for example `src/modules/expenses/` and `src/modules/time/`. Data persistence and Dexie setup live in `src/db/`. Shared utilities are in `src/lib/`; backup/PWA helpers are in `src/services/`. Static assets and reference files are in `public/`. Built output goes to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

- `npm run dev`: start the Vite development server.
- `npm test`: run the Vitest suite once.
- `npm test -- --run src/modules/expenses/calculations.test.ts`: run a focused test file.
- `npm run build`: type-check with `tsc -b` and create the production build.
- `npm run preview`: serve the production build locally for verification.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep pure calculation and parsing logic in module files instead of UI components. Follow the existing style: two-space indentation, double quotes, semicolons, named exports for reusable helpers, and concise type annotations at module boundaries.

Use `PascalCase` for React components and TypeScript interfaces, `camelCase` for functions and variables, and descriptive test names that state behavior. Keep UI text consistent with the existing German copy.

## Testing Guidelines

Tests use Vitest with `jsdom` and `@testing-library/jest-dom/vitest`, configured in `vite.config.ts` and `src/test/setup.ts`. Place tests next to the code they cover using `*.test.ts` or `*.test.tsx`, as in `src/modules/expenses/municipalities.test.ts`.

Add or update tests for behavior changes in calculations, parsing, persistence helpers, or user-visible workflows. Prefer focused unit tests for domain logic and app-level tests when UI integration or exported app helpers need coverage.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style prefixes such as `feat:` and `style:`. Keep commit messages short, imperative, and scoped to one change, for example `feat: improve municipality address matching`.

Pull requests should include a brief description, reason for the change, and commands run for verification. Include screenshots or short recordings for visible UI changes, especially layout, navigation, and responsive behavior. Link related issues when available.

## Agent-Specific Instructions

Do not rewrite generated output in `dist/`. Keep changes small and aligned with existing module boundaries. Before editing, check for local uncommitted work and avoid reverting changes you did not make. After each completed feature, create a commit and sync the branch with the remote.
