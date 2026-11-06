// desk lenses <slug> [--json]: the stack lenses (skills/stack-lens/SKILL.md) a worktree's change matches,
// one `<lens>: <reason>` line each, nothing when none. The orchestrator starts one extra reviewer per
// matched lens other than typescript, and names the lenses in implementer briefs.
// Matching is three kinds of rule, kept simple on purpose: a path regex on every changed file, a regex on
// the added lines of code files (never docs, whose prose names locks and secrets freely), and the todo's kind.
import { SLUG, config, worktreeList, baseRef } from './config.mjs';
import { todos, OPEN, gitIn, changedFiles } from '../bin/desk.mjs';

// In the order and with the names of the stack-lens table (test/lenses.test.mjs holds them together).
export const RULES = [
  { lens: 'typescript', path: /\.[cm]?tsx?$/ },
  { lens: 'testing', path: /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/, kind: 'fix' },
  { lens: 'state', added: /\b(write|append)File(Sync)?\b|\b(rename|rm|unlink|mkdir)Sync\b|\bcreateWriteStream\b|\b(lock|mutex|semaphore|retry|retries|queue)/i },
  { lens: 'perf', kind: 'perf' },
  { lens: 'security', path: /(^|\/)(hooks|\.husky|\.github\/workflows)\/|(^|\/)\.env|secret|auth|setup|install/i, notInTests: true,
    added: /\bchild_process\b|\b(exec|execFile|spawn)(Sync)?\(|\bprocess\.env\b|\b(secret|password|credential|api[-_]?key)s?\b/i },
  { lens: 'ui', path: /\.(tsx|jsx|css|scss|html|vue|svelte)$/, added: /\bprocess\.std(out|err)\.write\(/ },
];
const PROSE = /\.(md|mdx|txt|rst|json|jsonl|ya?ml|lock|csv|svg)$/i;
const TEST = RULES.find((r) => r.lens === 'testing').path;
const COMMENT = /^\s*(\/\/|\/\*|\*|#)/;

// files: changed paths; added: Map path -> added text; kind: the todo's kind, if any. Returns [{ lens, why }]
// where why is the first reason (`kind fix`, a path, or `<path> adds <match>`) and `(+N)` more.
export function matchLenses({ files, added = new Map(), kind }) {
  return RULES.flatMap(({ lens, path, added: re, kind: k, notInTests }) => {
    const why = [];
    if (k && kind === k) why.push(`kind ${k}`);
    if (path) for (const f of files) if (path.test(f) && !(notInTests && TEST.test(f))) why.push(f);
    if (re) for (const [f, text] of added) {
      const code = text.split('\n').filter((l) => !COMMENT.test(l)).join('\n');
      const m = !PROSE.test(f) && !TEST.test(f) && !(path && path.test(f)) && re.exec(code);
      if (m) why.push(`${f} adds ${m[0]}`);
    }
    return why.length ? [{ lens, why: why[0] + (why.length > 1 ? ` (+${why.length - 1})` : '') }] : [];
  });
}

// Added lines per file from a `git diff` patch: `+++ b/<path>` names the file, `+` lines in hunks are added.
export function addedLines(patch) {
  const out = new Map();
  let file = null, head = false;
  for (const l of patch.split('\n')) {
    if (l.startsWith('diff ')) { head = true; file = null; }
    else if (l.startsWith('@@')) head = false;
    else if (head && l.startsWith('+++ ')) file = l.startsWith('+++ b/') ? l.slice(6) : null;
    else if (!head && file && l[0] === '+') out.set(file, (out.get(file) ?? '') + l.slice(1) + '\n');
  }
  return out;
}

export function lenses(argv) {
  const slug = argv.find((a) => !a.startsWith('--'));
  if (!SLUG.test(slug ?? '')) throw new Error('usage: desk lenses <slug> [--json]');
  const w = worktreeList(config()).find((x) => x.slug === slug);
  if (!w) throw new Error(`no worktree "${slug}"`);
  const files = changedFiles(w.dir, w.repo);
  // Committed and uncommitted tracked changes against the merge base; untracked files get path rules only.
  const added = addedLines(gitIn(w.dir, '-c', 'core.quotePath=false', 'diff', '--src-prefix=a/', '--dst-prefix=b/', '-U0', '--no-color', '--no-ext-diff', '--merge-base', baseRef(w.repo)));
  const kind = [...todos().values()].find((t) => t.slug === slug && OPEN.has(t.status))?.kind;
  const out = matchLenses({ files, added, kind });
  if (argv.includes('--json')) return console.log(JSON.stringify(out));
  if (out.length) console.log(out.map((x) => `${x.lens}: ${x.why}`).join('\n'));
}
