from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Iterable, Mapping

import requests


@dataclass(frozen=True)
class SupabaseConfig:
    url: str
    service_role_key: str

    @staticmethod
    def from_env() -> "SupabaseConfig":
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return SupabaseConfig(url=url.rstrip("/"), service_role_key=key)


class SupabaseREST:
    def __init__(self, config: SupabaseConfig) -> None:
        self.config = config

    @property
    def headers(self) -> Mapping[str, str]:
        return {
            "apikey": self.config.service_role_key,
            "Authorization": f"Bearer {self.config.service_role_key}",
            "Content-Type": "application/json",
        }

    def fetch_rows(
        self,
        table: str,
        select: str = "*",
        filters: Mapping[str, str] | None = None,
        page_size: int = 1000,
        order: str = "id",
    ) -> list[dict[str, Any]]:
        url = f"{self.config.url}/rest/v1/{table}"
        params = {"select": select}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order

        all_rows: list[dict[str, Any]] = []
        start = 0

        while True:
            page_params = dict(params)
            page_params["limit"] = page_size
            page_params["offset"] = start
            response = requests.get(url, headers=self.headers, params=page_params, timeout=60)
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            all_rows.extend(batch)
            if len(batch) < page_size:
                break
            start += page_size

        return all_rows

    def insert_rows(self, table: str, rows: Iterable[Mapping[str, Any]], batch_size: int = 500) -> None:
        url = f"{self.config.url}/rest/v1/{table}"
        rows_list = list(rows)
        if not rows_list:
            return

        for start in range(0, len(rows_list), batch_size):
            batch = rows_list[start : start + batch_size]
            payload = json.dumps(batch)
            response = requests.post(url, headers=self.headers, data=payload, timeout=60)
            response.raise_for_status()

    def download_storage_object(self, bucket: str, path: str) -> bytes:
        url = f"{self.config.url}/storage/v1/object/{bucket}/{path}"
        response = requests.get(url, headers=self.headers, timeout=60)
        response.raise_for_status()
        return response.content
