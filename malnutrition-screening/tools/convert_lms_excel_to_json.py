"""
Convert WHO LMS Excel workbooks into data/lms.json for the malnutrition
screening PWA without requiring third-party Excel dependencies.

Expected files in the working directory (or pass --dir):
  weight_for_age.xlsx    -> waz (numeric key: age, months)
  Height_for_age.xlsx    -> haz
  weight_for_height.xlsx -> whz (numeric key: height, cm; preserves WHO age bands)
  bmi_for_age.xlsx       -> baz
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

DATASET_VERSION = "who-lms-v3"
ALLOWED_INDICATORS = ("waz", "haz", "whz", "baz")
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def column_letters(ref: str) -> str:
    letters = []
    for char in ref:
        if char.isalpha():
            letters.append(char)
        else:
            break
    return "".join(letters)


def normalize_header(value: str) -> str:
    compact = re.sub(r"\s+", "", str(value or "").strip().lower())
    mapping = {
        "gender": "sex",
        "sex": "sex",
        "age": "age",
        "age(months)": "age",
        "length(cm)": "height",
        "height(cm)": "height",
        "length": "height",
        "height": "height",
        "l": "L",
        "m": "M",
        "s": "S",
    }
    return mapping.get(compact, str(value or "").strip())


def normalize_sex(value: str | None, sheet_name: str) -> str | None:
    raw = str(value or "").strip().upper()
    if not raw:
        low = sheet_name.lower()
        if "boy" in low or "male" in low:
            raw = "M"
        elif "girl" in low or "female" in low:
            raw = "F"
    if raw in {"M", "MALE", "BOY"}:
        return "M"
    if raw in {"F", "FEMALE", "GIRL"}:
        return "F"
    return None


def parse_number(value: str | None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def load_xlsx_records(path: Path) -> list[tuple[str, dict[str, str]]]:
    with ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("main:si", NS):
                text = "".join(node.text or "" for node in item.iterfind(".//main:t", NS))
                shared_strings.append(text)

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target_by_id = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pkg:Relationship", NS)
        }

        records: list[tuple[str, dict[str, str]]] = []
        sheets = workbook.find("main:sheets", NS)
        if sheets is None:
            raise ValueError(f"No sheets found in {path}")
        for sheet in sheets:
            name = sheet.attrib.get("name", "Sheet")
            rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = "xl/" + target_by_id[rel_id]
            xml = ET.fromstring(archive.read(target))
            headers: dict[str, str] | None = None

            for row in xml.findall(".//main:sheetData/main:row", NS):
                values: dict[str, str] = {}
                for cell in row.findall("main:c", NS):
                    ref = cell.attrib.get("r", "")
                    typ = cell.attrib.get("t")
                    value_node = cell.find("main:v", NS)
                    inline_node = cell.find("main:is", NS)
                    if typ == "s" and value_node is not None:
                        value = shared_strings[int(value_node.text)]
                    elif typ == "inlineStr" and inline_node is not None:
                        value = "".join(node.text or "" for node in inline_node.iterfind(".//main:t", NS))
                    elif value_node is not None:
                        value = value_node.text or ""
                    else:
                        value = ""
                    values[column_letters(ref)] = value

                if headers is None:
                    headers = {col: normalize_header(val) for col, val in values.items()}
                    continue

                row_map = {headers[col]: val for col, val in values.items() if col in headers}
                if any(str(v).strip() for v in row_map.values()):
                    records.append((name, row_map))

        return records


def load_indicator_records(path: Path, numeric_cols: list[str], preserve_age_band: bool = False) -> list[dict]:
    cleaned: list[dict] = []
    for sheet_name, raw in load_xlsx_records(path):
        sex = normalize_sex(raw.get("sex"), sheet_name)
        if sex is None:
            continue

        row: dict[str, object] = {"sex": sex}
        valid = True
        for col in numeric_cols:
            number = parse_number(raw.get(col))
            if number is None:
                valid = False
                break
            row[col] = number

        for col in ("L", "M", "S"):
            number = parse_number(raw.get(col))
            if number is None:
                valid = False
                break
            row[col] = number

        if not valid:
            continue

        if preserve_age_band:
            age_band = str(raw.get("age", "")).strip()
            if not age_band:
                valid = False
            else:
                row["ageBand"] = age_band

        if valid:
            cleaned.append(row)

    if not cleaned:
        raise ValueError(f"No valid data in {path}")
    return cleaned


def group_rows(records: list[dict], xkey: str, preserve_age_band: bool = False) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {"M": [], "F": []}
    for sex in ("M", "F"):
        grouped: dict[tuple, list[dict]] = defaultdict(list)
        for row in records:
            if row["sex"] != sex:
                continue
            key = (row[xkey], row.get("ageBand")) if preserve_age_band else (row[xkey],)
            grouped[key].append(row)

        payload_rows: list[dict] = []
        for key, items in grouped.items():
            bucket = {
                xkey: float(key[0]),
                "L": sum(float(item["L"]) for item in items) / len(items),
                "M": sum(float(item["M"]) for item in items) / len(items),
                "S": sum(float(item["S"]) for item in items) / len(items),
            }
            if preserve_age_band:
                bucket["ageBand"] = key[1]
            payload_rows.append(bucket)

        sort_key = (lambda row: (row.get("ageBand", ""), row[xkey])) if preserve_age_band else (lambda row: row[xkey])
        out[sex] = sorted(payload_rows, key=sort_key)
    return out


def validate_rows(rows: dict[str, list[dict]], xkey: str, indicator: str, preserve_age_band: bool = False) -> None:
    for sex in ("M", "F"):
        values = rows.get(sex, [])
        if not values:
            raise ValueError(f"{indicator}.{sex} has no rows.")

        seen: set[tuple] = set()
        for row in values:
            if xkey not in row:
                raise ValueError(f"{indicator}.{sex} row missing {xkey}.")
            if preserve_age_band and not row.get("ageBand"):
                raise ValueError(f"{indicator}.{sex} row missing ageBand.")
            key = (row[xkey], row.get("ageBand")) if preserve_age_band else (row[xkey],)
            if key in seen:
                raise ValueError(f"{indicator}.{sex} contains duplicate keys: {key}.")
            seen.add(key)

            for field in ("L", "M", "S"):
                if not isinstance(row.get(field), float):
                    raise ValueError(f"{indicator}.{sex} {field} is not numeric.")


def validate_payload(payload: dict) -> None:
    if payload.get("meta", {}).get("schema_version") != DATASET_VERSION:
        raise ValueError("Payload has an unexpected schema version.")
    for indicator in ALLOWED_INDICATORS:
        if indicator not in payload:
            raise ValueError(f"Payload missing indicator: {indicator}")
        validate_rows(
            payload[indicator],
            "height" if indicator == "whz" else "age",
            indicator,
            preserve_age_band=(indicator == "whz"),
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=Path("."), help="Directory containing the four xlsx files")
    ap.add_argument("-o", "--output", type=Path, default=Path("data/lms.json"), help="Output JSON path")
    ap.add_argument("--source", type=str, default="WHO growth standards Excel", help="Source label persisted in metadata.")
    args = ap.parse_args()
    base = args.dir

    waz = load_indicator_records(base / "weight_for_age.xlsx", ["age"])
    haz = load_indicator_records(base / "Height_for_age.xlsx", ["age"])
    whz = load_indicator_records(base / "weight_for_height.xlsx", ["height"], preserve_age_band=True)
    baz = load_indicator_records(base / "bmi_for_age.xlsx", ["age"])

    payload = {
        "meta": {
            "schema_version": DATASET_VERSION,
            "dataset_id": "who-growth-standards",
            "source": args.source,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "waz_age_months_max": 120,
            "whz_age_months_max": 60,
            "whz_age_bands": {"0-2": "0 to 23 months", "2-5": "24 to 60 months"},
        },
        "waz": group_rows(waz, "age"),
        "haz": group_rows(haz, "age"),
        "whz": group_rows(whz, "height", preserve_age_band=True),
        "baz": group_rows(baz, "age"),
    }
    validate_payload(payload)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {args.output.resolve()}")


if __name__ == "__main__":
    main()
