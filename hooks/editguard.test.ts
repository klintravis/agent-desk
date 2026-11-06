import { expect, test } from 'claude-code/testing'

import { CASES } from './editguard.mjs'

test('in a desk, the edit guard denies shell-scripted edits and lets the rest run, on both shell tools', async ($, on) => {
  on('process.run', () => ({ value: { exitCode: 0, stdout: '/desk', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: 'ran' }) as never)
  await $.session.start({ cwd: '/desk', surface: 'terminal', isInteractive: false })
  for (const tool of ['Bash', 'PowerShell']) {
    for (const [command, blocked] of CASES) {
      const r = await $.tool.call({ tool, command } as never)
      expect([tool, command, 'deny' in r && typeof r.deny === 'string']).toEqual([tool, command, blocked])
    }
  }
})
