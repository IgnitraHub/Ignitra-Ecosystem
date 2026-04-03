export interface VolumePoint {
  timestamp: number
  volumeUsd: number
}

export interface SpikeEvent {
  timestamp: number
  volume: number
  spikeRatio: number
  windowAvg: number
  windowStart: number
  windowEnd: number
}

export interface SpikeOptions {
  /** Rolling average window size (default 10) */
  windowSize?: number
  /** Threshold ratio for spike detection (default 2.0 = 200%) */
  spikeThreshold?: number
  /** Ignore spikes below this absolute volume (default 0) */
  minVolume?: number
  /** If true, sort points by timestamp ascending before processing (default true) */
  sortByTimestamp?: boolean
}

/**
 * Detect spikes in trading volume compared to a rolling average window
 * Adds metadata about window stats and filtering options
 */
export function detectVolumeSpikes(
  rawPoints: VolumePoint[],
  opts: SpikeOptions = {}
): SpikeEvent[] {
  const {
    windowSize = 10,
    spikeThreshold = 2.0,
    minVolume = 0,
    sortByTimestamp = true,
  } = opts

  if (!Array.isArray(rawPoints) || rawPoints.length <= windowSize) return []

  const points = sortByTimestamp
    ? [...rawPoints].sort((a, b) => a.timestamp - b.timestamp)
    : [...rawPoints]

  const events: SpikeEvent[] = []
  const volumes = points.map(p => p.volumeUsd)

  for (let i = windowSize; i < volumes.length; i++) {
    const window = volumes.slice(i - windowSize, i)
    if (window.length === 0) continue
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length
    const curr = volumes[i]
    const ratio = avg > 0 ? curr / avg : Infinity

    if (curr >= minVolume && ratio >= spikeThreshold) {
      events.push({
        timestamp: points[i].timestamp,
        volume: curr,
        spikeRatio: Math.round(ratio * 100) / 100,
        windowAvg: Math.round(avg * 100) / 100,
        windowStart: points[i - windowSize].timestamp,
        windowEnd: points[i - 1].timestamp,
      })
    }
  }

  return events
}
