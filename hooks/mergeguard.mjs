// The merge guard's rule: under `merge: review`, no shell command pushes to, deletes or merges into a
// branch outside the repo's branchPrefix, and no `gh pr merge`. A guardrail, not a wall: the server rule
// is the wall. Not seen, all of it allowed: `bash -c`, `eval`, `Invoke-Expression`, scripts, aliases,
// `$VAR` and `$(...)` as names, `gh api`, `rtk run`, bash `git {push,} origin main`, `a[ 0 ]=x git push`, `a[x y]=x git push`, `a["]"]=x git push`, `a[b[0]]=x git push`, `env GH_REPO=o/a GH_REPO+=b gh pr merge` (env sets `GH_REPO+`, read here as an append), `GH_REPO=o/a env GH_REPO+=b gh pr merge 1`, `echo ${x:-$(git push)}`,
// `echo ${x:-'}'}; git push #'` (a `${...}` ends at its first `}`, whatever the quotes),
// `` echo `echo '`; git push; echo `echo '` `` (a backtick body with an odd quote is read past its backtick), PowerShell
// `[string] $x = git push`, `$a[$i + 1] = git push`, `$a[ 0 ] = git push`, `($a,$b) = git push`, `$o.($k) = git push`,
// `$o[($k)] = git push`, `[Console]::Title = git push`, `$a <# x #> = git push`, `<# x #> git push`, `return git push`,
// `$(git push)` inside `@"..."@`, `@{ x = git push }` and its family (a PowerShell hashtable value whose key is only a `$(...)`, sits in parentheses, or has no `$`: `@{ "$(a)" = git push origin main }`, `@{ "$()" = ... }`, `@{ ("$x") = ... }`, `@{ "x" = ... }`, `@{ $() = ... }`), `. git push` and PowerShell 7's "pu`u{73}h".
// A line the parser cannot read is refused when it names push or merge, or has a backslash after $'. A line it misreads but can read is judged as read, so a parser miss can still be a bypass.
// A known false positive, refused though git never runs: `"$x y" = git push` (PowerShell rejects the target) and `& "$x y" = git push` (`&` calls the string). A lone string reads the same as a hashtable key, `@{ "$x" = git push }`, which does run git.
// Shared, Node-free. This file reads the command; scripts/merge-guard.mjs maps its directories to repos.

// shortcut: a `cd` counts as run, even one behind `&`, a pipe or a failed `&&`, and `popd` and `cd -` are not followed; the server rule covers those.

const WRAPPERS = new Set(['command', 'env', 'exec', 'builtin', 'coproc', 'nohup', 'time', 'timeout', 'nice', 'sudo', 'xargs', 'rtk', 'if', 'then', 'do', 'else', 'elif', 'while', 'until', '!']);
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

const ANSI_PLAIN = { a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
const ANSI_ESCAPE = /\\(?:([0-7]{1,3})|x\{([\da-fA-F]*)\}?|x([\da-fA-F]{1,2})|u([\da-fA-F]{1,4})|U([\da-fA-F]{1,8})|c(\\\\|[^])|([^]))/g;

/** The body of a bash `$'...'`, decoded as bash does. Never throws: `parse` refuses a line it cannot read, and these all are readable. */
function ansiC(body) {
  const text = body.replace(ANSI_ESCAPE, (all, oct, brace, hex, u, U, ctl, other) => {
    if (oct) return String.fromCharCode(parseInt(oct, 8) & 0xff); // \563 wraps to s
    if (brace !== undefined || hex) return String.fromCharCode(parseInt((brace ?? hex).slice(-2) || '0', 16)); // \x{173} wraps to s
    if (u || U) { const v = parseInt(u ?? U, 16); return v >= 0x80000000 ? '' : String.fromCodePoint(Math.min(v, 0x10ffff)); } // past 0x10ffff bash writes bytes no name can use; fromCodePoint would throw
    if (ctl) return ctl === '?' ? '\x7f' : String.fromCharCode(ctl.toUpperCase().charCodeAt(0) & 0x1f);
    return ANSI_PLAIN[other] ?? all; // an unknown escape keeps its backslash
  });
  const nul = text.indexOf('\0'); // ends this $'...' piece only: pu$'\0zz'sh is push
  return nul < 0 ? text : text.slice(0, nul);
}

// PowerShell: only assignment targets so far (`$a`, `$a,$b`, `$a ,, $b`), so this `=` assigns, and `+=` and the like with it.
function assigning(seg, w) {
  const run = w ? [...seg, { ...w, t: w.t.replace(/(?:[-–—―+*/%]|\?\?)$/, '') }] : seg; // PowerShell reads these dashes as a hyphen
  const words = run.filter((x) => x.t);
  return words.some((x) => x.dyn) && words.every((x) => x.dyn || /^,+$/.test(x.t)) && words.every((x, i) => i === 0 || x.t.startsWith(',') || words[i - 1].t.endsWith(','));
}

/** Words per command, with '(' and ')' around a subshell. Throws on what it reads as an unterminated quote, which the shell may read otherwise: `${x:-'}'}`. */
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
    // Bash takes one level of backslashes off a backtick body before reading it: \\ \` \$, and \" inside "...".
    const backtick = (quoted) => {
      const from = ++i;
      let body = '', inner;
      for (; i < s.length && s[i] !== '`'; i++) {
        if (s[i] === '\\' && (quoted ? /[\\`$"]/ : /[\\`$]/).test(s[i + 1] ?? '')) i++;
        body += s[i] ?? '';
      }
      // shortcut: a body with an odd quote is read in place, its quote running past the backtick, so what it refuses stays as it was; upgrade with the T-151 ruling.
      try { inner = scan(body, ps); } catch { i = from; subst('`'); return; }
      i++; add(''); w.dyn = true;
      out.push('(', ...inner, ')');
    };
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
        else if (!ps && c === '`') backtick(true);
        else { if (c === '$') w.dyn = true; add(c); i++; }
      }
      throw new Error('unterminated quote');
    };
    // Each heredoc line reads as a command, since `bash <<EOF` runs them (text that looks like one is D4's false positive).
    // In a child shell: its `cd` ends with it. A stray apostrophe ends only its own line.
    // shortcut: an unreadable body line stays unseen, or prose with an apostrophe would be refused, so a quote spanning two lines hides a push there; upgrade by telling a body fed to a shell from data.
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
        add(ansiC(s.slice(from, i))); i++;
      }
      else if (!ps && c === '$' && n === '"') i++; // $"x" is quoting, not a variable
      // What a PowerShell assignment runs starts after it, spaced or glued: `$out=git` is `$out = git`.
      else if (ps && c === '=' && !skip && assigning(seg, w)) { seg = []; w = null; i++; }
      else if (c === '$' && n === '(') { i += 2; subst(')'); }
      else if (c === '$' && n === '{') {
        const j = s.indexOf('}', i), stop = j < 0 ? s.length : j + 1;
        add(s.slice(i, stop)); w.dyn = true; i = stop;
      }
      else if (c === '$') { const two = n === '$'; add(two ? '$$' : c); w.dyn = true; i += two ? 2 : 1; } // $$ is the PID: a quote after it is a plain one
      else if (!ps && c === '`') backtick(false);
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
 * @returns {{ kind: 'push' | 'merge' | 'gh' | 'unreadable', dirs: (string | null)[], args: { t: string, dyn: boolean }[], repo?: string }[]} a null dir is not knowable here
 */
export function parse(cmd, shell) {
  const ps = /powershell/i.test(shell ?? '');
  const ops = [], stack = [];
  let dirs = [];
  // PowerShell takes \ as a path separator on every OS; / reads the same on Windows.
  const path = (t) => (ps ? t.replace(/\\/g, '/') : t);
  const value = (w) => (!w || w.dyn ? null : path(w.t));
  let segs;
  try { segs = scan(cmd, ps); } catch { return typeof cmd === 'string' && mentions(cmd) ? [{ kind: 'unreadable', dirs: [], args: [] }] : []; }
  for (const seg of segs) {
    if (seg === '(') { stack.push(dirs); continue; }
    if (seg === ')') { const before = stack.pop(); if (!ps) dirs = before; continue; } // bash subshell: its cd ends with it
    let k = 0, ghEnv = '', afterRtk = false;
    for (; k < seg.length; k++) {
      const t = seg[k].t;
      if (/^[A-Za-z_]\w*(?:\[[^\]]*\])?\+?=/.test(t)) { const m = /^GH_REPO\+?=(.*)/.exec(t); if (m) ghEnv = (t[7] === '+' ? ghEnv : '') + m[1]; continue; }
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
  if (op.kind === 'unreadable') return "a line that names push or merge, or has a backslash after $', and that the guard cannot read (check its quotes)";
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

/** @param {string} why @param {string} prefix @param {string} [where] */
export const reason = (why, prefix, where = 'this repo has merge "review"') => `Desk rule, ${where}: ${why} is refused. Work on a ${prefix}* branch and run \`desk wt merge <slug>\`; a person merges on the server.`;

/** The pure verdict, for one repo of the given prefix. @returns {string | null} */
export function verdict(cmd, { prefix = 'agent/', current = '', shell = 'Bash' } = {}) {
  for (const op of parse(cmd, shell)) { const why = judge(op, prefix, current); if (why) return why; }
  return null;
}

// The hook's cheap test before it starts Node, so without the quoting a shell removes: `pu''sh` and `pu$''sh` are push.
// A backslash after `$'` may spell either word; the script decodes it, and refuses the line when the parser then cannot read it.
/** @param {string} cmd */
export const mentions = (cmd) => /\$'[^\\]*\\/.test(cmd) || /\b(push|merge)\b/.test(cmd.replace(/[\\`]\r?\n|\$(?=['"])|['"`\\\u2018-\u201F]/g, ''));

const P = 'PowerShell';
/** @typedef {[string, string, boolean, string?]} Case command, current branch ('' is detached), should it be refused, shell */
// What bash decodes inside $'...'. The wrapping and NUL rows are what real bash printed, which the manual does not say.
/** @type {Case[]} */
export const ESCAPE_CASES = [
  // Hex, octal, unicode: the push is seen, and its agent-branch twin passes
  ["git pu$'\\x73'h origin main", 'agent/x', true], ["git pu$'\\x73'h origin agent/x", 'agent/x', false],
  ["git $'pu\\x73h' origin main", 'agent/x', true], ["git pu$'\\X73'h origin main", 'agent/x', false], // \X is no escape
  ["git pu$'\\163'h origin main", 'agent/x', true], ["git pu$'\\163'h origin agent/x", 'agent/x', false],
  ["git pu$'\\563'h origin main", 'agent/x', true], ["git pu$'\\1634'h origin main", 'agent/x', false], // \563 wraps to s; only three digits are read
  ["git pu$'\\u0073'h origin main", 'agent/x', true], ["git pu$'\\u0073'h origin agent/x", 'agent/x', false],
  ["git pu$'\\U00000073'h origin main", 'agent/x', true], ["git pu$'\\U00000073'h origin agent/x", 'agent/x', false],
  ["git pu$'\\x{73}'h origin main", 'agent/x', true], ["git pu$'\\x{173}'h origin main", 'agent/x', true], ["git pu$'\\x{74}'h origin main", 'agent/x', false],
  // Plain escapes, and the ones that stay as written
  ["git push origin $'HEAD:main\\n'", 'agent/x', true], ["git $'push\\n' origin main", 'agent/x', false], ["git push origin $'agent/x\\n'", 'agent/x', false],
  ["git pu$'\\s'h origin main", 'agent/x', false], ["git pu$'\\\\s'h origin main", 'agent/x', false], ["git $'pu\\xsh' origin main", 'agent/x', false], ["git $'pu\\ush' origin main", 'agent/x', false], ["git $'pu\\cAsh' origin main", 'agent/x', false],
  // NUL ends that one $'...' piece; a value UTF-8 cannot hold is dropped; none of it throws, since a throw refuses the line
  ["git pu$'\\0zz'sh origin main", 'agent/x', true], ["git $'push\\x00junk' origin main", 'agent/x', true], ["git $'pu\\0sh' origin main", 'agent/x', false], ["git $'pu\\c@sh' origin main", 'agent/x', false],
  ["git push origin $'main\\0:agent/x'", 'agent/x', true], ["git push origin $'agent/x\\0:main'", 'agent/x', false],
  ["git $'pu\\U80000000sh' origin main", 'agent/x', true], ["git $'pu\\U7FFFFFFFsh' origin main", 'agent/x', false],
  ["echo $'\\U00110000'; git push origin main", 'agent/x', true], ["echo $'\\U00110000'; git status", 'main', false],
  // Every word is decoded, not only the subcommand
  ["git push origin $'\\x6dain'", 'agent/x', true], ["git push origin $'agent/\\x78'", 'agent/x', false], ["$'\\x67it' push origin main", 'agent/x', true], ["gh pr $'merg\\x65' 1", 'agent/x', true], ["git $'merg\\x65' agent/y", 'main', true], ["git $'merg\\x65' agent/y", 'agent/x', false],
  ["git add . && git pu$'\\x73'h origin main", 'agent/x', true], ["bash <<'EOF'\ngit pu$'\\x73'h origin main\nEOF", 'agent/x', true],
  // Decoded text stays one word of data
  ["git commit -m $'pu\\x73h to main'", 'main', false], ["echo $'git\\x20push origin main'", 'agent/x', false], ["echo $'a\\x3b git push origin main'", 'agent/x', false], ["echo $'a\\n git push origin main'", 'agent/x', false],
  // Not $'...': nothing is decoded
  ["git commit -m \"git pu$'\\x73'h origin main\"", 'main', false], ["git commit -m 'git pu\\x73h origin main'", 'main', false], ['git pu\\x73h origin main', 'agent/x', false], ["git 'pu\\x73h' origin main", 'agent/x', false], ['git "pu\\x73h" origin main', 'agent/x', false],
  ["git pu$'\\x73'h origin main", 'agent/x', false, P], // PowerShell has no $'...'
  ["git pu$'\\0zz'sh origin agent/x", 'agent/x', false],
  // $$ is the PID, so the quote after it is a plain ''
  ["echo $$'\\' ; git push origin main; echo '\\'", 'agent/x', true], ["echo $$'\\'; git push origin main #'", 'agent/x', true], ["echo $$'\\' ; git push origin agent/x; echo '\\'", 'agent/x', false], ["echo $$ '\\'", 'agent/x', false],
  // A backtick body loses one level of backslashes before it is read: \\ \` \$, and \" only inside "..."
  ["echo `git pu$'\\\\x73'h origin main`", 'agent/x', true], ["echo `git pu$'\\\\x73'h origin agent/x`", 'agent/x', false], ["echo `git pu$'\\x73'h origin main`", 'agent/x', true],
  ["echo \"`git pu$'\\\\x73'h origin main`\"", 'agent/x', true], ["echo \"`git pu$'\\\\x73'h origin agent/x`\"", 'agent/x', false], ["echo `git pu\\$'\\\\x73'h origin main`", 'agent/x', true],
  ['echo `git pu\\\\sh origin main`', 'agent/x', true], ['echo `git pu\\\\sh origin agent/x`', 'agent/x', false], ['echo "`git pu\\\\sh origin main`"', 'agent/x', true],
  ['echo "`git pu\\"\\"sh origin main`"', 'agent/x', true], ['echo "`git pu\\"\\"sh origin agent/x`"', 'agent/x', false], ['echo `git pu\\"\\"sh origin main`', 'agent/x', false],
  ['echo `echo \\`git push origin main\\``', 'agent/x', true], ['echo `echo \\`git push origin agent/x\\``', 'agent/x', false], ['echo `true # x`; git push origin main', 'agent/x', true],
  ['echo `git push origin main', 'agent/x', true], ['echo `git push origin agent/x', 'agent/x', false], // unclosed: not unreadable
];
// A PowerShell assignment runs its right side, whatever the operator and however many targets.
/** @type {Case[]} */
export const ASSIGN_CASES = [
  ['$a += git push origin main', 'agent/x', true, P], ['$a += git push origin agent/x', 'agent/x', false, P], ['$a += "git push origin main"', 'main', false, P], ['$a += git status', 'main', false, P],
  ['a+=x git push origin main', 'agent/x', true], ['a+=x git push origin agent/x', 'agent/x', false],
  ['$a+=git push origin main', 'agent/x', true, P], ['$a +=git push origin main', 'agent/x', true, P], ['$a+= git push origin main', 'agent/x', true, P], ['$a +=git push origin agent/x', 'agent/x', false, P],
  ['$a -= git push origin main', 'agent/x', true, P], ['$a *= git push origin main', 'agent/x', true, P], ['$a /= git push origin main', 'agent/x', true, P], ['$a %= git push origin main', 'agent/x', true, P], ['$a ??= git push origin main', 'agent/x', true, P],
  ['$a=$b=git push origin main', 'agent/x', true, P], ['$a=$b=git push origin agent/x', 'agent/x', false, P], ["$a=$b='git push origin main'", 'main', false, P], ['$a=$b=git status', 'main', false, P],
  ['$a = $b = git push origin main', 'agent/x', true, P], ['$a=$b += git push origin main', 'agent/x', true, P], ['$a = $b = $c = git push origin main', 'agent/x', true, P],
  ['$a,$b = git push origin main', 'agent/x', true, P], ['$a,$b = git push origin agent/x', 'agent/x', false, P], ['$a,$b = "git push origin main"', 'main', false, P], ['$a,$b = git status', 'main', false, P],
  ['$a,$b=git push origin main', 'agent/x', true, P], ['$a, $b = git push origin main', 'agent/x', true, P], ['$a , $b = git push origin main', 'agent/x', true, P], ['$a ,$b = git push origin main', 'agent/x', true, P], ['$a, $b, $c = git push origin main', 'agent/x', true, P],
  ['$a.b = git push origin main', 'agent/x', true, P], ['$a[0] = git push origin main', 'agent/x', true, P], ['if ($x) { $a += git push origin main }', 'agent/x', true, P], ['git status; $a,$b = git merge agent/y', 'main', true, P],
  ["$env:DESK_HOME = 'C:\\d'; node 'C:\\k\\bin\\desk.mjs' wt merge x", 'main', false, P],
  // A target with a space in it is one word
  ['${a b} = git push origin main', 'agent/x', true, P], ['${a b}=git push origin main', 'agent/x', true, P], ['$a, ${b c} = git push origin main', 'agent/x', true, P], ['${a b} = git push origin agent/x', 'agent/x', false, P],
  ['$h = @{}; $h["a b"] = git push origin main', 'agent/x', true, P], ["$h = @{}; $h['a b'] = git push origin main", 'agent/x', true, P], ['$h = @{}; $h."a b" = git push origin main', 'agent/x', true, P], ["$h = @{}; $h.'a b' = git push origin main", 'agent/x', true, P],
  // PowerShell reads an en dash, em dash or horizontal bar as a hyphen
  ['$a –= git push origin main', 'agent/x', true, P], ['$a —= git push origin main', 'agent/x', true, P], ['$a ―= git push origin main', 'agent/x', true, P], ['$a–=git push origin main', 'agent/x', true, P], ['$a –= git push origin agent/x', 'agent/x', false, P],
  // Empty target slots between commas
  ['$a ,, $b = git push origin main', 'agent/x', true, P], ['$a ,,, $b = git push origin main', 'agent/x', true, P], ['$a ,, $b = git push origin agent/x', 'agent/x', false, P],
  // A string with more glued to it is a target: real PowerShell ran git for both
  ['"$x".y = git push origin main', 'agent/x', true, P], ['"$x"[0] = git push origin main', 'agent/x', true, P], ['"$x y".z = git push origin main', 'agent/x', true, P],
  // A hashtable key starts a fresh segment, so it reads as a lone string: real PowerShell ran git for all of these
  ['@{ "$x" = git push origin main }', 'agent/x', true, P], ['@{ "$x y" = git push origin main }', 'agent/x', true, P], ['@{"$x"=git push origin main}', 'agent/x', true, P], ['@{ a=1; "$x y" = git push origin main }', 'agent/x', true, P], ['[pscustomobject]@{ "$x" = git push origin main }', 'agent/x', true, P],
  // The known false positive those force: real PowerShell rejects the first, `&` calls the string in the second, git never runs
  ['"$x y" = git push origin main', 'agent/x', true, P], ['& "$x y" = git push origin main', 'agent/x', true, P],
  // Commas with no target are a parse error: git never runs
  [',, = git push origin main', 'agent/x', false, P],
  // No assignment: the `=` is an argument
  ['echo $a += git push origin main', 'agent/x', false, P], ['echo a,b = git push origin main', 'agent/x', false, P], ['& $a $b = git push origin main', 'agent/x', false, P], ['$a $b = git push origin main', 'agent/x', false, P], ['foo $a,$b = git push origin main', 'agent/x', false, P],
  ['git commit -m "$a += git push origin main"', 'main', false, P], ['for ($i=0; $i -lt 1; $i+=1) { git push origin agent/x }', 'agent/x', false, P],
  // Bash reads all of these as a command named by the variable
  ['$a += git push origin main', 'agent/x', false], ['$a=$b=git push origin main', 'agent/x', false], ['$a,$b = git push origin main', 'agent/x', false],
];
// What the parser cannot read is refused if it names push or merge: bash runs the first row, and its directory is unread too.
/** @type {Case[]} */
export const UNREADABLE_CASES = [
  ["echo ${x:-'}'}; git push origin main", 'agent/x', true], ["echo ${x:-'}'}; git push origin agent/x", 'agent/x', true], ["echo ${x:-'}'}; git status", 'main', false],
  ['git push origin "unterminated', 'main', true], ['git merge "open', 'main', true], ["git push origin $'main", 'agent/x', true], ["git push origin $'main\\'", 'agent/x', true], ["git pu$'\\x73'h origin main; echo \"", 'agent/x', true],
  ["git push origin 'main", 'agent/x', true, P], ['git push origin "main', 'agent/x', true, P], ["$a += 'git push origin main", 'agent/x', true, P], ["@'\ngit push origin main", 'agent/x', true, P],
  ['gh pr merge "1', 'agent/x', true], ["echo ${x:-'}'} $'\\t'", 'agent/x', true],
  // A backtick body with an odd quote: refused and allowed as before it was read on its own
  ["echo `git push origin agent/x; echo '`", 'agent/x', true], ["echo `echo '` and `echo '` merge", 'agent/x', false], ["echo `echo '`; git push origin agent/x; echo `echo '`", 'agent/x', false],
  // No push or merge in it, and body lines that are mostly prose: allowed
  ['echo "open', 'main', false], ["echo 'open", 'main', false, P], ["echo $'open", 'main', false], ["cat <<EOF\ndon't push this\nEOF", 'main', false],
];
/** @type {Case[]} */
export const CASES = [
  ...ESCAPE_CASES, ...ASSIGN_CASES, ...UNREADABLE_CASES,
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
  ["git commit -m $'it\\'s done' && git push origin main", 'main', true], ["git commit -m $'a\\\\' && git push origin main", 'agent/x', true], ["git commit -m 'it\\' && git push origin main", 'agent/x', true], // $'' takes \' and \\, '' does not
  ["git pu$''sh origin main", 'agent/x', true], ['git pu$""sh origin main', 'agent/x', true],
  // Chains, groups and wrappers
  ['git add . && git commit -m x && git push origin main', 'agent/x', true], ['true || git push origin main', 'agent/x', true], ['echo hi | git push origin main', 'agent/x', true], ['sleep 1 & git push origin main', 'agent/x', true], ['echo a\ngit push origin main', 'agent/x', true],
  ['(git push origin main)', 'agent/x', true], ['{ git push origin main; }', 'agent/x', true], ['if git push origin main; then echo ok; fi', 'agent/x', true], ['for b in x; do git push origin main; done', 'agent/x', true], ['! git push origin main', 'agent/x', true], ['echo $(git push origin main)', 'agent/x', true], ['echo `git push origin main`', 'agent/x', true], ['echo "$(git push origin main)"', 'agent/x', true],
  ['a[0]=x git push origin main', 'agent/x', true], ['a[0]+=x git push origin main', 'agent/x', true], ['a[0]=x git push origin agent/x', 'agent/x', false],
  ['coproc git push origin main', 'agent/x', true], ['coproc git push origin agent/x', 'agent/x', false],
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
