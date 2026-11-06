// Secret shapes, ported from secret-redactor (MIT, see THIRD-PARTY.md).
// Shared, Node-free: hooks/redact.ts masks them, `desk wt merge` and `desk decide` refuse text that holds one.

// Shapes that belong to one vendor and mean one thing: hidden on sight, whatever their entropy.
// On raw text the JWT alternative is quadratic: go through maskVendor or hasSecret.
export const VENDOR = new RegExp(
  [
    'sk-ant-[A-Za-z0-9_-]{16,}',
    // A digit within 100 characters (with no limit, a long digit-free run takes quadratic time in the redactor), not a left boundary: keys land after `\n`, `%3D` or a word, and `risk-based-rollout-for-every-branch` is a sentence.
    // shortcut: a real key with no digit in its first 101 characters is not caught by this pattern and a long hyphenated word holding a digit after `sk-` is treated as a key (the CLI refuses it, the dialog's Other text masks it silently), add a vendor checksum if one ever exists.
    'sk-(?=[A-Za-z0-9_-]{0,100}\\d)[A-Za-z0-9_-]{20,}',
    'gh[pousr]_[A-Za-z0-9]{20,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    'xox[baprse]-[A-Za-z0-9-]{10,}',
    'xapp-[0-9]-[A-Za-z0-9-]{10,}',
    'A(?:KIA|SIA)[0-9A-Z]{16}',
    '[sr]k_(?:live|test)_[A-Za-z0-9]{16,}',
    'whsec_[A-Za-z0-9]{16,}',
    'AIza[0-9A-Za-z_-]{30,}',
    'ya29\\.[A-Za-z0-9_-]{20,}',
    'npm_[A-Za-z0-9]{30,}',
    'dop_v1_[a-f0-9]{40,}',
    'glpat-[A-Za-z0-9_-]{16,}',
    'shpat_[a-f0-9]{32,}',
    'SG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}',
    'eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}',
    'https://hooks\\.slack\\.com/services/[A-Za-z0-9/+_-]{16,}',
    'https://discord(?:app)?\\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]{16,}',
  ].join('|'),
  'g',
)

// PEM and PGP private keys. With no END the block runs to the end of the text: a truncated paste is still a key.
// Linear on raw text: a header always matches, so what it scanned is consumed and never scanned again.
export const PRIVATE_KEY = /-----BEGIN[^\n-]{0,40}PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END[^\n-]{0,40}PRIVATE KEY(?: BLOCK)?-----|$)/g

// All of a run's eyJ share the dots ahead and a later one has a shorter first part, so the first decides
// for the run, and a run that fails is renamed before VENDOR retries each of its eyJ to the run's end.
// eyK is safe for the other shapes: same length, J and K share every character class, no literal holds J or `yK`.
const JWT_RUN = /eyJ([A-Za-z0-9_-]*)(?=(\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})?)/g
/** @param {string} text */
const withoutDeadJwtStarts = (text) => text.replace(JWT_RUN, (run, first, rest) =>
  rest && first.length >= 8 ? run : run.replaceAll('eyJ', 'eyK'))

/** Same matches as `text.replace(VENDOR, mask)`, in linear time.
 * @param {string} text @param {(match: string) => string} mask */
export const maskVendor = (text, mask) => {
  let out = ''
  let last = 0
  for (const m of withoutDeadJwtStarts(text).matchAll(VENDOR)) {
    out += text.slice(last, m.index) + mask(text.slice(m.index, m.index + m[0].length)) // from text: a key may hold a renamed eyJ
    last = m.index + m[0].length
  }
  return out + text.slice(last)
}


// The password may hold `@`, but a piece after one may not hold `:`, `?` or `#`, and a template placeholder never takes one: `${PASS}@h:5432?x=a@b` has its host and query there, and a plain `[^\s/]{3,200}` would refuse it.
// The `@` branch comes first, or `abc` wins in `abc@defgh@db`.
// shortcut: a password with one of those characters after an `@` (`abc@d:ef@db`), or with more than 10 `@`, is hidden only up to there, and one after a user of more than 200 characters stays raw; widen the piece if such passwords show up.
// shortcut: a password of 1 or 2 characters stays raw, since `mailto://a:b@c` looks the same, and so does every later host's password after it, since the walk stops there (`a:pw@h1,b:<password>@h2`); accept short passwords, with a port check, if such URLs show up.
// The password inside a connection string (scheme://user:<password>@host); the user may be empty (redis://:pw@host).
const PASSWORD_PART = String.raw`((?!(?:\$\{[\w.]+\}|\{\{[\w.]+\}\})@)[^\s/@]{1,200}(?:@[^\s/@:?#]{1,200}){1,10}|[^\s/@]{3,200})@`
// The user may hold `@`, since `:` still ends it at one place: no backtracking is added.
// With `@` in the user it may be a host, and the "password" its port: `a@h1:27017,b@h2`, `me@host:8443?to=a@b`.
// shortcut: so a password of digits and then `,`, `?` or `#`, after a user holding `@`, stays raw, and a later host's password after a host that has a user and no password stays raw too; tell ports from passwords by parsing the hosts if one shows up.
const PORT_AFTER_USER_HOST = /^\d{1,5}[,?#]/
const URL_PASSWORD = new RegExp(String.raw`\b([a-z][a-z0-9+.-]{1,20}:\/\/[^\s/:]{0,200}):${PASSWORD_PART}`, 'gi')
// A later host's password in a multi-host URL: hosts up to a comma, then `user:password@`. Tried from the end of a password only.
// shortcut: stays raw after more than 64 hosts or a host of more than 260 characters, and a later password holding both `,` and `:` is hidden only after its last comma; raise the bounds if such URLs show up.
// shortcut: a later host's port, then `?` or `#` and an `@` in the query (`a:${P}@h1:27017,h2:27017?to=x@y`), reads as a password: it is hidden and refused, which fails safe; parse the hosts if such URLs get refused. The port check is not run here, since it would leave a later password of digits and a comma raw.
const NEXT_HOST_PASSWORD = new RegExp(String.raw`((?:[^\s/@,]{0,260},){1,64}[^\s/@:,]{0,200}):${PASSWORD_PART}`, 'y')
// A password that is one template placeholder and nothing else (`${pass}`, `{{pass}}`) is source text,
// not a secret. Inside: a bare name or dotted path only, so a default value (`${P:-pw}`,
// `${a||"pw"}`, `{{p|default('pw')}}`) and `${a}${b}` stay hidden.
// `<...>`, `%VAR%` and `$VAR` are left out: `<SuperSecret>` and `$ecret99` are real passwords.
// Nor is one redaction placeholder a secret: it is what a masked URL holds. Exactly one, so nothing can ride along with it.
const KEPT_URL_PASSWORD = /^(?:\$\{[\w.]+\}|\{\{[\w.]+\}\}|\[REDACTED-(?:SECRET|EMAIL|IP)-[0-9a-f]{8}\])$/

/** Masks each connection-string password, a multi-host URL's later ones too. Linear: a walk stops at the first `/` or `@`
 * it cannot use, and the next URL match starts after that, since a scheme holds neither and needs `://`.
 * @param {string} text @param {(password: string) => string} mask */
export const maskUrlPasswords = (text, mask) => {
  let out = ''
  let last = 0
  for (const first of text.matchAll(URL_PASSWORD)) {
    /** @type {RegExpExecArray | RegExpMatchArray | null} */
    let m = first
    while (m) {
      const password = m[2] ?? ''
      const start = (m.index ?? 0) + (m[1] ?? '').length + 1
      const port = (m[1] ?? '').includes('@') && PORT_AFTER_USER_HOST.test(password)
      if (!port && !KEPT_URL_PASSWORD.test(password)) {
        out += text.slice(last, start) + mask(password)
        last = start + password.length
      }
      // From a port the walk goes on inside what was read as a password: `a@h1:27017,b:pw@h2`.
      NEXT_HOST_PASSWORD.lastIndex = port ? start : (m.index ?? 0) + m[0].length
      m = NEXT_HOST_PASSWORD.exec(text)
    }
  }
  return out + text.slice(last)
}

// ---- keys known by their shape or by the name beside them

// A run of the characters a key is made of. `/` and `.` are left out: with them every path is a candidate.
// `=` padding rides along, but is kept out of the run so a `name=value` pair does not read as one token.
const CANDIDATE = /[A-Za-z0-9+_-]{12,200}={0,2}/g
// The run with `/`, which base64 keys hold. No `_` or `-`: no base64 alphabet mixes them with `/`, but paths do.
// Paths without them are left to slashedKey.
const SLASHED = /[A-Za-z0-9+/]{24,200}={0,2}/g
// A bearer token's run: RFC 6750 allows `.` and `~`. Dotted code paths are told apart by bearerKey.
const BEARER_RUN = /[A-Za-z0-9._~+-]{16,500}/g
// A password's run. It stops at what ends or surrounds a value in text, and at `/`, or every path is a candidate.
const PASSWORD_RUN = /[^\s"'`=:<>(){}[\],;/]{8,200}/g
// A long hex token as a URL's username (scheme://<hex>@host, scheme://<hex>:x-oauth-basic@host), which a host, even with a port, is not.
const URL_HEX_USER = /(?<=:\/\/)[0-9a-f]{32,200}(?=(?::[^\s/@]{0,200})?@)/gi

// What ends a key's name to the left of the candidate.
const NAME_END = '["\'\\]\\s]{0,4}[:=]{1,2}\\s*["\'`]?\\s*$'
// An allow-list, since most suffixes make another thing of the name: `KEY_ID`, `TOKEN_URL`, `SESSION_TIMEOUT`, `CACHE_KEY_HASH`.
const NAME_SUFFIX = '(?:[_.-](?:base|prod|production|dev|development|stage|staging|test|live|qa|uat|v?[0-9]+))?'
// `pass` needs a left edge, or `bypass` and `compass` are names; the prefixes are the joined spellings people use (`DBPASS`, `dbPass`).
// shortcut: another joined spelling (`mysqlpass`) stays raw, and so does `pass:` after a word and a space, which reads as a sentence (`all tests pass: <sha>`), though `user pass: <value>` may be meant; add a prefix if one shows up.
// shortcut: `pass: <sha>` is hidden and refused, like `key: <sha>`, since YAML's `pass: <value>` looks the same, unless a letter and one space or tab come right before it: so `CI: pass: <sha>`, `209 pass: <sha>` and `tests  pass: <sha>` (two spaces) are refused too; exempt a bare 40-hex value if such lines get refused.
const PASS_NAME = `(?<![a-z])(?:db|pg|sql|user|root|admin)?pass${NAME_SUFFIX}`
// A flag and its value, split by a space or tab: not a line break, so a help text's next line is not its value.
// shortcut: `-p <value>` and `-p<value>` stay raw (`mkdir -p`, `ssh -p 22`, `grep -p` are ordinary text), and so does a single-dash `-password <value>`; add a tool's own form if one shows up.
const PASSWORD_FLAG = '--(?:password|passwd|pwd|pass)[ \\t]+["\'`]?$'
// `$` on every branch: without it any `key=` in the window would mark every later token as named.
const NAMED = new RegExp(`(?:key|token|secret|password|passwd|pwd|credential|auth|bearer|private|signature|session|cookie|dsn|salt|nonce|otp)${NAME_SUFFIX}${NAME_END}|(?<![a-z][ \\t])${PASS_NAME}${NAME_END}|${PASS_NAME}["'\\]\\s]{0,4}={1,2}\\s*["'\`]?\\s*$|${PASSWORD_FLAG}|\\bbearer\\s+$|\\bauthorization["']?\\s*:\\s*["']?token\\s+$`, 'i')
// People make passwords out of words; machines make keys. Beside these names a value built of words counts only with a digit.
// A bare `pass` is left out: `pass: build#1234` is a CI line. After a letter or digit and `_`, `.` or `-` (`DB_PASS`), or after `--` (`--pass=`), it is a password's name; joined (`PGPASS`, `dbPass`) or bare (`PASS=`) it is a key's name only.
const PASSWORD_NAMED = new RegExp(`(?:password|passwd|pwd|(?<=[a-z0-9][_.-]|--)pass)${NAME_SUFFIX}${NAME_END}|${PASSWORD_FLAG}`, 'i')

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

/** @param {string} token */
function isCamelName(token) {
  if (!ALNUM_ONLY.test(token)) return false
  const segs = token.match(SEGMENTS)
  if (!segs || segs.join('') !== token) return false
  const words = segs.filter((seg) => WORDY.test(seg)).length
  return words >= 2 && words >= segs.length - 2
}

/** @param {string} token @param {boolean} named */
function looksLikeName(token, named) {
  if (isCamelName(token)) return true
  const parts = token.split(/[_-]/)
  if (parts.length >= 2 && parts.every((p) => WORD_PART.test(p))) return true
  // Below, shapes a key can also have: a name beside the token wins.
  if (named) return false
  // Every character used once: an alphabet constant; a random key this long repeats one.
  if (token.length >= 20 && new Set(token).size === token.length) return true
  // Three or more parts, two of them plain words: a naming convention, not a key.
  return parts.length >= 3 && parts.filter((p) => /^[A-Za-z]{4,}$/.test(p)).length >= 2
}

/** @param {string} text */
function entropy(text) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / text.length
    h -= p * Math.log2(p)
  }
  return h
}

// Lowercase, uppercase and digits, long and random enough to be a key with no name beside it.
/** @param {string} token @param {number} h */
const mixedKey = (token, h) => /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token) && token.length >= 24 && h >= 3.6

/** @param {string} token @param {string} before */
// shortcut: the named bar has limits: a word value needs a digit (`DB_PASSWORD=correct-horse-battery-staple`, `password=correct_horse_battery_staple` stay raw), a hex run needs 24 characters (`DB_PASSWORD=` + 16 hex stays raw), a slash key must mix lowercase, uppercase and digits and have 24+ characters; lower the bar if such secrets leak.
function looksSecret(token, before) {
  if (token.startsWith('REDACTED-') || DIGITS_ONLY.test(token)) return false
  const named = NAMED.test(before)
  if (!named && (PUBLIC_SHAPE.test(token) || PUBLIC_PREFIX.test(token))) return false
  if (!PASSWORD_NAMED.test(before) && looksLikeName(token, named)) return false
  const h = entropy(token)
  // A bare hex run is a git SHA or a checksum far more often than a key: hex needs a name beside it.
  if (HEX_ONLY.test(token)) return named && token.length >= 24 && h >= 3.0
  if (mixedKey(token, h)) return true
  // Next to a key's name the bar is lower, but the token still mixes letters and digits.
  return named && /[0-9]/.test(token) && /[A-Za-z]/.test(token) && token.length >= 16 && h >= 3.0
}

// A key holding `/`, or a path beside a key's name: a path's segments, joined, read as a code name; a key's do not.
// shortcut: a mixed-case object key with a digit and no `-` or `_` (`"Key": "photos/2024/SummerTrip/IMG1234.jpg"`) still counts as a key, and hasSecret refuses it; judge each `/` piece on its own if that bites.
/** @param {string} token @param {string} before */
const slashedKey = (token, before) => token.includes('/') && NAMED.test(before)
  && mixedKey(token, entropy(token)) && !looksLikeName(token.replaceAll('/', ''), true)

// A bearer token holding `.` or `~` is judged with them taken out. Beside `bearer` a dotted code path reads as a name, or has no digit.
/** @param {string} token @param {string} before */
const bearerKey = (token, before) => /[.~]/.test(token) && /\bbearer\s+$/i.test(before) && looksSecret(token.replace(/[.~]/g, ''), before)

// A password holding `#`, `$`, `!` or `@`: letters, a digit, and that mark after a letter or digit, since a leading one makes a variable (`$dbPass2`, `!isValid2`).
// A `.` makes it a code path or an address (`config?.db2!.pass`, `user1@example.com`).
// shortcut: stays raw when it is under 8 characters, holds `.`, `/`, `=` or `:`, or has its only mark in front (`!Passw0rd1`); other marks and other key names are out too. Code or prose after `password` is hidden and refused: a camelCase name with a digit and a TypeScript `!` (`dbPass2!`), two joined shell variables (`$DB1$DB2`), an issue reference (`issue#123`). Widen it if such passwords show up, narrow it if such text gets refused.
/** @param {string} token @param {string} before */
const punctPassword = (token, before) => PASSWORD_NAMED.test(before) && !token.includes('.')
  && /[A-Za-z]/.test(token) && /[0-9]/.test(token) && /[A-Za-z0-9][#$!@]/.test(token)

/** Masks each key in the text. With `onlyNamed`, only those with a key's name beside them.
 * @param {string} text @param {(key: string) => string} mask @param {boolean} [onlyNamed] */
export const maskKeys = (text, mask, onlyNamed = false) => {
  /** @param {string} s @param {RegExp} run @param {(token: string, before: string) => boolean} isKey */
  const pass = (s, run, isKey) => s.replace(run, (token, /** @type {number} */ offset) => {
    const before = s.slice(Math.max(0, offset - 64), offset)
    return (!onlyNamed || NAMED.test(before)) && isKey(token, before) ? mask(token) : token
  })
  // Not gated by onlyNamed: a URL's username slot is as good as a name beside it.
  const unnamed = text.replace(URL_HEX_USER, (token) => (entropy(token) >= 3.0 ? mask(token) : token))
  return pass(pass(pass(pass(unnamed, SLASHED, slashedKey), BEARER_RUN, bearerKey), PASSWORD_RUN, punctPassword), CANDIDATE, looksSecret)
}

// search and matchAll, not test: the shared `g` regexes must not carry a lastIndex between calls.
// Named keys only: this check refuses text rather than masking it, and an unnamed token is too weak a reason.
/** @param {string} text */
export const hasSecret = (text) => text.search(PRIVATE_KEY) >= 0
  || withoutDeadJwtStarts(text).search(VENDOR) >= 0
  || maskUrlPasswords(text, () => '#') !== text
  || maskKeys(text, () => '#', true) !== text
