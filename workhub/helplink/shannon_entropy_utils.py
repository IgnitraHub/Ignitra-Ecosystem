import math
from typing import List, Dict, Any

def compute_shannon_entropy(addresses: List[str]) -> float:
    """
    Compute Shannon entropy (in bits) of an address sequence.

    Args:
        addresses: list of addresses (strings)

    Returns:
        Shannon entropy rounded to 4 decimals
    """
    if not addresses:
        return 0.0
    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1
    total = len(addresses)
    entropy = 0.0
    for count in freq.values():
        p = count / total
        entropy -= p * math.log2(p)
    return round(entropy, 4)


def entropy_distribution(addresses: List[str]) -> Dict[str, Any]:
    """
    Return both the entropy value and the normalized distribution of addresses.

    Args:
        addresses: list of addresses (strings)

    Returns:
        Dict with keys:
          - "entropy": Shannon entropy (float)
          - "distribution": dict mapping address -> probability
    """
    if not addresses:
        return {"entropy": 0.0, "distribution": {}}
    freq: Dict[str, int] = {}
    for a in addresses:
        freq[a] = freq.get(a, 0) + 1
    total = len(addresses)
    distribution = {addr: round(count / total, 6) for addr, count in freq.items()}
    entropy = compute_shannon_entropy(addresses)
    return {"entropy": entropy, "distribution": distribution}
