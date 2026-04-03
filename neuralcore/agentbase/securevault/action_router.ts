import type { BaseAction, ActionResponse } from "./action_types"
import { z } from "zod"

export interface AgentContext {
  apiEndpoint: string
  apiKey: string
  network?: string
  traceId?: string
}

/**
 * Central Agent: routes calls to registered actions with validation and safety.
 */
export class Agent {
  private actions = new Map<string, BaseAction<any, any, AgentContext>>()

  /**
   * Register an action definition.
   */
  register<S extends z.ZodObject<any>, R>(
    action: BaseAction<S, R, AgentContext>
  ): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with id "${action.id}" already registered`)
    }
    this.actions.set(action.id, action)
  }

  /**
   * Invoke a registered action by ID with validation and context.
   */
  async invoke<R>(
    actionId: string,
    payload: unknown,
    ctx: AgentContext
  ): Promise<ActionResponse<R>> {
    const action = this.actions.get(actionId)
    if (!action) {
      return {
        notice: `Unknown action "${actionId}"`,
        success: false,
        error: "Action not found",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
      }
    }

    const startedAt = new Date().toISOString()
    const start = Date.now()
    const parsed = action.input.safeParse(payload)

    if (!parsed.success) {
      const finishedAt = new Date().toISOString()
      return {
        notice: `Validation failed for action "${actionId}"`,
        success: false,
        error:
          parsed.error.flatten().formErrors.join("; ") || "Invalid input payload",
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
      }
    }

    try {
      const res = await action.execute({ payload: parsed.data, context: ctx })
      const finishedAt = new Date().toISOString()
      return {
        ...res,
        success: res.success ?? true,
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
      }
    } catch (err: any) {
      const finishedAt = new Date().toISOString()
      return {
        notice: `Execution failed for action "${actionId}"`,
        success: false,
        error: err?.message || "Unknown error",
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
      }
    }
  }

  /**
   * List registered action IDs.
   */
  listActions(): string[] {
    return Array.from(this.actions.keys())
  }

  /**
   * Get a summary of all registered actions.
   */
  describeActions(): Array<{ id: string; summary: string }> {
    return Array.from(this.actions.values()).map(a => ({
      id: a.id,
      summary: a.summary,
    }))
  }

  /**
   * Remove an action from registry.
   */
  unregister(actionId: string): boolean {
    return this.actions.delete(actionId)
  }
}
