/**
 * Detect volume-based patterns in a series of activity amounts.
 */
export interface PatternMatch {
  index: number
  window: number
  average: number
  peak: number
  total: number
  zScore?: number
}

export interface PatternOptions {
  computeZScore?: boolean
  minPeak?: number
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr: number[], m?: number): number {
  if (arr.length === 0) return 0
  const avg = m ?? mean(arr)
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

export function detectVolumePatterns(
  volumes: number[],
  windowSize: number,
  threshold: number,
  opts: PatternOptions = {}
): PatternMatch[] {
  const matches: PatternMatch[] = []
  if (windowSize <= 0 || volumes.length < windowSize) return matches

  for (let i = 0; i + windowSize <= volumes.length; i++) {
    const slice = volumes.slice(i, i + windowSize)
    const avg = mean(slice)
    const total = slice.reduce((a, b) => a + b, 0)
    const peak = Math.max(...slice)

    if (avg >= threshold && (!opts.minPeak || peak >= opts.minPeak)) {
      const match: PatternMatch = {
        index: i,
        window: windowSize,
        average: Number(avg.toFixed(2)),
        peak,
        total,
      }

      if (opts.computeZScore) {
        const m = mean(volumes)
        const sd = stddev(volumes, m)
        match.zScore = sd > 0 ? Number(((avg - m) / sd).toFixed(3)) : 0
      }

      matches.push(match)
    }
  }

  return matches
}
