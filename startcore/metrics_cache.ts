export interface MetricEntry {
  key: string
  value: number
  updatedAt: number
  ttlMs?: number
}

export class MetricsCache {
  private cache = new Map<string, MetricEntry>()

  get(key: string): MetricEntry | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (entry.ttlMs && Date.now() - entry.updatedAt > entry.ttlMs) {
      this.cache.delete(key)
      return undefined
    }
    return entry
  }

  set(key: string, value: number, ttlMs?: number): void {
    this.cache.set(key, { key, value, updatedAt: Date.now(), ttlMs })
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  hasRecent(key: string, maxAgeMs: number): boolean {
    const entry = this.cache.get(key)
    return !!entry && Date.now() - entry.updatedAt < maxAgeMs
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  values(): MetricEntry[] {
    return Array.from(this.cache.values())
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  entries(): MetricEntry[] {
    return Array.from(this.cache.values())
  }

  pruneExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttlMs && now - entry.updatedAt > entry.ttlMs) {
        this.cache.delete(key)
      }
    }
  }

  snapshot(): Record<string, MetricEntry> {
    return Object.fromEntries(this.cache.entries())
  }
}
