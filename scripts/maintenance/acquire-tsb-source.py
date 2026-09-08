#!/usr/bin/env python3
"""Temporary B2 maintenance script: acquire a price-free normalized TSB snapshot."""

from __future__ import annotations

import argparse
import io
import json
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

import requests
from openpyxl import load_workbook

BASE_URL = "https://www.tsb.org.tr"
MONTHS_URL = f"{BASE_URL}/InsuranceData/GetMonthList"
ARCHIVE_URL = f"{BASE_URL}/InsuranceData/GetInsuranceDataArchiveFile"
SOURCE_PAGE = f"{BASE_URL}/tr/kasko-arsiv-listesi"
HEADER_SCAN_ROWS = 25
ARCHIVE_LOOKBACK_MONTHS = 18


def fold(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("ı", "i").replace("İ", "I")
    decomposed = unicodedata.normalize("NFKD", text)
    return " ".join(
        "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower().split()
    )


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(unicodedata.normalize("NFKC", str(value)).strip().split())


def identity(value: str) -> str:
    return fold(value).upper()


def as_int(value: Any) -> int | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        return int(float(text.replace(",", ".")))
    except ValueError:
        return None


def unwrap(payload: Any) -> Any:
    if isinstance(payload, dict) and "Result" in payload:
        if payload.get("HasError") is True:
            raise RuntimeError(f"TSB returned an error: {payload.get('Message')}")
        return payload["Result"]
    return payload


def request_json(session: requests.Session, url: str, **params: Any) -> Any:
    response = session.get(url, params=params or None, timeout=30)
    response.raise_for_status()
    try:
        return unwrap(response.json())
    except ValueError as error:
        raise RuntimeError(f"Expected JSON from {response.url}") from error


def previous_periods(year: int, month: int, limit: int) -> list[tuple[int, int]]:
    periods: list[tuple[int, int]] = []
    current_year, current_month = year, month
    for _ in range(limit):
        periods.append((current_year, current_month))
        current_month -= 1
        if current_month == 0:
            current_year -= 1
            current_month = 12
    return periods


def resolve_latest_archive_url(
    session: requests.Session,
    year: int,
    month: int,
) -> tuple[int, int, str]:
    months = request_json(session, MONTHS_URL)
    if not isinstance(months, list):
        raise RuntimeError("TSB month list response is not an array")

    month_ids: dict[int, int] = {}
    for item in months:
        if not isinstance(item, dict):
            continue
        try:
            order = int(item.get("MonthOrder"))
            month_id = int(item["Id"])
        except (KeyError, TypeError, ValueError):
            continue
        if 1 <= order <= 12:
            month_ids[order] = month_id

    checked: list[str] = []
    for candidate_year, candidate_month in previous_periods(
        year, month, ARCHIVE_LOOKBACK_MONTHS
    ):
        month_id = month_ids.get(candidate_month)
        if month_id is None:
            continue
        payload = request_json(
            session,
            ARCHIVE_URL,
            Year=candidate_year,
            MonthId=month_id,
        )
        checked.append(f"{candidate_year}-{candidate_month:02d}")
        if payload in (None, ""):
            continue
        if not isinstance(payload, str):
            raise RuntimeError(
                f"Unexpected TSB archive path response for {candidate_year}-{candidate_month:02d}"
            )
        path = payload.strip()
        if path:
            url = path if path.startswith("http") else f"{BASE_URL}/{path.lstrip('/')}"
            return candidate_year, candidate_month, url

    raise RuntimeError(f"TSB published no archive in checked periods: {', '.join(checked)}")


FIELD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "brand_code": ("marka kodu", "markakodu", "brand code"),
    "model_code": ("model kodu", "modelkodu", "tip kodu", "tipkodu", "model code"),
    "model_year": ("model yili", "modelyili", "model year"),
    "brand": ("marka", "brand"),
    "model": ("model", "tip", "arac", "vehicle"),
}
FIELD_PRIORITY = ("brand_code", "model_code", "model_year", "brand", "model")
COMBINED = "brand_model"


def match_header(value: Any) -> str | None:
    header = fold(value)
    if not header:
        return None
    if "marka" in header and ("model" in header or "tip" in header):
        return COMBINED
    for field in FIELD_PRIORITY:
        if any(keyword in header for keyword in FIELD_KEYWORDS[field]):
            return field
    return None


def header_year(value: Any, publication_year: int) -> int | None:
    year = as_int(value)
    if year is None or year < 1886 or year > publication_year + 1:
        return None
    return year


def locate_header(
    rows: list[tuple[Any, ...]],
    publication_year: int,
) -> tuple[int, dict[str, int], dict[int, int]]:
    best_index = -1
    best_fields: dict[str, int] = {}
    best_years: dict[int, int] = {}
    best_score = -1

    for row_index, row in enumerate(rows[:HEADER_SCAN_ROWS]):
        fields: dict[str, int] = {}
        years: dict[int, int] = {}
        for column_index, value in enumerate(row):
            field = match_header(value)
            if field and field not in fields:
                fields[field] = column_index
            year = header_year(value, publication_year)
            if year is not None:
                years[year] = column_index

        score = len(fields) * 100 + len(years)
        if score > best_score:
            best_index, best_fields, best_years, best_score = (
                row_index,
                fields,
                years,
                score,
            )

    required = {"brand_code", "model_code"}
    if best_index < 0 or not required.issubset(best_fields):
        raise RuntimeError(
            f"Could not locate required TSB workbook columns; found {sorted(best_fields)}"
        )
    if COMBINED not in best_fields and not {"brand", "model"}.issubset(best_fields):
        raise RuntimeError("TSB workbook has no usable brand/model text columns")
    if "model_year" not in best_fields and not best_years:
        raise RuntimeError("TSB workbook has neither a model-year column nor year value columns")
    return best_index, best_fields, best_years


def split_combined(value: Any) -> tuple[str, str]:
    text = clean_text(value)
    if not text:
        return "", ""
    for separator in (" - ", "-", "/"):
        if separator in text:
            head, tail = text.split(separator, 1)
            if head.strip() and tail.strip():
                return clean_text(head), clean_text(tail)
    return "", text


def cell(row: tuple[Any, ...], index: int | None) -> Any:
    if index is None or index >= len(row):
        return None
    return row[index]


def has_year_value(value: Any) -> bool:
    text = clean_text(value)
    if not text:
        return False
    return text not in {"0", "0.0", "0,0", "-"}


def parse_workbook(content: bytes, *, publication_year: int) -> list[dict[str, Any]]:
    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as error:
        raise RuntimeError(f"Could not open TSB workbook: {error}") from error

    try:
        sheet = workbook.worksheets[0]
        rows = list(sheet.iter_rows(values_only=True))
    finally:
        workbook.close()

    header_index, columns, year_columns = locate_header(rows, publication_year)
    grouped: dict[str, dict[str, Any]] = {}
    years_by_key: dict[str, set[int]] = defaultdict(set)

    for row in rows[header_index + 1 :]:
        brand_code = as_int(cell(row, columns.get("brand_code")))
        model_code = as_int(cell(row, columns.get("model_code")))
        if brand_code is None or model_code is None:
            continue

        row_years: set[int] = set()
        if "model_year" in columns:
            model_year = as_int(cell(row, columns.get("model_year")))
            if model_year is not None and 1886 <= model_year <= publication_year + 1:
                row_years.add(model_year)
        else:
            for year, column_index in year_columns.items():
                if has_year_value(cell(row, column_index)):
                    row_years.add(year)
        if not row_years:
            continue

        if COMBINED in columns:
            brand_raw, type_raw = split_combined(cell(row, columns.get(COMBINED)))
        else:
            brand_raw = clean_text(cell(row, columns.get("brand")))
            type_raw = clean_text(cell(row, columns.get("model")))
        if not brand_raw or not type_raw:
            continue

        source_key = f"{brand_code}-{model_code}"
        existing = grouped.get(source_key)
        if existing is None:
            grouped[source_key] = {
                "sourceKey": source_key,
                "brandRaw": brand_raw,
                "typeRaw": type_raw,
            }
        elif (
            identity(existing["brandRaw"]) != identity(brand_raw)
            or identity(existing["typeRaw"]) != identity(type_raw)
        ):
            raise RuntimeError(
                f"Conflicting brand/type identity for TSB code {source_key}: "
                f"{existing['brandRaw']} / {existing['typeRaw']} vs {brand_raw} / {type_raw}"
            )
        years_by_key[source_key].update(row_years)

    if not grouped:
        raise RuntimeError("TSB workbook produced zero normalized vehicle records")

    return [
        {
            **grouped[source_key],
            "availableModelYears": sorted(years_by_key[source_key]),
        }
        for source_key in sorted(grouped)
    ]


def acquire(year: int, month: int) -> dict[str, Any]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Bizzat vehicle-catalog maintenance/1.0",
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
            "Referer": SOURCE_PAGE,
        }
    )
    actual_year, actual_month, archive_url = resolve_latest_archive_url(session, year, month)
    response = session.get(archive_url, timeout=60)
    response.raise_for_status()
    records = parse_workbook(response.content, publication_year=actual_year)
    return {
        "provider": {
            "code": "tsb-kasko",
            "sourceName": "Türkiye Sigorta Birliği Kasko Değer Listesi",
            "sourceUrl": SOURCE_PAGE,
            "version": f"{actual_year}-{actual_month:02d}",
        },
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, choices=range(1, 13), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    snapshot = acquire(args.year, args.month)
    serialized = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    forbidden = ("amount", "price", "bedel", "deger", "tutar")
    lowered = serialized.lower()
    if any(f'"{term}"' in lowered for term in forbidden):
        raise RuntimeError("Normalized snapshot unexpectedly contains a price/value field")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(serialized + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "version": snapshot["provider"]["version"],
                "records": len(snapshot["records"]),
                "output": str(args.output),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"acquisition failed: {error}", file=sys.stderr)
        raise
