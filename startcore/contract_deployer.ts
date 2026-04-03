export interface LaunchConfig {
  contractName: string
  parameters: Record<string, any>
  deployEndpoint: string
  apiKey?: string
  retries?: number
  timeoutMs?: number
}

export interface LaunchResult {
  success: boolean
  address?: string
  transactionHash?: string
  error?: string
  durationMs?: number
  rawResponse?: any
}

export class LaunchNode {
  constructor(private config: LaunchConfig) {}

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`
    }
    return headers
  }

  async deploy(): Promise<LaunchResult> {
    const { deployEndpoint, contractName, parameters } = this.config
    const retries = this.config.retries ?? 1
    const timeout = this.config.timeoutMs ?? 15000

    const payload = { contractName, parameters }

    let attempt = 0
    const start = Date.now()

    while (attempt < retries) {
      attempt++
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        const res = await fetch(deployEndpoint, {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        clearTimeout(timer)

        if (!res.ok) {
          const text = await res.text()
          if (attempt >= retries) {
            return {
              success: false,
              error: `HTTP ${res.status}: ${text}`,
              durationMs: Date.now() - start,
            }
          }
          continue
        }

        const json = await res.json()
        return {
          success: true,
          address: json.contractAddress,
          transactionHash: json.txHash,
          rawResponse: json,
          durationMs: Date.now() - start,
        }
      } catch (err: any) {
        if (attempt >= retries) {
          return {
            success: false,
            error: err.message || "Unknown deployment error",
            durationMs: Date.now() - start,
          }
        }
      }
    }

    return {
      success: false,
      error: "Deployment failed after max retries",
      durationMs: Date.now() - start,
    }
  }
}
