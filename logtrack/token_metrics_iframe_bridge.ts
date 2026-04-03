import type { TokenMetrics } from "./token_analysis_calculator"

export interface IframeConfig {
  containerId: string
  srcUrl: string
  metrics: TokenMetrics
  refreshIntervalMs?: number
  /** Explicit target origin for postMessage; defaults to iframe origin (recommended) */
  targetOrigin?: string
  /** Auto-resize iframe height if child posts { type: "IFRAME_HEIGHT", height } */
  autoResize?: boolean
}

type OutgoingMessage = { type: "TOKEN_ANALYSIS_METRICS"; payload: TokenMetrics }
type IncomingMessage = { type: "IFRAME_HEIGHT"; height: number } | { type: "IFRAME_READY" }

export class TokenAnalysisIframe {
  private iframeEl: HTMLIFrameElement | null = null
  private refreshTimer?: ReturnType<typeof setInterval>
  private resolvedTargetOrigin = "*"
  private posting = false

  constructor(private config: IframeConfig) {
    const url = new URL(config.srcUrl)
    this.resolvedTargetOrigin = config.targetOrigin ?? url.origin
  }

  init(): void {
    const container = document.getElementById(this.config.containerId)
    if (!container) throw new Error("Container not found: " + this.config.containerId)

    const iframe = document.createElement("iframe")
    iframe.src = this.config.srcUrl
    iframe.style.border = "none"
    iframe.style.width = "100%"
    iframe.style.height = "100%"
    iframe.setAttribute("loading", "lazy")
    // optional sandbox hardening without restricting same-origin
    // iframe.setAttribute("sandbox", "allow-scripts allow-same-origin")

    container.appendChild(iframe)
    this.iframeEl = iframe

    if (this.config.autoResize) {
      window.addEventListener("message", this.onIncomingMessage, false)
    }

    // initial post once the frame is ready (either onload or IFRAME_READY handshake)
    const onLoad = () => {
      this.postMetrics().catch(() => void 0)
      iframe.removeEventListener("load", onLoad)
    }
    iframe.addEventListener("load", onLoad)

    if (this.config.refreshIntervalMs && this.config.refreshIntervalMs > 0) {
      this.refreshTimer = setInterval(
        () => void this.postMetrics(),
        this.config.refreshIntervalMs
      )
    }
  }

  /**
   * Update metrics and push an immediate refresh
   */
  setMetrics(next: TokenMetrics): void {
    this.config.metrics = next
    void this.postMetrics()
  }

  /**
   * Update the refresh interval (0/undefined disables periodic posting)
   */
  setRefreshInterval(ms?: number): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    this.config.refreshIntervalMs = ms
    if (ms && ms > 0) {
      this.refreshTimer = setInterval(() => void this.postMetrics(), ms)
    }
  }

  /**
   * Clean up timers, listeners, and remove iframe
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    window.removeEventListener("message", this.onIncomingMessage, false)
    if (this.iframeEl?.parentElement) this.iframeEl.parentElement.removeChild(this.iframeEl)
    this.iframeEl = null
  }

  private onIncomingMessage = (ev: MessageEvent<IncomingMessage>) => {
    if (!this.iframeEl) return
    if (ev.origin !== this.resolvedTargetOrigin) return
    if (ev.source !== this.iframeEl.contentWindow) return
    const msg = ev.data
    if (!msg || typeof msg !== "object") return

    if (msg.type === "IFRAME_HEIGHT" && typeof msg.height === "number") {
      const h = Math.max(100, Math.min(msg.height, 20000))
      this.iframeEl.style.height = `${h}px`
    }
  }

  private async postMetrics(): Promise<void> {
    if (this.posting) return
    if (!this.iframeEl?.contentWindow) return
    this.posting = true
    try {
      const payload: OutgoingMessage = {
        type: "TOKEN_ANALYSIS_METRICS",
        payload: this.config.metrics,
      }
      this.iframeEl.contentWindow.postMessage(payload, this.resolvedTargetOrigin)
    } finally {
      this.posting = false
    }
  }
}
