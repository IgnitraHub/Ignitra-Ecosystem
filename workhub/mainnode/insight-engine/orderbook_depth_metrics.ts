/**
 * Analyze on-chain orderbook depth for a given market.
 */
export interface Order {
  price: number
  size: number
}

export interface DepthMetrics {
  averageBidDepth: number
  averageAskDepth: number
  spread: number
}

export interface ExtendedDepthMetrics extends DepthMetrics {
  midPrice: number
  totalBidSize: number
  totalAskSize: number
  topOfBookBid: number
  topOfBookAsk: number
  depthImbalance: number // (bids - asks) / (bids + asks)
  vwapBid?: number
  vwapAsk?: number
}

export interface DepthAnalyzerOptions {
  timeoutMs?: number
  retries?: number
}

type Orderbook = { bids: Order[]; asks: Order[] }

export class TokenDepthAnalyzer {
  private timeoutMs: number
  private retries: number

  constructor(private rpcEndpoint: string, private marketId: string, opts: DepthAnalyzerOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 10_000
    this.retries = Math.max(0, opts.retries ?? 1)
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  private async getJsonWithRetry<T>(url: string): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.fetchWithTimeout(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as T
      } catch (err) {
        lastErr = err
        if (attempt === this.retries) throw lastErr
      }
    }
    // unreachable
    throw new Error("Failed to fetch after retries")
  }

  async fetchOrderbook(depth = 50): Promise<Orderbook> {
    const url = `${this.rpcEndpoint}/orderbook/${encodeURIComponent(this.marketId)}?depth=${depth}`
    const ob = await this.getJsonWithRetry<Orderbook>(url)
    const bids = Array.isArray(ob?.bids) ? ob.bids.filter(this.validOrder).sort((a, b) => b.price - a.price) : []
    const asks = Array.isArray(ob?.asks) ? ob.asks.filter(this.validOrder).sort((a, b) => a.price - b.price) : []
    return { bids, asks }
  }

  private validOrder = (o: Partial<Order>): o is Order =>
    Number.isFinite(o?.price) && Number.isFinite(o?.size) && (o!.price as number) > 0 && (o!.size as number) > 0

  private avgSize(arr: Order[]): number {
    if (arr.length === 0) return 0
    const sum = arr.reduce((s, o) => s + o.size, 0)
    return sum / arr.length
  }

  private vwap(orders: Order[], limitLevels?: number): number | undefined {
    const slice = typeof limitLevels === "number" ? orders.slice(0, Math.max(0, limitLevels)) : orders
    if (slice.length === 0) return undefined
    const num = slice.reduce((s, o) => s + o.price * o.size, 0)
    const den = slice.reduce((s, o) => s + o.size, 0)
    return den > 0 ? num / den : undefined
  }

  async analyze(depth = 50): Promise<DepthMetrics> {
    const { bids, asks } = await this.fetchOrderbook(depth)
    const bestBid = bids[0]?.price ?? 0
    const bestAsk = asks[0]?.price ?? 0
    return {
      averageBidDepth: this.avgSize(bids),
      averageAskDepth: this.avgSize(asks),
      spread: bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0,
    }
  }

  /**
   * Extended depth metrics including mid price, imbalance, totals, and VWAP (top-N levels).
   */
  async analyzeExtended(depth = 50, vwapLevels = 10): Promise<ExtendedDepthMetrics> {
    const { bids, asks } = await this.fetchOrderbook(depth)
    const topBid = bids[0]?.price ?? 0
    const topAsk = asks[0]?.price ?? 0
    const spread = topAsk > 0 && topBid > 0 ? topAsk - topBid : 0
    const mid = spread > 0 ? (topAsk + topBid) / 2 : 0
    const totalBidSize = bids.reduce((s, o) => s + o.size, 0)
    const totalAskSize = asks.reduce((s, o) => s + o.size, 0)
    const denom = totalBidSize + totalAskSize
    const depthImbalance = denom > 0 ? (totalBidSize - totalAskSize) / denom : 0

    return {
      averageBidDepth: this.avgSize(bids),
      averageAskDepth: this.avgSize(asks),
      spread,
      midPrice: mid,
      totalBidSize,
      totalAskSize,
      topOfBookBid: topBid,
      topOfBookAsk: topAsk,
      depthImbalance,
      vwapBid: this.vwap(bids, vwapLevels),
      vwapAsk: this.vwap(asks, vwapLevels),
    }
  }
}
