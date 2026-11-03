// Secret shapes, ported from secret-redactor (MIT, see THIRD-PARTY.md).
// Shared, Node-free: hooks/redact.ts masks them, `desk wt merge` refuses a PR body that holds one.

// Shapes that belong to one vendor and mean one thing: hidden on sight, whatever their entropy.
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

export const PRIVATE_KEY = /-----BEGIN[^\n-]{0,40}PRIVATE KEY-----[\s\S]*?-----END[^\n-]{0,40}PRIVATE KEY-----/g

// The password inside a connection string (scheme://user:<password>@host).
export const URL_PASSWORD = /\b([a-z][a-z0-9+.-]{1,20}:\/\/[^\s/@:]{1,80}):([^\s/@]{3,200})@/gi
// A password that is one template placeholder and nothing else (`${pass}`, `{{pass}}`) is source text,
// not a secret. Inside: a bare name or dotted path only, so a default value (`${P:-pw}`,
// `${a||"pw"}`, `{{p|default('pw')}}`) and `${a}${b}` stay hidden.
// `<...>`, `%VAR%` and `$VAR` are left out: `<SuperSecret>` and `$ecret99` are real passwords.
export const TEMPLATE_PASSWORD = /^(?:\$\{[\w.]+\}|\{\{[\w.]+\}\})$/

// search and matchAll, not test: the shared `g` regexes must not carry a lastIndex between calls.
/** @param {string} text */
export const hasSecret = (text) => text.search(PRIVATE_KEY) >= 0 || text.search(VENDOR) >= 0
  || [...text.matchAll(URL_PASSWORD)].some((m) => !TEMPLATE_PASSWORD.test(m[2] ?? ''))
