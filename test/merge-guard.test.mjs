// scripts/merge-guard.mjs: the desk and repo mapping, and which way it fails. The rule's own table is CASES in
// hooks/mergeguard.mjs, run here through --self-test. Temp dirs only; the guard only reads, git never pushes here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { multiDesk, desk, git, repo, tmp, KIT, setRepo } from './helpers.mjs';
import { ASSIGN_CASES, ESCAPE_CASES, UNREADABLE_CASES, mentions, verdict } from '../hooks/mergeguard.mjs';

const GUARD = join(KIT, 'scripts', 'merge-guard.mjs');
const { DESK_HOME: _, ...noDesk } = process.env;

// `from` is the script's own folder: the plugin hook starts it in the session root, the desk.
function run(cwd, command, { tool = 'Bash', from = cwd, env = noDesk } = {}) {
  return spawnSync(process.execPath, [GUARD], { cwd: from, env, encoding: 'utf8', input: JSON.stringify({ cwd, tool_name: tool, tool_input: { command } }) });
}
function denial(...args) {
  const r = run(...args);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason : null;
}

// Repo a is `review` with a worktree `demo` outside the desk, repo b stays `direct`.
function mixed() {
  const { root, home } = multiDesk();
  const made = desk(home, 'wt', 'new', 'demo', '--repo', 'a', '--no-build');
  assert.equal(made.status, 0, made.stderr);
  setRepo(home, 'a', { merge: 'review' });
  return { root, home, a: join(root, 'a'), b: join(root, 'b'), wt: join(root, 'worktrees', 'a-demo') };
}

// Logs every child process the script starts, under the names it may import.
function spy() {
  const dir = tmp(), log = join(dir, 'spawns.log'), file = join(dir, 'spy.mjs');
  writeFileSync(file, `import { createRequire, syncBuiltinESMExports } from 'node:module';
import { appendFileSync } from 'node:fs';
const cp = createRequire(import.meta.url)('node:child_process');
for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) {
  const real = cp[k];
  cp[k] = (...a) => { appendFileSync(${JSON.stringify(log)}, k + ' ' + a[0] + '\\n'); return real(...a); };
}
syncBuiltinESMExports();
`);
  return { log, env: { ...noDesk, NODE_OPTIONS: `--import=${pathToFileURL(file).href}` } };
}

test('merge-guard --self-test runs every row of the table', () => {
  const r = spawnSync(process.execPath, [GUARD, '--self-test'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ok \d+ cases/);
});

for (const [name, rows] of [["bash $'...' escapes", ESCAPE_CASES], ['PowerShell assignment forms', ASSIGN_CASES], ['lines it cannot parse', UNREADABLE_CASES]]) {
  test(`merge guard reads ${name}`, async (t) => {
    for (const [c, current, want, shell = 'Bash'] of rows) {
      await t.test(`${want ? 'refuse' : 'allow'} ${shell} on ${current}: ${c}`, () => {
        assert.equal(!!verdict(c, { current, shell }), want);
        if (want) assert.ok(mentions(c), 'the hook would not start the script');
      });
    }
  });
}

test('direct desk: key absent or "direct", everything is allowed and no git process starts', () => {
  const { home, root } = multiDesk();
  const a = join(root, 'a');
  for (const fields of [{}, { merge: 'direct' }]) {
    setRepo(home, 'a', fields);
    const { log, env } = spy();
    for (const c of ['git push origin main', 'git merge agent/x', 'gh pr merge 1', 'git push --all']) assert.equal(denial(a, c, { from: home, env }), null, c);
    assert.equal(existsSync(log), false, 'no child process');
  }
  // The spy does see git once a repo is `review`, so the assertion above is not empty.
  setRepo(home, 'a', { merge: 'review' });
  const { log, env } = spy();
  assert.ok(denial(a, 'git push origin main', { from: home, env }));
  assert.match(readFileSync(log, 'utf8'), /git/);
});

test('mapping: main checkout, worktree and subfolders resolve to the repo; a mixed desk refuses only on review', () => {
  const { home, a, b, wt } = mixed();
  mkdirSync(join(a, 'sub')); mkdirSync(join(wt, 'sub'));

  for (const dir of [a, join(a, 'sub'), wt, join(wt, 'sub')]) assert.ok(denial(dir, 'git push origin main', { from: home }), dir);
  assert.equal(denial(b, 'git push origin main', { from: home }), null, 'direct repo');
  assert.equal(denial(b, 'git merge agent/x', { from: home }), null);
  assert.equal(denial(b, 'gh pr merge 1', { from: home }), null);

  // The worktree is outside the desk: found through the session root, or through DESK_HOME as its own settings set it.
  assert.ok(denial(wt, 'git push origin main', { from: wt, env: { ...noDesk, DESK_HOME: home } }));
  assert.equal(denial(wt, 'git push origin main', { from: wt }), null, 'no desk found: allowed');

  // The current branch of the directory decides.
  assert.equal(denial(wt, 'git push', { from: home }), null);
  assert.equal(denial(wt, 'git push origin agent/demo', { from: home }), null);
  assert.equal(denial(wt, 'git merge origin/main', { from: home }), null);
  assert.match(denial(a, 'git push', { from: home }), /main/);
  assert.match(denial(a, 'git merge agent/demo', { from: home }), /main/);
  assert.equal(denial(a, 'git merge --abort', { from: home }), null);
  git(wt, 'checkout', '-q', '--detach');
  assert.equal(denial(wt, 'git push origin HEAD', { from: home }), null, 'detached');
  assert.ok(denial(wt, 'git push origin main', { from: home }), 'a named branch still counts');
  assert.ok(denial(wt, 'git merge x', { from: home }) === null, 'detached merge');
  git(wt, 'checkout', '-q', 'agent/demo');
});

test('mapping: -C, cd and Set-Location move the directory, step by step and per command', () => {
  const { home, a, b, wt } = mixed();
  for (const [c, want, tool] of [
    ['git -C ../a push origin main', true], ['cd ../a && git push origin main', true], ['cd .. && cd a && git push origin main', true], ['cd .. && git -C a push origin main', true],
    ['cd "../a"; git push origin main', true], ['git push origin main; cd ../a', false], ['(cd ../a); git push origin main', false], ['(cd ../a && git push origin main)', true],
    ['bash <<EOF\ncd ../a\ngit push origin main\nEOF', true], ['cat <<EOF\ncd ../a\nEOF\ngit push origin main', false],
    ['git -C ../a push origin agent/x', false], ['cd $REPO && git push origin main', false], ['git -C "$REPO" push origin main', false],
    ['git push origin main; git -C ../a push origin main', true], ['git -C ../missing push origin main; git -C ../a push origin main', true],
    [`Set-Location ${a.replace(/\//g, '\\')}; git.exe push origin main`, true, 'PowerShell'], ['Set-Location ../a; git push origin main', true, 'PowerShell'],
    ['Set-Location -Path ..\\a; git push origin main', true, 'PowerShell'], ['git -C ..\\a push origin main', true, 'PowerShell'], ['(Set-Location ../a); git push origin main', true, 'PowerShell'],
    ['if ($?) { git -C ../a push origin main }', true, 'PowerShell'], ['Set-Location ../a; git merge agent/x', true, 'PowerShell'], ['Set-Location $env:X; git push origin main', false, 'PowerShell'],
  ]) assert.equal(!!denial(b, c, { from: home, tool }), want, c);
  assert.equal(denial(a, 'git -C ../b push origin main', { from: home }), null, 'away from review');
  assert.equal(denial(a, 'cd ../b; git push origin main', { from: home }), null);
  // Reads this directory's own branch, not the session's: `git push` in a main checkout from a worktree.
  assert.match(denial(wt, `git -C ${JSON.stringify(a)} push`, { from: home }), /main/);
  assert.equal(denial(a, `git -C ${JSON.stringify(wt)} push`, { from: home }), null);
});

test('gh pr merge: refused by the directory or by --repo naming a review repo', () => {
  const { home, a, b, wt } = mixed();
  setRepo(home, 'a', { gh: 'o/a' });
  setRepo(home, 'b', { gh: 'o/b' });
  assert.ok(denial(a, 'gh pr merge 1', { from: home }));
  assert.ok(denial(wt, 'gh pr merge --squash', { from: home }));
  assert.ok(denial(wt, 'gh.exe pr merge 1', { from: home, tool: 'PowerShell' }));
  assert.ok(denial(b, 'gh pr merge 1 -R o/a', { from: home }));
  assert.ok(denial(b, 'gh pr merge 1 --repo=O/A', { from: home }));
  assert.ok(denial(b, 'GH_REPO=o/a gh pr merge 1', { from: home }));
  assert.ok(denial(b, 'GH_REPO+=o/a gh pr merge 1', { from: home }));
  // bash joins `+=` onto the value before it; a plain `=` replaces it
  for (const form of ['GH_REPO=o/a GH_REPO+= gh pr merge 1', 'GH_REPO=o/a GH_REPO+="" gh pr merge 1', 'GH_REPO=o GH_REPO+=/a gh pr merge 1', 'GH_REPO=o/ GH_REPO+=a gh pr merge 1', 'if GH_REPO=o GH_REPO+=/a gh pr merge 1; then :; fi', 'GH_REPO=o/b GH_REPO=o/a gh pr merge 1']) assert.ok(denial(b, form, { from: home }), form);
  for (const form of ['GH_REPO=o GH_REPO+=/b gh pr merge 1', 'GH_REPO=o/a GH_REPO=o/b gh pr merge 1', 'GH_REPO=o/a GH_REPO+=b gh pr merge 1']) assert.equal(denial(a, form, { from: home }), null, form);
  assert.ok(denial(b, 'gh pr merge https://github.com/o/a/pull/1', { from: home }));
  assert.equal(denial(a, 'gh pr merge 1 -R o/b', { from: home }), null);
  assert.equal(denial(a, 'gh pr view 1', { from: home }), null);
});

test('the denial names the branch, the tag form, desk wt merge and the person on the server, under the repo prefix', () => {
  const { home, a } = mixed();
  const main = denial(a, 'git push origin main', { from: home });
  assert.match(main, /main/); assert.match(main, /desk wt merge/); assert.match(main, /person merges on the server/);
  assert.match(denial(a, 'git push origin v1.2', { from: home }), /refs\/tags\/v1\.2/);
  assert.equal(denial(a, 'git push origin refs/tags/v1.2', { from: home }), null);
  setRepo(home, 'a', { branchPrefix: 'feat/' });
  assert.ok(denial(a, 'git push origin agent/x', { from: home }), 'agent/ is outside this prefix');
  assert.equal(denial(a, 'git push origin feat/x', { from: home }), null);
});

test('a branch switch earlier in the line counts in the real script; a file checkout does not', () => {
  const { home, wt } = mixed();
  assert.equal(denial(wt, 'git push', { from: home }), null, 'control: the worktree itself is on an agent branch');
  assert.match(denial(wt, 'git checkout main && git merge agent/demo && git push', { from: home }), /main/);
  assert.match(denial(wt, 'git switch main; git push origin HEAD', { from: home, tool: 'PowerShell' }), /main/);
  assert.equal(denial(wt, 'git checkout -- f && git push', { from: home }), null);
});

test('the file-checkout hint shows only when the checkout moves off the current branch', () => {
  const { home, a, wt } = mixed();
  assert.match(denial(wt, 'git checkout main && git push', { from: home }), /if main is a file/);
  for (const c of ['git switch main', 'git checkout -b main', 'git switch -c main']) {
    const d = denial(wt, `${c} && git push`, { from: home });
    assert.match(d, /main/, c); // still refused
    assert.doesNotMatch(d, /is a file/, c);
  }
  assert.doesNotMatch(denial(a, 'git switch main && git push', { from: home }), /is a file/); // already on main
  assert.match(denial(a, 'git switch main && git push', { from: home }), /main/);
});

test('a BOM in desk.config.json still refuses: the config loads, so the guard does not fail open', () => {
  const { home, a } = mixed();
  const file = join(home, 'desk.config.json');
  writeFileSync(file, `\uFEFF${readFileSync(file, 'utf8')}`);
  assert.match(denial(a, 'git push origin main', { from: home }), /main/);
});

test('fails closed: a line it cannot read and that names push or merge is refused wherever it is typed', () => {
  const { root, home, a, b } = mixed();
  const hidden = "cd a && echo ${x:-'}'}; git push origin main";
  assert.match(denial(a, hidden, { from: home }), /cannot read[^]*desk wt merge[^]*on the server/, 'in the review repo, with the way out');
  assert.match(denial(root, hidden, { from: home }), /cannot read/, 'from outside any repo: its cd is unread too');
  assert.match(denial(b, hidden, { from: home }), /cannot read/, 'from a direct repo: its cd is unread too');
  for (const dir of [a, b]) {
    const text = denial(dir, "echo it's a merge", { from: home });
    assert.match(text, /this desk has a review repo/);
    assert.doesNotMatch(text, /this repo has/, 'the line names no repo');
  }
  assert.match(denial(a, "git push origin 'main", { tool: 'PowerShell', from: home }), /cannot read/);
  assert.equal(denial(a, 'echo "open', { from: home }), null, 'names neither word');

  const direct = multiDesk(), { log, env } = spy();
  assert.equal(denial(join(direct.root, 'a'), hidden, { from: direct.home, env }), null, 'no review repo on the desk');
  assert.equal(existsSync(log), false, 'a direct desk spawns no git');
});

test('an unknown key in desk.config.json does not make the guard fail open', () => {
  const { home, a } = mixed();
  const file = join(home, 'desk.config.json'), cfg = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify({ ...cfg, fromANewerKit: 1, repos: cfg.repos.map((r) => ({ ...r, newField: 1 })) }));
  assert.match(denial(a, 'git push origin main', { from: home }), /main/);
});

test('fails open: unknown repo, failing git, broken config, bad input, no desk', () => {
  const { root, home, a } = mixed();
  const elsewhere = tmp();
  repo(elsewhere, 'other');
  assert.equal(denial(join(elsewhere, 'other'), 'git push origin main', { from: home }), null, 'a repo the desk does not list');
  assert.equal(denial(tmp(), 'git push origin main', { from: home }), null, 'no repo at all: git fails');
  assert.equal(denial(join(root, 'gone'), 'git push origin main', { from: home }), null, 'no such directory');
  assert.equal(denial(a, 'git -C ../missing push origin main', { from: home }), null);

  assert.equal(denial(tmp(), 'git push origin main', { from: tmp() }), null, 'no desk');
  for (const input of ['not json', '', '{}', 'null', '{"tool_input":{"command":7}}']) {
    const r = spawnSync(process.execPath, [GUARD], { cwd: a, env: noDesk, encoding: 'utf8', input });
    assert.deepEqual([r.status, r.stdout], [0, ''], input);
  }

  writeFileSync(join(home, 'desk.config.json'), '{ broken');
  assert.equal(denial(a, 'git push origin main', { from: home }), null, 'broken config');
  writeFileSync(join(home, 'desk.config.json'), JSON.stringify({ repos: [{ id: 'a', path: '../a', merge: 'sometimes' }] }));
  assert.equal(denial(a, 'git push origin main', { from: home }), null, 'config that does not validate');
});
