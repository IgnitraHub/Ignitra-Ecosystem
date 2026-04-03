import math
from typing import Dict

def calculate_risk_score(price_change_pct: float, liquidity_usd: float, flags_mask: int) -> float:
    """
    Compute a 0–100 risk score.

    Components:
      - Volatility: percent change in price, scaled (max 50 points)
      - Liquidity: deeper liquidity reduces risk, up to 30 points reduction
      - Flags: bitmask of detected risk conditions, each bit adds 5 points

    Args:
        price_change_pct: percent change over a period (e.g. +5.0 for +5%).
        liquidity_usd: total liquidity in USD.
        flags_mask: integer bitmask of risk flags.

    Returns:
        A float risk score in the range [0, 100].
    """
    # volatility component (max 50)
    vol_score = min(abs(price_change_pct) / 10, 1.0) * 50.0

    # liquidity component: more liquidity = lower risk, up to 30
    if liquidity_usd > 0:
        liq_score = max(0.0, 30.0 - (math.log10(liquidity_usd) * 5.0))
    else:
        liq_score = 30.0

    # flag penalty: 5 points per bit set
    flag_count = bin(flags_mask).count("1")
    flag_score = flag_count * 5.0

    raw_score = vol_score + liq_score + flag_score
    return min(round(raw_score, 2), 100.0)


def risk_score_breakdown(price_change_pct: float, liquidity_usd: float, flags_mask: int) -> Dict[str, float]:
    """
    Return a structured breakdown of the risk score components.
    Useful for debugging and analytics.

    Returns:
        Dict with 'volatility', 'liquidity', 'flags', and 'total' keys.
    """
    vol_score = min(abs(price_change_pct) / 10, 1.0) * 50.0
    liq_score = max(0.0, 30.0 - (math.log10(liquidity_usd) * 5.0)) if liquidity_usd > 0 else 30.0
    flag_score = bin(flags_mask).count("1") * 5.0
    total = min(round(vol_score + liq_score + flag_score, 2), 100.0)
    return {
        "volatility": round(vol_score, 2),
        "liquidity": round(liq_score, 2),
        "flags": round(flag_score, 2),
        "total": total,
    }
