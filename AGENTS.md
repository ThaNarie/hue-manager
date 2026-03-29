Use the vite-plus skill when working with this project and you need to run tasks, test code, etc.

# React Component Structure

**One component per file.** Every non-trivial component gets its own folder. Keep files small and focused.

```
components/
  EmptyState/
    EmptyState.tsx              # Component (single export)
    EmptyState.stories.tsx      # Storybook stories
    EmptyState.test.tsx         # Tests (if any)
    EmptyState.hooks.ts         # Custom hooks used only by this component
    EmptyState.utils.ts         # Helpers, constants, config objects
```

## Rules

- **One component per file** — never export multiple components from a single file.
- Name the folder and file after the component in **PascalCase**.
- Export the component as a **named export** (not default).
- Colocate the Storybook story file (`*.stories.tsx`) in the same folder.
- Colocate test files (`*.test.tsx`) in the same folder when applicable.
- Extract hooks into `ComponentName.hooks.ts` when the component uses custom hooks or complex stateful logic.
- Extract utils, constants, and config objects into `ComponentName.utils.ts` when present.
- Keep page-level components in `pages/<feature>/components/<ComponentName>/`.
- Keep shared UI primitives in `components/ui/` (managed by shadcn — single files, no subfolder needed).
- Pages themselves are allowed to live as single files without a wrapping folder.

## Splitting large components

When a component grows beyond ~150 lines or contains multiple sub-components:

1. Extract each sub-component into its own folder under the same parent.
2. Move shared helpers/constants into a `*.utils.ts` file.
3. Move shared hooks into a `*.hooks.ts` file or into `lib/` if used across features.

# File Size & Decomposition (Hard Rules)

- Do not add new features to any file over 300 lines.
- If a change adds more than 25 lines, evaluate extraction first.
- One domain per file. No mixed concerns.
- New helpers/hooks/utils must be colocated in dedicated files.
- Any file crossing 300 lines must be split in the same PR (unless explicitly approved).
