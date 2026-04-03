export interface Signal {
  id: string
  type: string
  timestamp: number
  payload: Record<string, any>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
  durationMs?: number
}

/**
 * HTTP client for fetching signals and interacting with API endpoints.
 */
export class SignalApiClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`
    return headers
  }

  private async handleResponse<T>(res: Response, start: number): Promise<ApiResponse<T>> {
    if (!res.ok) {
      return {
        success: false,
        error: `HTTP ${res.status}`,
        statusCode: res.status,
        durationMs: Date.now() - start,
      }
    }
    try {
      const data = (await res.json()) as T
      return { success: true, data, statusCode: res.status, durationMs: Date.now() - start }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Invalid JSON",
        statusCode: res.status,
        durationMs: Date.now() - start,
      }
    }
  }

  async fetchAllSignals(): Promise<ApiResponse<Signal[]>> {
    const start = Date.now()
    try {
      const res = await fetch(`${this.baseUrl}/signals`, {
        method: "GET",
        headers: this.getHeaders(),
      })
      return this.handleResponse<Signal[]>(res, start)
    } catch (err: any) {
      return { success: false, error: err.message, durationMs: Date.now() - start }
    }
  }

  async fetchSignalById(id: string): Promise<ApiResponse<Signal>> {
    const start = Date.now()
    try {
      const res = await fetch(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: this.getHeaders(),
      })
      return this.handleResponse<Signal>(res, start)
    } catch (err: any) {
      return { success: false, error: err.message, durationMs: Date.now() - start }
    }
  }

  async createSignal(signal: Signal): Promise<ApiResponse<Signal>> {
    const start = Date.now()
    try {
      const res = await fetch(`${this.baseUrl}/signals`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(signal),
      })
      return this.handleResponse<Signal>(res, start)
    } catch (err: any) {
      return { success: false, error: err.message, durationMs: Date.now() - start }
    }
  }

  async deleteSignal(id: string): Promise<ApiResponse<null>> {
    const start = Date.now()
    try {
      const res = await fetch(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      })
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}`, statusCode: res.status, durationMs: Date.now() - start }
      }
      return { success: true, data: null, statusCode: res.status, durationMs: Date.now() - start }
    } catch (err: any) {
      return { success: false, error: err.message, durationMs: Date.now() - start }
    }
  }
}
