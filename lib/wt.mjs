// Worktrees and streams, one per piece of work: `desk wt new|finish|rebase|merge|remove|discard <slug>` and
// `desk stream`. Same behaviour on every OS (git and gh only, no shell scripts).
//   wt new <slug> [--repo <id>] [--base <ref>] [--no-build]
//        worktree <worktreesDir>/<worktreePrefix><slug> on <branchPrefix><slug> from origin/<defaultBranch>,
//        settings synced, claim posted, `copy` paths copied, then the repo's install and build (each skipped when empty)
//   wt finish <slug> [--no-wait] [--rebased]   repo's check, push (--rebased: --force-with-lease --force-if-includes), wait for every CI run
//   wt rebase <slug> [--no-wait]   fetch, rebase on origin/<defaultBranch>, push as finish --rebased, range-diff vs the newest verdict's commit
//   wt merge <slug>     pushed + CI green + board `MERGE @<head>` -> push that sha to origin/<default>, ff the default branch to it, close todos, remove
//        `merge: "review"` repo: same gates -> open or update the PR (--findings <file>); a re-run closes once the PR has merged
//   wt merge <slug> --into <other-slug> [--force]   merge into that worktree's branch, close the source; no CI or verdict gate
//   wt remove <slug>    remove the worktree once its branch is in origin/<defaultBranch>; posts `release`
//   wt discard <slug> [--force]   drop worktree + branch, uncommitted work included; refuses another session's claim; posts `release`; reopens the slug's active todos
//   wt handoff <slug> --next "<step>" [--todo T-n]   write the slug's active todo's state from facts (head, clean, pushed, CI,
//        newest verdict without its `by` part) and next; post `release`. Refuses another session's claim.
// A repo without `gh` in desk.config.json has no CI: finish skips the wait and merge skips the CI gate.
// A clone without an `origin` remote is local-only: no fetch or push; merge fast-forwards its local
// default branch. A `kind: "folder"` entry has no worktrees: every wt command refuses it.
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync, openSync, realpathSync, cpSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { SLUG, config, repoFor, wtDir, worktreeList, gitRepos, hasOrigin, baseRef } from './config.mjs';
import { post, read, mergeOk, headBlock,conclusion, PASS, doneSlug, reopenSlug, openClaims, me, todos, OPEN, needsClaim, writeTodo, clean } from '../bin/desk.mjs';
import { syncCheckout, workspace, workspaceFile } from './sync.mjs';
import { hasSecret } from '../hooks/secretpatterns.mjs';

// The .code-workspace lists open worktrees: keep it current when there is one.
const refreshWorkspace = (c) => { if (existsSync(workspaceFile(c))) workspace(); };

const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { stdio: 'ignore' }).status === 0;
// Progress to the terminal; a non-zero exit throws with the message given.
const run = (cmd, args, cwd, msg) => { const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' }); if (r.status !== 0) throw new Error(msg ?? `${cmd} ${args.join(' ')} failed`); };
// Config commands (install/build/check) are command lines: a shell runs them (npm.cmd needs one on Windows).
const sh = (line, cwd, what) => { console.log(`> ${line}`); const r = spawnSync(line, { cwd, stdio: 'inherit', shell: true }); if (r.status !== 0) throw new Error(`${what} failed: ${line}`); };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// The flags `wt` and `stream` each take: anything else is a typo, and a value flag needs its value.
const VALUE_FLAGS = ['repo', 'base', 'todo', 'maxTurns', 'budget', 'into', 'findings', 'next'];
const WT_FLAGS = ['repo', 'base', 'noBuild', 'noWait', 'rebased', 'force', 'into', 'findings', 'todo', 'next'];
const STREAM_FLAGS = ['repo', 'todo', 'maxTurns', 'budget', 'desk', 'dryRun'];
export function flags(argv, allowed) {
  const f = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const k = a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
    if (!allowed.includes(k)) throw new Error(`unknown flag ${a}`);
    if (VALUE_FLAGS.includes(k)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      f[k] = v;
    } else f[k] = true;
  }
  return { f, rest };
}

// The repo of a slug: --repo, else the repo whose worktree has that slug, else the only git repo.
function locate(c, slug, repoId) {
  if (!SLUG.test(slug ?? '')) throw new Error('slug must be lowercase letters, digits and dashes');
  const hits = worktreeList(c).filter((w) => w.slug === slug);
  const repo = repoId ? repoFor(c, repoId) : hits.length === 1 ? hits[0].repo : repoFor({ ...c, repos: gitRepos(c) });
  if (repo.kind !== 'git') throw new Error(`${repo.id} is a plain folder (kind "folder" in desk.config.json): no worktrees, work in ${repo.path} directly`);
  return repo;
}

// gh, always against the repo's GitHub name (the desk itself has no remote).
const gh = (repo, ...a) => execFileSync('gh', ['-R', repo.gh, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// A PR body goes on stdin, never in argv, and no shell reads it.
const ghBody = (repo, body, ...a) => execFileSync('gh', ['-R', repo.gh, ...a, '--body-file', '-'], { input: body, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const ciRuns = (repo, sha) => JSON.parse(gh(repo, 'run', 'list', '--commit', sha, '--json', 'conclusion,status,databaseId'));
const ciConclusion = (repo, sha) => conclusion(ciRuns(repo, sha));

const dropStream = (c, slug) => { rmSync(join(c.home, 'streams', `${slug}.md`), { force: true }); refreshWorkspace(c); };

async function wtNew(c, slug, f) {
  const repo = locate(c, slug, f.repo);
  const remote = hasOrigin(repo);
  const dir = wtDir(c, repo, slug), branch = repo.branchPrefix + slug, base = f.base ?? baseRef(repo, remote);
  if (existsSync(dir)) throw new Error(`${dir} already exists`);
  if (repo.copy !== undefined && !Array.isArray(repo.copy)) throw new Error('copy must be an array of relative paths');
  for (const p of repo.copy ?? []) if (typeof p !== 'string' || isAbsolute(p) || p.split(/[\\/]/).includes('..') || resolve(repo.path, p) === resolve(repo.path)) throw new Error(`copy path must be relative and stay inside the repo: ${p}`);
  const other = worktreeList(c).find((w) => w.slug === slug);
  if (other) throw new Error(`slug ${slug} is already open in repo ${other.repo.id} (${other.dir}); slugs are desk-wide`);
  if (remote) run('git', ['-C', repo.path, 'fetch', '-q', 'origin'], undefined, 'git fetch failed');
  mkdirSync(c.worktreesDir, { recursive: true });
  // --no-track: a branch made from origin/<default> would track it, and a bare `git push` (push.default=upstream) would land on main.
  run('git', ['-C', repo.path, 'worktree', 'add', '--no-track', dir, '-b', branch, base], undefined, 'git worktree add failed');
  syncCheckout(c, dir);
  refreshWorkspace(c);
  post('claim', slug, `from ${base}`, repo.id); // never fails
  for (const p of repo.copy ?? []) // gitignored, machine-local files the worktree would lack
    if (existsSync(join(repo.path, p))) cpSync(join(repo.path, p), join(dir, p), { recursive: true });
    else console.log(`copy: ${p} not in ${repo.path}, skipped`);
  if (repo.install) sh(repo.install, dir, 'install');
  if (repo.build && !f.noBuild) sh(repo.build, dir, 'build');
  console.log(`Ready: ${dir} (branch ${branch} from ${base})`);
  return dir;
}

// A push git refused because the remote branch has commits this one lacks (after a rebase or amend).
// --rebased cannot force over commits this branch never had (--force-if-includes), so both messages give that way out.
const pushFailed = (stderr = '', rebased = false, branch) => {
  if (!/non-fast-forward|\[rejected\]|fetch first/.test(stderr)) return 'git push failed';
  const out = `if origin/${branch} holds commits this branch never had (an old branch of the same name), integrate them (git fetch origin && git rebase origin/${branch}) or, only if nobody else pushed to it, delete the remote branch (git push origin --delete ${branch}); --rebased will not overwrite them`;
  return rebased ? `git push failed: ${out}` : `git push failed: the remote branch has other commits. If you rebased or amended this branch, rerun with --rebased; ${out}`;
};

// Longest wait for all of a commit's runs together: a dead runner never finishes; a repo with slow CI can hit it too.
const CI_WATCH_MS = 30 * 60 * 1000;
// Longest wait for GitHub to register the first run after a push (it has been seen later than 60 s).
const CI_RUN_WAIT_MS = 5 * 60 * 1000;
// Watch each run until the shared deadline; a gh killed at the deadline leaves the run open, which finish then reports as running.
export function watchRuns(repo, ids, ms = CI_WATCH_MS, spawn = spawnSync, now = Date.now) {
  const end = now() + ms;
  for (const id of ids) {
    const left = end - now();
    if (left <= 0) return;
    spawn('gh', ['-R', repo.gh, 'run', 'watch', String(id), '--exit-status', '--interval', '60'], { stdio: 'ignore', timeout: left });
  }
}

// The slug's worktree, on its branch and clean, or the reason it is not.
function cleanWt(c, slug, f) {
  const repo = locate(c, slug, f.repo), dir = wtDir(c, repo, slug), branch = repo.branchPrefix + slug;
  if (!existsSync(dir)) throw new Error(`no worktree at ${dir}`);
  const on = git(dir, 'branch', '--show-current');
  if (on !== branch) throw new Error(`${dir} is on '${on || 'a detached HEAD'}', not ${branch}; check out ${branch} first`);
  if (git(dir, 'status', '--porcelain')) throw new Error(`uncommitted changes in ${dir}`);
  return { repo, dir, branch };
}

function finish(c, slug, f) {
  const { repo, dir, branch } = cleanWt(c, slug, f);
  if (repo.check) sh(repo.check, dir, 'check');
  if (!hasOrigin(repo)) { console.log(`Checked ${branch}. No origin remote: nothing to push, no CI.`); return; }
  const push = spawnSync('git', ['-C', dir, 'push', ...(f.rebased ? ['--force-with-lease', '--force-if-includes'] : []) /* includes: a bare lease always passes after a fetch */, '-u', 'origin', branch], { stdio: ['inherit', 'inherit', 'pipe'], encoding: 'utf8' });
  process.stderr.write(push.stderr ?? '');
  if (push.status !== 0) throw new Error(pushFailed(push.stderr, f.rebased, branch));
  const sha = git(dir, 'rev-parse', 'HEAD');
  if (!repo.gh) { console.log(`Pushed ${branch}. No gh repo in desk.config.json: no CI wait.`); return; }
  if (f.noWait) { console.log(`Pushed ${branch}. Watch CI: gh run list -R ${repo.gh} --branch ${branch}`); return; }
  const end = Date.now() + CI_RUN_WAIT_MS;
  let ids = [], ghErr; // a failed gh call here is a blip: no run yet, keep polling
  while (!ids.length && Date.now() < end) {
    try { ids = ciRuns(repo, sha).map((r) => r.databaseId); ghErr = undefined; } catch (e) { if (e.code === 'ENOENT') throw e; ghErr = e; } // no gh at all is not a blip
    if (!ids.length) sleep(3000); // usually seconds after the push
  }
  if (!ids.length) throw new Error(ghErr ? `no CI run found for ${sha}; gh failed: ${(ghErr.stderr || ghErr.message).trim()}` : `no CI run found for ${sha} after ${CI_RUN_WAIT_MS / 60000} minutes`);
  console.log(`Waiting for CI (up to ${CI_WATCH_MS / 60000} minutes)...`);
  watchRuns(repo, ids);
  let runs;
  for (let i = 1; !runs; i++) { // the one read of the result: a failed gh call is a blip here too
    try { runs = ciRuns(repo, sha); } catch (e) {
      if (e.code === 'ENOENT') throw e;
      if (i === 3) throw new Error(`CI finished watching but its result for ${sha} is unknown; gh failed: ${(e.stderr || e.message).trim()}`);
      sleep(3000);
    }
  }
  const ci = conclusion(runs);
  console.log(`CI for ${branch} (${sha}): ${ci} (${runs.length} run${runs.length === 1 ? '' : 's'})`);
  if (ci === 'running') console.log('Stopped waiting with CI still running; check that the runner is up.');
  post('ci', slug, `${sha.slice(0, 7)} ${ci}`, repo.id);
  if (ci !== 'success') {
    // shortcut: the still-running vs failed-logs split has no test (needs a mocked gh), add one with a gh stub.
    for (const r of runs.filter((x) => !PASS.includes(x.conclusion))) {
      console.log(r.status === 'completed' ? `Failed logs: gh run view -R ${repo.gh} ${r.databaseId} --log-failed` : `Still running: gh run watch -R ${repo.gh} ${r.databaseId}`);
    }
    process.exitCode = 1;
  }
}

// Rebase on the repo's default branch, push like `finish --rebased` (check, CI wait), then say whether the
// patches changed since the reviewed commit. Informs the next verdict; posts none.
function rebase(c, slug, f) {
  const { repo, dir, branch } = cleanWt(c, slug, f), old = git(dir, 'rev-parse', 'HEAD'), base = baseRef(repo);
  if (hasOrigin(repo)) run('git', ['-C', dir, 'fetch', 'origin'], undefined, 'git fetch failed');
  const r = spawnSync('git', ['-C', dir, 'rebase', base], { encoding: 'utf8' });
  if (r.status !== 0) {
    spawnSync('git', ['-C', dir, 'rebase', '--abort']);
    throw new Error(`rebase of ${branch} on ${base} conflicts; aborted, ${dir} is back at ${old.slice(0, 7)}. Rebase by hand (git rebase ${base}), then desk wt finish ${slug} --rebased\n${(r.stdout + r.stderr).trim()}`);
  }
  const head = git(dir, 'rev-parse', 'HEAD');
  console.log(`Rebased ${branch} on ${base}: ${old.slice(0, 7)} -> ${head.slice(0, 7)}`);
  const pushed = !hasOrigin(repo) || (gitOk(dir, 'rev-parse', '--verify', '-q', `origin/${branch}`) && git(dir, 'rev-parse', `origin/${branch}`) === head);
  if (head === old && pushed) { console.log('Already up to date: nothing to push.'); return; }
  const vm = read().filter((l) => l.kind === 'verdict' && l.slug === slug).at(-1)?.text.match(/^\s*(.*?)\s*@([0-9a-f]{7,40})\b/), v = vm?.[2];
  const known = v && gitOk(dir, 'cat-file', '-e', `${v}^{commit}`), reviewed = known ? v : old;
  try { finish(c, slug, { ...f, rebased: true }); }
  finally { // the report is worth having even when the check or CI failed
    console.log(known ? `Reviewed commit (newest board verdict ${vm[1] || 'without a word'}): ${reviewed.slice(0, 7)}` : `No usable board verdict${v ? ` (${v} is not in this repo)` : ''}; compared with the head before the rebase: ${old.slice(0, 7)}`);
    let out = null;
    try {
      if (gitOk(dir, 'merge-base', '--is-ancestor', reviewed, head)) { // an empty first range makes range-diff exit 129
        const n = git(dir, 'rev-list', '--count', `${reviewed}..${head}`);
        console.log(`Reviewed commit unchanged, with ${n} commit${n === '1' ? '' : 's'} on top: no range-diff.`);
      } else out = git(dir, 'range-diff', '--no-color', '--no-patch', `${git(dir, 'merge-base', reviewed, head)}..${reviewed}`, `${base}..${head}`);
    } catch (e) { console.log(`range-diff failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`); } // no return: it would swallow the check's or CI's error
    const diff = (out ?? '').split('\n').filter((l) => /^\s*(-|\d+):\s+\S+\s+[=!<>]\s+(-|\d+):/.test(l)).map((l) => l.trim()).filter((l) => !/^(-|\d+):\s+\S+\s+=\s/.test(l));
    if (out !== null) console.log(diff.length ? `Patches differ from the reviewed commit:\n  ${diff.join('\n  ')}` : 'Only context changed: every patch is the same as in the reviewed commit.');
    console.log(`Old head ${old}\nNew head ${head}\nNo verdict posted: wt merge still needs \`MERGE @${head}\`.`);
  }
}

// The gates every merge passes: pushed, CI green, a board verdict for exactly this head.
function mergeGates(repo, slug, branch, sha, remote) {
  if (remote && (!gitOk(repo.path, 'rev-parse', '--verify', '-q', `origin/${branch}`) || git(repo.path, 'rev-parse', `origin/${branch}`) !== sha))
    throw new Error(`${branch} has unpushed commits; run desk wt finish ${slug} first`);
  if (repo.gh) { const ci = ciConclusion(repo, sha); if (ci !== 'success') throw new Error(`CI on ${branch} (${sha}) is '${ci}', not success`); }
  else console.log(`No gh repo in desk.config.json for ${repo.id}: CI gate skipped.`);
  // The review gate: the newest board verdict must be MERGE for exactly this head.
  const lines = read(), why = mergeOk(lines, slug, sha);
  // A blocker on the head names its own way out (a new commit, or an override); a plain MERGE would not clear it.
  if (why) throw new Error(`merge blocked: ${why}${headBlock(lines, slug, sha) ? '' : `; after a clean review: desk board post verdict ${slug} "MERGE @${sha}"`}`);
}

const FINDINGS_MAX = 60000;
// A fence longer than the longest backtick run in the text, so nothing inside can close it.
const fenced = (text) => { const tick = '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map((r) => r.length + 1))); return `${tick}\n${text.trimEnd()}\n${tick}`; };

// The whole PR body: a person reads it on a server the desk does not own, so no board text but the sha,
// nothing live in the findings, and a secret is refused rather than masked.
export function prBody(sha, findings, commits) {
  if (findings.length > FINDINGS_MAX) throw new Error(`findings are ${findings.length} characters, over the ${FINDINGS_MAX} limit; nothing was sent`);
  const body = `Reviewed: MERGE @${sha}\n\n## Findings\n\n${fenced(findings)}\n\n## Commits\n\n${fenced(commits)}\n`;
  if (hasSecret(body)) throw new Error('the findings or a commit subject hold something shaped like a secret; remove it. Nothing was sent');
  return body;
}

// `gh pr list` answers [] with exit 0 for no PR, so any failure is a real one: stop, never go on without it.
function prsFor(repo, branch) {
  try { return JSON.parse(gh(repo, 'pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,headRefOid,url,isCrossRepository')).filter((p) => !p.isCrossRepository); } // --head matches the branch name only: a fork's PR from the same name is not ours
  catch (e) { throw new Error(`${e.code === 'ENOENT' ? 'gh is not installed' : `gh pr list failed: ${String(e.stderr ?? e.message).trim()}`}; nothing was merged`); }
}

// The close after the merge happened elsewhere: the local branch may share no commits with its base, hence merged.
function closeMerged(c, repo, slug, f, text, note) {
  post('merged', slug, text, repo.id);
  doneSlug(slug, note); // todos started with --slug close on merge
  remove(c, slug, { ...f, repo: repo.id, afterMerge: true, merged: true });
}

// merge: "review": the desk opens the PR and a person merges it on the server. Returning here is what
// keeps this path off the fast-forward and push below.
function mergeReview(c, repo, slug, f) {
  const main = repo.defaultBranch, branch = repo.branchPrefix + slug, remote = hasOrigin(repo);
  if (!repo.gh || !remote) throw new Error(`merge: review needs gh and origin on ${repo.id}; nothing was merged`);
  run('git', ['-C', repo.path, 'fetch', '-q', 'origin'], undefined, 'git fetch failed; nothing was merged');
  const sha = git(repo.path, 'rev-parse', `refs/heads/${branch}`);
  const prs = prsFor(repo, branch);
  const pr = prs.find((p) => p.state === 'OPEN') ?? prs.toSorted((a, b) => b.number - a.number)[0];
  // A failed fetch counts as no proof: FETCH_HEAD would still be the previous fetch's.
  const holdsHead = pr?.state === 'MERGED' && gitOk(repo.path, 'fetch', '-q', 'origin', `pull/${pr.number}/head`) && gitOk(repo.path, 'merge-base', '--is-ancestor', sha, 'FETCH_HEAD');
  if (holdsHead) return closeMerged(c, repo, slug, f, `PR #${pr.number}`);
  if (pr?.state === 'CLOSED' && pr.headRefOid === sha) throw new Error(`PR #${pr.number} was closed unmerged at this head; add commits and get a new verdict, or desk wt discard ${slug}`);
  if (pr?.state === 'OPEN' && !f.findings) { console.log(`PR #${pr.number} is ${pr.state}: ${pr.url}`); return; }
  mergeGates(repo, slug, branch, sha, remote);
  if (!f.findings) throw new Error(`no open PR for ${branch}: pass --findings <file> with the review's findings; nothing was created`);
  let findings;
  try { findings = readFileSync(f.findings, 'utf8'); } catch (e) { throw new Error(`cannot read ${f.findings}: ${e.message}; nothing was sent`); }
  const body = prBody(sha, findings, git(repo.path, 'log', '--oneline', '--no-decorate', `origin/${main}..${sha}`));
  const title = git(repo.path, 'log', '--reverse', '--format=%s', `origin/${main}..${sha}`).split('\n')[0] || slug;
  if (pr?.state === 'OPEN') {
    ghBody(repo, body, 'pr', 'edit', String(pr.number));
    post('note', slug, `PR #${pr.number} updated @${sha.slice(0, 7)}`, repo.id);
    console.log(pr.url);
    return;
  }
  const url = ghBody(repo, body, 'pr', 'create', '--base', main, '--head', branch, '--title', title).trim();
  post('note', slug, `PR #${/\/pull\/(\d+)/.exec(url)?.[1] ?? '?'} opened @${sha.slice(0, 7)}`, repo.id);
  console.log(url);
}

// Merge one worktree's branch into another's, on any policy: the target's own wt merge gates the combined head.
function mergeInto(c, repo, slug, f) {
  if (f.findings) throw new Error('--findings goes with a PR, not with --into');
  if (!SLUG.test(f.into) || f.into === slug) throw new Error('--into needs the slug of another worktree');
  const source = wtDir(c, repo, slug), target = wtDir(c, repo, f.into), branch = repo.branchPrefix + slug, into = repo.branchPrefix + f.into;
  if (!existsSync(source)) throw new Error(`no worktree at ${source}`);
  if (!existsSync(target) || !registered(repo, target)) throw new Error(`no worktree of ${repo.id} at ${target}; --into needs both in the same repo`);
  notInside(source);
  for (const dir of [source, target]) if (git(dir, 'status', '--porcelain')) throw new Error(`${dir} has uncommitted changes`);
  if (git(target, 'branch', '--show-current') !== into) throw new Error(`${target} must be on ${into}`);
  const holder = openClaims(read()).find((x) => (x.slug === slug || x.slug === f.into) && x.from !== me());
  if (holder && !f.force) throw new Error(`${holder.slug} is claimed by session ${holder.from}; ask it, or pass --force`);
  // Already an ancestor: a person resolved the merge by hand, or a re-run after a failed close.
  if (!gitOk(repo.path, 'merge-base', '--is-ancestor', branch, into)) {
    const r = spawnSync('git', ['-C', target, 'merge', '--no-edit', branch], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.status !== 0) {
      const files = git(target, 'diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
      // No MERGE_HEAD: git refused before starting (an untracked file in the way), so nothing to undo.
      if (gitOk(target, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')) git(target, 'merge', '--abort');
      throw new Error(`${branch} does not merge into ${into}${files.length ? `: conflict in ${files.join(', ')}` : `: ${r.stderr.trim()}`}; both are as they were. Merge by hand in ${target}, then re-run`);
    }
  }
  closeMerged(c, repo, slug, f, `into ${into}`, `merged into ${into} (${slug})`);
}

function merge(c, slug, f) {
  const repo = locate(c, slug, f.repo), main = repo.defaultBranch, branch = repo.branchPrefix + slug;
  if (f.into) return mergeInto(c, repo, slug, f);
  if (!existsSync(wtDir(c, repo, slug))) throw new Error(`no worktree at ${wtDir(c, repo, slug)}`);
  notInside(wtDir(c, repo, slug));
  if (repo.merge === 'review') return mergeReview(c, repo, slug, f);
  const remote = hasOrigin(repo);
  if (remote) run('git', ['-C', repo.path, 'fetch', '-q', 'origin'], undefined, 'git fetch failed');
  const sha = git(repo.path, 'rev-parse', `refs/heads/${branch}`); // the one sha every gate checks and the merge takes
  mergeGates(repo, slug, branch, sha, remote);
  if (git(repo.path, 'branch', '--show-current') !== main || git(repo.path, 'status', '--porcelain')) throw new Error(`main checkout ${repo.path} must be on ${main} and clean`);
  if (remote) run('git', ['-C', repo.path, 'merge', '-q', '--ff-only', `origin/${main}`], undefined, `main checkout cannot fast-forward to origin/${main}`);
  const notFf = `${branch} is not a fast-forward of ${main}; run desk wt rebase ${slug} (rebases on ${baseRef(repo, remote)}, pushes, waits for CI), then get a new review`;
  if (remote) {
    // Push first: a failed push leaves the default branch no further than origin. A sha origin already holds skips check and push, so a rerun after a failed local step closes the work even once origin moved on.
    if (!gitOk(repo.path, 'merge-base', '--is-ancestor', sha, `origin/${main}`)) {
      if (!gitOk(repo.path, 'merge-base', '--is-ancestor', main, sha)) throw new Error(notFf);
      run('git', ['-C', repo.path, 'push', 'origin', `${sha}:refs/heads/${main}`], undefined, `git push origin ${main} failed; the default branch was not moved past origin/${main} and the merge did not happen, so re-run desk wt merge ${slug} (run desk wt rebase ${slug} first if origin/${main} moved)`);
    }
  }
  run('git', ['-C', repo.path, 'merge', '--ff-only', sha], undefined, remote
    ? `${branch} is pushed to origin/${main} but the main checkout cannot fast-forward to it; re-run desk wt merge ${slug} (it catches up and closes the work), or fix ${repo.path} by hand`
    : notFf);
  post('merged', slug, `${main}=${sha.slice(0, 7)}; open worktrees rebase`, repo.id);
  doneSlug(slug); // todos started with --slug close on merge
  remove(c, slug, { ...f, repo: repo.id, afterMerge: true });
}

// Whether git still lists dir as a worktree of repo (paths compared resolved, with / and, on Windows, in lower case).
export const samePath = (p) => { try { p = realpathSync.native(p); } catch {} p = p.replace(/\\/g, '/'); return process.platform === 'win32' ? p.toLowerCase() : p; };
const registered = (repo, dir) => git(repo.path, 'worktree', 'list', '--porcelain').split(/\r?\n/)
  .some((l) => l.startsWith('worktree ') && samePath(l.slice(9)) === samePath(dir));

// A shell standing in the worktree locks the folder (Windows): refuse before anything changes.
const notInside = (dir) => { const d = samePath(dir), p = samePath(process.cwd()); if (p === d || p.startsWith(d + '/')) throw new Error(`cd out of ${dir} first`); };

function remove(c, slug, f) {
  const repo = locate(c, slug, f.repo), dir = wtDir(c, repo, slug), branch = repo.branchPrefix + slug;
  if (!existsSync(dir)) throw new Error(`no worktree at ${dir}`);
  notInside(dir);
  const remote = hasOrigin(repo), into = baseRef(repo, remote);
  // merged: a PR or --into already proved the commits landed, and a squash or a target branch never makes them ancestors of the base.
  const del = f.merged ? '-D' : '-d';
  if (remote && !f.merged) run('git', ['-C', repo.path, 'fetch', '-q', 'origin'], undefined, 'git fetch failed');
  if (!f.merged && !gitOk(repo.path, 'merge-base', '--is-ancestor', branch, into)) throw new Error(`${branch} is not in ${into} yet; merge it first${repo.merge === 'review' ? `. If its PR was merged on the server, close it with desk wt merge ${slug}` : ''}`);
  // git's reason (modified/untracked files, locked) reaches the terminal; stdin ignored so Git for Windows does not ask "try again? (y/n)".
  if (spawnSync('git', ['-C', repo.path, 'worktree', 'remove', dir], { stdio: ['ignore', 'inherit', 'inherit'] }).status !== 0) {
    gitOk(repo.path, 'worktree', 'prune');
    // Still registered: git refused before deleting anything, so the work and the claim stay.
    if (registered(repo, dir)) throw new Error(f.merged
      ? `git worktree remove failed; the merge is done: fix what git reports, then desk wt merge ${slug}${f.into ? ` --into ${f.into}` : ''}`
      : `git worktree remove failed${f.afterMerge ? '; the merge is pushed' : ''}: fix what git reports, then desk wt remove ${slug}`);
    // Unregistered but the folder stayed (a shell holds it on Windows): close it, don't strand the branch and the claim.
    const branchGone = gitOk(repo.path, 'branch', del, branch);
    dropStream(c, slug);
    post('release', slug, f.afterMerge ? 'merged; folder left' : 'removed; folder left', repo.id);
    console.warn(`warning: ${f.afterMerge ? 'merged and closed' : 'removed'}, but ${dir} could not be removed${branchGone ? '' : ` and branch ${branch} is still there`}; remove the folder by hand, then: git -C ${repo.path} worktree prune${branchGone ? '' : ` && git -C ${repo.path} branch ${del} ${branch}`}`);
    return;
  }
  run('git', ['-C', repo.path, 'branch', del, branch], undefined, `git branch ${del} failed`);
  dropStream(c, slug);
  post('release', slug, 'removed', repo.id);
  console.log(`Removed ${dir} and ${branch}`);
}

function discard(c, slug, f) {
  const repo = locate(c, slug, f.repo), dir = wtDir(c, repo, slug), branch = repo.branchPrefix + slug;
  if (!existsSync(dir)) throw new Error(`no worktree at ${dir}`);
  const holder = openClaims(read()).find((x) => x.slug === slug && x.from !== me());
  if (holder && !f.force) throw new Error(`${slug} is claimed by session ${holder.from}; discarding throws away its work. Ask it, or pass --force`);
  notInside(dir);
  if (spawnSync('git', ['-C', repo.path, 'worktree', 'remove', '--force', dir], { stdio: ['ignore', 'inherit', 'inherit'] }).status !== 0) {
    gitOk(repo.path, 'worktree', 'prune');
    // Still listed: git refused before deleting, so branch and claim stay. Unlisted: only the folder stayed; finish below.
    if (registered(repo, dir)) throw new Error('git worktree remove failed; branch and claim kept');
    console.warn(`warning: ${dir} could not be removed; remove the folder by hand`);
  }
  run('git', ['-C', repo.path, 'branch', '-D', branch], undefined, 'git branch -D failed');
  dropStream(c, slug);
  post('release', slug, 'discarded', repo.id);
  console.log(`Discarded ${dir} and ${branch}`);
  reopenSlug(slug);
}

// The handoff skill's state line, from facts instead of hand-assembled: the next session reads it in `desk status`.
// The verdict loses its `by <model>/<effort>` part, because todo.jsonl is committed and the board is not.
export function handoff(c, slug, f) {
  if (!f.next) throw new Error('wt handoff needs --next "<the exact next step and stopping point>"');
  const repo = locate(c, slug, f.repo), dir = wtDir(c, repo, slug), branch = repo.branchPrefix + slug;
  if (!existsSync(dir)) throw new Error(`no worktree at ${dir}`);
  const holder = openClaims(read()).find((x) => x.slug === slug && x.from !== me());
  if (holder) throw new Error(`${slug} is claimed by session ${holder.from}; only the holder hands it off`);
  const t = todos(), x = f.todo ? t.get(f.todo) : [...t.values()].find((y) => y.slug === slug && y.status === 'active');
  if (!x) throw new Error(f.todo ? `no todo ${f.todo}` : `no active todo for ${slug}: pass --todo T-n`);
  const head = git(dir, 'rev-parse', 'HEAD'), dirty = git(dir, 'status', '--porcelain') !== '';
  const pushed = !hasOrigin(repo) || (gitOk(dir, 'rev-parse', '--verify', '-q', `origin/${branch}`) && git(dir, 'rev-parse', `origin/${branch}`) === head);
  let ci = 'no CI';
  if (repo.gh) try { ci = ciConclusion(repo, head) || 'none'; } catch { ci = 'unknown'; }
  const v = read().filter((l) => l.kind === 'verdict' && l.slug === slug).at(-1)?.text.replace(/\s+by\s+\S+\s*$/, '');
  const state = `head ${head.slice(0, 7)}, ${dirty ? 'uncommitted changes' : 'clean'}, ${pushed ? 'pushed' : 'not pushed'}, CI ${ci}, verdict ${v ?? 'none'}`;
  writeTodo(x.id, { state, next: clean(f.next) });
  post('release', slug, 'handed off', repo.id);
  console.log(`${x.id} state: ${state}\n${x.id} next: ${clean(f.next)}\nReleased ${slug}`);
}

export async function wt([sub, slug, ...argv]) {
  const { f } = flags(argv, WT_FLAGS), c = config();
  const cmds = { new: wtNew, finish, rebase, merge, remove, discard, handoff };
  if (!cmds[sub]) throw new Error('usage: desk wt new|finish|rebase|merge|remove|discard|handoff <slug> [--repo <id>] [--base <ref>] [--no-build] [--no-wait] [--rebased] [--force] [--into <slug>] [--findings <file>] [--todo T-n] [--next "<step>"]');
  await cmds[sub](c, slug, f);
}

// ---- stream: one unattended headless Claude session for a piece of work, detached ----
// desk stream <slug> <task-file> [--todo T-n] [--desk] [--repo <id>] [--max-turns 80] [--budget <usd>] [--dry-run]
//   --budget (or `budgetUsd:` in the task file's front matter): claude's --max-budget-usd; default none.
//   --desk: work on the desk itself (no worktree pipeline). Log: <scratchDir>/<slug>-run.jsonl (stream-json).
function brief(c, slug, task, f) {
  const repo = f.desk ? null : locate(c, slug, f.repo);
  return [
    `Unattended run started by the desk manager; no human is watching. Read the rulings (\`desk decide --list\`) and follow the desk's`,
    `CLAUDE.md / AGENTS.md and the \`orchestrate\` skill. Your slug is \`${slug}\`${repo ? ` (repo ${repo.id}, worktree ${wtDir(c, repo, slug)})` : ''}.`,
    '', 'Task:', task.trim(),
    ...(f.todo ? ['', `Todo: ${f.todo}. First run \`desk todo start ${f.todo} --slug ${slug}\`; split it with \`desk todo split\` if it holds several steps; \`desk todo note\` decisions on it.`] : []),
    '',
    ...(f.desk ? [
      `Desk work: you edit the desk folder ${c.home} directly (no worktree, no CI). First post`,
      `\`desk board post claim desk-${slug}\`. Other sessions use the desk while you work: an existing command keeps`,
      'working (same name, same arguments) until every caller is moved. Commit each finished todo on its own, staging',
      'only the files you changed. Review: a fresh `general-purpose` agent following the `ponytail-review` skill reads',
      'your commits before you finish; fix what it finds.',
    ] : [
      `Pipeline: if the worktree does not exist, create it with \`desk wt new ${slug} --repo ${repo.id}\` and confirm`,
      `\`desk board claims\` shows it as yours; if it exists, \`desk board check ${slug}\` must say yours or unclaimed,`,
      'else stop and report. Delegate per `orchestrate` (require verify-command output in reports) ->',
      `\`desk wt finish ${slug}\` -> fresh \`reviewer\` + \`validator\` (+ \`structure-reviewer\` per orchestrate) -> fixes -> \`verifier\`. STOP before \`desk wt merge\`, whatever the`,
      'verdict: the desk manager merges. Every `reviewer` and `verifier` brief states the model and effort you pass,',
      'so the verdict posted reads `<VERDICT> @<sha> by <model>/<effort>`.',
    ]),
    'Hard rules: the desk\'s and the repo\'s written rules. An owner decision: add it as a todo',
    '(`desk todo add "<question>" --area owner --why "<context>" --option "<label>: <why>" --option "<label>: <why>"`, 2-4 options, recommendation first, labels up to 60 characters) and stop there.',
    'End with the `handoff` skill. Final message: verdicts with SHAs, the validator\'s `Validation:` line, CI results, what you skipped, and the',
    'usage table from `desk tokens 24 --session self` (you and each of your agents).',
    ...(repo?.merge === 'review' ? ['This repo merges by review: the final message also holds the `PR findings:` block of the last reviewer or verifier report (the verifier\'s after a fix round) in full, after the verdict; the desk manager saves them to a file for `desk wt merge <slug> --findings <file>`.'] : []),
  ].join('\n') + '\n';
}

export const SESSION_ENV = ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT'];
// A task file may open with a front matter block: `budgetUsd: 5` caps the run's spend (--budget wins).
function taskFile(raw, budgetFlag) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw), fm = m?.[1] ?? '';
  const budget = budgetFlag ?? /^budgetUsd:\s*(\S+)\s*$/m.exec(fm)?.[1];
  if (budget !== undefined && !(Number(budget) > 0)) throw new Error(`budget must be a positive dollar amount, got ${budget}`);
  return { task: m ? raw.slice(m[0].length) : raw, budget };
}

// How to start claude detached. On Windows a real claude.exe starts directly: through `shell: true` a
// detached cmd.exe has no console and exits at once with nothing written (T-71). A .cmd/.bat shim
// (npm install) needs cmd, so it runs undetached there.
// shortcut: that shim case is not tested on CI, move to a node entry point when claude ships one.
function claudeLauncher(platform = process.platform) {
  if (platform !== 'win32') return { cmd: 'claude', shell: false, detached: true };
  const exe = spawnSync('where', ['claude'], { encoding: 'utf8' }).stdout?.split(/\r?\n/).find((l) => /\.exe$/i.test(l.trim()));
  return exe ? { cmd: exe.trim(), shell: false, detached: true } : { cmd: 'claude', shell: true, detached: false };
}

export function stream([slug, taskPath, ...argv]) {
  const { f } = flags(argv, STREAM_FLAGS), c = config();
  if (!SLUG.test(slug ?? '')) throw new Error('slug must be lowercase letters, digits and dashes');
  if (!taskPath || !existsSync(taskPath)) throw new Error(`no task file ${taskPath ?? ''}`);
  const { task, budget } = taskFile(readFileSync(taskPath, 'utf8'), f.budget);
  // Refuse here what the child would only find out after a whole headless startup.
  const held = openClaims(read()).find((x) => x.slug === slug && x.from !== me());
  if (held) throw new Error(`${slug} is claimed by session ${held.from}; nothing was started`);
  if (f.todo) {
    const x = todos().get(f.todo);
    if (!x || !OPEN.has(x.status)) throw new Error(`${f.todo} ${x ? `is ${x.status}` : 'does not exist'}; nothing was started`);
    if (needsClaim(x)) throw new Error(`${f.todo} is a ${x.kind} with no acceptance claim: desk todo note ${f.todo} "accept: <claim> | <command> | <expected>" first; nothing was started`);
  }
  const text = brief(c, slug, task, f);
  mkdirSync(c.scratchDir, { recursive: true });
  const prompt = join(c.scratchDir, `${slug}-prompt.txt`), log = join(c.scratchDir, `${slug}-run.jsonl`);
  writeFileSync(prompt, text); // utf8, no BOM
  const args = ['-p', '--max-turns', String(f.maxTurns ?? 80), '--output-format', 'stream-json', '--verbose', ...(budget ? ['--max-budget-usd', String(budget)] : [])];
  if (f.dryRun) { console.log(`claude ${args.join(' ')} < ${prompt} > ${log}`); console.log(text); return; }
  // The child must not inherit this session's identity, bridge or messaging pipe: the board would
  // credit its claim to the caller and it could attach to the caller's socket.
  // Only those: the rest (CLAUDE_CONFIG_DIR, CLAUDE_CODE_USE_BEDROCK, ...) is the user's setup the child needs.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !SESSION_ENV.includes(k.toUpperCase())));
  const { cmd, shell, detached } = claudeLauncher();
  const p = spawn(cmd, args, { cwd: c.home, env: { ...env, DESK_HOME: c.home }, detached, windowsHide: true, shell,
    stdio: [openSync(prompt, 'r'), openSync(log, 'a'), openSync(`${log}.err`, 'a')] }); // append: a second run must not wipe a live run's log
  p.on('error', (e) => { console.error(`desk stream: cannot start claude: ${e.message}`); process.exitCode = 1; });
  p.unref();
  if (p.pid) console.log(`Started ${slug} (pid ${p.pid}). Log: ${log}`);
}
