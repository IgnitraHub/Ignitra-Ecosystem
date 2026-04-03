import { execCommand, runCommandStrict, ExecResult } from "./execCommand"

export interface ShellTask {
  id: string
  command: string
  description?: string
  strict?: boolean // if true, non-zero exit codes throw
}

export interface ShellResult {
  taskId: string
  output?: string
  error?: string
  executedAt: number
  finishedAt: number
  durationMs: number
  code?: number | null
  signal?: NodeJS.Signals | null
}

export class ShellTaskRunner {
  private tasks: ShellTask[] = []

  /**
   * Schedule a shell task for later execution.
   */
  scheduleTask(task: ShellTask): void {
    this.tasks.push(task)
  }

  /**
   * Clear all scheduled tasks without running them.
   */
  clearTasks(): void {
    this.tasks = []
  }

  /**
   * Execute all scheduled tasks in sequence.
   * Returns structured results including duration, exit code, and signals.
   */
  async runAll(): Promise<ShellResult[]> {
    const results: ShellResult[] = []
    for (const task of this.tasks) {
      const start = Date.now()
      try {
        const res: ExecResult | string = task.strict
          ? await runCommandStrict(task.command)
          : await execCommand(task.command)

        if (typeof res === "string") {
          results.push({
            taskId: task.id,
            output: res,
            executedAt: start,
            finishedAt: Date.now(),
            durationMs: Date.now() - start,
            code: 0,
            signal: null,
          })
        } else {
          results.push({
            taskId: task.id,
            output: res.stdout,
            error: res.stderr || undefined,
            executedAt: start,
            finishedAt: Date.now(),
            durationMs: res.durationMs,
            code: res.code,
            signal: res.signal,
          })
        }
      } catch (err: any) {
        results.push({
          taskId: task.id,
          error: err.message,
          executedAt: start,
          finishedAt: Date.now(),
          durationMs: Date.now() - start,
        })
      }
    }
    this.clearTasks()
    return results
  }

  /**
   * Run a single task by ID if scheduled.
   */
  async runTaskById(id: string): Promise<ShellResult | null> {
    const task = this.tasks.find(t => t.id === id)
    if (!task) return null
    const results = await this.runAll()
    return results.find(r => r.taskId === id) || null
  }

  /**
   * List scheduled tasks without running them.
   */
  listTasks(): ShellTask[] {
    return [...this.tasks]
  }
}
