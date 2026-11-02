// Refuse shell-scripted file edits (sed -i, heredoc into a file, python/node replace scripts); agents
// break files with them again and again (quote/escape mangling, \f -> form feed, CRLF).
// Shared, Node-free: the mod's tool.call hook and scripts/edit-guard.mjs (settings hook) both import it.

/** @param {string} cmd @returns {string | null} what kind of edit it is, or null to allow */
export function verdict(cmd) {
  // Command position only (start, after ; & | or xargs), so text that merely mentions it passes,
  // including "(sed -i, ...)" inside a quoted log line.
  if (/(^|[;&|]\s*|\bxargs\s+)sed\s+(-[a-zA-Z]*i|--in-place)/m.test(cmd)) return 'sed -i';
  if (/\bcat\s*>>?\s*\S+\s*<<|<<-?\s*['"]?\w+['"]?\s*>>?\s*\S/.test(cmd)) return 'heredoc into a file';
  if (/\bpython3?\s+-\s*<<|\bpython3?\s+-c\b[\s\S]*(write|open\([^)]*['"]w)/.test(cmd)) return 'python edit script';
  if (/\bnode\s+-e\b[\s\S]*writeFileSync/.test(cmd) && !/settings\.local\.json|worktree-settings/.test(cmd)) return 'node -e edit script';
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
];
