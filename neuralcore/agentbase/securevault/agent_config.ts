export interface AgentCapabilities {
  canAnswerProtocolQuestions: boolean
  canAnswerTokenQuestions: boolean
  canDescribeTooling: boolean
  canReportEcosystemNews: boolean
  canAnalyzeWallets: boolean
  canDetectScams: boolean
}

export interface AgentFlags {
  requiresExactInvocation: boolean
  noAdditionalCommentary: boolean
  strictMode: boolean
  experimental?: boolean
}

export const SOLANA_AGENT_CAPABILITIES: AgentCapabilities = {
  canAnswerProtocolQuestions: true,
  canAnswerTokenQuestions: true,
  canDescribeTooling: true,
  canReportEcosystemNews: true,
  canAnalyzeWallets: true,
  canDetectScams: true,
}

export const SOLANA_AGENT_FLAGS: AgentFlags = {
  requiresExactInvocation: true,
  noAdditionalCommentary: true,
  strictMode: true,
}
