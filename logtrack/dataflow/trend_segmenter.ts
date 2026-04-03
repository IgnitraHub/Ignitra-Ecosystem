export interface PricePoint {
  timestamp: number
  priceUsd: number
}

export type TrendDirection = "upward" | "downward" | "neutral"

export interface TrendResult {
  startTime: number
  endTime: number
  startPrice: number
  endPrice: number
  bars: number
  trend: TrendDirection
  changePct: number
}

export interface TrendOptions {
  /** Minimum number of points required to form a segment (default 5) */
  minSegmentLength?: number
  /** Ignore segments with absolute % change below this threshold (default 0) */
  minChangePct?: number
  /** Simple moving average window for smoothing (0 = no smoothing, default 0) */
  smoothingWindow?: number
  /** If true, sort points by timestamp ascending before analysis (default true) */
  sortByTimestamp?: boolean
}

/**
 * Compute a simple moving average smoothing (centered on current point using trailing window)
 */
function smoothSeries(points: PricePoint[], window: number): PricePoint[] {
  if (window <= 1) return points
  const out: PricePoint[] = []
  let sum = 0
  let q: number[] = []
  for (let i = 0; i < points.length; i++) {
    const v = points[i].priceUsd
    q.push(v)
    sum += v
    if (q.length > window) sum -= q.shift()!
    const avg = sum / q.length
    out.push({ timestamp: points[i].timestamp, priceUsd: avg })
  }
  return out
}

function pctChange(a: number, b: number): number {
  if (a === 0) return 0
  return ((b - a) / a) * 100
}

/**
 * Analyze a series of price points to determine overall trend segments
 * Adds options for smoothing, minimum % change filtering, and richer segment metadata
 */
export function analyzePriceTrends(
  rawPoints: PricePoint[],
  options: TrendOptions = {}
): TrendResult[] {
  const {
    minSegmentLength = 5,
    minChangePct = 0,
    smoothingWindow = 0,
    sortByTimestamp = true,
  } = options

  if (!Array.isArray(rawPoints) || rawPoints.length < minSegmentLength) return []

  // Optionally sort by time and filter out invalid points
  const cleaned = (sortByTimestamp
    ? [...rawPoints].sort((a, b) => a.timestamp - b.timestamp)
    : [...rawPoints]
  ).filter(p => Number.isFinite(p.timestamp) && Number.isFinite(p.priceUsd) && p.priceUsd > 0)

  if (cleaned.length < minSegmentLength) return []

  // Optional smoothing
  const points = smoothingWindow > 1 ? smoothSeries(cleaned, smoothingWindow) : cleaned

  const results: TrendResult[] = []
  let segStart = 0

  // Helper to finalize a segment if it meets the rules
  const finalizeSegment = (endIdx: number) => {
    if (endIdx - segStart + 1 < minSegmentLength) return
    const start = points[segStart]
    const end = points[endIdx]
    const change = pctChange(start.priceUsd, end.priceUsd)
    const trend: TrendDirection = change > 0 ? "upward" : change < 0 ? "downward" : "neutral"
    if (Math.abs(change) < minChangePct && trend !== "neutral") return
    results.push({
      startTime: start.timestamp,
      endTime: end.timestamp,
      startPrice: start.priceUsd,
      endPrice: end.priceUsd,
      bars: endIdx - segStart + 1,
      trend,
      changePct: Math.round(change * 100) / 100,
    })
    segStart = endIdx
  }

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].priceUsd
    const curr = points[i].priceUsd
    const next = points[i + 1].priceUsd

    const dirNow = curr > prev ? 1 : curr < prev ? -1 : 0
    const dirNext = next > curr ? 1 : next < curr ? -1 : 0

    // Direction change or plateau reversal qualifies as segment boundary
    const directionChanged = dirNow !== 0 && dirNext !== 0 && dirNow !== dirNext
    const plateauFlip = dirNow === 0 && dirNext !== 0 && i - segStart + 1 >= minSegmentLength

    if (directionChanged || plateauFlip) {
      finalizeSegment(i)
    }
  }

  // Always attempt to close the last segment at the end
  finalizeSegment(points.length - 1)

  return results
}
