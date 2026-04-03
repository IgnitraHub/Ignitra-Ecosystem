/**
 * ExecutionEngine: registers, enqueues, and executes async tasks by type.
 * Includes queue inspection, clearing, and per-task result reporting.
 */
type Handler = (params: any) => Promise<any>

interface Task {
  id: string
  type: string
  params: any
}

interface TaskResult {
  id: string
  result?: any
  error?: string
  startedAt: number
  finishedAt: number
}

export class ExecutionEngine {
  private handlers: Record<string, Handler> = {}
  private queue: Task[] = []

  register(type: string, handler: Handler): void {
    if (this.handlers[type]) {
      throw new Error(`Handler for "${type}" is already registered`)
    }
    this.handlers[type] = handler
  }

  enqueue(id: string, type: string, params: any): void {
    if (!this.handlers[type]) throw new Error(`No handler registered for type "${type}"`)
    this.queue.push({ id, type, params })
  }

  getQueueLength(): number {
    return this.queue.length
  }

  clearQueue(): void {
    this.queue = []
  }

  listPending(): Task[] {
    return [...this.queue]
  }

  async runAll(): Promise<TaskResult[]> {
    const results: TaskResult[] = []
    while (this.queue.length) {
      const task = this.queue.shift()!
      const startedAt = Date.now()
      try {
        const data = await this.handlers[task.type](task.params)
        results.push({
          id: task.id,
          result: data,
          startedAt,
          finishedAt: Date.now(),
        })
      } catch (err: any) {
        results.push({
          id: task.id,
          error: err?.message ?? String(err),
          startedAt,
          finishedAt: Date.now(),
        })
      }
    }
    return results
  }
}
