export interface PairInfo {
  exchange: string
  pairAddress: string
  baseSymbol: string
  quoteSymbol: string
  liquidityUsd: number
  volume24hUsd: number
  priceUsd: number
  updatedAt?: number
}

export interface DexSuiteConfig {
  apis: ApiDef[]
  timeoutMs?: number
  retries?: number
  backoffMs?: number
  concurrency?: number
}

export type ApiDef = {
  name: string
  baseUrl: string
  apiKey?: string
  // Optional path templates to accommodate different providers
  paths?: {
    pair?: string // default: `/pair/{address}`
  }
}

type PairApiShape =
  | {
      token0: { symbol: string }
      token1: { symbol: string }
      liquidityUsd: number | string
      volume24hUsd: number | string
      priceUsd: number | string
      updatedAt?: number | string
    }
  | Record<string, unknown>

export class DexSuite {
  private timeoutMs: number
  private retries: number
  private backoffMs: number
  private concurrency: number

  constructor(private config: DexSuiteConfig) {
    if (!config.apis?.length) {
      throw new Error("DexSuite requires at least one API")
    }
    this.timeoutMs = config.timeoutMs ?? 10_000
    this.retries = Math.max(0, config.retries ?? 1)
    this.backoffMs = Math.max(0, config.backoffMs ?? 500)
    this.concurrency = Math.max(1, config.concurrency ?? 4)
  }

  private authHeaders(api: ApiDef): Record<string, string> {
    return api.apiKey ? { Authorization: `Bearer ${api.apiKey}` } : {}
  }

  private path(api: ApiDef, template: string, params: Record<string, string>): string {
    const root = api.paths?.pair ?? template
    return root.replace(/{(\w+)}/g, (_, k) => encodeURIComponent(params[k] ?? ""))
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms))
  }

  private parseNumber(v: unknown): number {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return 0
  }

  private normalize(api: ApiDef, addr: string, raw: PairApiShape): PairInfo {
    // Try common shapes first; fallback to heuristic keys
    const token0 = (raw as any)?.token0
    const token1 = (raw as any)?.token1

    const baseSymbol =
      (token0?.symbol as string) ??
      (raw as any)?.baseSymbol ??
      (raw as any)?.base ??
      "BASE"
    const quoteSymbol =
      (token1?.symbol as string) ??
      (raw as any)?.quoteSymbol ??
      (raw as any)?.quote ??
      "QUOTE"

    const liquidityUsd =
      this.parseNumber((raw as any)?.liquidityUsd ?? (raw as any)?.liquidity_usd)
    const volume24hUsd =
      this.parseNumber((raw as any)?.volume24hUsd ?? (raw as any)?.volume_24h_usd)
    const priceUsd =
      this.parseNumber((raw as any)?.priceUsd ?? (raw as any)?.price_usd ?? (raw as any)?.price)

    const updatedAt = this.parseNumber((raw as any)?.updatedAt ?? (raw as any)?.updated_at)

    return {
      exchange: api.name,
      pairAddress: addr,
      baseSymbol,
      quoteSymbol,
      liquidityUsd,
      volume24hUsd,
      priceUsd,
      updatedAt: updatedAt || undefined,
    }
  }

  private async fetchWithTimeout(api: ApiDef, url: string, signal?: AbortSignal): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    try {
      return await fetch(url, {
        headers: this.authHeaders(api),
        signal: signal ?? ctrl.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  private async fetchJson<T>(api: ApiDef, url: string): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.fetchWithTimeout(api, url)
        if (!res.ok) throw new Error(`${api.name} ${res.status} ${res.statusText}`)
        return (await res.json()) as T
      } catch (err) {
        lastErr = err
        if (attempt < this.retries) {
          await this.sleep(this.backoffMs) // fixed backoff, no randomness
          continue
        }
        throw lastErr
      }
    }
    // Unreachable, but satisfies type checker
    throw new Error("Unexpected fetchJson failure")
  }

  private async fetchFromApi(api: ApiDef, pairAddress: string): Promise<PairInfo | null> {
    const path = this.path(api, "/pair/{address}", { address: pairAddress })
    const url = `${api.baseUrl}${path}`
    try {
      const data = await this.fetchJson<PairApiShape>(api, url)
      return this.normalize(api, pairAddress, data)
    } catch {
      return null
    }
  }

  /**
   * Retrieve aggregated pair info across all configured DEX APIs.
   * Executes with a simple concurrency limiter to avoid bursting all providers at once.
   */
  async getPairInfo(pairAddress: string): Promise<PairInfo[]> {
    const out: PairInfo[] = []
    const queue = [...this.config.apis]
    const workers = Array.from({ length: Math.min(this.concurrency, queue.length) }).map(
      async () => {
        while (queue.length) {
          const api = queue.shift()!
          const info = await this.fetchFromApi(api, pairAddress)
          if (info) out.push(info)
        }
      }
    )
    await Promise.all(workers)
    return out
  }

  /**
   * Compare a list of pairs across exchanges, returning the best volume and liquidity for each.
   * If a pair has no successful responses, it will not appear in the result map.
   */
  async comparePairs(
    pairs: string[]
  ): Promise<Record<string, { bestVolume: PairInfo; bestLiquidity: PairInfo; bestPrice: PairInfo }>> {
    const entries: Array<[string, { bestVolume: PairInfo; bestLiquidity: PairInfo; bestPrice: PairInfo }]> = []

    for (const addr of pairs) {
      const infos = await this.getPairInfo(addr)
      if (!infos.length) continue
      const bestVolume = infos.reduce((a, b) => (b.volume24hUsd > a.volume24hUsd ? b : a))
      const bestLiquidity = infos.reduce((a, b) => (b.liquidityUsd > a.liquidityUsd ? b : a))
      const bestPrice = infos.reduce((a, b) => (b.priceUsd > a.priceUsd ? b : a))
      entries.push([addr, { bestVolume, bestLiquidity, bestPrice }])
    }

    return Object.fromEntries(entries)
  }

  /**
   * Get the top N exchanges for a given pair by a selected key.
   */
  async topBy(
    pairAddress: string,
    key: keyof Pick<PairInfo, "liquidityUsd" | "volume24hUsd" | "priceUsd">,
    limit = 3
  ): Promise<PairInfo[]> {
    const infos = await this.getPairInfo(pairAddress)
    return infos
      .sort((a, b) => b[key] - a[key])
      .slice(0, Math.max(0, limit))
  }
}
