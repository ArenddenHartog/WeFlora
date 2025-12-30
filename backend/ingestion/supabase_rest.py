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
        use_keyset: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        url = f"{self.config.url}/rest/v1/{table}"
        params = {"select": select}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order

        all_rows: list[dict[str, Any]] = []
        start = 0
        order_column = order.split(".", maxsplit=1)[0] if order else ""
        is_desc = order.endswith(".desc") if order else False
        last_value: Any | None = None
        previous_last_value: Any | None = None
        remaining = limit
        total_rows: int | None = None

        while True:
            page_params = dict(params)
            if remaining is None:
                page_params["limit"] = page_size
            else:
                page_params["limit"] = min(page_size, remaining)
            if use_keyset and order_column:
                if last_value is not None:
                    operator = "lt" if is_desc else "gt"
                    page_params[order_column] = f"{operator}.{last_value}"
            else:
                page_params["offset"] = start
            headers = dict(self.headers)
            headers.setdefault("Prefer", "count=exact")
            response = requests.get(url, headers=headers, params=page_params, timeout=60)
            response.raise_for_status()
            batch = response.json()
            if not batch:
                break
            all_rows.extend(batch)
            if total_rows is None:
                content_range = response.headers.get("Content-Range")
                if content_range and "/" in content_range:
                    try:
                        reported_total = int(content_range.split("/", maxsplit=1)[1])
                        if reported_total > start + len(batch):
                            total_rows = reported_total
                    except ValueError:
                        total_rows = None
            if remaining is not None:
                remaining -= len(batch)
                if remaining <= 0:
                    break
            if use_keyset and order_column:
                last_value = batch[-1].get(order_column)
                if last_value is None:
                    use_keyset = False
                    start = len(all_rows)
                    continue
                if last_value == previous_last_value:
                    use_keyset = False
                    start = len(all_rows)
                    continue
                previous_last_value = last_value
            else:
                start += page_size
                if total_rows is not None:
                    if start >= total_rows:
                        break
                elif len(batch) < page_size:
                    break

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
