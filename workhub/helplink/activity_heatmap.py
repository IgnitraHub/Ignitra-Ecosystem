from typing import List, Dict, Union

def generate_activity_heatmap(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[float]:
    """
    Bucket activity counts into 'buckets' time intervals,
    returning either raw counts or normalized values in [0.0–1.0].

    Args:
        timestamps: list of epoch ms timestamps.
        counts: list of integer counts per timestamp.
        buckets: number of intervals to divide the range into.
        normalize: whether to scale results relative to the max count.

    Returns:
        List of floats, either raw counts or normalized.
    """
    if not timestamps or not counts or len(timestamps) != len(counts):
        return []

    t_min, t_max = min(timestamps), max(timestamps)
    span = t_max - t_min or 1
    bucket_size = span / buckets

    agg = [0] * buckets
    for t, c in zip(timestamps, counts):
        idx = min(buckets - 1, int((t - t_min) / bucket_size))
        agg[idx] += c

    if normalize:
        m = max(agg) or 1
        return [round(val / m, 4) for val in agg]
    return [float(v) for v in agg]


def generate_activity_heatmap_with_labels(
    timestamps: List[int],
    counts: List[int],
    buckets: int = 10,
    normalize: bool = True
) -> List[Dict[str, Union[int, float]]]:
    """
    Extended version: returns labeled buckets with index and value.

    Returns:
        List of dicts: {"bucket": i, "value": normalized_or_raw_value}
    """
    values = generate_activity_heatmap(timestamps, counts, buckets, normalize)
    return [{"bucket": i, "value": v} for i, v in enumerate(values)]
