import nodemailer, { Transporter } from "nodemailer"

export interface AlertConfig {
  email?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string[]
    replyTo?: string
    secure?: boolean
    pool?: boolean
  }
  console?: boolean
}

export interface AlertSignal {
  title: string
  message: string
  level: "info" | "warning" | "critical"
  timestamp?: string // ISO string; if omitted, will be set automatically
}

export class AlertService {
  private transporter: Transporter | null = null

  constructor(private cfg: AlertConfig) {
    this.validateConfig()
  }

  private validateConfig() {
    if (!this.cfg.email && !this.cfg.console) {
      throw new Error("AlertService requires at least one output: email or console")
    }
    if (this.cfg.email) {
      const { host, port, user, pass, from, to } = this.cfg.email
      if (!host || !port || !user || !pass || !from || !to?.length) {
        throw new Error("Incomplete email configuration")
      }
    }
  }

  private getTransporter(): Transporter | null {
    if (!this.cfg.email) return null
    if (this.transporter) return this.transporter
    const { host, port, user, pass, secure = port === 465, pool = true } = this.cfg.email
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool,
      auth: { user, pass },
    })
    return this.transporter
  }

  private formatSubject(signal: AlertSignal): string {
    const lvl = signal.level.toUpperCase()
    return `[${lvl}] ${signal.title}`
  }

  private toHtml(message: string): string {
    const escaped = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    return `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap; line-height: 1.4;">${escaped}</pre>`
  }

  private ensureTimestamp(signal: AlertSignal): AlertSignal {
    if (signal.timestamp) return signal
    return { ...signal, timestamp: new Date().toISOString() }
  }

  private async sendEmail(signal: AlertSignal) {
    if (!this.cfg.email) return
    const t = this.getTransporter()
    if (!t) return
    const { from, to, replyTo } = this.cfg.email
    const enriched = this.ensureTimestamp(signal)
    try {
      await t.sendMail({
        from,
        to,
        replyTo,
        subject: this.formatSubject(enriched),
        text: `${enriched.message}\n\n— level: ${enriched.level}\n— time: ${enriched.timestamp}`,
        html: this.toHtml(`${enriched.message}\n\nlevel: ${enriched.level}\ntime: ${enriched.timestamp}`),
      })
    } catch (err) {
      // Fallback to console if email fails
      this.logConsole(
        this.ensureTimestamp({
