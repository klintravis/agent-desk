import { expect, test } from 'claude-code/testing'

import { restore, scrub, scrubPii } from './redact'
import { hasSecret, maskVendor, PRIVATE_KEY, VENDOR } from './secretpatterns.mjs'

// Fixture keys are built at run time: no real-looking key sits in the source (push protection, other redactors).
let seed = 7
const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const rnd = (n: number, ab = AB) => Array.from({ length: n }, () => ab[(seed = (seed * 1103515245 + 12345) % 2 ** 31) % ab.length]).join('')
const TAG = /\[REDACTED-(SECRET|EMAIL|IP)-[0-9a-f]{8}\]/

// [text, the secret inside it]: the secret itself must be gone from scrub(text).
const pair = (secret: string, make: (s: string) => string): readonly [string, string] => [make(secret), secret]
const HIDE: readonly (readonly [string, string])[] = [
  pair(`${'sk-' + 'ant-api03-'}${rnd(40)}`, (s) => `ANTHROPIC_API_KEY=${s}`),
  pair(`${'sk-'}${rnd(40)}`, (s) => `OPENAI_API_KEY=${s}`),
  pair(`${'sk-'}${rnd(40)}`, (s) => `a key ${s} in a sentence`),
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
  // Low entropy, so only the vendor shape can hide it; the \n is the two characters of JSON-escaped text.
  pair(`${'sk-'}${'a1'.repeat(15)}`, (s) => `{"text":"first line\\n${s}"}`),
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
  `merge the ${'ri'}sk-based-rollout-for-every-branch first`,
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

test('a key is given away by the name beside it: hidden and refused, whatever its shape', () => {
  const named: readonly (readonly [string, string])[] = [
    pair(['79a1e9dd8f3b2c1a', '4e5d6f7089abcdef', '01234567'].join(''), (s) => `Authorization: Bearer ${s}`),
    pair(`re_${rnd(8)}_${rnd(20)}`, (s) => `RESEND_API_KEY=${s}`),
    pair(`prod_${rnd(15)}`, (s) => `DB_PASSWORD=${s}`),
    pair(['Correct', 'Horse', 'Battery', 'Staple', '9'].join(''), (s) => `password=${s}`),
    pair(['correct', 'horse', 'battery', 'staple9'].join('_'), (s) => `password=${s}`),
    pair(`prod-live-${rnd(22)}`, (s) => `API_TOKEN=${s}`),
    pair(rnd(12), (s) => `redis://:${s}@cache:6379`),
    pair(`${rnd(20)}/${rnd(8)}/${rnd(12)}`, (s) => `aws_secret_access_key = ${s}`),
    // the known cost: public ids and a password-named call read as keys beside a key's name
    pair(`pk_live_${rnd(24)}`, (s) => `STRIPE_PUBLISHABLE_KEY=${s}`),
    pair(`price_${rnd(24)}`, (s) => `stripe_key: "${s}"`),
    pair(['get', 'Database', 'Password', '2'].join(''), (s) => `password: ${s}`),
  ]
  expect(named.filter(([t, secret]) => scrub(t).includes(secret) || !TAG.test(scrub(t))).map(([t]) => t)).toEqual([])
  expect(named.filter(([t]) => !hasSecret(t)).map(([t]) => t)).toEqual([])
})

test('ordinary code and prose beside a key name stay untouched, and hasSecret refuses none of it', () => {
  const stay = [
    ...KEEP,
    // code names, digit included
    'key: playerEventBatchV1Schema',
    'token: user_profile_settings_v2',
    'cacheKey: "homepage-hero-banner-v2"',
    `key: ${'test'}_fixture_alpha1_beta2`,
    // paths: their segments, joined, read as a name
    'key: /api/v2/keys/rotate',
    'secret: config/prod/v2/app',
    'token: src/components/auth/LoginFormV2/index',
    'key: packages/CoreUtils/src/StringHelpers2/index',
    'auth: https://login.example.com/oauth2/authorize',
    '{"Key": "photos/2024/Summer-Trip/IMG_1234.jpg"}',
    'PWD=/home/dev/src/agent-desk-v2/Hooks',
    'OLDPWD=/c/work/trees/adesk-redact-gaps/Hooks2',
    // connection strings with no password
    'redis://cache:6379/0',
    'see https://example.com:8080/a@b',
    // known kept case: a real password shape with no digit
    'password=correct_horse_battery_staple',
    // prose
    'password: must be at least 12 characters',
    'Bearer tokens expire after 3600 seconds',
    'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE',
    'Authorization: Bearer ${ACCESS_TOKEN_FROM_ENV}',
    'Rotate the key: quarterly2026 is the plan',
  ]
  expect(stay.filter((t) => scrub(t) !== t)).toEqual([])
  expect(stay.filter((t) => hasSecret(t))).toEqual([])
})

test('hasSecret: a long run beside a key name takes linear time, and an unnamed token is not refused', () => {
  const start = Date.now()
  expect(hasSecret(`key: ${'a-'.repeat(1e5)}`)).toBe(false)
  expect(hasSecret(`${'key: abc '.repeat(1e5)}`)).toBe(false)
  hasSecret(`key: ${'aB1/'.repeat(1e5)}`) // time only; the result is not the point
  expect(Date.now() - start).toBeLessThan(2000)
  const bare = `a bare high-entropy token ${rnd(32)} here`
  expect(scrub(bare)).not.toBe(bare) // masked, because the model need not see it
  expect(hasSecret(bare)).toBe(false) // not refused: a refusal blocks the ruling or the PR body
})

test('a long digit-free run of bare key prefixes takes linear time', () => {
  const start = Date.now()
  expect(hasSecret(`${'sk-'}`.repeat(1e5))).toBe(false)
  expect(Date.now() - start).toBeLessThan(5000) // 35 ms with the window, 23 s without it
})

const JWT = 'ey' + 'J'
const BEGIN = '-----' + 'BEGIN PRIVATE KEY-----'
const END = '-----' + 'END PRIVATE KEY-----'
const RSA_BEGIN = '-----' + 'BEGIN RSA PRIVATE KEY-----'
const RSA_END = '-----' + 'END RSA PRIVATE KEY-----'
const PGP_BEGIN = '-----' + 'BEGIN PGP PRIVATE KEY BLOCK-----'
const PGP_END = '-----' + 'END PGP PRIVATE KEY BLOCK-----'
const a = (n: number) => 'a'.repeat(n)

// Before the fix a scrub at 150 KB took 5-8 s on every eyJ and address shape, each doubling costing four times as
// much, so 20 s or more here. Now under a second.
const SLOW: Readonly<Record<string, string>> = {
  'a run of eyJ': JWT.repeat(1e5),
  'a run of eyJ with short segments': `${JWT.repeat(1e5)}.a.b`,
  'two runs of eyJ': `${JWT.repeat(5e4)}.${JWT.repeat(5e4)}`,
  'an address run with no @': a(3e5),
  'a dotted address run with no @': 'a.'.repeat(15e4),
  'an address run ending in @': `${a(3e5)}@`,
  'a domain with no dot': `a@${a(3e5)}`,
  'a domain with a numeric ending': `a@b${'.1'.repeat(15e4)}`,
  'a domain of hyphens': `a@b${'-'.repeat(3e5)}`,
}
for (const [shape, text] of Object.entries(SLOW)) {
  test(`linear time: ${shape}`, () => {
    const start = Date.now()
    expect(hasSecret(text)).toBe(false)
    scrub(text)
    expect(Date.now() - start).toBeLessThan(5000)
  })
}

// 23 s here when a header with no end rescanned the text to its end.
const HEADERS: Readonly<Record<string, string>> = {
  'private key headers with no end': BEGIN.repeat(5e4),
  'private key headers after an end': `${END}${BEGIN.repeat(5e4)}`,
  'PGP key headers with no end': PGP_BEGIN.repeat(5e4),
}
for (const [shape, text] of Object.entries(HEADERS)) {
  test(`linear time, masked to the end: ${shape}`, () => {
    const start = Date.now()
    expect(hasSecret(text)).toBe(true)
    expect(scrub(text).includes('BEGIN')).toBe(false)
    expect(Date.now() - start).toBeLessThan(5000)
  })
}

const isHidden = (text: string, secret: string) => !scrub(text).includes(secret) && restore(scrub(text)) === text

test('a JWT is caught wherever it sits, at the edge of its segments and at any length', () => {
  const jwt = `${JWT}${a(40)}.${a(40)}.${a(40)}` // low entropy: only the JWT shape can catch it
  const placed = [`t=${jwt}`, `token%3D${jwt}`, `"\\n${jwt}"`, `word${jwt}`, `a-b_${jwt}`, `${JWT.repeat(1e5)} ${jwt}`, `${JWT.repeat(1e5)}.x ${jwt}`]
  expect(placed.filter((t) => !hasSecret(t) || !isHidden(t, jwt))).toEqual([])

  const shapes = [
    `${JWT}${a(8)}.${a(8)}.${a(8)}`,
    `${JWT}${a(5)}${JWT}.${a(8)}.${a(8)}`, // eight characters only from the first eyJ of the run
    `${JWT}${a(2048)}.${a(8)}.${a(8)}`, // a header carrying x5c or jwk
    `${JWT}${a(1e5)}.${a(1e5)}.${a(1e5)}`,
    `${JWT.repeat(1e5)}.${JWT.repeat(1e5)}.${JWT.repeat(1e5)}`,
  ]
  expect(shapes.filter((t) => !hasSecret(t) || scrub(t).includes(JWT))).toEqual([])

  const notShapes = [`${JWT}${a(7)}.${a(8)}.${a(8)}`, `${JWT}${a(8)}.${a(7)}.${a(8)}`, `${JWT}${a(8)}.${a(8)}.${a(7)}`, `${JWT}${JWT}${a(2)}.${a(8)}.${a(8)}`]
  expect(notShapes.filter((t) => hasSecret(t))).toEqual([])
})

test('a key holding eyJ is masked and comes back whole', () => {
  const inKey = `${'gh' + 'p_'}${a(10)}${JWT}${a(20)}`
  expect(isHidden(`k ${inKey}`, inKey)).toBe(true)
  const jwt = `${JWT}${a(8)}.${a(8)}.${a(8)}`
  const glued = `${'gh' + 'p_'}${a(20)}_${jwt}` // the key stops at `_`, the JWT is a second match
  expect(hasSecret(glued)).toBe(true)
  expect(isHidden(glued, jwt)).toBe(true)
})

test('an address is caught at any length, glued to another, and after a run with no address', () => {
  const addr = 'pat@realcorp.io'
  const long = [`${a(100)}@realcorp.io`, `${a(3e5)}@realcorp.io`, `a@${a(1e5)}.realcorp.io`, `a@realcorp.${a(24)}`]
  // The whole address goes: a bounded pattern would still mask its tail and leave the prefix in the clear.
  expect(long.filter((t) => !/^\[REDACTED-EMAIL-[0-9a-f]{8}\]$/.test(scrubPii(t)))).toEqual([])

  const placed = [`${a(3e5)} ${addr}`, `${a(3e5)}@ ${addr}`, `a@${addr}`, `a@b ${addr}`, `x@y.io+${addr}`, `x@y.io-${addr}`, `x@y.io.${addr}`, `you@example.com+${addr}`]
  expect(placed.filter((t) => !isHidden(t, addr))).toEqual([])
  expect(scrub(`you@example.com+${addr}`).startsWith('you@example.com')).toBe(true)

  // What the old pattern left alone stays as it was.
  const kept = ['a.b%c+d-e_f', 'a@b', 'a@', '@b.io', 'a@b.c', 'a@-b.io', 'you@example.com', 'noreply@realcorp.io']
  expect(kept.filter((t) => scrubPii(t) !== t)).toEqual([])
  expect(scrubPii(`${a(30)}@realcorp.${a(25)}`)).not.toContain('@realcorp')
})

test('every private key goes, however its markers repeat; text past a closing end stays', () => {
  const key = `${BEGIN}\n${rnd(64)}\n${END}`
  expect(scrub(`one ${key} two ${key} three`)).not.toContain('PRIVATE KEY')
  expect(scrub(`one ${key} two ${key} three`).endsWith(' three')).toBe(true)
  const other = `${BEGIN}\n${rnd(64)}\n${BEGIN}\n${rnd(64)}\n${END}`
  expect(scrub(other)).not.toContain('PRIVATE KEY')
  expect(scrub(`${BEGIN.repeat(1e5)}${END}`)).not.toContain('PRIVATE KEY')
  expect(scrub(`${key} between ${BEGIN} tail`)).toMatch(/^\[REDACTED-SECRET-[0-9a-f]{8}\] between \[REDACTED-SECRET-[0-9a-f]{8}\]$/)
  expect(hasSecret(END)).toBe(false)
  expect(hasSecret(`${END} ${BEGIN}`)).toBe(true)
  expect(scrub(`${BEGIN}END PRIVATE KEY----- tail`)).not.toContain('tail') // the opening's own dashes are not its end
  expect(scrub(`${BEGIN}END PRIVATE KEY-----END PRIVATE KEY----- tail`).endsWith(' tail')).toBe(true) // ... and the next end shares them
})

test('a key block with no end goes to the end of the text; text before it and after a closed block stays', () => {
  const block = /\[REDACTED-SECRET-[0-9a-f]{8}\]/.source
  const markers: readonly (readonly [string, string])[] = [[BEGIN, END], [RSA_BEGIN, RSA_END], [PGP_BEGIN, PGP_END]]
  for (const [open, close] of markers) {
    const body = `\n${rnd(64)}\n`
    const closed = `before ${open}${body}${close} normal text`
    expect(hasSecret(closed)).toBe(true)
    expect(scrub(closed)).toMatch(new RegExp(`^before ${block} normal text$`))
    expect(restore(scrub(closed))).toBe(closed)

    const truncated = `before ${open}${body}the rest of the paste`
    expect(hasSecret(truncated)).toBe(true)
    expect(scrub(truncated)).toMatch(new RegExp(`^before ${block}$`))
    expect(restore(scrub(truncated))).toBe(truncated)

    expect(hasSecret(open)).toBe(true)
    expect(scrub(open)).toMatch(new RegExp(`^${block}$`))
  }

  const pub = 'before ' + '-----' + 'BEGIN PGP PUBLIC KEY BLOCK-----\nafter'
  expect(hasSecret(pub)).toBe(false)
  expect(scrub(pub)).toBe(pub)
})

test('the linear scans find exactly what the patterns find on raw text', () => {
  const draw = (tokens: readonly string[]) => Array.from({ length: 1 + AB.indexOf(rnd(1)) % 20 }, () => tokens[AB.indexOf(rnd(1)) % tokens.length]).join('')
  const mask = (m: string) => `<${m}>`
  const vendor = [JWT, JWT, '.', '.', '_', '-', '%3D', '\\n', ' ', 'gh' + 'p_', 'AK' + 'IA', 'sk-', 'SG.', 'ya' + '29.', 'J', 'K', 'y', 'e', 'a', '1', a(8), '12345678', 'ABCDEFGHIJKLMNOP']
  let seen = 0
  for (let i = 0; i < 20000; i++) {
    const v = draw(vendor)
    const rawV = v.replace(VENDOR, mask)
    seen += +(rawV !== v)
    if (maskVendor(v, mask) !== rawV || hasSecret(v) !== (rawV !== v || v.search(PRIVATE_KEY) >= 0)) expect(v).toBe('the same match as VENDOR')
  }
  expect(seen).toBeGreaterThan(500) // the walk reaches real matches

  // The address pattern as it was before a run with no address became a match of its own.
  const EMAIL_AS_WAS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}/g
  const mails = ['@', '@', '.', '.', '-', '+', '_', '%', 'a', 'b', 'com', 'io', 'realcorp', ' ', '\n', '@x.com', '.io', a(25)]
  let found = 0
  for (let i = 0; i < 20000; i++) {
    const t = draw(mails)
    const was = t.replace(EMAIL_AS_WAS, '#')
    found += +(was !== t)
    if (scrubPii(t).replace(/\[REDACTED-EMAIL-[0-9a-f]{8}\]/g, '#') !== was) expect(t).toBe('the same match as the old EMAIL')
  }
  expect(found).toBeGreaterThan(500)
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

test('Agent, SendMessage, SubagentHandback, AskUserQuestion, WebSearch and WebFetch keep placeholders; deny and context are scrubbed too', async ($, on) => {
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
  for (const tool of ['Agent', 'SendMessage', 'SubagentHandback', 'AskUserQuestion', 'WebSearch', 'WebFetch']) await $.tool.call({ tool, prompt: tag } as never)
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

// rnd draws only part of a short alphabet, and a hex token needs all 16 symbols to read as high entropy.
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 16).toString(16)).join('')

const WIDER: readonly (readonly [string, string])[] = [
  // a key's name with a suffix
  pair(hex(128), (s) => `SECRET_KEY_BASE=${s}`),
  pair(`prod_${rnd(15)}`, (s) => `DB_PASSWORD_PROD=${s}`),
  pair(rnd(32), (s) => `API_KEY_V2=${s}`),
  // Fixed, not rnd: a later fixture's draw depends on how many came before it.
  pair('prod_' + 'aB3xQ9zK1pW7mN2', (s) => `db.password.prod=${s}`),
  pair('prod_' + 'aB3xQ9zK1pW7mN2', (s) => `DB-PASSWORD-PROD=${s}`),
  pair('aB3xQ9zK1pW7mN2v' + 'L8cT4rY6pH5sD0fG', (s) => `api.key.v2=${s}`),
  pair('hunter' + '2!abc', (s) => `db.password.prod=${s}`),
  // the GitHub form of the Authorization header
  pair(hex(40), (s) => `Authorization: token ${s}`),
  pair(hex(40), (s) => `"Authorization": "token ${s}"`),
  pair(rnd(32), (s) => `authorization: Token ${s}`),
  // a password holding # $ ! @
  pair(`Tr0ub4dor#${rnd(6)}`, (s) => `password=${s}`),
  pair('abc$def!' + 'ghi@123', (s) => `password=${s}`),
  pair('p#ss$w0rd!' + 'x@longer1', (s) => `password: ${s}`),
  pair('Summer' + '2024!', (s) => `DB_PASSWORD_PROD = "${s}"`),
  // a bearer token holding . or ~
  pair(`${rnd(16)}.${rnd(16)}~${rnd(8)}`, (s) => `Authorization: Bearer ${s}`),
  pair(`${rnd(10)}~${rnd(10)}.${rnd(10)}`, (s) => `Bearer ${s}`),
  // a hex token as a URL's username
  pair(hex(40), (s) => `https://${s}@github.com/org/repo.git`),
  pair(hex(40), (s) => `https://${s}:x-oauth-basic@github.com/org/repo.git`),
]
const AT_PASSWORDS: readonly (readonly [string, string])[] = [
  pair('p@' + 'ssw0rd', (s) => `postgres://app:${s}@db`),
  pair('abc@' + 'defgh', (s) => `postgres://app:${s}@db`),
  pair('abc@' + 'defgh', (s) => `postgres://app:${s}@db.example.com:5432/main`),
  pair('a@b' + '@c', (s) => `mysql://app:${s}@host/db`),
  pair('p@' + 'ssw0rd', (s) => `redis://:${s}@cache:6379`),
]
test('a suffixed key name, a token after Authorization, a password or bearer token with marks, a hex URL username and a URL password with @ are hidden and refused', () => {
  for (const [text, secret] of [...WIDER, ...AT_PASSWORDS]) {
    expect({ text, hidden: isHidden(text, secret), refused: hasSecret(text) }).toEqual({ text, hidden: true, refused: true })
  }
})

test('a URL password with @ is hidden whole, with the host kept', () => {
  expect(scrub('postgres://app:abc@' + 'defgh@db')).toMatch(/^postgres:\/\/app:\[REDACTED-SECRET-[0-9a-f]{8}\]@db$/)
  expect(scrub('redis://:p@' + 'ssw0rd@cache:6379')).toMatch(/^redis:\/\/:\[REDACTED-SECRET-[0-9a-f]{8}\]@cache:6379$/)
})

test('look-alikes of the wider patterns are kept and not refused', () => {
  const sha = hex(40)
  const kept = [
    // key names with a suffix that makes another thing of them
    'SECRET_KEY_NAME=config_value_name', 'KEY_NAME=abcdef123456abcdef', 'TOKEN_TTL=360000000000000000', 'PASSWORD_MIN_LENGTH=12',
    'TOKEN_URL=https://login.example.com/oauth2/token', 'SESSION_TIMEOUT_MS=3600000', 'KEY_ID=build-artifact-store-v2',
    `SESSION_ID=${sha}`, `CACHE_KEY_HASH=${sha}`,
    // a suffix after `.` or `-` on what is not a key
    'auth.test: passed', 'session.test: user_profile_settings_v2', 'key-1: buildArtifactStoreName', 'token.prod=https://login.example.com/oauth2/token',
    'auth.prod:8080/path', 'db.password.min=12', 'KEY-ID=build-artifact-store-v2',
    // `token` as a word
    'token bucket algorithm is used', 'Authorization: token bucket is empty', 'Authorization: token is required by the middleware',
    'Authorization: token ${GITHUB_TOKEN}', `token ${sha}`, `use token ${sha} for this`,
    // what sits after `password` and is not one
    'password: must be at least 12 characters, with # or $!', 'password: $DB_PASS', 'password: $dbPass2', 'password=$DB_PASS and more',
    'password: ${DB_PASS}', 'password: %DB_PASS2%', 'password: !important', 'password: !isValid2', 'password=<your-password-here>',
    'password: user1@example.com', 'password = "#{vault.get(name)}"', 'password = config?.db2!.pass', 'password = process.env.DB_PASS2!',
    'password: ~/secrets/db1.txt', 'email: dev1!notes#here@x',
    // what sits after `Bearer` and is not a token
    'Bearer tokens expire after 3600.5 seconds', 'Authorization: Bearer YOUR_ACCESS_TOKEN.HERE', 'Bearer config.auth.accessToken.value',
    'Bearer config2.auth.accessToken.value3', 'Bearer this.state.session.currentToken', 'Bearer ~/home/dev/token.file.name', 'Bearer api.v2.example.com.internal',
    // a hex run in a URL's other slots
    `https://${sha}/path`, `https://${sha}:8080/path`, `https://${sha}.cdn.example.com/x`, 'https://user@example.com/path',
    `https://${'0'.repeat(40)}@example.com/x`,
    // a URL with a template password, or with no password
    'postgres://app:${PASS}@h:5432?x=a', 'postgres://app:${PASS}@h:5432?x=a@b', 'postgres://app:{{pass}}@h:5432/db', 'postgres://app:${PASS}@h@b',
    'see https://example.com:8080/a@b', 'see https://example.com:8080/a@b@c', 'redis://cache:6379/0', 'mailto://a:b@c',
  ]
  for (const text of kept) expect({ text, scrubbed: scrub(text), refused: hasSecret(text) }).toEqual({ text, scrubbed: text, refused: false })
  // scrubPii takes these as addresses, so only the refusal check speaks to them
  for (const text of ['git clone https://git@github.com/org/repo.git', 'ssh://git@github.com/org/repo.git', `see https://cdn.example.com/${sha}@2x.png`]) expect(hasSecret(text)).toBe(false)
})

// 20 characters: an unnamed token is caught from 24 on, so at this length only the name, flag or URL can hide it.
const shortKey = () => `${rnd(18)}9a`
const tagOf = (kind = 'SECRET') => `[REDACTED-${kind}-${hex(8)}]`
const MARKED = 'Passw0rd' + '#2024'
const CAMEL = 'Super' + 'Secret12345'
// Each secret is hidden as one secret tag, not an email one, and refused. Dotless hosts: `pw@db.internal` would hide as an email anyway.
const expectHidden = (text: string, ...secrets: readonly string[]) => {
  for (const secret of secrets) expect({ text, hidden: isHidden(text, secret) }).toEqual({ text, hidden: true })
  const out = scrub(text)
  expect({ text, tags: out.match(/\[REDACTED-SECRET-/g)?.length, emails: out.includes('[REDACTED-EMAIL-') }).toEqual({ text, tags: secrets.length, emails: false })
  expect(scrub(out)).toBe(out)
  expect(hasSecret(text)).toBe(true)
}
const expectKept = (...texts: readonly string[]) => {
  for (const text of texts) expect({ text, scrubbed: scrub(text), refused: hasSecret(text) }).toEqual({ text, scrubbed: text, refused: false })
}

test('a vendor key as a URL password becomes one placeholder, which restores whole', () => {
  const key = `${'gh' + 'p_'}${rnd(36)}`
  expectHidden(`postgres://app:${key}@db:5432/main`, key)
})

test('a value beside a pass name or after a password flag is hidden and refused', () => {
  for (const make of [
    (s: string) => `DB_PASS=${s}`, (s: string) => `DB_PASS: "${s}"`, (s: string) => `export DB_PASS=${s}`, (s: string) => `db.pass=${s}`,
    (s: string) => `PASS=${s}`, (s: string) => `export PASS=${s}`, (s: string) => `PGPASS=${s}`, (s: string) => `export DBPASS=${s}`,
    (s: string) => `dbPass: ${s}`, (s: string) => `"pass": "${s}"`, (s: string) => `pass: ${s}`, (s: string) => `--pass=${s}`,
    (s: string) => `mysqldump --password ${s} main`, (s: string) => `--password\t${s}`, (s: string) => `--password "${s}"`, (s: string) => `--password '${s}' main`,
    (s: string) => `--passwd ${s}`, (s: string) => `--pwd ${s}`, (s: string) => `--pass ${s}`,
  ]) {
    const secret = shortKey()
    expectHidden(make(secret), secret)
  }
  // Words with a digit count, as they do beside `password`.
  const words = 'correct-' + 'horse-battery-7'
  expectHidden(`DB_PASS=${words}`, words)
  expectHidden(`--password ${words}`, words)
  expectHidden(`DB_PASS=${MARKED}`, MARKED)
  expectHidden(`--password ${MARKED}`, MARKED)
  expectHidden(`DB_PASS_PROD=${MARKED}`, MARKED)
})

test('--pass= with a marked or camelCase value is hidden and refused, as --password= is', () => {
  expectHidden(`--pass=${MARKED}`, MARKED)
  expectHidden(`--pass=${CAMEL}`, CAMEL)
  expectKept('--pass=$DB_PASS', '--pass=your-password-here', `--bypass=${MARKED}`, `--pass-through=${MARKED}`)
  // The named gap: joined or bare, `pass` is a key's name only, and these values have no key's shape.
  expectKept(`PGPASS=${MARKED}`, `dbPass: ${MARKED}`, `PASS=${MARKED}`)
})

test('what only looks like a pass name or a password flag stays and is not refused', () => {
  const key = shortKey()
  expectKept(
    // what the flag's name starts with, or a flag whose value is not on its line
    '--password-file /run/secrets/database', `--password-file ${key}`, '--password-stdin', 'docker login --password-stdin ghcr.io',
    `--pass-through ${key}`, `--passphrase-file ${key}`, `--password\n${key}`, `mkdir -p ${key}`, 'ssh -p 22 host',
    // a word ending in pass, a sentence, a CI line
    'pass=true', 'bypass=1', 'compass: north', `bypass=${key}`, `compass: ${key}`, `surpass=${key}`, `all tests pass: ${key}`,
    'pass: build#1234', 'tests pass = 12 of 12', `pass_through=${key}`, 'PASS=false',
    // what follows the name or the flag and is not a password
    '--password must be set', 'use --password or --token', 'the --password flag configuration', '--password /run/secrets/database',
    '--password $DB_PASSWORD', '--password ${DB_PASSWORD}', '--password "$(cat /run/x)"', '--password <password>', '--password YOUR_PASSWORD',
    '--password your-password-here', '--password changeme', 'DB_PASS=${DB_PASS}', 'DB_PASS=$(cat /run/x)', 'DB_PASS=changeme', 'DB_PASS=your_password_here',
    // The named gaps: telling these from ordinary text would refuse `mkdir -p <name>` and the like.
    `-p ${key}`, `-p${key}`, `-password ${key}`, `mysqlpass=${key}`, `user pass: ${key}`,
  )
  // The named costs: these pass no longer, though their value is not a password.
  for (const text of [`pass: ${hex(40)}`, `tests pass=${key}`, `CI: pass: ${hex(40)}`, `209 pass: ${hex(40)}`, `tests  pass: ${hex(40)}`]) expect({ text, refused: hasSecret(text) }).toEqual({ text, refused: true })
})

test('a URL user holding @ does not leave its password raw, and a port is not a password', () => {
  const pw = shortKey()
  expectHidden(`postgres://me@corp:${pw}@db/main`, pw)
  expectHidden(`postgres://a@b@c:${pw}@db/main`, pw)
  expectHidden(`mongodb://a@h1:27017,b:${pw}@h2/db`, pw)
  expectKept(
    'mongodb://a@h1:27017,b@h2:27017/db', 'mongodb://a@h1,b@h2:27017,c@h3/db', 'mongodb://a@h1:27017,b@h2,c@h3:27017/db',
    'https://me@host:8443?to=a@b', 'https://me@host:8443#a@b', 'https://me@host:8443/a@b',
    // The named gap: digits and a comma after a user holding `@` read as a port, so what follows stays raw.
    `mongodb://me@corp:123,${pw}@db/x`,
  )
})

test('every password of a multi-host URL is hidden, a template or placeholder first or not, down to the named limits', () => {
  const [one, two, three] = [shortKey(), shortKey(), shortKey()]
  expectHidden(`mongodb://app:${one}@h1:27017,app2:${two}@h2:27017/db`, one, two)
  expectHidden(`mongodb://a:${one}@h1,b:${two}@h2,c:${three}@h3/db`, one, two, three)
  expectHidden(`mongodb://app:\${P}@h1:27017,app2:${two}@h2:27017/db`, two)
  expectHidden(`mongodb://app:{{p}}@h1,app2:${two}@h2/db`, two)
  // A later host with no password, and a list after a URL, are not one.
  expectKept('mongodb://a:${P}@h1:27017,b:${Q}@h2:27017/db', 'mongodb://a:${P}@h1:27017,h2:27017/db', 'see https://a.b/c, d:e@f', 'a,b,c:d,e')
  // The named gap: a password of 1 or 2 characters stays raw and stops the walk, as `mailto://a:b@c` must be kept.
  expectKept(`mongodb://a:pw@h1,b:${two}@h2/db`)
  expectHidden(`mongodb://a:${one}@h1,b:xy@h2,c:${three}@h3/db`, one)
  expect(isHidden(`mongodb://a:${one}@h1,b:xy@h2,c:${three}@h3/db`, three)).toBe(false)
  // The named cost: a later host's port and an `@` in its query read as a password, so such a URL is refused.
  expect(hasSecret('mongodb://a:${P}@h1:27017,h2:27017?to=x@y')).toBe(true)
  // The walk's limit is 64 hosts, and it stops at a host with a user and no password: the named gaps.
  expectHidden(`mongodb://a:\${P}@${'h,'.repeat(63)}b:${two}@h/db`, two)
  expectKept(`mongodb://a:\${P}@${'h,'.repeat(65)}b:${two}@h/db`, `mongodb://a:\${P}@h1,b@h2,c:${two}@h3/db`)
})

test('a URL whose password is exactly a placeholder is not refused, and nothing can ride along with one', () => {
  for (const kind of ['SECRET', 'EMAIL', 'IP']) expectKept(`postgres://app:${tagOf(kind)}@db:5432/main`)
  const tag = tagOf()
  expectKept(`The URL was postgres://app:${tag}@db:5432/main and failed`)
  // A masked first host does not excuse a raw later one.
  const raw = shortKey()
  const later = `mongodb://a:${tag}@h1,b:${raw}@h2/db`
  expect({ hidden: isHidden(later, raw), refused: hasSecret(later) }).toEqual({ hidden: true, refused: true })
  for (const text of [
    `postgres://app:${tag}${raw}@db/main`, `postgres://app:${raw}${tag}@db/main`, `postgres://app:${tag}@${raw}@db/main`, `postgres://app:${tag}${tag}@db/main`,
    `postgres://app:[REDACTED-TOKEN-${hex(8)}]@db/main`, `postgres://app:[REDACTED-SECRET-${hex(7)}]@db/main`, `postgres://app:[REDACTED-SECRET-${hex(9)}]@db/main`,
    `postgres://app:[REDACTED-SECRET-${'A'.repeat(8)}]@db/main`, `postgres://app:[redacted-secret-${hex(8)}]@db/main`,
  ]) expect({ text, refused: hasSecret(text) }).toEqual({ text, refused: true })
})

// At the scrubber's own limit (MAX_STRING). The ceiling only tells a walk from a rescan, which would take hours here; a walk takes seconds.
const AT_LIMIT: Readonly<Record<string, string>> = {
  'password flags': `--password ${a(6)} `.repeat(8e6 / 18),
  'a run of DB_PASS=': 'DB_PASS='.repeat(1e6),
  'a run of --pass=': '--pass='.repeat(8e6 / 7),
  'a URL user of nothing but @': `postgres://${'@'.repeat(8e6 - 11)}`,
  'URL users holding @': 'p://a@b@c:'.repeat(8e5),
  'a multi-host chain': `mongodb://a:bcd@h,${'u:vwx@h,'.repeat(1e6 - 3)}`,
  'a run of commas after a password': `mongodb://a:bcd@${','.repeat(8e6 - 16)}`,
  'hosts with no password': `mongodb://a:bcd@${'h,'.repeat(4e6 - 8)}`,
  'ports after a user holding @': `mongodb://a@h:1,${'b@h:1,'.repeat(1e6)}`,
  'placeholder passwords': `p://a:${tagOf()}@h `.repeat(2e5),
  'URL starts': 'a://'.repeat(2e6),
}
for (const [shape, text] of Object.entries(AT_LIMIT)) {
  test(`linear time at 8,000,000 characters: ${shape}`, { timeoutMs: 60000 }, () => {
    expect(text.length).toBeLessThanOrEqual(8e6)
    hasSecret(text)
    scrub(text)
  })
}

test('an object-store path beside a name is hidden and refused: its segments, joined, do not read as a code name (ruling T-235)', () => {
  for (const [text, secret] of [
    pair('photos/2024/SummerTrip/IMG1234', (s) => `{"Key": "${s}.jpg"}`),
    pair('backups/Prod2024/DailyDump/Part12/Export99', (s) => `{"Key": "${s}"}`),
    pair('Photos2024/SummerTrip2/Img1234/Beach12Sunset', (s) => `Key: ${s}`),
    pair('archive2024/SummerVacationPhotos2024/IMG1234', (s) => `Key: ${s}`),
    pair(`Assets2024/Build/${hex(32)}/App`, (s) => `Key: ${s}`),
  ]) expect({ text, hidden: isHidden(text, secret), refused: hasSecret(text) }).toEqual({ text, hidden: true, refused: true })
})

test('a key with a `/` near one end or in the middle is hidden and refused', () => {
  for (const [text, secret] of [
    pair(`${rnd(39)}/x`, (s) => `secret: ${s}`),
    pair(`a/${rnd(39)}`, (s) => `secret: ${s}`),
    pair(`${rnd(12)}/${rnd(27)}`, (s) => `aws_secret_access_key = ${s}`),
  ]) expect({ text, hidden: isHidden(text, secret), refused: hasSecret(text) }).toEqual({ text, hidden: true, refused: true })
})

test('a key cut short by `/` (12/11, 8/7/7) is hidden and refused', () => {
  // Fixed, not rnd: a short random key can miss the digit or case mix and stay raw.
  for (const key of ['aB3xQ9zK1pW7/' + 'mN2vL8cT4rY', 'aB3xQ9zK/' + 'mN2vL8c/T4rY6pH', 'aB3xQ9zK1pW7/' + 'mN2vL8cT4rY==', 'aB3xQ9zK1pW7/' + 'mN2+L8cT4rY', '/aB3xQ9zK1pW7/' + 'mN2vL8cT4rY/']) {
    for (const [text, secret] of [pair(key, (s) => `secret: ${s}`), pair(key, (s) => `API_SECRET=${s}`)]) {
      expect({ text, hidden: isHidden(text, secret), refused: hasSecret(text) }).toEqual({ text, hidden: true, refused: true })
    }
  }
})

test('a URL password is hidden after a user as long as a hex username can be', () => {
  const password = 'hunter' + '2hunter2'
  for (const user of [hex(81), hex(200), 'u'.repeat(81), 'u'.repeat(200)]) {
    // A host with no dot: `password@host.com` would be hidden as an address on its own.
    const text = `postgres://${user}:${password}@db/main`
    expect({ text, hidden: isHidden(text, password), refused: hasSecret(text) }).toEqual({ text, hidden: true, refused: true })
  }
  expect(scrub(`postgres://${hex(120)}:${password}@db/main`)).toMatch(/^postgres:\/\/\[REDACTED-SECRET-[0-9a-f]{8}\]:\[REDACTED-SECRET-[0-9a-f]{8}\]@db\/main$/)
})

test('a placeholder survives a second scrub: no pass mints a tag inside a tag', () => {
  for (const [text] of WIDER) expect(scrub(scrub(text))).toBe(scrub(text))
})

for (const [shape, text] of Object.entries({
  'a URL password of many @': `s://a:${'x@'.repeat(15e4)}`,
  'URLs with @ and no end': 's://a:b@c'.repeat(3e4),
  'a long hex run after a scheme': `://${'a'.repeat(3e5)}`,
  'many hex runs after a scheme': `://${'a'.repeat(40)}:x`.repeat(1e4),
  'many long URL users with no password': `s://${'a'.repeat(200)}:x `.repeat(2e3),
  'many long URL users and a run of @': `s://${'a'.repeat(200)}:${'x@'.repeat(100)}`.repeat(1e3),
  'a dotted run after Bearer': `Bearer ${'a.'.repeat(15e4)}`,
  'many dotted runs after Bearer': 'Bearer aaaaaaaa.bbbbbbbb~c '.repeat(2e4),
  'a run of marks after a password': `password=${'a1#'.repeat(1e5)}`,
  'many marked passwords': 'password=a1#b2$c3x '.repeat(2e4),
  'a run of marks with no name': '#a1'.repeat(1e5),
})) {
  test(`linear time, the wider patterns: ${shape}`, () => {
    const start = Date.now()
    hasSecret(text) // time only; the result is not the point
    scrub(text)
    expect(Date.now() - start).toBeLessThan(5000)
  })
}

test('redact: an object key holding a secret is hidden in a result and restored in a tool input', async ($, on) => {
  const key = `${'gh' + 'p_'}${rnd(36)}`
  const seen: string[] = []
  on('ui.notice', () => ({ value: undefined }))
  on('tool.call', (_$, e) => {
    seen.push(JSON.stringify(e))
    return { result: { [key]: { nested: 1 }, plain: 2, data: 'A'.repeat(300) } } as never
  })
  const r = (await $.tool.call({ tool: 'Bash', command: 'x' } as never)) as { result: Record<string, unknown> }
  expect(JSON.stringify(r.result)).not.toContain(key)
  const tag = Object.keys(r.result).find((k) => TAG.test(k))!
  expect(r.result[tag]).toEqual({ nested: 1 })
  expect(r.result.plain).toBe(2)
  expect(r.result.data).toBe('A'.repeat(300)) // a payload under a skipped key stays, and so does its key

  await $.tool.call({ tool: 'Bash', env: { [tag]: '1' } } as never)
  expect(seen.at(-1)).toContain(key)
  expect(seen.at(-1)).not.toContain(tag)
})
