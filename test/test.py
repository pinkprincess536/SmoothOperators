import pandas as pd
import math
import json

# ==============================
# CLEAN
# ==============================

def force_clean(df, numeric_cols=None):
    df = df.copy()

    # Rename safely
    df.columns = df.columns.str.strip()

    rename_map = {
        "Gender": "sex",
        "Age": "age",
        "Length(cm)": "height",
        "Height(cm)": "height"
    }
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns}, inplace=True)

    # Normalize sex
    if "sex" in df.columns:
        df["sex"] = df["sex"].astype(str).str.strip().str.upper()
        df["sex"] = df["sex"].replace({
            "MALE": "M",
            "FEMALE": "F",
            "BOY": "M",
            "GIRL": "F"
        })
        # Handle cases where it might already be 'M' or 'F' but just in case
        df["sex"] = df["sex"].apply(lambda x: "M" if "M" in x else ("F" if "F" in x else x))

    # 🔥 FORCE ONLY REQUIRED COLUMNS
    required = ["sex", "L", "M", "S"]
    if numeric_cols:
        required.extend(numeric_cols)
    
    keep_cols = [c for c in required if c in df.columns]
    df = df[keep_cols]

    # 🔥 Convert numeric STRICTLY
    if numeric_cols:
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    # 🔥 DROP ALL INVALID ROWS
    df = df.dropna(subset=keep_cols)

    return df

def load_excel_robust(filename, numeric_cols=None):
    xls = pd.ExcelFile(filename)
    dfs = []
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        
        # If 'sex' is missing but sheet name contains 'boy' or 'girl'/'male'/'female'
        if 'sex' not in df.columns and 'Gender' not in df.columns:
            if 'boy' in sheet_name.lower() or 'male' in sheet_name.lower():
                df['sex'] = 'M'
            elif 'girl' in sheet_name.lower() or 'female' in sheet_name.lower():
                df['sex'] = 'F'
        
        cleaned_df = force_clean(df, numeric_cols=numeric_cols)
        if not cleaned_df.empty:
            dfs.append(cleaned_df)
    
    if not dfs:
        raise ValueError(f"No valid data found in {filename}")
    
    return pd.concat(dfs, ignore_index=True)

# ==============================
# LOAD DATA
# ==============================

try:
    waz_df = load_excel_robust("weight_for_age.xlsx", numeric_cols=["age"])
    haz_df = load_excel_robust("Height_for_age.xlsx", numeric_cols=["age"])
    whz_df = load_excel_robust("weight_for_height.xlsx", numeric_cols=["height"])
    baz_df = load_excel_robust("bmi_for_age.xlsx", numeric_cols=["age"])
except Exception as e:
    print(f"Error loading Excel files: {e}")
    raise
# ==============================
# SAFE INTERPOLATION
# ==============================

def interpolate(df, value, col, sex):

    df = df[df['sex'] == sex]

    if df.empty:
        raise ValueError(f"No data for sex={sex}")

    df = df.sort_values(col)

    if value <= df[col].min():
        row = df.iloc[0]
        return row['L'], row['M'], row['S']

    if value >= df[col].max():
        row = df.iloc[-1]
        return row['L'], row['M'], row['S']

    # Find closest points
    lower_idx = df[df[col] <= value].index[-1]
    upper_idx = df[df[col] >= value].index[0]
    
    lower = df.loc[lower_idx]
    upper = df.loc[upper_idx]

    if upper[col] == lower[col]:
        return lower['L'], lower['M'], lower['S']

    def interp(v1, v2):
        return v1 + (value - lower[col]) * (v2 - v1) / (upper[col] - lower[col])

    return (
        interp(lower['L'], upper['L']),
        interp(lower['M'], upper['M']),
        interp(lower['S'], upper['S'])
    )

# ==============================
# CLEAN
# ==============================

def clean(x):
    return round(float(x), 2) if x is not None else None

# ==============================
# Z SCORE
# ==============================

def z_score(x, L, M, S):
    if L == 0:
        return math.log(x / M) / S
    return ((x / M) ** L - 1) / (L * S)

# ==============================
# CLASSIFICATION
# ==============================

def classify(z):
    if z is None:
        return "Not Applicable"
    if z < -3:
        return "Severe"
    elif z < -2:
        return "Moderate"
    else:
        return "Normal"

# ==============================
# MAIN FUNCTION
# ==============================

def analyze_child(age_months, weight_kg, height_cm, sex):

    bmi = weight_kg / ((height_cm / 100) ** 2)

    # ---- WAZ: Weight-for-Age (Determines Underweight, ONLY ≤ 10 yrs) ----
    if age_months <= 120:
        L, M, S = interpolate(waz_df, age_months, 'age', sex)
        waz = z_score(weight_kg, L, M, S)
    else:
        waz = None

    # ---- HAZ: Height-for-Age (Determines Stunting, ALL AGES) ----
    L, M, S = interpolate(haz_df, age_months, 'age', sex)
    haz = z_score(height_cm, L, M, S)

    # ---- WHZ / WLZ: Weight-for-Height/Length (Determines Wasting, ONLY ≤ 5 yrs) ----
    if age_months <= 60:
        if age_months < 24:
            measurement = height_cm + 0.7  # length correction
            mode = "Weight-for-Length (0–2 yrs)"
        else:
            measurement = height_cm
            mode = "Weight-for-Height (2–5 yrs)"

        L, M, S = interpolate(whz_df, measurement, 'height', sex)
        whz = z_score(weight_kg, L, M, S)
    else:
        whz = None
        mode = "Not Applicable (>5 yrs)"

    # ---- BAZ: BMI-for-Age (Determines Thinness/Overweight, ALL AGES) ----
    L, M, S = interpolate(baz_df, age_months, 'age', sex)
    baz = z_score(bmi, L, M, S)

    # ---- CLASSIFICATION ----
    underweight = classify(waz)
    stunting = classify(haz)
    wasting = classify(whz)
    bmi_status = classify(baz)

    # ---- FINAL VERDICT (WHO PRIORITY) ----
    if whz is not None and whz < -3:
        final = ["Severe Acute Malnutrition (SAM)"]
    elif whz is not None and whz < -2:
        final = ["Moderate Acute Malnutrition (MAM)"]
    elif haz < -3:
        final = ["Severe Stunting"]
    elif haz < -2:
        final = ["Moderate Stunting"]
    elif waz is not None and waz < -3:
        final = ["Severe Underweight"]
    elif waz is not None and waz < -2:
        final = ["Moderate Underweight"]
    else:
        final = ["Normal"]

    return {
        "Input": {
            "Age (months)": age_months,
            "Weight (kg)": weight_kg,
            "Height (cm)": height_cm,
            "Sex": sex
        },
        "Z-Scores": {
            "WAZ (Weight-for-Age / Underweight)": clean(waz),
            "HAZ (Height-for-Age / Stunting)": clean(haz),
            "WHZ (Weight-for-Height / Wasting)": clean(whz),
            "BAZ (BMI-for-Age / BMI Status)": clean(baz)
        },
        "WHZ Mode": mode,
        "Classification": {
            "Underweight Status (WAZ)": underweight,
            "Stunting Status (HAZ)": stunting,
            "Wasting Status (WHZ)": wasting,
            "BMI Status (BAZ)": bmi_status
        },
        "Final Verdict": final
    }
    
    
    
    
    

# ==============================
# TEST
# ==============================

if __name__ == "__main__":
    test_cases = [
        {"age_months": 6, "weight_kg": 7.9, "height_cm": 67.6, "sex": "M", "desc": "6mo Healthy Male"},
        {"age_months": 24, "weight_kg": 10.0, "height_cm": 82.0, "sex": "F", "desc": "24mo Slightly Stunted Female"},
        {"age_months": 60, "weight_kg": 18.3, "height_cm": 110.0, "sex": "M", "desc": "5yr Healthy Male"},
        {"age_months": 36, "weight_kg": 10.0, "height_cm": 95.0, "sex": "F", "desc": "3yr Severe Wasting Female (Previous case)"},
        {"age_months": 132, "weight_kg": 40.0, "height_cm": 145.0, "sex": "M", "desc": "11yr (Above WAZ age limit)"}
    ]

    print("\n" + "="*50)
    print("CHILD NUTRITION REPORT - MULTI-CASE TEST")
    print("="*50)

    for case in test_cases:
        print(f"\n--- TEST CASE: {case['desc']} ---")
        result = analyze_child(
            case["age_months"], 
            case["weight_kg"], 
            case["height_cm"], 
            case["sex"]
        )
        
        # Compact display
        print(f"Input: {case['age_months']}mo, {case['weight_kg']}kg, {case['height_cm']}cm, {case['sex']}")
        print(f"Z-Scores: WAZ: {result['Z-Scores']['WAZ (Weight-for-Age / Underweight)']}, HAZ: {result['Z-Scores']['HAZ (Height-for-Age / Stunting)']}, WHZ: {result['Z-Scores']['WHZ (Weight-for-Height / Wasting)']}")
        print(f"Classifications: WAZ: {result['Classification']['Underweight Status (WAZ)']}, HAZ: {result['Classification']['Stunting Status (HAZ)']}, WHZ: {result['Classification']['Wasting Status (WHZ)']}")
        print(f"Final Verdict: {', '.join(result['Final Verdict'])}")
        print("-" * 30)