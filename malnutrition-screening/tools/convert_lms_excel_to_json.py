"""
Convert WHO-style LMS Excel workbooks (same layout as test/test.py) into data/lms.json
for the offline malnutrition screening PWA.

Expected files in the working directory (or pass --dir):
  weight_for_age.xlsx   -> waz (numeric column: age, months)
  Height_for_age.xlsx   -> haz
  weight_for_height.xlsx-> whz (numeric column: height, cm)
  bmi_for_age.xlsx      -> baz

Each workbook may contain multiple sheets; sex may be inferred from sheet names
('boy', 'male', 'girl', 'female'). Columns must include L, M, S after cleaning.

Usage:
  pip install pandas openpyxl
  python convert_lms_excel_to_json.py --dir ..
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def force_clean(df: pd.DataFrame, numeric_cols: list[str] | None = None) -> pd.DataFrame:
    df = df.copy()
    df.columns = df.columns.str.strip()
    rename_map = {
        "Gender": "sex",
        "Age": "age",
        "Length(cm)": "height",
        "Height(cm)": "height",
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns}, inplace=True)

    if "sex" in df.columns:
        df["sex"] = df["sex"].astype(str).str.strip().str.upper()
        df["sex"] = df["sex"].replace(
            {"MALE": "M", "FEMALE": "F", "BOY": "M", "GIRL": "F"}
        )
        df["sex"] = df["sex"].apply(lambda x: "M" if "M" in x else ("F" if "F" in x else x))

    required = ["sex", "L", "M", "S"]
    if numeric_cols:
        required.extend(numeric_cols)
    keep_cols = [c for c in required if c in df.columns]
    df = df[keep_cols]

    if numeric_cols:
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=keep_cols)
    return df


def load_excel_robust(path: Path, numeric_cols: list[str] | None = None) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    dfs: list[pd.DataFrame] = []
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        if "sex" not in df.columns and "Gender" not in df.columns:
            low = sheet_name.lower()
            if "boy" in low or "male" in low:
                df["sex"] = "M"
            elif "girl" in low or "female" in low:
                df["sex"] = "F"
        cleaned = force_clean(df, numeric_cols=numeric_cols)
        if not cleaned.empty:
            dfs.append(cleaned)
    if not dfs:
        raise ValueError(f"No valid data in {path}")
    return pd.concat(dfs, ignore_index=True)


def df_to_rows(df: pd.DataFrame, xkey: str) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {"M": [], "F": []}
    for sex in ("M", "F"):
        sub = df[df["sex"] == sex].sort_values(xkey)
        rows: list[dict] = []
        for _, r in sub.iterrows():
            rows.append(
                {
                    xkey: float(r[xkey]),
                    "L": float(r["L"]),
                    "M": float(r["M"]),
                    "S": float(r["S"]),
                }
            )
        out[sex] = rows
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--dir",
        type=Path,
        default=Path("."),
        help="Directory containing the four xlsx files",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("data/lms.json"),
        help="Output JSON path",
    )
    args = ap.parse_args()
    base: Path = args.dir

    waz = load_excel_robust(base / "weight_for_age.xlsx", numeric_cols=["age"])
    haz = load_excel_robust(base / "Height_for_age.xlsx", numeric_cols=["age"])
    whz = load_excel_robust(base / "weight_for_height.xlsx", numeric_cols=["height"])
    baz = load_excel_robust(base / "bmi_for_age.xlsx", numeric_cols=["age"])

    payload = {
        "meta": {
            "source": "Converted from Excel via convert_lms_excel_to_json.py",
            "waz_age_months_max": 120,
            "whz_age_months_max": 60,
        },
        "waz": df_to_rows(waz, "age"),
        "haz": df_to_rows(haz, "age"),
        "whz": df_to_rows(whz, "height"),
        "baz": df_to_rows(baz, "age"),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {args.output.resolve()}")


if __name__ == "__main__":
    main()
