from __future__ import annotations

import io
import os
from typing import Iterable

import pandas as pd
import fitz


def extract_text_from_bytes(data: bytes, filename: str, mime_type: str | None = None) -> str:
    lowered = filename.lower()
    if lowered.endswith(".pdf") or mime_type == "application/pdf":
        return _extract_pdf(data)
    if lowered.endswith(".csv") or mime_type == "text/csv":
        return _extract_csv(data)
    if lowered.endswith(".xlsx") or lowered.endswith(".xls"):
        return _extract_excel(data)
    if lowered.endswith(".txt") or mime_type == "text/plain":
        return data.decode("utf-8", errors="ignore")
    return data.decode("utf-8", errors="ignore")


def _extract_pdf(data: bytes) -> str:
    text_parts: list[str] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts)


def _extract_csv(data: bytes) -> str:
    df = pd.read_csv(io.BytesIO(data))
    return df.to_csv(index=False)


def _extract_excel(data: bytes) -> str:
    xls = pd.ExcelFile(io.BytesIO(data))
    sheets: list[str] = []
    for sheet_name in xls.sheet_names:
        df = xls.parse(sheet_name)
        sheets.append(f"Sheet: {sheet_name}\n" + df.to_csv(index=False))
    return "\n".join(sheets)
