export interface TokenDataPoint {
  timestamp: number
  priceUsd: number
  volumeUsd: number
  marketCapUsd: number
}

export interface TokenStats {
  symbol: string
  latestPrice?: number
  avgPrice?: number
  totalVolume?: number
  marketCap?: number
  start?: number
  end?: number
}

export class TokenDataFetcher {
  constructor(private apiBase: string) {}

  /**
   * Fetches an array of TokenDataPoint for the given token symbol.
   * Expects endpoint: `${apiBase}/tokens/${symbol}/history`
   */
  async fetchHistory(symbol: string): Promise<TokenDataPoint[]> {
    const res = await fetch(
      `${this.apiBase}/tokens/${encodeURIComponent(symbol)}/history`
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch history for ${symbol}: ${res.status}`)
    }
    const raw = (await res.json()) as any[]
    return raw.map(r => ({
      timestamp: r.time * 1000,
      priceUsd: Number(r.priceUsd),
      volumeUsd: Number(r.volumeUsd),
      marketCapUsd: Number(r.marketCapUsd),
    }))
  }

  /**
   * Fetch the latest data point only.
   */
  async fetchLatest(symbol: string): Promise<TokenDataPoint | null> {
    const history = await this.fetchHistory(symbol)
    if (history.length === 0) return null
    return history[history.length - 1]
  }

  /**
   * Compute basic statistics for a token based on historical data.
   */
  async getStats(symbol: string): Promise<TokenStats> {
    const history = await this.fetchHistory(symbol)
    if (history.length === 0) return { symbol }

    const prices = history.map(p => p.priceUsd)
    const volumes = history.map(p => p.volumeUsd)
    const caps = history.map(p => p.marketCapUsd)

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    const totalVolume = volumes.reduce((a, b) => a + b, 0)
    const latest = history[history.length - 1]

    return {
      symbol,
      latestPrice: latest.priceUsd,
      avgPrice: avg,
      totalVolume,
      marketCap: latest.marketCapUsd,
      start: history[0].timestamp,
      end: latest.timestamp,
    }
  }

  /**
   * Fetch multiple tokens in parallel.
   */
  async fetchBatch(symbols: string[]): Promise<Record<string, TokenDataPoint[]>> {
    const results: Record<string, TokenDataPoint[]> = {}
    await Promise.all(
      symbols.map(async sym => {
        try {
          results[sym] = await this.fetchHistory(sym)
        } catch {
          results[sym] = []
        }
      })
    )
    return results
  }
}
