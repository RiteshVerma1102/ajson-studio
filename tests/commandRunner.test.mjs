import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'

import { pathToFileURL } from 'node:url'

// Bundle the REAL TypeScript sources (not re-implemented copies).
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-runner-'))
async function load(entry, name) {
  const outfile = path.join(outDir, name + '.mjs')
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', external: ['electron'], logLevel: 'silent' })
  return import(pathToFileURL(outfile).href)
}
const { CommandRunner, validateRunRequest, isInsideRoot } = await load('electron/services/commandRunner.ts', 'runner')
const { parseGitStatus, getGitStatus } = await load('electron/services/gitService.ts', 'git')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-proj-'))
fs.mkdirSync(path.join(root, 'sub'))

function runToExit(runner, req) {
  return new Promise((resolve) => {
    const events = []
    const r = runner.run(req, (e) => {
      events.push(e)
      if (e.type === 'exit') resolve(events)
    })
    if (!r.ok) resolve({ rejected: r.error })
  })
}
const join = (events, t) => events.filter((e) => e.type === t).map((e) => e.data).join('')

test('runs a real command and captures stdout + exit code 0', async () => {
  const ev = await runToExit(new CommandRunner(), { id: 'a', command: 'echo hello-ajson', cwd: root, projectRoot: root })
  assert.match(join(ev, 'stdout'), /hello-ajson/)
  const exit = ev.at(-1)
  assert.equal(exit.code, 0)
  assert.equal(exit.reason, 'completed')
})

test('captures stderr and non-zero exit code', async () => {
  const ev = await runToExit(new CommandRunner(), { id: 'b', command: 'node -e "console.error(\'oops\'); process.exit(3)"', cwd: root, projectRoot: root })
  assert.match(join(ev, 'stderr'), /oops/)
  assert.equal(ev.at(-1).code, 3)
})

test('runs inside the requested subdirectory', async () => {
  const ev = await runToExit(new CommandRunner(), { id: 'c', command: 'node -e "console.log(process.cwd())"', cwd: path.join(root, 'sub'), projectRoot: root })
  assert.equal(fs.realpathSync(join(ev, 'stdout').trim()), fs.realpathSync(path.join(root, 'sub')))
})

test('rejects cwd outside the project root', async () => {
  const res = await runToExit(new CommandRunner(), { id: 'd', command: 'echo x', cwd: os.tmpdir(), projectRoot: root })
  assert.match(res.rejected, /outside the project root/)
})

test('rejects ".." traversal and sibling-prefix directories', () => {
  assert.equal(isInsideRoot(path.join(root, '..'), root), false)
  assert.equal(isInsideRoot(root + '-evil', root), false)
  assert.ok(validateRunRequest({ id: 'e', command: 'ls', cwd: path.join(root, 'sub', '..', '..'), projectRoot: root }))
})

test('rejects symlink that escapes the project root', () => {
  const link = path.join(root, 'escape')
  try {
    fs.symlinkSync(os.tmpdir(), link, process.platform === 'win32' ? 'junction' : 'dir')
  } catch {
    return
  }
  assert.match(validateRunRequest({ id: 'f', command: 'ls', cwd: link, projectRoot: root }), /outside the project root/)
})

test('rejects empty command, missing root, null byte, duplicate id', async () => {
  assert.ok(validateRunRequest({ id: 'g', command: '   ', cwd: root, projectRoot: root }))
  assert.ok(validateRunRequest({ id: 'g', command: 'ls', cwd: root, projectRoot: '' }))
  assert.ok(validateRunRequest({ id: 'g', command: 'ls\0', cwd: root, projectRoot: root }))
  const runner = new CommandRunner()
  assert.ok(runner.run({ id: 'dup', command: 'node -e "setTimeout(() => {}, 5000)"', cwd: root, projectRoot: root }, () => {}).ok)
  assert.equal(runner.run({ id: 'dup', command: 'echo', cwd: root, projectRoot: root }, () => {}).ok, false)
  runner.killAll()
})

test('cancellation kills a long-running process and reports reason=killed', async () => {
  const runner = new CommandRunner()
  const p = runToExit(runner, { id: 'k', command: 'node -e "setTimeout(() => {}, 30000)"', cwd: root, projectRoot: root })
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(runner.kill('k'), true)
  const ev = await p
  assert.equal(ev.at(-1).reason, 'killed')
  assert.equal(runner.runningCount(), 0)
})

test('cancellation kills the whole process tree (child of the shell)', async () => {
  const runner = new CommandRunner()
  const marker = path.join(root, 'tree-pid')
  const p = runToExit(runner, { id: 't', command: `sh -c 'echo $$ > "${marker}"; sleep 30' & wait`, cwd: root, projectRoot: root })
  await new Promise((r) => setTimeout(r, 500))
  const childPid = parseInt(fs.readFileSync(marker, 'utf8'), 10)
  runner.kill('t')
  await p
  await new Promise((r) => setTimeout(r, 300))
  // kill(pid, 0) succeeds for zombies (dead but unreaped), so read the real state on Linux.
  let alive = true
  try { process.kill(childPid, 0) } catch { alive = false }
  if (alive && fs.existsSync(`/proc/${childPid}/stat`)) {
    const state = fs.readFileSync(`/proc/${childPid}/stat`, 'utf8').replace(/^.*\) /, '')[0]
    if (state === 'Z' || state === 'X') alive = false
  }
  assert.equal(alive, false, 'grandchild process must be dead')
})

test('timeout terminates the process with reason=timeout', async () => {
  const ev = await runToExit(new CommandRunner(), { id: 'to', command: 'node -e "setTimeout(() => {}, 30000)"', cwd: root, projectRoot: root, timeoutMs: 1000 })
  assert.equal(ev.at(-1).reason, 'timeout')
})

test('unknown command surfaces a non-zero exit, not a fake success', async () => {
  const ev = await runToExit(new CommandRunner(), { id: 'u', command: 'definitely-not-a-real-cmd-xyz', cwd: root, projectRoot: root })
  assert.notEqual(ev.at(-1).code, 0)
})

test('parseGitStatus parses branch, ahead/behind and changes', () => {
  const out = '## main...origin/main [ahead 2, behind 1]\n M src/a.ts\nA  src/b.ts\n?? new.txt\n'
  const s = parseGitStatus(out)
  assert.equal(s.branch, 'main')
  assert.equal(s.ahead, 2)
  assert.equal(s.behind, 1)
  assert.deepEqual(s.changes, [
    { index: ' ', workTree: 'M', path: 'src/a.ts' },
    { index: 'A', workTree: ' ', path: 'src/b.ts' },
    { index: '?', workTree: '?', path: 'new.txt' },
  ])
  assert.equal(parseGitStatus('## No commits yet on dev\n').branch, 'dev')
  assert.equal(parseGitStatus('## HEAD (no branch)\n').branch, 'HEAD (detached)')
})

test('getGitStatus reports isRepo=false outside a repo and real data inside one', async () => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-nogit-'))
  assert.equal((await getGitStatus(plain)).isRepo, false)
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-git-'))
  execFileSync('git', ['init', '-q', '-b', 'trunk'], { cwd: repo })
  fs.writeFileSync(path.join(repo, 'f.txt'), 'x')
  const s = await getGitStatus(repo)
  assert.equal(s.isRepo, true)
  assert.equal(s.branch, 'trunk')
  assert.deepEqual(s.changes.map((c) => c.path), ['f.txt'])
})

const { parseNodeTestSummary } = await load('src/utils/testSummary.ts', 'summary')

test('parseNodeTestSummary reads real node --test output', () => {
  const real = execFileSync('node', ['--test', '--test-reporter=tap'], { cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-nt-')), encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: undefined }, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  // empty dir => 0 tests; summary must still parse
  const s = parseNodeTestSummary(real)
  assert.ok(s && s.tests === 0 && s.fail === 0)
  const sample = '# tests 96\n# suites 0\n# pass 94\n# fail 2\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 643.4\n'
  assert.deepEqual(parseNodeTestSummary(sample), { tests: 96, pass: 94, fail: 2, skipped: 0, durationMs: 643.4 })
  assert.equal(parseNodeTestSummary('no summary here'), null)
})
