import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { stripVTControlCharacters } from 'node:util'

export type LogLevel = 'INFO' | 'ERROR'

/** Append-only UTF-8 log shared by the Electron host and its DSH child. */
export class DesktopLogger {
  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.info('desktop', 'Log session started')
  }

  info(scope: string, message: string): void {
    this.write('INFO', scope, message)
  }

  error(scope: string, message: string): void {
    this.write('ERROR', scope, message)
  }

  childOutput(stream: 'stdout' | 'stderr', chunk: Buffer | string): void {
    this.write(stream === 'stdout' ? 'INFO' : 'ERROR', `dsh:${stream}`, chunk.toString())
  }

  private write(level: LogLevel, scope: string, message: string): void {
    const timestamp = new Date().toISOString()
    const clean = stripVTControlCharacters(message).replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    const records = clean.split('\n')
      .filter((line, index, lines) => line.length > 0 || lines.length === 1 || index < lines.length - 1)
      .map(line => `[${timestamp}] [${level}] [${scope}] ${line}\n`)
      .join('')

    try {
      appendFileSync(this.path, records, 'utf8')
    } catch (error) {
      console.error(`Unable to write desktop log at ${this.path}`, error)
    }
  }
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message
  return String(error)
}
