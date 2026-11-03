import { expect, test } from 'claude-code/testing'

import { restore, scrub } from './redact'

// Fixture keys are built at run time: no real-looking key sits in the source (push protection, other redactors).
let seed = 7
const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const rnd = (n: number, ab = AB) => Array.from({ length: n }, () => ab[(seed = (seed * 1103515245 + 12345) % 2 ** 31) % ab.length]).join('')
const TAG = /\[REDACTED-(SECRET|EMAIL|IP)-[0-9a-f]{8}\]/

// [text, the secret inside it]: the secret itself must be gone from scrub(text).
const pair = (secret: string, make: (s: string) => string): readonly [string, string] => [make(secret), secret]
const HIDE: readonly (readonly [string, string])[] = [
  pair(`${'sk-' + 'ant-api03-'}${rnd(40)}`, (s) => `ANTHROPIC_API_KEY=${s}`),
  pair(`${'gh' + 'p_'}${rnd(36)}`, (s) => `export GITHUB_TOKEN=${s}`),
  pair(`${'AK' + 'IA'}${rnd(16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567')}`, (s) => `aws_access_key_id = ${s}`),
  pair(rnd(14), (s) => `db: postgres://app:${s}@db.example.com:5432/main`),
  pair(rnd(32), (s) => `Authorization: Bearer ${s}`),
  pair(rnd(32), (s) => `a bare high-entropy token ${s} here`),
  pair(rnd(64), (s) => `-----BEGIN ${'RSA PRIVATE'} KEY-----\n${s}\n-----END RSA PRIVATE KEY-----`),
  pair(`jdoe@${'realcorp.io'}`, (s) => `contact me at ${s}`),
  // a person's addresses that only begin like an example word
  ...['john.smith', 'johnson', 'adminops', 'alice.wong', 'bobby', 'testerson'].map((l) => pair(`${l}@realcorp.io`, (s) => `from ${s}`)),
  pair(['8', '8', '4', '4'].join('.'), (s) => `origin ${s} hit the worker`),
  pair(['2606', '4700', '4700', '0', '0', '0', '0', '1111'].join(':'), (s) => `v6 ${s} seen`),
  pair(['2606', '4700'].join(':') + '::1111', (s) => `compressed v6 ${s} seen`),
  pair('2001:4860::', (s) => `prefix ${s} only`),
  pair('2001:db8:85a3::8a2e:370:7334', (s) => `mid ${s}.`),
]

// From secret-redactor's contract: things that look like keys or addresses and are not.
const KEEP: readonly string[] = [
  'commit 79a1e9dd8f3b2c1a4e5d6f7089abcdef01234567 landed on main',
  'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'apps/nextjs/src/components/agentengineer/school/school-styles.ts',
  'http://localhost:3000/api/auth and 127.0.0.1:5432',
  'private net 192.168.1.14 and 10.0.0.7 and 172.16.4.2 and 203.0.113.9',
  'Co-Authored-By: Claude <noreply@anthropic.com>',
  'someone-else@users.noreply.github.com',
  'Claude Code 2.1.260 released 2026-09-04',
  'const IN_FLIGHT = new Set([QUEUED, BUILDING, INITIALIZING])',
  'npm install @anthropic-ai/claude-code --save-dev',
  'PLANETSCALE_DATABASE_URL is set in Infisical prod',
  'monthly: "price_1Q4RmZKtVnpLXbYc82F0dTgW", productId: "prod_Rbk7HDpQ2mXvLe"',
  'pk_live_51H8xQ2LpR7vT4nK9wYbF1cJhE6sAdG0u',
  'key="archived-modules-marker"',
  'const OUTLINE_OPEN_KEY = "lesson_article_outline_open_v1";',
  'import { playerEventBatchV1Schema } from "./player-event-ingest";',
  'META_Conv_Lookalike-Customers_FreeTrial_2024Q1',
  'const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";',
  'The channel ID is UCq7NmTfKbrWzXd4LpHveAJs (a channel)',
  'placeholder="you@example.com" and name@company.com',
  'bare example words: admin@realcorp.io, user42@realcorp.io, first.last@realcorp.io',
  'C++ std::vector<int> and Foo::bar at 12:30 or 10:30:45, ::1 and fe80::1ff:fe23:4567:890a',
]

test('redact: secrets, emails and public IPs hidden; ids, hashes, names and private ranges kept', () => {
  expect(HIDE.filter(([t, secret]) => scrub(t).includes(secret) || !TAG.test(scrub(t))).map(([t]) => t)).toEqual([])
  expect(KEEP.filter((t) => scrub(t) !== t)).toEqual([])
})

test('redact: a URL password that is one ${...} or {{...}} placeholder is kept; a literal or <...> one is hidden', () => {
  // Single quotes: these are the literal placeholder text a source file holds.
  const url = (password: string) => 'const dsn = `postgres://app:' + password + '@db.realcorp.io:5432/main`'
  const kept = ['${s}', '${process.env.DB_PASS}', '{{db_password}}']
  expect(kept.map(url).filter((t) => scrub(t) !== t)).toEqual([])
  const hidden = [rnd(14), 'a$' + rnd(12), rnd(4) + '${x}' + rnd(4), '${' + rnd(10), '${a}${b}', '<a>b<c>', '{{}}',
    // A default value inside the placeholder is a real password.
    '${DB_PASS:-pw}', '${DB_PASS-pw}', '${DB_PASS:=pw}', '${process.env.PW||"pw"}', "${process.env.PW??'pw'}",
    "${'pw'}", "{{pw|default('pw')}}", '<Zqw7Kp2mXr>', '$' + 'DB_PASS', '%DB_PASS%',
    // Angle brackets are not a placeholder form: a real password was written that way.
    '<password>', '<your-password>', '<db_password>', '<SuperSecret>']
  expect(hidden.filter((p) => scrub(url(p)).includes(p) || !TAG.test(scrub(url(p))))).toEqual([])
})

test('redact: two distinct values never share a placeholder, and each restores to its own value', () => {
  const values = Array.from({ length: 2000 }, (_, i) => `50.${i >> 8}.${i & 255}.1`)
  const tags = values.map((v) => scrub(`ip ${v}`).slice(3))
  expect(tags.every((t) => TAG.test(t))).toBe(true)
  expect(new Set(tags).size).toBe(values.length)
  values.forEach((v, i) => expect(restore(tags[i]!)).toBe(v))
})

test('redact: the walker reads data objects and withholds what is too deep or too large', async ($, on) => {
  const key = `${'gh' + 'p_'}${rnd(36)}`
  let deep: unknown = { leaf: key }
  for (let i = 0; i < 15; i++) deep = { n: deep }
  let answer: unknown = { data: { api_key: key }, blob: { data: 'A'.repeat(300) } }
  on('ui.notice', () => ({ value: undefined }))
  on('tool.call', () => ({ result: answer }) as never)
  const r = (await $.tool.call({ tool: 'Bash', command: 'x' } as never)) as { result: { data: { api_key: string }; blob: { data: string } } }
  expect(r.result.data.api_key).not.toContain(key)
  expect(r.result.blob.data).toBe('A'.repeat(300)) // a base64 payload under `data` is left alone

  answer = deep
  const d = (await $.tool.call({ tool: 'Bash', command: 'x' } as never)) as { result: unknown }
  expect(JSON.stringify(d.result)).not.toContain(key)
  expect(JSON.stringify(d.result)).toContain('withheld')
})

test('redact: a value always mints the same placeholder, and the placeholder buys it back', () => {
  const line = `KEY=${rnd(32)}`
  expect(scrub(line)).toBe(scrub(line))
  expect(scrub(line)).not.toBe(line)
  expect(restore(scrub(line))).toBe(line)
})

test('a tool result is redacted, its placeholder restored in the next tool input; the edit guard still runs', async ($, on) => {
  const key = `${'gh' + 'p_'}${rnd(36)}`
  const seen: string[] = []
  on('process.run', () => ({ value: { exitCode: 0, stdout: '/desk', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('ui.notice', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_$, e) => {
    seen.push((e as { command?: string }).command ?? '')
    return { result: `TOKEN=${key}` } as never
  })
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/desk', surface: null, isInteractive: false })
  const r = (await $.tool.call({ tool: 'Bash', command: 'cat .env' } as never)) as { result: string }
  expect(r.result).not.toContain(key)
  const tag = r.result.slice('TOKEN='.length)
  await $.tool.call({ tool: 'Bash', command: `curl -H "Authorization: ${tag}" x` } as never)
  expect(seen.at(-1)).toBe(`curl -H "Authorization: ${key}" x`)
  expect('deny' in (await $.tool.call({ tool: 'Bash', command: "sed -i 's/a/b/' f" } as never))).toBe(true)
  const p = (await $.prompt.submit({ text: `use ${key}`, wait: false, origin: { kind: 'composer' } } as never)) as { text: string }
  expect(p.text).toBe(`use ${tag}`)
})

test('Agent, SendMessage and AskUserQuestion keep placeholders; deny and context are scrubbed too', async ($, on) => {
  const key = `${'gh' + 'p_'}${rnd(36)}`
  const seen: string[] = []
  let reply: unknown = { result: `TOKEN=${key}` }
  on('ui.notice', () => ({ value: undefined }))
  on('tool.call', (_$, e) => { seen.push(JSON.stringify(e)); return reply as never })
  // the engine's own vault mints the placeholder (the test file may hold another copy of the module)
  const tag = ((await $.tool.call({ tool: 'Bash', command: 'cat .env' } as never)) as { result: string }).result.slice('TOKEN='.length)
  expect(tag).toMatch(TAG)
  reply = { result: 'ok' }
  seen.length = 0
  for (const tool of ['Agent', 'SendMessage', 'AskUserQuestion']) await $.tool.call({ tool, prompt: tag } as never)
  expect(seen.join('')).not.toContain(key)
  expect(seen.every((s) => s.includes(tag))).toBe(true)
  await $.tool.call({ tool: 'Write', content: tag } as never)
  expect(seen.at(-1)).toContain(key) // other tools still get the real value

  reply = { deny: `blocked: ${key}` }
  expect(JSON.stringify(await $.tool.call({ tool: 'Write', content: 'x' } as never))).not.toContain(key)
})

test('a toast that throws does not let the prompt through unredacted', async ($, on) => {
  const key = `${'gh' + 'p_'}${rnd(36)}`
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('store.get', () => ({ value: undefined }))
  on('ui.toast', () => { throw new Error('no ui') })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  const p = (await $.prompt.submit({ text: `use ${key}`, wait: false, origin: { kind: 'composer' } } as never)) as { text: string }
  expect(p.text).not.toContain(key)
  expect(p.text).toMatch(TAG)
})
