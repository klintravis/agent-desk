// Refuse shell-scripted file edits (sed -i, heredoc into a file, python/node replace scripts); agents
// break files with them again and again (quote/escape mangling, \f -> form feed, CRLF).
// Shared, Node-free: the mod's tool.call hook and scripts/edit-guard.mjs (settings hook) both import it.

// A heredoc's body is text, not commands; it may hold apostrophes that would shift the quote pairing.
const HEREDOC_BODY = /(<<-?\s*(['"]?)(\w+)\2[^\n]*)(\n[\s\S]*?^[ \t]*\3[ \t]*$)/gm;
// Quoted text. PowerShell here-strings come first, since they hold apostrophes.
const STRING = /@'\r?\n[\s\S]*?\r?\n'@|@"\r?\n[\s\S]*?\r?\n"@|"(?:\\[\s\S]|[^"\\])*"|'[^']*'/g;
// One left-to-right pass, so a # in a string stays and an apostrophe in a comment opens no string.
const COMMENT = new RegExp(`(${STRING.source})|(?<![^\\s;&|()])#[^\\n\\0]*`, 'g'); // stops at NUL: a heredoc's placeholder ends the opener's line
// One command: the text between ; & | ( ) and newlines outside quotes. A stray quote is an ordinary character.
const SEGMENT = new RegExp(`(?:${STRING.source}|[^;&|()\\n])+`, 'g');
const SED = /^\s*(?:(?:do|then|else|if|elif|while|until|sudo|env|command|exec|time|!|\{|\w+=\S*|xargs(?:\s+-\S+)*)\s+)*(?:\S*[\\/])?sed(?:\.exe)?\s(?:[\s\S]*\s)?(?:-[a-zA-Z]*i|--in-place)/;
const HEREDOC_INTO_FILE = /\bcat\s*>>?\s*\S+\s*<<|<<-?\s*\w+\s*>>?\s*\S/;
const PY_STDIN = /(?<![\w.-])(?:py|python3?)(?:\.exe)?\s+-\s*<</;
const PY_C = /(?<![\w.-])(?:py|python3?)(?:\.exe)?(?:\s+-\S+)*?\s+-\w*c\b/;
const NODE_E = /(?<![\w.-])node(?:\.exe)?(?:\s+-\S+)*?\s+(?:-\w*e|--eval)\b/;

/**
 * Judged per command segment, on text with quoted strings blanked: a harmless call and an unrelated
 * edit-looking word in another segment, or in a commit message, pass.
 * shortcut: misses find -exec, xargs -I {} sed, perl -i, tee, python <<EOF, bash <<EOF, a shell -c behind a prefix or path (sudo bash -c, /bin/bash -c), cmd /c strings, pwsh -c strings, \" inside a bash -c string (not unescaped) and PowerShell's Set-Content, add them when an agent is seen using them.
 * shortcut: quotes follow bash, so PowerShell's "C:\x\" (a closed string there) stays open and can shift the segments after it, a backtick continuation is not joined, a line ending in \ joins the next there too (cd C:\x\ then sed -i on the next line passes), and the PowerShell-only @'...'@ here-string is also read on Bash, pass the tool to verdict if that bites. A heredoc body counts for the last segment of its opener line, so a pipe after the opener can move it off the interpreter that reads it.
 * @param {string} cmd @returns {string | null} what kind of edit it is, or null to allow
 */
export function verdict(cmd) {
  const bodies = [];
  const text = cmd
    .replace(HEREDOC_BODY, (_m, open, _q, _tag, body) => `${open}\0${bodies.push(body) - 1}\0`)
    .replace(COMMENT, (_m, s) => s ?? '')
    .replace(/(?<!\\)((?:\\\\)*)\\\r?\n/g, '$1 '); // after the comments: a comment does not continue over a line; an escaped backslash continues nothing
  for (const seg of text.match(SEGMENT) ?? []) {
    const bare = seg.replace(STRING, '_');
    // The segment as written: a heredoc body is no command, but it can be the script an interpreter runs.
    const script = seg.replace(/\0(\d+)\0/g, (_m, i) => bodies[i]);
    const inner = /^\s*(?:ba|z)?sh\s+-\w*c\s+(["'])([\s\S]*)\1\s*$/.exec(script);
    const nested = inner && verdict(inner[2]);
    if (nested) return nested;
    if (SED.test(bare)) return 'sed -i';
    if (HEREDOC_INTO_FILE.test(bare)) return 'heredoc into a file';
    if (PY_STDIN.test(bare) || (PY_C.test(bare) && /\bwrite|open\([^)]*['"]w/.test(script))) return 'python edit script';
    if (NODE_E.test(bare) && script.includes('writeFileSync') && !/settings\.local\.json|worktree-settings/.test(script)) return 'node -e edit script';
  }
  return null;
}

/** @param {string} why */
export const reason = (why) => `Desk rule: no ${why} for file edits (it keeps mangling quotes, escapes and line endings here). Use the Edit tool (or Write for a new file) instead.`;

/** @type {[string, boolean][]} command, should it be blocked */
export const CASES = [
  ["sed -i 's/a/b/' x.ts", true], ["sed -n 2p x.ts", false], ["cat >> f.ts <<'EOF'\nx\nEOF", true],
  ["git commit -F - <<'EOF'\nmsg\nEOF", false], ["python - <<'EOF'\nopen('a','w')\nEOF", true],
  ["node -e \"require('fs').writeFileSync('a','b')\"", true], ["node -e \"console.log(1)\"", false],
  ["grep -n foo x.ts", false], ['echo "blocked a sed -i test" >> log.md', false], ['echo "| 7 blocks (sed -i, heredoc) |" >> log.md', false],
  ["cd x && sed -i 's/a/b/' f", true], ["find . -name '*.ts' | xargs sed -i 's/a/b/'", true], ["npm run check > /tmp/chk.log 2>&1", false],
  // Refused: forms that used to pass.
  ["sed -E -i 's/a/b/' f", true], ["sed -Ei 's/a/b/' f", true], ["sed -e 's/a/b/' -i f", true],
  ["for f in *; do sed -i 's/a/b/' $f; done", true], ["  sed -i 's/a/b/' f", true], ["cd x\n  sed -i 's/a/b/' f", true],
  ["(sed -i 's/a/b/' f)", true], ["if true; then sed -i 's/a/b/' f; fi", true], ["bash -c \"sed -i 's/a/b/' f\"", true],
  ["py -c \"open('a','w')\"", true], ["py -3 -c \"open('a','w')\"", true], ["node --eval \"require('fs').writeFileSync('a','b')\"", true],
  ["& node -e \"require('fs').writeFileSync('a','b')\"", true],
  // A separator inside the quoted script must not cut the write out of the interpreter's segment.
  ["python -c \"import os; open('a','w')\"", true], ["node -e \"const fs=require('fs'); fs.writeFileSync('a','b')\"", true],
  ["python -c \"print(1)\" && python -c \"open('a','w')\"", true], ["node -e \"1\" && node -e \"require('fs').writeFileSync('a','b')\"", true],
  ["bash -c \"python -c 'open(1,\\\"w\\\")'\"", true], ["uv run python -c \"open('a','w')\"", true],
  // A comment is not a command, and its apostrophe opens no string.
  ["# don't touch the header\nsed -i 's/a/b/' f", true], ["# it's a fix\nnode -e \"require('fs').writeFileSync('a','b')\"", true],
  ["# avoid (sed -i here)\ngit status", false], ["git status # don't\nsed -i 's/a/b/' f", true], ["# a \\\nsed -i 's/a/b/' f", true],
  ['echo "# not a comment; it\'s" && sed -i x f', true], ["echo a#b'; sed -i x f'", false],
  // An interpreter's script in a heredoc still counts as its script.
  ["node -e \"$(cat <<'EOF'\nconst fs=require('fs');\nfs.writeFileSync('a','b')\nEOF\n)\"", true],
  ["python -c \"$(cat <<'EOF'\nopen('a','w').write('x')\nEOF\n)\"", true],
  ["git commit -m \"$(cat <<'EOF'\nsed -i and writeFileSync\nEOF\n)\"", false],
  ["python -c \"print(1)\" && git commit -F - <<'EOF'\nrewrite\nEOF", false],
  ["bash -c 'node -e \"$(cat <<EOF\nwriteFileSync\nEOF\n)\"'", true],
  ["node -e \"$(cat)\" <<'EOF' # x\nrequire('fs').writeFileSync('a','b')\nEOF", true],
  // A backslash at the end of a line continues the command.
  ["node -e \\\n\"require('fs').writeFileSync('a','b')\"", true], ["sed \\\r\n  -i 's/a/b/' f", true], ["ls C:\\\\\nsed -i x f", true],
  // Spellings the spec promises.
  ["sed --in-place f", true], ["sudo sed -i x f", true], ["FOO=1 sed -i x f", true], ["xargs -0 sed -i x", true], ["sh -c \"sed -i x f\"", true],
  // Allowed: the verdict is per segment, and quoted text is not a command.
  ['python -c "print(1)" && git commit -m "rewrite x"', false], ['node -e "console.log(1)" && grep writeFileSync x', false],
  ['python -c "print(\'rewrite\')"', false], ['git commit -m "python -c \'open(1,w)\' and node -e writeFileSync"', false],
  ['git commit -m "fix\nsed -i at the start of a line\ncat > f <<EOF"', false], ['grep -E "a|sed -i|b" f', false],
  ["git commit -F - <<'EOF'\ndon't use this:\nsed -i no more\nEOF", false], ["git commit -m @'\ndon't; sed -i no more\n'@", false],
  ['sed -n "s/-i/x/p" f', false], ["sed -n 2p f | grep -i x", false], ['python x.py -c "rewrite"', false],
  ["node -e \"require('fs').writeFileSync('.claude/settings.local.json','{}')\"", false],
];
