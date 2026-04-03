import type { SightCoreMessage } from "./WebSocketClient"

export interface AggregatedSignal {
  topic: string
  count: number
  lastPayload: any
  lastTimestamp: number
  firstTimestamp?: number
  history?: any[]
}

export class SignalAggregator {
  private counts: Record<string, AggregatedSignal> = {}

  /**
   * Process a new incoming message and update aggregation state.
   */
  processMessage(msg: SightCoreMessage): AggregatedSignal {
    const { topic, payload, timestamp } = msg
    const entry: AggregatedSignal = this.counts[topic] || {
      topic,
      count: 0,
      lastPayload: null,
      lastTimestamp: 0,
      firstTimestamp: timestamp,
      history: [],
    }

    entry.count += 1
    entry.lastPayload = payload
    entry.lastTimestamp = timestamp
    entry.firstTimestamp = entry.firstTimestamp ?? timestamp

    if (entry.history) {
      entry.history.push({ payload, timestamp })
      if (entry.history.length > 50) {
        entry.history.shift()
      }
    }

    this.counts[topic] = entry
    return entry
  }

  /**
   * Retrieve aggregated state for a given topic.
   */
  getAggregated(topic: string): AggregatedSignal | undefined {
    return this.counts[topic]
  }

  /**
   * Retrieve all aggregated states as a list.
   */
  getAllAggregated(): AggregatedSignal[] {
    return Object.values(this.counts)
  }

  /**
   * Remove aggregation for a specific topic.
   */
  removeTopic(topic: string): void {
    delete this.counts[topic]
  }

  /**
   * Get the most active topic based on message count.
   */
  getTopTopic(): AggregatedSignal | undefined {
    const values = Object.values(this.counts)
    return values.sort((a, b) => b.count - a.count)[0]
  }

  /**
   * Get the most recent message across all topics.
   */
  getLatest(): AggregatedSignal | undefined {
    const values = Object.values(this.counts)
    return values.sort((a, b) => b.lastTimestamp - a.lastTimestamp)[0]
  }

  /**
   * Reset all aggregation state.
   */
  reset(): void {
    this.counts = {}
  }
}
