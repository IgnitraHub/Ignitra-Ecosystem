import type { TaskFormInput } from "./taskFormSchemas"
import { TaskFormSchema } from "./taskFormSchemas"

/**
 * Compute a stable, deterministic 32-bit hash for a string
 * (no randomness; consistent across runs)
 */
function stableHash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return h >>> 0
}

/**
 * Basic 5-field cron validator (min hour dom month dow)
 * Accepts numbers, '*', comma lists, ranges with '-', and step '*/n'
 * Example: "*/15 * * * *", "0 12 * * 1-5", "5 0,12 * * *"
 */
function isValidCron(expr: string): boolean {
  const part = String.raw`(?:\*|\d{1,2}|\d{1,2}-\d{1,2}|\*(?:\/\d{1,2})?|\d{1,2}(?:,\d{1,2})+)`
  const re = new RegExp(`^\\s*(${part})\\s+(${part})\\s+(${part})\\s+(${part})\\s+(${part})\\s*$`)
  if (!re.test(expr)) return false
  // very lightweight range checks
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/)
  const inRange = (val: string, max: number) => {
    const nums = val.split(",").flatMap(v => v.includes("-") ? v.split("-") : [v])
    return nums.every(n => n === "*" || n.startsWith("*/") || /^\d+$/.test(n) ? (n === "*" || n.startsWith("*/") || (Number(n) >= 0 && Number(n) <= max)) : true)
  }
  return inRange(min, 59) && inRange(hour, 23) && inRange(dom, 31) && inRange(mon, 12) && inRange(dow, 7)
}

/**
 * Normalize task name (trim and collapse whitespace)
 */
function normalizeTaskName(name: string): string {
  return name.replace(/\s+/g, " ").trim()
}

/**
 * Processes a Typeform webhook payload to schedule a new task
 * - Validates payload with zod schema
 * - Validates cron format
 * - Generates deterministic task ID (no randomness)
 * - Returns a concise message including the task ID
 */
export async function handleTypeformSubmission(
  raw: unknown
): Promise<{ success: boolean; message: string }> {
  const parsed = TaskFormSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => i.message).join("; ")
    return { success: false, message: `Validation error: ${issues}` }
  }

  // Stronger normalization & guards
  const data: TaskFormInput = parsed.data as TaskFormInput
  const taskName = normalizeTaskName(data.taskName)
  const taskType = data.taskType
  const parameters = data.parameters ?? {}
  const scheduleCron = (data.scheduleCron ?? "").trim()

  if (!taskName) {
    return { success: false, message: "Validation error: taskName must not be empty" }
  }

  if (!scheduleCron || !isValidCron(scheduleCron)) {
    return { success: false, message: `Invalid cron expression: "${scheduleCron || "(empty)"}"` }
  }

  // Deterministic ID based on content
  const idInput = `${taskName}|${taskType}|${JSON.stringify(parameters)}|${scheduleCron}`
  const id = `tsk_${stableHash(idInput).toString(16).padStart(8, "0")}`

  // Here you would persist or enqueue the task using your scheduler of choice.
  // This function intentionally avoids side effects beyond validation and response assembly.

  return {
    success: true,
    message: `Task "${taskName}" scheduled with ID ${id} using cron "${scheduleCron}"`,
  }
}
