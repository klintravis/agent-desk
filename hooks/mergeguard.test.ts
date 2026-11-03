import { expect, test } from 'claude-code/testing'

import { CASES, mentions, parse } from './mergeguard.mjs'

const done = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const DENY = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'refused, see desk wt merge' } })

test('every command the guard would refuse passes the word test, so the hook starts the script', () => {
  for (const [command, , blocked] of CASES) if (blocked) expect([command, mentions(command)]).toEqual([command, true])
  for (const [command, , , shell] of CASES) if (parse(command, shell).length) expect([command, mentions(command)]).toEqual([command, true])
})

test('both shell tools ask the script from the session root with the tool directory, and deny what it denies', async ($, on) => {
  const asked: { argv: readonly string[]; cwd?: string; stdin?: string }[] = []
  on('process.run', (_, e) => {
    if (!e.argv.some((a) => a.endsWith('merge-guard.mjs'))) return done('/desk')
    asked.push({ argv: e.argv, cwd: e.init?.cwd, stdin: e.init?.stdin })
    return done(DENY)
  })
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/worktree' }))
  on('session.root', () => ({ value: '/desk' }))
  on('tool.call', () => ({ result: 'ran' }) as never)
  await $.session.start({ cwd: '/desk', surface: 'terminal', isInteractive: false })
  for (const tool of ['Bash', 'PowerShell']) {
    const r = await $.tool.call({ tool, command: 'git push origin main' } as never)
    expect('deny' in r && r.deny).toBe('refused, see desk wt merge')
    const last = asked.at(-1)!
    expect(last.cwd).toBe('/desk')
    expect(JSON.parse(last.stdin!)).toEqual({ cwd: '/worktree', tool_name: tool, tool_input: { command: 'git push origin main' } })
  }
})

test('a command without push or merge never starts the script', async ($, on) => {
  let scripts = 0
  on('process.run', (_, e) => { if (e.argv.some((a) => a.endsWith('merge-guard.mjs'))) scripts++; return done('/desk') })
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: 'ran' }) as never)
  await $.session.start({ cwd: '/desk', surface: 'terminal', isInteractive: false })
  for (const tool of ['Bash', 'PowerShell']) {
    const r = await $.tool.call({ tool, command: 'git status' } as never)
    expect('deny' in r).toBe(false)
  }
  expect(scripts).toBe(0)
})

test('a script that fails, times out or answers nonsense allows the command', async ($, on) => {
  const answers: (() => ReturnType<typeof done>)[] = [() => done('', 1), () => done('not json'), () => { throw new Error('timed out') }, () => done('{}')]
  let answer = answers[0]!
  on('process.run', (_, e) => (e.argv.some((a) => a.endsWith('merge-guard.mjs')) ? answer() : done('/desk')))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: 'ran' }) as never)
  await $.session.start({ cwd: '/desk', surface: 'terminal', isInteractive: false })
  for (const a of answers) {
    answer = a
    const r = await $.tool.call({ tool: 'PowerShell', command: 'git push origin main' } as never)
    expect('deny' in r).toBe(false)
  }
})

test('outside a desk the guard does nothing and starts no script', async ($, on) => {
  let scripts = 0
  on('process.run', (_, e) => { if (e.argv.some((a) => a.endsWith('merge-guard.mjs'))) scripts++; return done('', 1) })
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: 'ran' }) as never)
  await $.session.start({ cwd: '/elsewhere', surface: 'terminal', isInteractive: false })
  const r = await $.tool.call({ tool: 'Bash', command: 'git push origin main' } as never)
  expect('deny' in r).toBe(false)
  expect(scripts).toBe(0)
})
