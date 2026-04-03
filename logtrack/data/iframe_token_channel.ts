import type { TokenDataPoint } from "./token_data_fetcher"

export interface DataIframeConfig {
  containerId: string
  iframeUrl: string
  token: string
  refreshMs?: number
  /** Explicit API base for token history; defaults to iframe origin */
  dataApiBase?: string
  /** postMessage target origin; defaults to iframe origin (recommended, avoids "*") */
  targetOrigin?: string
  /** Auto-resize iframe height to match its content via postMessage 'IFRAME_HEIGHT' */
  autoResize?: boolean
}

type OutgoingMessage =
  | { type: "TOKEN_DATA"; token: string; data: TokenDataPoint[] }
  | { type: "TOKEN_DATA_ERROR"; token: string; error: string }

type IncomingMessage =
  | { type: "IFRAME_READY" }
  | { type: "IFRAME_HEIGHT"; height: number }

export class TokenDataIframeEmbedder {
  private iframe?: HTMLIFrameElement
  private refreshTimer?: ReturnType<typeof setInterval>
  private isPosting = false
  private resolvedTargetOrigin: string

  constructor(private cfg: DataIframeConfig) {
    const url = new URL(cfg.iframeUrl)
    this.resolvedTargetOrigin = cfg.targetOrigin ?? url.origin
  }

  /**
   * Initialize the iframe and start periodic data posting
   */
  async init(): Promise<void> {
    const container = document.getElementById(this.cfg.containerId)
    if (!container) throw new Error(`Container not found: ${this.cfg.containerId}`)

    this.iframe = document.createElement("iframe")
    this.iframe.src = this.cfg.iframeUrl
    this.iframe.style.border = "none"
    this.iframe.style.width = "100%"
    this.iframe.style.height = "100%"
    this.iframe.setAttribute("loading", "lazy")
    container.appendChild(this.iframe)

    // Optionally auto-resize when child reports its height
    if (this.cfg.autoResize) {
      window.addEventListener("message", this.onIncomingMessage, false)
    }

    // Wait until iframe signals readiness (or fallback to onload)
    await this.waitUntilReady()

    // Initial push
    await this.postTokenData()

    // Periodic refresh
    if (this.cfg.refreshMs && this.cfg.refreshMs > 0) {
      this.refreshTimer = setInterval(() => void this.postTokenData(), this.cfg.refreshMs)
    }
  }

  /**
   * Gracefully dispose: stop timers, listeners, and remove iframe
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    window.removeEventListener("message", this.onIncomingMessage, false)
    if (this.iframe?.parentElement) {
      this.iframe.parentElement.removeChild(this.iframe)
    }
    this.iframe = undefined
  }

  /**
   * Change token and push a fresh update immediately
   */
  async setToken(nextToken: string): Promise<void> {
    this.cfg.token = nextToken
    await this.postTokenData()
  }

  /**
   * Update refresh interval (0 or undefined disables periodic updates)
   */
  setRefreshMs(nextRefreshMs?: number): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    this.cfg.refreshMs = nextRefreshMs
    if (nextRefreshMs && nextRefreshMs > 0) {
      this.refreshTimer = setInterval(() => void this.postTokenData(), nextRefreshMs)
    }
  }

  private onIncomingMessage = (ev: MessageEvent<IncomingMessage>) => {
    if (!this.iframe) return
    if (ev.origin !== this.resolvedTargetOrigin) return
    if (ev.source !== this.iframe.contentWindow) return
    const msg = ev.data
    if (!msg || typeof msg !== "object") return

    if (msg.type === "IFRAME_HEIGHT" && typeof msg.height === "number") {
      // When autoResize is enabled, trust only positive, reasonable heights
      const h = Math.max(100, Math.min(msg.height, 20000))
      this.iframe.style.height = `${h}px`
    }
  }

  private async waitUntilReady(): Promise<void> {
    if (!this.iframe) return
    const ready = new Promise<void>(resolve => {
      const onReady = (ev: MessageEvent<IncomingMessage>) => {
        if (ev.origin !== this.resolvedTargetOrigin) return
        if (ev.source !== this.iframe?.contentWindow) return
        if (ev.data && (ev.data as IncomingMessage).type === "IFRAME_READY") {
          window.removeEventListener("message", onReady)
          resolve()
        }
      }
      window.addEventListener("message", onReady)
      // Fallback: resolve on load if the embed doesn't implement IFRAME_READY
      this.iframe!.onload = () => {
        window.removeEventListener("message", onReady)
        resolve()
      }
    })
    await ready
  }

  private async postTokenData(): Promise<void> {
    if (this.isPosting) return
    if (!this.iframe?.contentWindow) return

    this.isPosting = true
    try {
      const apiBase = this.cfg.dataApiBase ?? new URL(this.cfg.iframeUrl).origin
      const fetcher = new (await import("./token_data_fetcher")).TokenDataFetcher(apiBase)
      const data: TokenDataPoint[] = await fetcher.fetchHistory(this.cfg.token)
      this.postMessage({ type: "TOKEN_DATA", token: this.cfg.token, data })
    } catch (err: any) {
      this.postMessage({
        type: "TOKEN_DATA_ERROR",
        token: this.cfg.token,
        error: err?.message ?? "Failed to fetch token data",
      })
      // Optional: surface to host console for diagnostics
      console.warn("[TokenDataIframeEmbedder] data fetch failed:", err)
    } finally {
      this.isPosting = false
    }
  }

  private postMessage(message: OutgoingMessage): void {
    if (!this.iframe?.contentWindow) return
    this.iframe.contentWindow.postMessage(message, this.resolvedTargetOrigin)
  }
}
