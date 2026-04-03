import { exec, ExecException, ChildProcess } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export interface ExecResult {
  stdout: string
  stderr: string
  code: number | null
  signal: NodeJS.Signals | null
  durationMs: number
}

/**
 * Execute a shell command and return detailed results.
 * Provides structured output, timeout handling, and safe error reporting.
 * @param command Shell command to run (e.g., "ls -la")
 * @param timeoutMs Optional timeout in milliseconds (default: 30s)
 */
export async function execCommand(
  command: string,
  timeoutMs: number = 30_000
): Promise<ExecResult> {
  const start = Date.now()
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 })
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      code: 0,
      signal: null,
      durationMs: Date.now() - start,
    }
  } catch (err) {
    const e = err as ExecException & { stdout?: string; stderr?: string }
    return {
      stdout: (e.stdout || "").trim(),
      stderr: (e.stderr || e.message || "").trim(),
      code: e.code ?? 1,
      signal: e.signal ?? null,
      durationMs: Date.now() - start,
    }
  }
}

/**
 * Run a command and throw if exit code != 0
 * @param command Shell command string
 * @param timeoutMs Optional timeout
 */
export async function runCommandStrict(
  command: string,
  timeoutMs: number = 30_000
): Promise<string> {
  const res = await execCommand(command, timeoutMs)
  if (res.code !== 0) {
    throw new Error(`Command failed [code=${res.code}, signal=${res.signal}]: ${res.stderr}`)
  }
  return res.stdout
}

/**
 * Stream command output in real time (stdout + stderr)
 * Useful for long-running tasks (builds, logs, etc.)
 */
export function streamCommand(command: string, timeoutMs: number = 30_000): ChildProcess {
  const proc = exec(command, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 })
  if (proc.stdout) proc.stdout.on("data", data => process.stdout.write(data))
  if (proc.stderr) proc.stderr.on("data", data => process.stderr.write(data))
  return proc
}
