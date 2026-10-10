import { SupportedLanguage } from '../types/editor'

/**
 * Infers the Monaco editor language from a filename or extension.
 */
export function getLanguageFromPath(filePath: string): SupportedLanguage {
  const lower = filePath.toLowerCase()
  const baseName = lower.split(/[/\\]/).pop() || ''

  // Special full filenames
  if (baseName === 'dockerfile') return 'shell'
  if (baseName === '.gitignore' || baseName === '.env' || baseName === '.env.example') return 'plaintext'
  if (baseName === 'package.json' || baseName === 'tsconfig.json') return 'json'

  const ext = baseName.includes('.') ? baseName.split('.').pop() || '' : ''

  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'py':
    case 'pyw':
      return 'python'
    case 'json':
    case 'jsonc':
      return 'json'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
    case 'scss':
    case 'less':
      return 'css'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return 'shell'
    case 'sql':
      return 'sql'
    case 'xml':
    case 'svg':
      return 'xml'
    default:
      return 'plaintext'
  }
}

/**
 * Checks whether an extension indicates a binary file that shouldn't open in Monaco.
 */
export function isBinaryExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const binaryExtensions = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff',
    'zip', 'tar', 'gz', '7z', 'rar', 'bz2',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'node', 'wasm',
    'mp3', 'wav', 'ogg', 'flac', 'aac',
    'mp4', 'mkv', 'avi', 'mov', 'webm',
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    'class', 'pyc', 'pyo', 'obj', 'o',
  ])
  return binaryExtensions.has(ext)
}

/**
 * Validates a proposed filename against illegal characters.
 */
export function validateFileName(name: string): string | null {
  if (!name || name.trim() === '') {
    return 'Name cannot be empty.'
  }
  const illegalRe = /[<>:"/\\|?*\x00-\x1F]/
  if (illegalRe.test(name)) {
    return 'Name cannot contain characters / \\ : * ? " < > | or control characters.'
  }
  return null
}
