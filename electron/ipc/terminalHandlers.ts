import { ipcMain, BrowserWindow } from 'electron'
import { CommandRunner, CommandEvent } from '../services/commandRunner'
import { getGitStatus } from '../services/gitService'

const runner = new CommandRunner()

export function registerTerminalIpcHandlers(
  mainWindow: BrowserWindow,
  getProjectRoot: () => string | null
): void {
  ipcMain.handle(
    'terminal:run',
    (_e, req: { id: string; command: string; cwd?: string; timeoutMs?: number }) => {
      const root = getProjectRoot()
      if (!root) return { ok: false, error: 'Open a project folder before running commands' }
      if (!req || typeof req !== 'object') return { ok: false, error: 'Invalid request' }
      return runner.run(
        {
          id: String(req.id),
          command: String(req.command ?? ''),
          cwd: typeof req.cwd === 'string' && req.cwd ? req.cwd : root,
          projectRoot: root,
          timeoutMs: typeof req.timeoutMs === 'number' ? req.timeoutMs : undefined,
        },
        (event: CommandEvent) => {
          if (!mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:event', event)
        }
      )
    }
  )

  ipcMain.handle('terminal:kill', (_e, id: string) => ({ ok: runner.kill(String(id)) }))

  ipcMain.handle('git:status', async () => {
    const root = getProjectRoot()
    if (!root) return { isRepo: false, branch: null, ahead: 0, behind: 0, changes: [] }
    return getGitStatus(root)
  })

  mainWindow.on('closed', () => runner.killAll())
}
