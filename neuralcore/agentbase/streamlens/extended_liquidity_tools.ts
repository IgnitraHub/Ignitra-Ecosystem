import { toolkitBuilder } from "@/ai/core"
import { FETCH_POOL_DATA_KEY } from "@/ai/modules/liquidity/pool-fetcher/key"
import { ANALYZE_POOL_HEALTH_KEY } from "@/ai/modules/liquidity/health-checker/key"
import { FetchPoolDataAction } from "@/ai/modules/liquidity/pool-fetcher/action"
import { AnalyzePoolHealthAction } from "@/ai/modules/liquidity/health-checker/action"

type Toolkit = ReturnType<typeof toolkitBuilder>

/**
 * Extended liquidity tools registry
 * Includes:
 * – fetch pool raw data
 * – analyze pool health / risk metrics
 * Provides helpers to inspect and resolve tools dynamically
 */
export const EXTENDED_LIQUIDITY_TOOLS: Record<string, Toolkit> = Object.freeze({
  [`liquidityscan-${FETCH_POOL_DATA_KEY}`]: toolkitBuilder(new FetchPoolDataAction()),
  [`poolhealth-${ANALYZE_POOL_HEALTH_KEY}`]: toolkitBuilder(new AnalyzePoolHealthAction()),
})

/**
 * List available extended liquidity tool keys
 */
export function listExtendedLiquidityTools(): string[] {
  return Object.keys(EXTENDED_LIQUIDITY_TOOLS)
}

/**
 * Resolve an extended liquidity tool by key
 */
export function getExtendedLiquidityTool(key: string): Toolkit | undefined {
  return EXTENDED_LIQUIDITY_TOOLS[key]
}
