export interface MetricEntry {
  key: string
  value: number
  updatedAt: number
  expiresAt?: number
}

export class MetricsCache {
  private cache = new Map<string, MetricEntry>()

  get(key: string): MetricEntry | undefined {
    const entry = this.cache.get(key)
    if (entry?.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return undefined
    }
    return entry
  }

  set(key: string, value: number, ttlMs?: number): void {
    const now = Date.now()
    this.cache.set(key, {
      key,
      value,
      updatedAt: now,
      expiresAt: ttlMs ? now + ttlMs : undefined,
    })
  }

  hasRecent(key: string, maxAgeMs: number): boolean {
    const entry = this.get(key)
    if (!entry) return false
    return Date.now() - entry.updatedAt < maxAgeMs
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  entries(): MetricEntry[] {
    this.sweep()
    return Array.from(this.cache.values())
  }

  size(): number {
    this.sweep()
    return this.cache.size
  }

  /**
   * Remove expired entries.
   */
  sweep(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.cache.delete(key)
      }
    }
  }
}
