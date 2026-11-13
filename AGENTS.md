# Repository development

- The web workbench lives in `web/`. Production workflows, tools and prompts live in `.agents/skills/live2d-maker/`; read the applicable skill and pipeline documentation before changing those contracts.
- Saved KRA documents are the artwork source of truth. Author models bind native layer UUIDs; PNG exports and texture caches are derived data. Preserve cumulative geometry and apply upstream deformation once.
- Keep task goals in the workflow knowledge prompts and reusable tool contracts in tool documentation. Preserve the editable and preview scopes selected by the current step.
- Step completion markers, intermediate round progress and persistent agent sessions represent different state. Changes to dispatch or recovery must preserve the documented continue/resume/retry semantics and be covered by targeted tests.
- Run checks relevant to the change. Skill type checking runs with `pnpm check` in the skill directory; web type checking runs with `pnpm check:web` from the repository root. Prefer existing fixture tests when checking dispatch and file contracts.
- Tests check program behavior, not wording. Do not add assertions that only restate authored text, including but not limited to checking whether a prompt contains a given line or phrase. Prompt tests may check assembly (which files are included), injected inputs, tools and flow.
- Keep commits scoped and inspect staged files. Preserve unrelated work; exclude credentials, generated caches and runtime task outputs from commits.
