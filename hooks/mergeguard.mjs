// The merge guard's rule: under `merge: review`, no shell command pushes to, deletes or merges into a
// branch outside the repo's branchPrefix, and no `gh pr merge`. A guardrail, not a wall: the server rule
// is the wall. Not seen, all of it allowed: `bash -c`, `eval`, `Invoke-Expression`, scripts, aliases,
// `$VAR` and `$(...)` as names, escapes inside `$'...'`, PowerShell `+=`, `gh api`, `rtk run`.
// Shared, Node-free. This file reads the command; scripts/merge-guard.mjs maps its directories to repos.

// shortcut: a `cd` counts as run, even one behind `&`, a pipe or a failed `&&`, and `popd` and `cd -` are not followed; the server rule covers those.

const WRAPPERS = new Set(['command', 'env', 'exec', 'builtin', 'nohup', 'time', 'timeout', 'nice', 'sudo', 'xargs', 'rtk', 'if', 'then', 'do', 'else', 'elif', 'while', 'until', '!']);
// Words that run the rest of the line only straight after `rtk`; `proxy` is an alias of `bypass`.
const RTK_WORDS = new Set(['bypass', 'proxy']);
const CD = new Set(['cd', 'chdir', 'pushd', 'set-location', 'sl', 'push-location']);
const GIT_VALUE_FLAGS = new Set(['-c', '--work-tree', '--namespace', '--config-env', '--exec-path', '--attr-source']);
const WRAPPER_VALUE_FLAGS = {
  env: /^(-u|--unset)$/, exec: /^-a$/, nice: /^(-n|--adjustment)$/, sudo: /^(-u|--user|-g|--group)$/,
  timeout: /^(-k|--kill-after|-s|--signal)$/, xargs: /^(-n|-L|-P|-I|-s|-d)$/,
};
const SHORT_PUSH = '[ufvqnd46]';

// git takes a long option by any unambiguous start: `--del`, `--mir`. An ambiguous one is git's error, so it does no harm here.
const is = (word, ...full) => word.length >= 3 && full.some((f) => f.startsWith(word));

/** Words per command, with '(' and ')' around a subshell. Throws on an unterminated quote: the shell refuses that line too. */
function scan(src, ps) {
  const s = ps ? src.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"') : src;
  const out = [];
  let i = 0;

  function chain(closer) {
    let seg = [], w = null, skip = false;
    const heredocs = [];
    const add = (c) => { w ??= { t: '', dyn: false }; w.t += c; };
    const end = () => {
      if (!w) return;
      if (skip === 'heredoc') heredocs.push(w.t); else if (!skip) seg.push(w);
      skip = false; w = null;
    };
    const flush = () => { end(); if (seg.length) out.push(seg); seg = []; };
    const subst = (cl) => { add(''); w.dyn = true; out.push('('); chain(cl); out.push(')'); };
    const single = () => {
      i++; add('');
      for (;;) {
        const j = s.indexOf("'", i);
        if (j < 0) throw new Error('unterminated quote');
        add(s.slice(i, j)); i = j + 1;
        if (!ps || s[i] !== "'") return;
        add("'"); i++; // PowerShell: '' is a literal quote; in bash 'a''b' just joins
      }
    };
    const double = () => {
      i++; add('');
      while (i < s.length) {
        const c = s[i], n = s[i + 1];
        if (c === '"') {
          if (!ps || n !== '"') { i++; return; }
          add('"'); i += 2;
        } else if (!ps && c === '\\' && /["$`\\\n]/.test(n ?? '')) { if (n !== '\n') add(n); i += 2; }
        else if (ps && c === '`') { add(n ?? ''); i += 2; }
        else if (c === '$' && n === '(') { i += 2; subst(')'); }
        else if (!ps && c === '`') { i++; subst('`'); }
        else { if (c === '$') w.dyn = true; add(c); i++; }
      }
      throw new Error('unterminated quote');
    };
    // Each heredoc line reads as a command, since `bash <<EOF` runs them (text that looks like one is D4's false positive).
    // In a child shell: its `cd` ends with it. A stray apostrophe ends only its own line.
    const bodies = () => {
      for (const delim of heredocs.splice(0)) {
        out.push('(');
        for (;;) {
          const e = s.indexOf('\n', i), line = (e < 0 ? s.slice(i) : s.slice(i, e)).replace(/\r$/, '').replace(/^\t+/, '');
          i = e < 0 ? s.length : e + 1;
          if (line === delim) break;
          try { out.push(...scan(line, ps)); } catch { /* not a command */ }
          if (e < 0) break;
        }
        out.push(')');
      }
    };

    while (i < s.length) {
      const c = s[i], n = s[i + 1];
      if (closer && c === closer) { i++; flush(); return; }
      if (c === ' ' || c === '\t' || c === '\r') { end(); i++; }
      else if (c === '\n') { flush(); i++; bodies(); }
      else if (c === '#' && !w) { while (i < s.length && s[i] !== '\n') i++; }
      else if (c === (ps ? '`' : '\\')) {
        const nl = s[i + 1] === '\n' ? 1 : s.startsWith('\r\n', i + 1) ? 2 : 0;
        if (nl) { if (ps) end(); i += 1 + nl; } else { add(n ?? ''); i += 2; }
      }
      else if (c === "'") single();
      else if (c === '"') double();
      else if (ps && c === '@' && !w && (n === "'" || n === '"') && /^\r?\n/.test(s.slice(i + 2, i + 4))) {
        const j = s.indexOf(`\n${n}@`, i); // PowerShell here-string
        if (j < 0) throw new Error('unterminated here-string');
        add(s.slice(i + 2, j)); i = j + 3;
      }
      else if (!ps && c === '$' && n === "'") { // ANSI-C quoting: unlike '', a backslash escapes the quote
        i += 2; add('');
        const from = i;
        while (i < s.length && s[i] !== "'") i += s[i] === '\\' ? 2 : 1;
        if (i >= s.length) throw new Error('unterminated quote');
        add(s.slice(from, i)); i++;
      }
      else if (!ps && c === '$' && n === '"') i++; // $"x" is quoting, not a variable
      // A PowerShell assignment reads the same glued: `$out=git` is `$out = git`.
      else if (ps && c === '=' && (w ? w.dyn && !seg.length : seg.length === 1 && seg[0].dyn)) { end(); add('='); end(); i++; }
      else if (c === '$' && n === '(') { i += 2; subst(')'); }
      else if (c === '$' && n === '{') {
        const j = s.indexOf('}', i), stop = j < 0 ? s.length : j + 1;
        add(s.slice(i, stop)); w.dyn = true; i = stop;
      }
      else if (c === '$') { add(c); w.dyn = true; i++; }
      else if (!ps && c === '`') { i++; subst('`'); }
      else if (c === ';' || c === '|') { flush(); i++; }
      else if (c === '&') { if (n === '>') end(); else flush(); i++; }
      else if (c === '>' || c === '<') {
        const here = !ps && s.startsWith('<<', i) && s[i + 2] !== '<';
        if (w && /^(\d+|\*)$/.test(w.t)) w = null; else end(); // the 2 of 2>&1 is no word
        i++;
        while (/[<>&|-]/.test(s[i] ?? '')) i++;
        skip = here ? 'heredoc' : true;
      }
      else if (c === '(') { flush(); i++; out.push('('); chain(')'); out.push(')'); }
      else if (c === ')') { flush(); i++; }
      // HEAD@{1} and {a,b} are words in bash; a PowerShell block closes even when glued: `{ git push origin main}`.
      else if ((c === '{' || c === '}') && (ps || (!w && /^(\s|;|$)/.test(n ?? '')))) { flush(); i++; }
      else { add(c); i++; }
    }
    flush();
  }
  chain('');
  return out;
}

/**
 * The commands the guard judges, each with the `cd` / `-C` steps that lead to its directory.
 * @param {string} cmd @param {string} [shell] the tool name; PowerShell has other escapes than bash
 * @returns {{ kind: 'push' | 'merge' | 'gh', dirs: (string | null)[], args: { t: string, dyn: boolean }[], repo?: string }[]} a null dir is not knowable here
 */
export function parse(cmd, shell) {
  const ps = /powershell/i.test(shell ?? '');
  const ops = [], stack = [];
  let dirs = [];
  // PowerShell takes \ as a path separator on every OS; / reads the same on Windows.
  const path = (t) => (ps ? t.replace(/\\/g, '/') : t);
  const value = (w) => (!w || w.dyn ? null : path(w.t));
  let segs;
  try { segs = scan(cmd, ps); } catch { return []; } // a line the parser cannot read is allowed
  for (const seg of segs) {
    if (seg === '(') { stack.push(dirs); continue; }
    if (seg === ')') { const before = stack.pop(); if (!ps) dirs = before; continue; } // bash subshell: its cd ends with it
    let k = ps && seg[0].dyn && seg[1]?.t === '=' ? 2 : 0, ghEnv = '', afterRtk = false;
    for (; k < seg.length; k++) {
      const t = seg[k].t;
      if (/^[A-Za-z_]\w*=/.test(t)) { if (t.startsWith('GH_REPO=')) ghEnv = t.slice(8); continue; }
      if (!WRAPPERS.has(t.toLowerCase()) && !(afterRtk && RTK_WORDS.has(t))) break;
      afterRtk = t.toLowerCase() === 'rtk';
      while (seg[k + 1]?.t.startsWith('-')) {
        const f = seg[++k].t;
        if (f === '-C' || f === '--chdir') dirs = [...dirs, value(seg[++k])];
        else if (WRAPPER_VALUE_FLAGS[t]?.test(f)) k++;
      }
      if (t === 'timeout') k++; // its duration
    }
    if (k >= seg.length) continue;
    const name = seg[k].t.split(/[\\/]/).pop().toLowerCase(), args = seg.slice(k + 1);

    if (CD.has(name)) {
      const to = args.find((w) => !w.t.startsWith('-'));
      if (to) dirs = [...dirs, value(to)];
    } else if (name === 'git' || name === 'git.exe') {
      let a = 0, d = dirs;
      for (; a < args.length && args[a].t.startsWith('-'); a++) {
        const f = args[a].t;
        if (f === '-C' || f === '--git-dir') d = [...d, value(args[++a])];
        else if (f.startsWith('--git-dir=')) d = [...d, args[a].dyn ? null : path(f.slice(10))];
        else if (GIT_VALUE_FLAGS.has(f)) a++;
      }
      const sub = args[a]?.t;
      if (sub === 'push' || sub === 'merge') ops.push({ kind: sub, dirs: d, args: args.slice(a + 1) });
    } else if (name === 'gh' || name === 'gh.exe') {
      const pos = [];
      let repo = ghEnv;
      for (let a = 0; a < args.length; a++) {
        const f = args[a].t;
        if (f === '-R' || f === '--repo') repo = args[++a]?.t ?? '';
        else if (f.startsWith('--repo=')) repo = f.slice(7);
        else if (f.startsWith('-R')) repo = f.slice(2);
        else pos.push(args[a]);
      }
      if (pos[0]?.t === 'pr' && pos[1]?.t === 'merge') {
        const url = pos.slice(2).map((w) => w.t.match(/([^/]+\/[^/]+)\/pull\/\d+/)).find(Boolean);
        ops.push({ kind: 'gh', dirs, args: [], repo: (repo || url?.[1] || '').split('/').slice(-2).join('/') });
      }
    }
  }
  return ops;
}

/** @param {ReturnType<typeof parse>[number]} op @param {string} prefix @param {string} [current] current branch, empty when detached @returns {string | null} what it would do, or null to allow */
export function judge(op, prefix, current = '') {
  const outside = (b) => !b.startsWith(prefix);
  const onCurrent = (verb) => (current && outside(current) ? `git ${verb} ${current}` : null);
  if (op.kind === 'gh') return 'gh pr merge';
  if (op.kind === 'merge') return op.args.some((w) => is(w.t, '--abort', '--quit')) ? null : onCurrent('merge into');

  const pos = [];
  let del = false, tags = false;
  for (let a = 0; a < op.args.length; a++) {
    const w = op.args[a], t = w.t;
    if (t === '--') { pos.push(...op.args.slice(a + 1)); break; }
    if (w.dyn || !t.startsWith('-')) { pos.push(w); continue; }
    if (is(t, '--all', '--mirror', '--branches')) return `git push ${t}`;
    if (is(t, '--tags')) tags = true;
    else if (is(t, '--delete')) del = true;
    else if (is(t, '--repo', '--receive-pack', '--exec', '--push-option')) a++;
    else if (new RegExp(`^-${SHORT_PUSH}*o$`).test(t)) a++;
    else if (new RegExp(`^-${SHORT_PUSH}+$`).test(t) && t.includes('d')) del = true;
  }
  const specs = pos.slice(1); // the first is the remote; a URL decides nothing
  if (!specs.length) return tags || del ? null : onCurrent('push from');
  for (let s = 0; s < specs.length; s++) {
    if (specs[s].dyn) continue;
    if (specs[s].t === 'tag' && !del) { s++; continue; } // `git push origin tag v1` names a tag
    const spec = specs[s].t.replace(/^\+/, ''), colon = spec.lastIndexOf(':');
    const dst = colon < 0 ? spec : spec.slice(colon + 1) || spec.slice(0, colon);
    if (!dst) return 'git push origin : (every matching branch)';
    if (dst === 'HEAD' || dst === '@') { const why = onCurrent('push from'); if (why) return why; continue; }
    if (dst.startsWith('refs/') && !dst.startsWith('refs/heads/')) continue; // tags and the like are no branch
    const branch = dst.replace(/^refs\/heads\//, '');
    if (!outside(branch)) continue;
    const verb = del || (colon === 0) ? 'git push --delete' : 'git push to';
    return `${verb} ${branch}${colon < 0 && !del ? ` (if ${branch} is a tag, write refs/tags/${branch})` : ''}`;
  }
  return null;
}

/** @param {string} why @param {string} prefix */
export const reason = (why, prefix) => `Desk rule, this repo has merge "review": ${why} is refused. Work on a ${prefix}* branch and run \`desk wt merge <slug>\`; a person merges on the server.`;

/** The pure verdict, for one repo of the given prefix. @returns {string | null} */
export function verdict(cmd, { prefix = 'agent/', current = '', shell = 'Bash' } = {}) {
  for (const op of parse(cmd, shell)) { const why = judge(op, prefix, current); if (why) return why; }
  return null;
}

// The hook's cheap test before it starts Node, so without the quoting a shell removes: `pu''sh` and `pu$''sh` are push.
/** @param {string} cmd */
export const mentions = (cmd) => /\b(push|merge)\b/.test(cmd.replace(/[\\`]\r?\n|\$(?=['"])|['"`\\\u2018-\u201F]/g, ''));

const P = 'PowerShell';
/** @type {[string, string, boolean, string?][]} command, current branch ('' is detached), should it be refused, shell */
export const CASES = [
  ['rtk git push origin main', 'agent/x', true],
  ['rtk bypass git push origin main', 'agent/x', true],
  ['rtk proxy git push origin main', 'agent/x', true],
  ['rtk -v bypass --skip-env git push origin main', 'agent/x', true],
  ['rtk git push origin main', 'agent/x', true, 'PowerShell'],
  ['rtk bypass git push origin main', 'agent/x', true, 'PowerShell'],
  ['rtk gh pr merge 1', 'agent/x', true],
  ['rtk git merge agent/y', 'main', true],
  ['X=1 rtk git push origin main', 'agent/x', true],
  ['cd /tmp && rtk git push origin main', 'agent/x', true],
  ['rtk git push origin agent/x', 'agent/x', false],
  ['rtk bypass git push origin agent/x', 'agent/x', false],
  ['rtk git status', 'main', false],
  ['bypass git push origin main', 'agent/x', false], // not rtk: an unknown program
  ['rtk grep "git push origin main" .', 'agent/x', false],
  ['timeout 60 git push origin main', 'agent/x', true],
  ['timeout -k 5 60 git push origin main', 'agent/x', true],
  ['timeout 60 git push origin agent/x', 'agent/x', false],
  ['git --attr-source HEAD push origin main', 'agent/x', true],
  ['git push origin agent/x,main', 'agent/x', false, 'PowerShell'], // PowerShell hands git one argument
  // D4, on an agent branch
  ['git push origin agent/x', 'agent/x', false], ['git push -u origin agent/x', 'agent/x', false], ['git push --force origin agent/x', 'agent/x', false],
  ['git push --force-with-lease origin agent/x', 'agent/x', false], ['git push origin agent/main', 'agent/x', false],
  ['git push origin HEAD:main', 'agent/x', true], ['git push origin agent/x:main', 'agent/x', true], ['git push origin +HEAD:refs/heads/main', 'agent/x', true],
  ['git push origin :main', 'agent/x', true], ['git push origin --delete main', 'agent/x', true], ['git push --delete origin main', 'agent/x', true], ['git push -d origin main', 'agent/x', true],
  ['git push origin main', 'agent/x', true], ['git push https://host/r.git main', 'agent/x', true],
  ['git push --all', 'agent/x', true], ['git push origin --mirror', 'agent/x', true], ['git push --branches origin', 'agent/x', true],
  ['git push origin refs/tags/x', 'agent/x', false], ['git push origin HEAD:refs/tags/x', 'agent/x', false], ['git push origin :refs/tags/x', 'agent/x', false], ['git push origin --delete refs/tags/x', 'agent/x', false],
  ['git push --tags', 'main', false], ['git push origin --tags', 'main', false], ['git push origin main --tags', 'agent/x', true], ['git push origin v1.2', 'agent/x', true],
  ['cd ../main && git push origin main', 'agent/x', true], ['git -C ../main push origin main', 'agent/x', true], ['a; git push origin main', 'agent/x', true],
  // No refspec: the current branch decides, a detached head passes
  ['git push', 'main', true], ['git push origin', 'main', true], ['git push origin HEAD', 'main', true], ['git push', 'release/1', true], ['git push origin @', 'main', true], ['git push origin HEAD:', 'main', true],
  ['git push', 'agent/x', false], ['git push origin', 'agent/x', false], ['git push origin HEAD', 'agent/x', false], ['git push -u origin HEAD', 'agent/x', false], ['git push', '', false], ['git push origin HEAD', '', false], ['git push origin main', '', true],
  ['git push --follow-tags', 'main', true], ['git push --follow-tags origin agent/x', 'main', false],
  // Merge
  ['git merge origin/main', 'agent/x', false], ['git merge agent/x', 'main', true], ['git merge agent/x', 'release/1', true], ['git merge --abort', 'main', false], ['git merge --quit', 'main', false], ['git merge --continue', 'main', true], ['git merge', '', false],
  ['git merge-base main agent/x', 'main', false], ['git merge-tree a b', 'main', false], ['git merge-file a b c', 'main', false],
  // gh
  ['gh pr merge', 'agent/x', true], ['gh pr merge 12 --squash', 'agent/x', true], ['gh pr --repo o/r merge 1', 'agent/x', true], ['gh pr view 12', 'main', false], ['gh pr list --search merge', 'main', false], ['gh.exe pr merge 1', 'agent/x', true],
  // Quoted text, comments, heredocs
  ['git commit -m "git push origin main"', 'main', false], ["git commit -m 'git merge x; git push origin main'", 'main', false], ['echo "a; git push origin main"', 'main', false],
  ['git status # git push origin main', 'main', false], ['# git push origin main', 'main', false], ['git push origin agent/x # main', 'agent/x', false], ['git log --grep=x#git', 'main', false],
  ["git commit -F - <<'EOF'\ngit push origin main\nEOF", 'main', true], ['git commit -m "$(cat <<\'EOF\'\ngit push origin main\nEOF\n)"', 'main', true], // D4's false positive
  ["bash <<'EOF'\ngit push origin main\nEOF", 'agent/x', true], ['bash <<EOF\ngit push origin main', 'agent/x', true], ["cat <<EOF\nit's\ngit push origin main\nEOF", 'agent/x', true],
  ["git commit -F - <<'EOF'\nit's about the push to main\nEOF", 'main', false], ["git commit -F - <<'EOF'\nsay git push origin main\nEOF", 'main', false],
  ['sudo -k git push origin main', 'agent/x', true], ['sudo -s git push origin main', 'agent/x', true], ['sudo -n git push origin main', 'agent/x', true], ['sudo -u bob git push origin main', 'agent/x', true], ['xargs -n 1 git push origin main', 'agent/x', true], ['nice -n 5 git push origin main', 'agent/x', true], ['env -u X git push origin main', 'agent/x', true],
  ['git commit -m "$(cat <<\'EOF\'\nDon\'t (merge\nEOF\n)" && git push origin main', 'agent/x', true], ["git commit -F - <<EOF\nit's\nEOF\ngit push origin main", 'agent/x', true], ["cat <<-E\n\tx'\n\tE\ngit push origin main", 'agent/x', true],
  // Hostile quoting
  ['"git" "push" origin main', 'agent/x', true], ["g''it pu''sh origin ma''in", 'agent/x', true], ['git pu\\sh origin m\\ain', 'agent/x', true], ['git push origin "main"', 'agent/x', true], ["git push origin 'HEAD:main'", 'agent/x', true], ["git push origin $'main'", 'agent/x', true],
  ['git \\\n  push \\\n  origin main', 'agent/x', true], ['git pu\\\nsh origin main', 'agent/x', true], ['git push origin agent/x{,:main}', 'agent/x', true], ['git push origin HEAD@{1}:main', 'agent/x', true],
  ['git push origin "agent/x"', 'main', false], ['git push origin "agent/$SLUG"', 'main', false], ['git push origin $BRANCH', 'main', false], ['git push origin "$(git branch --show-current)"', 'main', false], ['git push "$REMOTE" agent/x', 'main', false],
  ['git push origin "unterminated', 'main', false], ['git merge "open', 'main', false],
  ["git commit -m $'it\\'s done' && git push origin main", 'main', true], ["git commit -m $'a\\\\' && git push origin main", 'agent/x', true], ["git push origin $'main\\'", 'agent/x', false], ["git commit -m 'it\\' && git push origin main", 'agent/x', true], // $'' takes \' and \\, '' does not
  ["git pu$''sh origin main", 'agent/x', true], ['git pu$""sh origin main', 'agent/x', true],
  // Chains, groups and wrappers
  ['git add . && git commit -m x && git push origin main', 'agent/x', true], ['true || git push origin main', 'agent/x', true], ['echo hi | git push origin main', 'agent/x', true], ['sleep 1 & git push origin main', 'agent/x', true], ['echo a\ngit push origin main', 'agent/x', true],
  ['(git push origin main)', 'agent/x', true], ['{ git push origin main; }', 'agent/x', true], ['if git push origin main; then echo ok; fi', 'agent/x', true], ['for b in x; do git push origin main; done', 'agent/x', true], ['! git push origin main', 'agent/x', true], ['echo $(git push origin main)', 'agent/x', true], ['echo `git push origin main`', 'agent/x', true], ['echo "$(git push origin main)"', 'agent/x', true],
  ['X=1 Y="a b" git push origin main', 'agent/x', true], ['env git push origin main', 'agent/x', true], ['env -u A X=1 git push origin main', 'agent/x', true], ['command git push origin main', 'agent/x', true], ['/usr/bin/git push origin main', 'agent/x', true], ['"C:\\Program Files\\Git\\cmd\\git.exe" push origin main', 'agent/x', true],
  ['git -c a.b=c push origin main', 'agent/x', true], ['git --git-dir=.git push origin main', 'agent/x', true], ['git --no-pager -C x push origin main', 'agent/x', true],
  // Redirections and option values are no refspec
  ['git push origin agent/x 2>&1 | tail -n 3', 'agent/x', false], ['git push origin agent/x > log.txt', 'agent/x', false], ['git push origin agent/x &> log.txt', 'agent/x', false], ['git push origin agent/x 2>/dev/null', 'agent/x', false], ['git push origin main 2>&1', 'agent/x', true],
  ['git push -o ci.skip origin agent/x', 'agent/x', false], ['git push --push-option=x origin agent/x', 'agent/x', false], ['git push --repo origin agent/y agent/x', 'agent/x', false], ['git push -uo ci.skip origin agent/x', 'agent/x', false], ['git push -o x origin main', 'agent/x', true],
  // Refspec shapes
  ['git push origin :', 'agent/x', true], ['git push origin +main', 'agent/x', true], ['git push origin agent/x main', 'agent/x', true], ['git push origin refs/heads/main', 'agent/x', true], ['git push origin refs/heads/agent/x', 'main', false], ['git push origin agent/*:agent/*', 'main', false], ['git push origin refs/heads/*:refs/heads/*', 'agent/x', true], ['git push origin main:agent/x', 'main', false], ['git push origin agent/x:', 'main', false], ['git push origin tag v1.2', 'main', false], ['git push origin refs/notes/x', 'main', false],
  ['git push origin -- main', 'agent/x', true], ['git push --del origin main', 'agent/x', true], ['git push --mir', 'agent/x', true], ['git push -fd origin main', 'agent/x', true], ['git push origin agent/main:agent/x', 'main', false],
  // Not a push: `push` or `merge` as an argument or another tool
  ['git stash push -m x', 'main', false], ['git log --merges', 'main', false], ['docker push main', 'main', false], ['npm run merge', 'main', false], ['echo git push origin main', 'main', false], ['git commit -m push', 'main', false], ['pushd x', 'main', false],
  // PowerShell: backslash is literal, the backtick escapes, ; chains, &-call
  ['Set-Location C:\\x\\main; git push origin main', 'agent/x', true, P], ['cd C:\\x; git.exe push origin main', 'agent/x', true, P], ['git.exe push origin main', 'agent/x', true, P], ['GIT.EXE push origin main', 'agent/x', true, P], ['& "C:\\Program Files\\Git\\cmd\\git.exe" push origin main', 'agent/x', true, P], ['& git push origin main', 'agent/x', true, P],
  ['Set-Location -Path C:\\x; git push origin agent/x', 'agent/x', false, P], ['git push origin agent/x; if ($?) { git push origin main }', 'agent/x', true, P], ['if ($?) { git push origin main}', 'agent/x', true, P], ['try { git push origin main } catch {}', 'agent/x', true, P], ['$out = git push origin main 2>&1', 'agent/x', true, P], ['git push origin agent/x *>&1', 'agent/x', false, P], ['git push origin agent/x 2>$null', 'agent/x', false, P],
  ['git push origin ma`in', 'agent/x', true, P], ["git push origin ma'in'", 'agent/x', true, P], ['git pu`sh origin main', 'agent/x', true, P], ['git `\n push `\n origin main', 'agent/x', true, P], ['git push origin \u201Cmain\u201D', 'agent/x', true, P], ['git --% push origin main', 'agent/x', true, P], ['git push origin $env:BRANCH', 'main', false, P], ['git push origin "agent/$slug"', 'main', false, P],
  ['git commit -m "git push origin main"', 'main', false, P], ["git commit -m 'it''s git push origin main'", 'main', false, P], ['git commit -m "a`"; git push origin main"', 'main', false, P], ["git commit -m @'\nDon't git push origin main\n'@", 'main', false, P], ["git commit -m @'\nDon't\n'@; git push origin main", 'agent/x', true, P], ['git commit -m @"\nDon\'t\n"@; git push origin main', 'agent/x', true, P],
  ['git merge --abort; git push origin agent/x', 'main', false, P], ['gh pr merge 12', 'agent/x', true, P],
  ['$out=git push origin main', 'agent/x', true, P], ['$out= git push origin main', 'agent/x', true, P], ['$out =git push origin main', 'agent/x', true, P], ['$env:X=git push origin main', 'agent/x', true, P], ['$out=git push origin agent/x', 'agent/x', false, P], ['$out=git status', 'main', false, P], ['$a=1; git push origin agent/x --force=$b', 'agent/x', false, P],
];
