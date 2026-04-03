import fetch from "node-fetch"

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export type CandlestickPattern =
  | "Hammer"
  | "ShootingStar"
  | "BullishEngulfing"
  | "BearishEngulfing"
  | "Doji"

export interface PatternSignal {
  timestamp: number
  pattern: CandlestickPattern
  confidence: number
  index?: number
}

export interface DetectorOptions {
  /** HTTP timeout for candle fetch (ms) */
  timeoutMs?: number
  /** Minimum confidence to include a detected pattern (0..1, default 0.4) */
  minConfidence?: number
  /** If true, return at most one pattern per candle (highest confidence) */
  uniquePerCandle?: boolean
}

/*------------------------------------------------------
 * Detector
 *----------------------------------------------------*/
export class CandlestickPatternDetector {
  private timeoutMs: number
  private minConfidence: number
  private uniquePerCandle: boolean

  constructor(private readonly apiUrl: string, opts: DetectorOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.minConfidence = Math.min(Math.max(opts.minConfidence ?? 0.4, 0), 1)
    this.uniquePerCandle = opts.uniquePerCandle ?? true
  }

  /* Fetch recent OHLC candles */
  async fetchCandles(symbol: string, limit = 100): Promise<Candle[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(
        `${this.apiUrl}/markets/${encodeURIComponent(symbol)}/candles?limit=${limit}`,
        { signal: controller.signal }
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch candles ${res.status}: ${res.statusText}`)
      }
      const data = (await res.json()) as Candle[]
      // basic validation and sorting by timestamp asc
      const cleaned = data
        .filter(
          c =>
            Number.isFinite(c.timestamp) &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
        )
        .sort((a, b) => a.timestamp - b.timestamp)
      return cleaned
    } finally {
      clearTimeout(timer)
    }
  }

  /* ------------------------- Pattern helpers ---------------------- */

  private isHammer(c: Candle): number {
    const range = c.high - c.low
    if (range <= 0) return 0
    const body = Math.abs(c.close - c.open)
    const lowerWick = Math.min(c.open, c.close) - c.low
    const upperWick = c.high - Math.max(c.open, c.close)
    if (upperWick > body * 1.2) return 0 // avoid long upper wick
    const ratio = body > 0 ? lowerWick / body : 0
    const bodyShare = body / range
    return ratio > 2 && bodyShare < 0.3 ? Math.min(ratio / 3, 1) : 0
  }

  private isShootingStar(c: Candle): number {
    const range = c.high - c.low
    if (range <= 0) return 0
    const body = Math.abs(c.close - c.open)
    const upperWick = c.high - Math.max(c.open, c.close)
    const lowerWick = Math.min(c.open, c.close) - c.low
    if (lowerWick > body * 1.2) return 0 // avoid long lower wick
    const ratio = body > 0 ? upperWick / body : 0
    const bodyShare = body / range
    return ratio > 2 && bodyShare < 0.3 ? Math.min(ratio / 3, 1) : 0
  }

  private isBullishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close > curr.open &&
      prev.close < prev.open &&
      curr.close > prev.open &&
      curr.open < prev.close
    if (!cond) return 0
    const bodyPrev = Math.abs(prev.close - prev.open)
    const bodyCurr = Math.abs(curr.close - curr.open)
    if (bodyPrev === 0) return 0.8
    const ratio = bodyCurr / bodyPrev
    return Math.min(ratio, 1)
  }

  private isBearishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close < curr.open &&
      prev.close > prev.open &&
      curr.open > prev.close &&
      curr.close < prev.open
    if (!cond) return 0
    const bodyPrev = Math.abs(prev.close - prev.open)
    const bodyCurr = Math.abs(curr.close - curr.open)
    if (bodyPrev === 0) return 0.8
    const ratio = bodyCurr / bodyPrev
    return Math.min(ratio, 1)
  }

  private isDoji(c: Candle): number {
    const range = c.high - c.low
    const body = Math.abs(c.close - c.open)
    if (range <= 0) return 0
    const ratio = body / range
    return ratio < 0.1 ? 1 - ratio * 10 : 0
  }

  /* ------------------------- Detection core ----------------------- */

  /**
   * Analyze a candle array and return pattern signals
   */
  detectPatterns(candles: Candle[]): PatternSignal[] {
    if (!Array.isArray(candles) || candles.length === 0) return []

    const out: PatternSignal[] = []

    const pushIf = (
      idx: number,
      pattern: CandlestickPattern,
      conf: number
    ) => {
      if (conf >= this.minConfidence) {
        out.push({
          timestamp: candles[idx].timestamp,
          pattern,
          confidence: Math.round(conf * 100) / 100,
          index: idx,
        })
      }
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const candidates: PatternSignal[] = []

      // single-candle patterns
      const hammer = this.isHammer(c)
      if (hammer > 0) {
        candidates.push({
          timestamp: c.timestamp,
          pattern: "Hammer",
          confidence: hammer,
          index: i,
        })
      }

      const star = this.isShootingStar(c)
      if (star > 0) {
        candidates.push({
          timestamp: c.timestamp,
          pattern: "ShootingStar",
          confidence: star,
          index: i,
        })
      }

      const doji = this.isDoji(c)
      if (doji > 0) {
        candidates.push({
          timestamp: c.timestamp,
          pattern: "Doji",
          confidence: doji,
          index: i,
        })
      }

      // two-candle patterns
      if (i > 0) {
        const prev = candles[i - 1]
        const bull = this.isBullishEngulfing(prev, c)
        if (bull > 0) {
          candidates.push({
            timestamp: c.timestamp,
            pattern: "BullishEngulfing",
            confidence: bull,
            index: i,
          })
        }
        const bear = this.isBearishEngulfing(prev, c)
        if (bear > 0) {
          candidates.push({
            timestamp: c.timestamp,
            pattern: "BearishEngulfing",
            confidence: bear,
            index: i,
          })
        }
      }

      if (candidates.length === 0) continue

      if (this.uniquePerCandle) {
        const best = candidates.sort((a, b) => b.confidence - a.confidence)[0]
        pushIf(i, best.pattern, best.confidence)
      } else {
        for (const cand of candidates) pushIf(i, cand.pattern, cand.confidence)
      }
    }

    return out
  }

  /**
   * Convenience: fetch candles and immediately detect patterns
   */
  async fetchAndDetect(symbol: string, limit = 100): Promise<PatternSignal[]> {
    const candles = await this.fetchCandles(symbol, limit)
    return this.detectPatterns(candles)
  }

  /**
   * Get the most recent detected signal (if any)
   */
  getLatestSignal(signals: PatternSignal[]): PatternSignal | undefined {
    if (!signals.length) return undefined
    return signals.reduce((a, b) => (b.timestamp > a.timestamp ? b : a))
  }
}
ы