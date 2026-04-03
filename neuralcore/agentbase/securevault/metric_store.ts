export interface MetricEntry {
  key: string
  value: number
  updatedAt: number
  expiresAt?: number
}

export class MetricsCache {
  private cache = new Map<string, MetricEntry>()

  get(key: string): MetricEntry | undefined {
    return this.cache.get(key)
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
    const entry = this.cache.get(key)
    if (!entry) return false
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return false
    }
    return Date.now() - entry.updatedAt < maxAgeMs
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  entries(): MetricEntry[] {
    return Array.from(this.cache.values())
  }

  size(): number {
    return this.cache.size
  }

  /**
   * Remove expired entries based on expiresAt.
   */
  sweep(): void {
    const now = Date.now()
    for (const [k, v] of this.cache.entries()) {
      if (v.expiresAt && v.expiresAt <= now) {
        this.cache.delete(k)
      }
    }
  }
}
