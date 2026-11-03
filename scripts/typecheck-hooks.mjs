// Type-checks hooks/ against the engine types. Not part of `npm test`: the types are machine-local.
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
if (!existsSync(`${root}.claude-plugin/types/claude-code/index.d.ts`)) {
  console.error('typecheck: .claude-plugin/types/claude-code/index.d.ts is missing (gitignored, written by the engine).\n' +
    'Open an interactive session with `claude --plugin-dir .` once (`claude -p`, `claude plugin test` and `claude plugin validate` do not write them),\n' +
    'or load the plugin-authoring skill (it names the path of its `types/claude-code.d.ts`) and copy that file to that path, creating the folder. In a worktree, the main checkout must hold the file and the repo must list `.claude-plugin/types` in `copy`. Then run `npm run typecheck` again.')
  process.exit(1)
}
const r = spawnSync('npx -y -p typescript@5.6.3 tsc -p hooks',{ cwd: root, stdio: 'inherit', shell: true })
process.exit(r.status ?? 1)
