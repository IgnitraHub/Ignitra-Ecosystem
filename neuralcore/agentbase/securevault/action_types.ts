import { z } from "zod"

/**
 * Base types for any flow action
 */
export type ActionSchema = z.ZodObject<z.ZodRawShape>

export interface ActionResponse<T> {
  notice: string
  data?: T
  success: boolean
  error?: string
  startedAt: string
  finishedAt: string
  durationMs: number
}

export interface BaseAction<S extends ActionSchema, R, Ctx = unknown> {
  id: string
  summary: string
  input: S
  execute(args: { payload: z.infer<S>; context: Ctx }): Promise<ActionResponse<R>>
}

/**
 * Validate an arbitrary payload against the action schema
 */
export function validatePayload<S extends ActionSchema>(
  schema: S,
  payload: unknown
): { ok: true; value: z.infer<S> } | { ok: false; error: string } {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join("; ") || "Invalid input" }
  }
  return { ok: true, value: parsed.data }
}

/**
 * Run an action with validation and automatic timing metadata
 */
export async function runAction<S extends ActionSchema, R, Ctx>(
  action: BaseAction<S, R, Ctx>,
  payload: unknown,
  context: Ctx
): Promise<ActionResponse<R>> {
  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  const check = validatePayload(action.input, payload)
  if (!check.ok) {
    const finishedAt = new Date().toISOString()
    return {
      notice: `Action ${action.id} validation failed`,
      success: false,
      error: check.error,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    }
  }

  try {
    const res = await action.execute({ payload: check.value, context })
    const finishedAt = new Date().toISOString()
    return {
      ...res,
      success: res.success ?? true,
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    }
  } catch (err: any) {
    const finishedAt = new Date().toISOString()
    return {
      notice: `Action ${action.id} execution error`,
      success: false,
      error: err?.message || "Unknown error",
      startedAt,
      finishedAt,
      durationMs: Date.now() - t0,
    }
  }
}

/**
 * Convenience factory to define an action with proper typing
 */
export function createAction<S extends ActionSchema, R, Ctx = unknown>(def: {
  id: string
  summary: string
  input: S
  handler: BaseAction<S, R, Ctx>["execute"]
}): BaseAction<S, R, Ctx> {
  return {
    id: def.id,
    summary: def.summary,
    input: def.input,
    execute: def.handler,
  }
}
