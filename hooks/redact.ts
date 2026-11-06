import type { EngineInterface as Engine, On, PromptContextBlock } from 'claude-code'
import { maskKeys, maskUrlPasswords, maskVendor, PRIVATE_KEY } from './secretpatterns.mjs'

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

function scrubSecrets(text: string): string {
  const hide = (m: string) => mint('SECRET', m)
  // URL passwords before vendor shapes: restore is single-pass, so a tag inside a tag would reach a tool call.
  return maskKeys(maskVendor(maskUrlPasswords(text.replace(PRIVATE_KEY, hide), hide), hide), hide)
}

// ---- email and IP addresses

// The address part is optional so a run with none is consumed once. Required, every start in the run rescans
// it (quadratic); no start is lost, since a later one in the run reaches the same `@` and domain as the first.
const EMAIL = /[A-Za-z0-9._%+-]+(@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24})?/g
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
    .replace(EMAIL, (m, address?: string) => (!address || allowedEmail(m) ? m : mint('EMAIL', m)))
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
    out[fn(k)] = SKIP_KEYS.has(k) && typeof v === 'string' && BLOB.test(v) ? v : walk(v, fn, over, depth + 1)
  }
  return out
}
const keep = (v: unknown) => v
const withhold = () => { hidden++; return WITHHELD }
const scrubAll = (v: unknown) => walk(v, scrub, withhold)

// These tools carry the model's own words to another model, to the user or off the machine (a search query, a
// fetched URL): a placeholder there stays a placeholder.
const NO_RESTORE = new Set(['Agent', 'SendMessage', 'SubagentHandback', 'AskUserQuestion', 'WebSearch', 'WebFetch'])

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
