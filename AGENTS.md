# Repository development

## Code and prompts

- The workbench lives in `web/`. Workflows, tools, and prompts live in `.agents/skills/live2d-maker/`. Read the relevant skill and pipeline docs before changing their contracts.
- Put task goals in workflow knowledge prompts and reusable tool contracts in tool documentation. Respect the current step's editing and preview scopes.
- Get the user's approval before adding a prompt template variable or adding a new prompt input to a step, even when reusing an existing variable name.

## Artwork and workflow state

- Saved KRA files are the source of truth. Author models bind native layer UUIDs. PNG exports and texture caches are derived from the artwork. Preserve cumulative geometry and apply upstream deformation once.
- Track step completion, intermediate round progress, and persistent agent sessions independently. Preserve the documented behavior of continue, resume, and retry. Cover dispatch and recovery changes with targeted tests.
- Fix incorrect grouping, ranges, and other upstream assumptions at their source. Preserve valid work and repair only affected dependencies. Resolve recoverable constraint conflicts within the workflow and mark completion only when the required output is valid. Prefer the smallest evidence-backed fix and avoid blanket retries, extra review stages, and speculative fallbacks.

## Checks and commits

- Run the checks relevant to the change. For skill code, run `pnpm check` in the skill directory. For workbench code, run `pnpm check:web` from the repository root. Prefer existing fixtures for dispatch and file contracts.
- Test program behavior. For prompts, check file assembly, injected inputs, tools, and workflow behavior. Keep assertions about authored wording out of tests.
- Keep commits focused, inspect staged files, and preserve unrelated work. Exclude credentials, generated caches, and runtime task outputs.
