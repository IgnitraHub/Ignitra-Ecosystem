/**
 * Analyze on-chain token activity: fetch recent activity and summarize transfers.
 */
export interface ActivityRecord {
  timestamp: number
  signature: string
  source: string
  destination: string
  amount: number
}

export interface AnalyzerOptions {
  timeoutMs?: number
  retries?: number
  concurrency?: number
}

type Json = Record<string, any>

export class TokenActivityAnalyzer {
  private timeoutMs: number
  private retries: number
  private concurrency: number

  constructor(private rpcEndpoint: string, opts: AnalyzerOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 15_000
    this.retries = Math.max(0, opts.retries ?? 1)
    this.concurrency = Math.max(1, opts.concurrency ?? 6)
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(t)
    }
  }

  private async getJsonWithRetry<T = Json>(url: string): Promise<T> {
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
    throw new Error("Unreachable")
  }

  async fetchRecentSignatures(mint: string, limit = 100): Promise<string[]> {
    const url = `${this.rpcEndpoint}/getSignaturesForAddress/${encodeURIComponent(
      mint
    )}?limit=${limit}`
    const json = await this.getJsonWithRetry<any[]>(url)
    // Defensive parsing
    if (!Array.isArray(json)) return []
    return json
      .map(e => (typeof e?.signature === "string" ? e.signature : null))
      .filter((s): s is string => !!s)
  }

  /**
   * Fetch a single transaction JSON by signature.
   * Returns null if not available or malformed.
   */
  private async fetchTransaction(sig: string): Promise<Json | null> {
    const url = `${this.rpcEndpoint}/getTransaction/${encodeURIComponent(sig)}`
    try {
      const tx = await this.getJsonWithRetry<Json>(url)
      if (!tx || !tx.meta) return null
      return tx
    } catch {
      return null
    }
  }

  /**
   * Bounded parallel map for fetching many transactions.
   */
  private async mapConcurrent<T, R>(
    items: T[],
    fn: (x: T) => Promise<R>,
    limit = this.concurrency
  ): Promise<R[]> {
    const out: R[] = []
    let idx = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }).map(async () => {
      while (idx < items.length) {
        const i = idx++
        out[i] = await fn(items[i])
      }
    })
    await Promise.all(workers)
    return out
  }

  /**
   * Analyze transfers for a token mint by inspecting pre/post token balances.
   */
  async analyzeActivity(mint: string, limit = 50): Promise<ActivityRecord[]> {
    const sigs = await this.fetchRecentSignatures(mint, limit)
    if (sigs.length === 0) return []

    const txs = await this.mapConcurrent(sigs, s => this.fetchTransaction(s))

    const out: ActivityRecord[] = []
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i]
      const sig = sigs[i]
      if (!tx) continue

      const pre = (tx.meta?.preTokenBalances as any[]) || []
      const post = (tx.meta?.postTokenBalances as any[]) || []
      const blockTime = Number(tx.blockTime) || 0

      // Build owner -> uiAmount map for pre/post
      const preMap = new Map<string, number>()
      const postMap = new Map<string, number>()

      for (const p of pre) {
        const owner = p?.owner ?? "unknown"
        const amt = Number(p?.uiTokenAmount?.uiAmount ?? 0)
        preMap.set(owner, (preMap.get(owner) ?? 0) + amt)
      }
      for (const p of post) {
        const owner = p?.owner ?? "unknown"
        const amt = Number(p?.uiTokenAmount?.uiAmount ?? 0)
        postMap.set(owner, (postMap.get(owner) ?? 0) + amt)
      }

      // Union of owners to detect deltas
      const owners = new Set<string>([...preMap.keys(), ...postMap.keys()])
      for (const owner of owners) {
        const before = preMap.get(owner) ?? 0
        const after = postMap.get(owner) ?? 0
        const delta = after - before
        if (delta === 0) continue

        // Positive delta = received; negative = sent
        const isRecv = delta > 0
        const src = isRecv ? "unknown" : owner
        const dst = isRecv ? owner : "unknown"

        out.push({
          timestamp: blockTime * 1000,
          signature: sig,
          source: src,
          destination: dst,
          amount: Math.abs(delta),
        })
      }
    }

    // Sort ascending by time, then signature
    return out.sort((a, b) => (a.timestamp - b.timestamp) || a.signature.localeCompare(b.signature))
  }

  /**
   * Summarize totals sent/received per address.
   */
  summarize(records: ActivityRecord[]): {
    totalsByAddress: Record<string, { sent: number; received: number }>
    totalTransfers: number
  } {
    const map: Record<string, { sent: number; received: number }> = {}
    for (const r of records) {
      if (!map[r.source]) map[r.source] = { sent: 0, received: 0 }
      if (!map[r.destination]) map[r.destination] = { sent: 0, received: 0 }
      map[r.source].sent += r.amount
      map[r.destination].received += r.amount
    }
    return { totalsByAddress: map, totalTransfers: records.length }
  }

  /**
   * Filter out tiny dust transfers below a given minimum amount.
   */
  filterByMinAmount(records: ActivityRecord[], minAmount: number): ActivityRecord[] {
    return records.filter(r => r.amount >= minAmount)
  }
}
