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
  timestamp?: string
}

export class AlertService {
  private transporter: Transporter | null = null

  constructor(private cfg: AlertConfig) {
    this.validateConfig()
  }

  private validateConfig(): void {
    if (!this.cfg.email && !this.cfg.console) {
      throw new Error("AlertService requires at least one output (email or console)")
    }
    if (this.cfg.email) {
      const { host, port, user, pass, from, to } = this.cfg.email
      if (!host || !port || !user || !pass || !from || !to?.length) {
        throw new Error("Invalid email configuration")
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

  private enrichSignal(signal: AlertSignal): AlertSignal {
    if (signal.timestamp) return signal
    return { ...signal, timestamp: new Date().toISOString() }
  }

  private formatSubject(signal: AlertSignal): string {
    return `[${signal.level.toUpperCase()}] ${signal.title}`
  }

  private formatHtml(signal: AlertSignal): string {
    const escaped = signal.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    return `<div style="font-family: monospace; white-space: pre-wrap; line-height:1.4;">
      <b>Level:</b> ${signal.level}<br/>
      <b>Time:</b> ${signal.timestamp}<br/><br/>
      ${escaped}
    </div>`
  }

  private async sendEmail(signal: AlertSignal): Promise<void> {
    if (!this.cfg.email) return
    const t = this.getTransporter()
    if (!t) return
    const { from, to, replyTo } = this.cfg.email
    const enriched = this.enrichSignal(signal)
    try {
      await t.sendMail({
        from,
        to,
        replyTo,
        subject: this.formatSubject(enriched),
        text: `${enriched.message}\n\nlevel: ${enriched.level}\ntime: ${enriched.timestamp}`,
        html: this.formatHtml(enriched),
      })
    } catch (err) {
      this.logConsole({
        title: "Email dispatch failed",
        message: (err as Error)?.message || "Unknown error",
        level: "critical",
      })
    }
  }

  private logConsole(signal: AlertSignal): void {
    if (!this.cfg.console) return
    const enriched = this.enrichSignal(signal)
    console.log(
      JSON.stringify({
        channel: "alert",
        level: enriched.level,
        title: enriched.title,
        message: enriched.message,
        timestamp: enriched.timestamp,
      })
    )
  }

  async dispatch(signals: AlertSignal[]): Promise<void> {
    if (!Array.isArray(signals) || signals.length === 0) return
    for (const sig of signals) {
      await this.sendEmail(sig)
      this.logConsole(sig)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.cfg.email) return false
    const t = this.getTransporter()
    try {
      await t!.verify()
      return true
    } catch (err) {
      this.logConsole({
        title: "SMTP verification failed",
        message: (err as Error)?.message || "Unknown error",
        level: "warning",
      })
      return false
    }
  }
}
