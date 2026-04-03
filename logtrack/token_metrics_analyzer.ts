export interface PricePoint {
  timestamp: number
  price: number
}

export interface TokenMetrics {
  averagePrice: number
  volatility: number // standard deviation
  maxPrice: number
  minPrice: number
  priceRange: number
  medianPrice: number
  returnsStdDev: number
  dataPoints: number
}

export class TokenAnalysisCalculator {
  constructor(private data: PricePoint[]) {}

  getAveragePrice(): number {
    if (this.data.length === 0) return 0
    const sum = this.data.reduce((acc, p) => acc + p.price, 0)
    return sum / this.data.length
  }

  getVolatility(): number {
    if (this.data.length === 0) return 0
    const avg = this.getAveragePrice()
    const variance =
      this.data.reduce((acc, p) => acc + (p.price - avg) ** 2, 0) /
      (this.data.length || 1)
    return Math.sqrt(variance)
  }

  getMaxPrice(): number {
    if (this.data.length === 0) return 0
    return this.data.reduce((max, p) => (p.price > max ? p.price : max), this.data[0].price)
  }

  getMinPrice(): number {
    if (this.data.length === 0) return 0
    return this.data.reduce((min, p) => (p.price < min ? p.price : min), this.data[0].price)
  }

  getPriceRange(): number {
    return this.getMaxPrice() - this.getMinPrice()
  }

  getMedianPrice(): number {
    if (this.data.length === 0) return 0
    const sorted = [...this.data].map(p => p.price).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  getReturnsStdDev(): number {
    if (this.data.length < 2) return 0
    const returns: number[] = []
    for (let i = 1; i < this.data.length; i++) {
      const prev = this.data[i - 1].price
      const curr = this.data[i].price
      if (prev > 0) {
        returns.push((curr - prev) / prev)
      }
    }
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance =
      returns.reduce((acc, r) => acc + (r - avg) ** 2, 0) /
      (returns.length || 1)
    return Math.sqrt(variance)
  }

  computeMetrics(): TokenMetrics {
    return {
      averagePrice: this.getAveragePrice(),
      volatility: this.getVolatility(),
      maxPrice: this.getMaxPrice(),
      minPrice: this.getMinPrice(),
      priceRange: this.getPriceRange(),
      medianPrice: this.getMedianPrice(),
      returnsStdDev: this.getReturnsStdDev(),
      dataPoints: this.data.length,
    }
  }
}
