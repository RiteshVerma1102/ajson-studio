import { execFile } from 'child_process'

export interface GitChange {
  path: string
  /** Index (staged) status letter, or ' ' */
  index: string
  /** Work-tree status letter, or ' ' */
  workTree: string
}

export interface GitStatus {
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  changes: GitChange[]
  error?: string
}

/** Parses `git status --porcelain=v1 -b` output. */
export function parseGitStatus(output: string): Omit<GitStatus, 'isRepo'> {
  const lines = output.split('\n').filter((l) => l.length > 0)
  let branch: string | null = null
  let ahead = 0
  let behind = 0
  const changes: GitChange[] = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      const info = line.slice(3)
      if (info.startsWith('No commits yet on ')) {
        branch = info.slice('No commits yet on '.length)
      } else if (info.startsWith('HEAD (no branch)')) {
        branch = 'HEAD (detached)'
      } else {
        branch = info.split('...')[0].split(' ')[0]
        const a = /ahead (\d+)/.exec(info)
        const b = /behind (\d+)/.exec(info)
        ahead = a ? parseInt(a[1], 10) : 0
        behind = b ? parseInt(b[1], 10) : 0
      }
      continue
    }
    if (line.length < 4) continue
    changes.push({ index: line[0], workTree: line[1], path: line.slice(3) })
  }
  return { branch, ahead, behind, changes }
}

export function getGitStatus(cwd: string): Promise<GitStatus> {
  return new Promise((resolve) => {
    // execFile without a shell: no injection surface.
    execFile(
      'git',
      ['status', '--porcelain=v1', '-b'],
      { cwd, timeout: 15000, maxBuffer: 5 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const msg = String(stderr || error.message)
          const notRepo = /not a git repository/i.test(msg)
          resolve({ isRepo: false, branch: null, ahead: 0, behind: 0, changes: [], error: notRepo ? undefined : msg.trim() })
          return
        }
        resolve({ isRepo: true, ...parseGitStatus(stdout) })
      }
    )
  })
}
