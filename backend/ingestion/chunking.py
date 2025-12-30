from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ChunkingConfig:
    max_tokens: int
    overlap: int


def chunk_text(text: str, config: ChunkingConfig) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(start + config.max_tokens, len(words))
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end == len(words):
            break
        start = max(end - config.overlap, 0)
    return chunks
