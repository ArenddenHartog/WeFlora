from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any, Iterable

from ingestion.chunking import ChunkingConfig, chunk_text
from ingestion.embedding import EmbeddingConfig, EmbeddingProvider
from ingestion.extraction import extract_text_from_bytes
from ingestion.supabase_rest import SupabaseConfig, SupabaseREST


@dataclass(frozen=True)
class SpeciesRow:
    id: str
    genus: str | None
    species: str | None
    code: str | None
    common_name: str | None
    family: str | None
    class_name: str | None
    tags: list[str] | None
    updated_at: str | None


def load_species_rows(client: SupabaseREST) -> list[SpeciesRow]:
    rows = client.fetch_rows("species", select="*")
    species: list[SpeciesRow] = []
    for row in rows:
        species.append(
            SpeciesRow(
                id=row.get("id"),
                genus=row.get("genus"),
                species=row.get("species"),
                code=row.get("code"),
                common_name=row.get("common_name"),
                family=row.get("family"),
                class_name=row.get("class"),
                tags=row.get("tags"),
                updated_at=row.get("updated_at"),
            )
        )
    return species


def build_species_text(row: SpeciesRow) -> str:
    parts = ["Species Profile"]
    if row.genus:
        parts.append(f"Genus: {row.genus}")
    if row.species:
        parts.append(f"Species: {row.species}")
    if row.code:
        parts.append(f"Code: {row.code}")
    if row.common_name:
        parts.append(f"Common name: {row.common_name}")
    if row.family:
        parts.append(f"Family: {row.family}")
    if row.class_name:
        parts.append(f"Class: {row.class_name}")
    if row.tags:
        parts.append(f"Tags: {', '.join(row.tags)}")
    return "\n".join(parts)


def ingest_species(client: SupabaseREST, embedder: EmbeddingProvider) -> None:
    chunking = ChunkingConfig(max_tokens=400, overlap=40)
    species_rows = load_species_rows(client)
    rows_to_insert: list[dict[str, Any]] = []

    for row in species_rows:
        text = build_species_text(row)
        chunks = chunk_text(text, chunking)
        embeddings = embedder.embed(chunks)
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            rows_to_insert.append(
                {
                    "species_id": row.id,
                    "chunk_id": f"{row.id}:{idx}",
                    "content": chunk,
                    "embedding": embedding,
                    "source": "canonical",
                    "version": row.updated_at,
                }
            )

    if rows_to_insert:
        client.insert_rows("species_embeddings", rows_to_insert)


def ingest_uploads(client: SupabaseREST, embedder: EmbeddingProvider) -> None:
    chunking = ChunkingConfig(max_tokens=500, overlap=60)
    files = client.fetch_rows("files", select="*")
    rows_to_insert: list[dict[str, Any]] = []

    for row in files:
        file_id = row.get("id")
        user_id = row.get("user_id")
        project_id = row.get("project_id")
        name = row.get("name") or "uploaded_file"
        mime = row.get("mime_type")
        if not file_id or not user_id:
            continue

        storage_path = f"{user_id}/{file_id}"
        data = client.download_storage_object("project_files", storage_path)
        text = extract_text_from_bytes(data, name, mime)
        chunks = chunk_text(text, chunking)
        embeddings = embedder.embed(chunks)

        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            rows_to_insert.append(
                {
                    "user_id": user_id,
                    "project_id": project_id,
                    "file_id": file_id,
                    "chunk_id": f"{file_id}:{idx}",
                    "content": chunk,
                    "embedding": embedding,
                    "origin": "user",
                    "metadata": {
                        "file_name": name,
                        "mime_type": mime,
                        "source": "upload",
                    },
                }
            )

    if rows_to_insert:
        client.insert_rows("document_embeddings", rows_to_insert)


def ingest_web(client: SupabaseREST, embedder: EmbeddingProvider, payloads: Iterable[dict[str, Any]]) -> None:
    chunking = ChunkingConfig(max_tokens=350, overlap=40)
    rows_to_insert: list[dict[str, Any]] = []

    for payload in payloads:
        content = payload.get("content")
        if not content:
            continue
        chunks = chunk_text(content, chunking)
        embeddings = embedder.embed(chunks)
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            rows_to_insert.append(
                {
                    "user_id": payload.get("user_id"),
                    "query": payload.get("query"),
                    "url": payload.get("url"),
                    "domain": payload.get("domain"),
                    "crawl_version": payload.get("crawl_version"),
                    "content": chunk,
                    "embedding": embedding,
                    "origin": "web",
                    "metadata": {
                        "title": payload.get("title"),
                        "source": payload.get("source"),
                        "chunk_index": idx,
                    },
                }
            )

    if rows_to_insert:
        client.insert_rows("web_embeddings", rows_to_insert)


def load_web_payloads(path: str) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return data
    return [data]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="WeFlora ingestion pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("species", help="Ingest canonical species embeddings")
    subparsers.add_parser("uploads", help="Ingest user upload embeddings")

    web_parser = subparsers.add_parser("web", help="Ingest web search embeddings")
    web_parser.add_argument("--input", required=True, help="Path to JSON payload of web documents")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    config = SupabaseConfig.from_env()
    client = SupabaseREST(config)
    embedder = EmbeddingProvider(EmbeddingConfig.from_env())

    if args.command == "species":
        ingest_species(client, embedder)
    elif args.command == "uploads":
        ingest_uploads(client, embedder)
    elif args.command == "web":
        payloads = load_web_payloads(args.input)
        ingest_web(client, embedder, payloads)


if __name__ == "__main__":
    main()
