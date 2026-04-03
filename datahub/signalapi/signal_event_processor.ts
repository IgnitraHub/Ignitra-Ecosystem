import type { Signal } from "./SignalApiClient"

export interface AggregatedResult {
  type: string
  count: number
  earliest: number
  latest: number
}

/**
 * Processes raw signals into actionable events and summaries.
 */
export class SignalProcessor {
  /**
   * Filter signals by type and recency.
   * @param signals Array of Signal
   * @param type Desired signal type
   * @param sinceTimestamp Only include signals after this time
   */
  filter(signals: Signal[], type: string, sinceTimestamp: number): Signal[] {
    return signals.filter(s => s.type === type && s.timestamp > sinceTimestamp)
  }

  /**
   * Aggregate signals by type, counting occurrences and tracking range.
   * @param signals Array of Signal
   */
  aggregateByType(signals: Signal[]): Record<string, AggregatedResult> {
    return signals.reduce((acc, s) => {
      if (!acc[s.type]) {
        acc[s.type] = {
          type: s.type,
          count: 0,
          earliest: s.timestamp,
          latest: s.timestamp,
        }
      }
      acc[s.type].count++
      if (s.timestamp < acc[s.type].earliest) acc[s.type].earliest = s.timestamp
      if (s.timestamp > acc[s.type].latest) acc[s.type].latest = s.timestamp
      return acc
    }, {} as Record<string, AggregatedResult>)
  }

  /**
   * Transform a signal into a human-readable summary string.
   */
  summarize(signal: Signal): string {
    const time = new Date(signal.timestamp).toISOString()
    return `[${time}] ${signal.type.toUpperCase()}: ${JSON.stringify(signal.payload)}`
  }

  /**
   * Sort signals by timestamp ascending or descending.
   */
  sortByTimestamp(signals: Signal[], order: "asc" | "desc" = "asc"): Signal[] {
    return [...signals].sort((a, b) =>
      order === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
    )
  }

  /**
   * Group signals by type into arrays.
   */
  groupByType(signals: Signal[]): Record<string, Signal[]> {
    return signals.reduce((acc, s) => {
      if (!acc[s.type]) acc[s.type] = []
      acc[s.type].push(s)
      return acc
    }, {} as Record<string, Signal[]>)
  }

  /**
   * Get the most recent signal per type.
   */
  latestByType(signals: Signal[]): Record<string, Signal> {
    return signals.reduce((acc, s) => {
      if (!acc[s.type] || s.timestamp > acc[s.type].timestamp) {
        acc[s.type] = s
      }
      return acc
    }, {} as Record<string, Signal>)
  }
}
