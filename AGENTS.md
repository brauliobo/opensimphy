@/home/braulio/.codex/RTK.md

## Engineering

- Fix root causes, not symptoms. Avoid defensive code, broad fallbacks, excessive error handling, and compatibility layers unless they are explicitly required.
- Resist workaround-first fixes. Before adding a guard, heuristic, retry, alternate path, or special case, reproduce the failure at the lowest responsible layer and identify the mechanism that produced the invalid state.
- If the owning abstraction cannot represent the correct behavior, refactor that abstraction and update its callers and tests. Do not preserve a flawed primary path and route problematic inputs around it.
- Add a fallback only when an external dependency has a defined failure mode and the product explicitly requires degraded behavior. Never use fallback output to conceal invalid primary-path results.
- When diagnosing failures, inspect or run the failing specs/tests first, then trace the failing behavior to its source before editing.
- Keep changes small, direct, and aligned with existing patterns.
- When new logic needs to handle more cases, refactor the owning abstraction first so the expanded behavior stays clear; do not stack confusing branches at the call site.
- Align consecutive hash/object entries and simple assignments within local blocks; keep `:` attached to keys.

## Search

- Avoid broad or unbounded recursive grep searches across repositories, workspaces, home directories, or filesystem roots because they can exhaust memory and trigger OOM kills. Narrow searches to relevant directories and file patterns, search incrementally, and use indexed code search or file discovery before content grep when available.

## Subagents

- Execute substantial or complex tasks through phased iterations of parallel subagents. In each phase, delegate independent work concurrently with clear scope, permissions, expected output, and verification, then evaluate the results before launching the next phase until the task is complete.
- Handle small and straightforward tasks directly in the main conversation.
- Require each file-modifying subagent to verify its work and commit only its own changes before it finishes. Research-only subagents with no file changes must not create empty commits.

## Task Tracking

- Create and maintain a workspace-specific `TASKS.md` only for substantial tasks. Store it outside the repository at `$XDG_STATE_HOME/opencode/tasks/<absolute-workspace-path>/TASKS.md` (use `~/.local/state` when `XDG_STATE_HOME` is unset).
- Record the task context, plan, decisions, progress, verification, and remaining work.
- Do not finish until every tracked task is complete and verified and `TASKS.md` contains no task entries.
- If an external blocker makes completion impossible, report every remaining task and its blocker.

## Builds

- Run build and compilation tasks with `nice` and at most four parallel threads or workers, for example `nice make -j4`.
- Use `rtk` for supported shell commands (`rtk git status`, `rtk cargo test`, `rtk npm run build`, `rtk grep`).

## Cleanup

- Before finishing, remove temporary files and scratch artifacts created for that task when they are not needed for future work. Do not remove unrelated or user-owned files.

## Git

- Never commit changes unless the user explicitly asks for a commit, except for file-modifying subagents required by the Subagents policy to commit their own changes before finishing.
- A commit request applies only to that immediate commit; ask before follow-up commits.
- Ignore unrelated working-tree changes unless they directly block the task or the user asks about them.
- Never use `git -A`. Stage files individually.
- Never add a Cursor coauthor or use `git --trailer`.
- Prefer separate focused commits for unrelated logical changes.
- Use Linux-style commit subjects with a concrete context prefix, and an optional subcontext when it adds clarity: `context: subcontext: describe change`.
- Never use `project` or the app/repo/product name as the commit subject context; use the changed module, domain, or feature area.
- Never commit private or internal files to public repositories, or add references that disclose private environments, internal hosts, URLs, IP addresses, credentials, configuration, infrastructure identifiers, or private local paths.

## Deployment

- Never deploy code, modify deployment trees, install deployment dependencies, or restart services unless the user explicitly asks for deployment.

## Templates

- Keep Vue single-file components on Pug templates. Do not migrate core OpenSimPhy SFCs away from Pug.

## Edwin Gray

- Treat historical COP-300 / COP-282 statements as source claims, not established physics.
- Keep classical motor ledgers closed and whole-system COP at or below one unless a complete independent energy boundary is supplied.
- Do not fabricate production FEM lookup tables. Reject incomplete convergence evidence.
- Source media belong under `../research/opensimphy-edwin-gray/`.

## Awesome Physics

- Represent every catalog entry as a descriptor. `artifact`, `reference`, and `blocked` are valid outcomes, not omissions.
- Promote a runnable adapter only after the plan license gate is `pass` and the kernel is a bounded local worker with no remote code or data fallback.
- Do not treat a finite educational result as scientific validation.
- Leave shared `tools/wasm` infrastructure and Vue/Pug page ownership to their dedicated agents unless this session already owns that layer.
