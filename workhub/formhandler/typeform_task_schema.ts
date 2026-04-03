import { z } from "zod"

/**
 * Schema for scheduling a new task via Typeform submission.
 * Covers:
 *  - taskName (3–100 chars)
 *  - taskType (whitelisted categories)
 *  - parameters (non-empty key-value string map)
 *  - scheduleCron (basic 5-field cron with validation)
 */
export const TaskFormSchema = z.object({
  taskName: z.string().min(3, "Task name must be at least 3 characters").max(100, "Task name too long"),
  taskType: z.enum(["anomalyScan", "tokenAnalytics", "whaleMonitor"], {
    required_error: "taskType is required",
    invalid_type_error: "Invalid taskType value",
  }),
  parameters: z
    .record(z.string(), z.string())
    .refine(obj => Object.keys(obj).length > 0, { message: "Parameters must include at least one key" }),
  scheduleCron: z
    .string()
    .refine(expr => {
      // Minimal cron validator: 5 fields separated by space
      const fields = expr.trim().split(/\s+/)
      if (fields.length !== 5) return false
      const [min, hour, dom, mon, dow] = fields
      const numOrStar = /^(\*|\d+)$/
      return (
        numOrStar.test(min) &&
        numOrStar.test(hour) &&
        numOrStar.test(dom) &&
        numOrStar.test(mon) &&
        numOrStar.test(dow)
      )
    }, { message: "Invalid cron expression: must have 5 fields with numbers or *" }),
})

export type TaskFormInput = z.infer<typeof TaskFormSchema>
