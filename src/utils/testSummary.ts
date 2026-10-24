export interface TestSummary {
  tests: number
  pass: number
  fail: number
  skipped: number
  durationMs: number | null
}

/** Parses the trailing summary of `node --test` (TAP-ish) output. Returns null if none found. */
export function parseNodeTestSummary(output: string): TestSummary | null {
  const num = (label: string): number | null => {
    const m = new RegExp(`^\\s*(?:#|ℹ)\\s+${label}\\s+([0-9.]+)`, 'm').exec(output)
    return m ? Number(m[1]) : null
  }
  const tests = num('tests')
  const pass = num('pass')
  const fail = num('fail')
  if (tests === null || pass === null || fail === null) return null
  return {
    tests,
    pass,
    fail,
    skipped: num('skipped') ?? 0,
    durationMs: num('duration_ms'),
  }
}
