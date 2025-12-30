from __future__ import annotations

import hashlib
import os
import random
from dataclasses import dataclass
from typing import Iterable

from google import genai


@dataclass(frozen=True)
class EmbeddingConfig:
    provider: str
    dimension: int
    model: str

    @staticmethod
    def from_env() -> "EmbeddingConfig":
        provider = os.environ.get("EMBEDDING_PROVIDER", "mock")
        dimension = int(os.environ.get("EMBEDDING_DIM", "1536"))
        model = os.environ.get("EMBEDDING_MODEL", "text-embedding-004")
        return EmbeddingConfig(provider=provider, dimension=dimension, model=model)


class EmbeddingProvider:
    def __init__(self, config: EmbeddingConfig) -> None:
        self.config = config

    def embed(self, texts: Iterable[str]) -> list[list[float]]:
        if self.config.provider == "google":
            return self._embed_google(texts)
        return self._embed_mock(texts)

    def _embed_google(self, texts: Iterable[str]) -> list[list[float]]:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GOOGLE_API_KEY for google embedding provider")

        client = genai.Client(api_key=api_key)
        embeddings: list[list[float]] = []
        for text in texts:
            response = client.models.embed_content(
                model=self.config.model,
                contents=text,
            )
            embedding = getattr(response, "embedding", None)
            if embedding is None:
                embedding = response.embeddings[0].values
            embeddings.append(list(embedding))
        return embeddings

    def _embed_mock(self, texts: Iterable[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for text in texts:
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16) % (2**32)
            rng = random.Random(seed)
            embeddings.append([rng.uniform(-1, 1) for _ in range(self.config.dimension)])
        return embeddings
