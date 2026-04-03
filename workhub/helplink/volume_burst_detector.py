from typing import List, Dict, Union

def detect_volume_bursts(
    volumes: List[float],
    threshold_ratio: float = 1.5,
    min_interval: int = 1
) -> List[Dict[str, Union[int, float]]]:
    """
    Identify indices where volume jumps by threshold_ratio compared to the previous value.

    Args:
        volumes: list of volume values.
        threshold_ratio: minimum multiple of increase to qualify as a burst.
        min_interval: minimum spacing (in indices) between detected bursts.

    Returns:
        List of dicts with keys:
          - index: index of the burst (int)
          - previous: previous volume (float)
          - current: current volume (float)
          - ratio: ratio of current/previous (float)
    """
    if not volumes or len(volumes) < 2:
        return []

    events: List[Dict[str, Union[int, float]]] = []
    last_idx = -min_interval
    for i in range(1, len(volumes)):
        prev, curr = volumes[i - 1], volumes[i]
        ratio = (curr / prev) if prev > 0 else float("inf")
        if ratio >= threshold_ratio and (i - last_idx) >= min_interval:
            events.append({
                "index": i,
                "previous": float(prev),
                "current": float(curr),
                "ratio": round(ratio, 4),
            })
            last_idx = i
    return events


def summarize_bursts(events: List[Dict[str, Union[int, float]]]) -> Dict[str, Union[int, float]]:
    """
    Summarize burst events: count, average ratio, max ratio.

    Args:
        events: list of burst event dicts.

    Returns:
        Dictionary with summary metrics.
    """
    if not events:
        return {"count": 0, "avg_ratio": 0.0, "max_ratio": 0.0}
    ratios = [e["ratio"] for e in events if isinstance(e["ratio"], (int, float))]
    return {
        "count": len(events),
        "avg_ratio": round(sum(ratios) / len(ratios), 4) if ratios else 0.0,
        "max_ratio": round(max(ratios), 4) if ratios else 0.0,
    }
