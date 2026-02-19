from collections import defaultdict, deque
from time import time


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, max_events: int, window_seconds: int) -> bool:
        now = time()
        bucket = self._events[key]
        threshold = now - window_seconds

        while bucket and bucket[0] < threshold:
            bucket.popleft()

        if len(bucket) >= max_events:
            return False

        bucket.append(now)
        return True


rate_limiter = InMemoryRateLimiter()
