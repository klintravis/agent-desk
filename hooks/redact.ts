import type { EngineInterface as Engine, On, PromptContextBlock } from 'claude-code'
import { PRIVATE_KEY, TEMPLATE_PASSWORD, URL_PASSWORD, VENDOR } from './secretpatterns.mjs'

// Secret redaction, ported from secret-redactor (MIT, see THIRD-PARTY.md) with its defaults fixed
// and its options dropped. Secrets, email addresses and public IP addresses are swapped for a stable
// placeholder on the way into the transcript (the same value always mints the same one, so the model
// can still tell two apart) and swapped back on the way into a tool call, so a command still carries
// the real key. The vault lives in this module's memory for the session; nothing is written to disk.

type Kind = 'SECRET' | 'EMAIL' | 'IP'

const byValue = new Map<string, string>()
const byTag = new Map<string, string>()
let hidden = 0

const TAG = /\[REDACTED-(?:SECRET|EMAIL|IP)-[0-9a-f]{8}\]/g

// A random id, not a hash of the value: a hash can collide, and for a low-entropy value (an IP) it can be enumerated.
function randomId(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! // length 1
  return n.toString(16).padStart(8, '0')
}

function mint(kind: Kind, value: string): string {
  hidden++
  const seen = byValue.get(value)
  if (seen) return seen
  let tag: string
  do tag = `[REDACTED-${kind}-${randomId()}]`; while (byTag.has(tag))
  byValue.set(value, tag)
  byTag.set(tag, value)
  return tag
}

export function restore(text: string): string {
  if (byTag.size === 0) return text
  return text.replace(TAG, (tag) => byTag.get(tag) ?? tag)
}

// ---- secrets

// A run of the characters a key is made of. `/` and `.` are left out: with them every path is a candidate.
// `=` padding rides along, but is kept out of the run so a `name=value` pair does not read as one token.
const CANDIDATE = /[A-Za-z0-9+_-]{12,200}={0,2}/g

// A name to the left of the candidate that says the candidate is a key.
const NAMED =
  /(?:key|token|secret|password|passwd|pwd|credential|auth|bearer|private|signature|session|cookie|dsn|salt|nonce|otp)["'\]\s]{0,4}[:=]{1,2}\s*["'`]?\s*$/i

const HEX_ONLY = /^[0-9a-f]+$/i
const DIGITS_ONLY = /^[0-9]+$/
// Public ids, not keys: a YouTube channel or playlist id; Stripe object ids and its publishable key.
const PUBLIC_SHAPE = /^(?:UC[A-Za-z0-9_-]{22}|PL[A-Za-z0-9_-]{16,32})$/
const PUBLIC_PREFIX =
  /^(?:price|prod|cus|sub|sched|in|ch|pi|cs|py|re|txn|il|si|seti|evt|acct|promo|coupon|plan|card|ba|src|dp|du|iv|ii|rcpt|file|link|pm|tok|pk|test|toolu|msg|req|run|wf)_/i

// A name written in code reads as high entropy but is built out of words; a key is not.
const WORD_PART = /^(?:[a-z]+[0-9]{0,3}|[A-Z][a-z]+[0-9]{0,3}|[A-Z]{2,})$/
const ALNUM_ONLY = /^[A-Za-z0-9]+$/
const SEGMENTS = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g
const WORDY = /^[A-Za-z]?[a-z]{2,}$/

function isCamelName(token: string): boolean {
  if (!ALNUM_ONLY.test(token)) return false
  const segs = token.match(SEGMENTS)
  if (!segs || segs.join('') !== token) return false
  const words = segs.filter((seg) => WORDY.test(seg)).length
  return words >= 2 && words >= segs.length - 2
}

function looksLikeName(token: string, named: boolean): boolean {
  if (isCamelName(token)) return true
  // Every character used once: an alphabet constant; a random key this long repeats one. A name beside it wins.
  if (!named && token.length >= 20 && new Set(token).size === token.length) return true
  const parts = token.split(/[_-]/)
  if (parts.length >= 2 && parts.every((p) => WORD_PART.test(p))) return true
  // Three or more parts, two of them plain words: a naming convention, not a key.
  return parts.length >= 3 && parts.filter((p) => /^[A-Za-z]{4,}$/.test(p)).length >= 2
}

function entropy(text: string): number {
  const counts = new Map<string, number>()
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / text.length
    h -= p * Math.log2(p)
  }
  return h
}

function looksSecret(token: string, before: string): boolean {
  if (token.startsWith('REDACTED-') || DIGITS_ONLY.test(token) || PUBLIC_SHAPE.test(token) || PUBLIC_PREFIX.test(token)) return false
  const named = NAMED.test(before)
  if (looksLikeName(token, named)) return false
  const h = entropy(token)
  // A bare hex run is a git SHA or a checksum far more often than a key: hex needs a name beside it.
  if (HEX_ONLY.test(token)) return named && token.length >= 24 && h >= 3.0
  const mixed = /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token)
  if (mixed && token.length >= 24 && h >= 3.6) return true
  // Next to a key's name the bar is lower, but the token still mixes letters and digits.
  return named && /[0-9]/.test(token) && /[A-Za-z]/.test(token) && token.length >= 16 && h >= 3.0
}

export function scrubSecrets(text: string): string {
  return text
    .replace(PRIVATE_KEY, (m) => mint('SECRET', m))
    .replace(VENDOR, (m) => mint('SECRET', m))
    .replace(URL_PASSWORD, (m, head: string, password: string) =>
      TEMPLATE_PASSWORD.test(password) ? m : `${head}:${mint('SECRET', password)}@`)
    .replace(CANDIDATE, (token: string, offset: number, whole: string) =>
      looksSecret(token, whole.slice(Math.max(0, offset - 64), offset)) ? mint('SECRET', token) : token)
}

// ---- email and IP addresses

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}/g
const OCTET = '(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])'
const IPV4 = new RegExp(`(?<![0-9.])(?:${OCTET}\\.){3}${OCTET}(?![0-9.])`, 'g')
const IPV6 = /(?<![0-9A-Za-z:])(?:[0-9A-Fa-f]{1,4}:){4,7}[0-9A-Fa-f]{1,4}(?![0-9A-Za-z:])/g
// The `::` form. Public addresses start 2xxx or 3xxx, which keeps `std::`, `Foo::bar` and times out.
// shortcut: a first group shorter than 4 digits (`2::1`) is not matched; widen it if one turns up.
const IPV6_SHORT = /(?<![0-9A-Za-z:])[23][0-9A-Fa-f]{3}(?::[0-9A-Fa-f]{1,4}){0,5}::(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,5})?(?![0-9A-Za-z:])/g

// Private, loopback, link-local, CGNAT, multicast, benchmarking and documentation ranges: never a person.
function isPrivateV4(ip: string): boolean {
  const [a = NaN, b = NaN, c = NaN] = ip.split('.').map(Number) // a missing octet is NaN: every comparison is false, as undefined was
  if (a === 10 || a === 127 || a === 0 || a >= 224) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  return (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
}

// Addresses that only stand in for a real one (forms, docs, fixtures, noreply): hiding them is noise.
const EXAMPLE_DOMAIN =
  /@(?:example\.(?:com|org|net)|examples?\.[a-z]+|test|invalid|localhost|acme\.com|(?:your)?domain\.com|company\.com|email\.com|mail\.com|foo\.com|bar\.com|sample\.com|placeholder\.[a-z]+)$/i
// The bare word (up to 4 digits after it), never a longer name that merely starts with one: john.smith@ is a person.
const EXAMPLE_LOCAL = /^(?:(?:you|your|user|username|name|email|someone|test|example|placeholder|jane|john|alice|bob|teammate|colleague|member|admin)[0-9]{0,4}|first\.last)@/i

function allowedEmail(address: string): boolean {
  const low = address.toLowerCase()
  return low.endsWith('@users.noreply.github.com') || low.startsWith('noreply@') || low.startsWith('no-reply@') ||
    EXAMPLE_DOMAIN.test(low) || EXAMPLE_LOCAL.test(low)
}

export function scrubPii(text: string): string {
  return text
    .replace(EMAIL, (m) => (allowedEmail(m) ? m : mint('EMAIL', m)))
    .replace(IPV4, (m) => (isPrivateV4(m) ? m : mint('IP', m)))
    .replace(IPV6, (m) => (/^(?:fe80:|fc|fd)/i.test(m) ? m : mint('IP', m)))
    .replace(IPV6_SHORT, (m) => mint('IP', m))
}

export const scrub = (text: string) => scrubPii(scrubSecrets(text))

// ---- the walker over tool input and results

// A payload (image bytes) under one of these keys is skipped, but only a long base64-looking string: an object
// under `data`, or a short string, is walked like any other value.
const SKIP_KEYS = new Set(['data', 'base64', 'b64_json', 'imageData', 'thumbnail'])
const BLOB = /^[A-Za-z0-9+/_=-]{200,}$/
const MAX_STRING = 8_000_000
const MAX_DEPTH = 12
const WITHHELD = '[agent-desk: value too large or too deep to scan, withheld]'

// `over` answers for what the walker will not scan: scrubbing withholds it (a value never passes raw),
// restoring leaves it, since it only swaps placeholders for values.
function walk(value: unknown, fn: (s: string) => string, over: (v: unknown) => unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length > MAX_STRING ? over(value) : fn(value)
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return over(value)
  if (Array.isArray(value)) return value.map((v) => walk(v, fn, over, depth + 1))
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SKIP_KEYS.has(k) && typeof v === 'string' && BLOB.test(v) ? v : walk(v, fn, over, depth + 1)
  }
  return out
}
const keep = (v: unknown) => v
const withhold = () => { hidden++; return WITHHELD }
const scrubAll = (v: unknown) => walk(v, scrub, withhold)

// These tools carry the model's own words to another model or to the user: a placeholder there stays a placeholder.
const NO_RESTORE = new Set(['Agent', 'SendMessage', 'AskUserQuestion'])

// A cosmetic notification must never change what the model gets: its failure is swallowed.
const quietly = (fn: () => unknown) => { Promise.resolve().then(fn).catch(() => {}) }

// The prompt as typed: a pasted key never reaches the model as itself. Called from register's one
// prompt.submit hook.
export function redactPrompt($: Engine, text: string): string {
  const before = hidden
  const out = scrub(text)
  const n = hidden - before
  if (n > 0) quietly(() => $.ui.toast(`agent-desk: hid ${n} value(s) from the prompt`))
  return out
}

export function registerRedact(on: On) {
  // What a tool reads back is where a secret usually arrives (`cat .env`, a config, an API answer).
  on('tool.call', async ($, e, next) => {
    const r = await next(NO_RESTORE.has(e.tool) ? e : (walk({ ...e }, restore, keep) as typeof e))
    if (r.deny !== undefined) return { deny: scrub(r.deny) }
    const before = hidden
    const result = scrubAll(r.result)
    const text = r.text === undefined ? undefined : scrub(r.text)
    if (hidden === before) return r
    const n = hidden - before
    quietly(() => $.ui.notice(e.tool_use_id, `agent-desk: hid ${n} value(s)`))
    // limit: `context` (notes a settings hook attached) goes back as it came. The engine refuses a hook
    // whose answer rewrites or drops an entry below it ("may not leave an entry out"), and then skips the
    // whole hook, so scrubbing it here would let the raw result through.
    if (r.isError) return { isError: true as const, result, text, context: r.context }
    return { result, context: r.context }
  })
  // The blocks on the first message (CLAUDE.md and the like): secrets only, since the email there is
  // the user's own and the engine puts it there on purpose.
  on('prompt.context', async ($, e, next) => {
    const r = await next(e)
    const blocks: PromptContextBlock[] = r.blocks.map((b) => ({ ...b, text: scrubSecrets(b.text) }))
    return { blocks }
  })
}
