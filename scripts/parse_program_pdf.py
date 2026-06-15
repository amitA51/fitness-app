"""
Parse "The Bodybuilding Transformation System (Intermediate/Advanced)" PDF
into a clean structured JSON program file.

Strategy: the PDF table has ruled grid lines, so pdfplumber.extract_tables()
returns clean cells. We map columns dynamically from the header row so the
parser is resilient to small per-page differences.
"""
import json
import re
import sys
import pdfplumber

PDF = "857318004_The_Bodybuilding_Transformation_System_Intermediate_Advanced.pdf"
OUT_JSON = "program_extracted.json"


def clean(s):
    if s is None:
        return ""
    s = s.replace("ï¿½", "°").replace("�", "°")  # mojibake/replacement -> degree
    s = s.replace("-\n", "-")  # join hyphenated line-breaks: "Super-\nBayesian" -> "Super-Bayesian"
    s = s.replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fix_spacing_artifacts(s):
    """The embedded font splits some glyphs (z, q, certain caps) with stray
    spaces, e.g. 's q uee z e' -> 'squeeze', 'si z e' -> 'size',
    'R O M' -> 'ROM'. Repair the known patterns conservatively."""
    if not s:
        return s
    fixes = {
        "s q uee z e": "squeeze",
        "s q uee z ing": "squeezing",
        "squee z e": "squeeze",
        "squee z ing": "squeezing",
        "si z e": "size",
        "R O M": "ROM",
        "j ust": "just",
        "U se": "Use",
        " z e": "ze",  # generic trailing fragment, applied last
    }
    out = s
    for bad, good in fixes.items():
        out = out.replace(bad, good)
    out = re.sub(r"\s+", " ", out).strip()
    return out


DAY_TYPE_RE = re.compile(
    r"(Upper|Lower|Pull|Push|Legs)\s*\(\s*(Strength|Hypertrophy)\s*Focus\s*\)",
    re.IGNORECASE,
)


def rotated_text(page):
    """The day-type label is rotated 90°; reconstruct it from non-upright chars."""
    chars = [c["text"] for c in page.chars if c.get("upright") is False]
    return "".join(chars).strip()


def detect_meta(page):
    page_text = page.extract_text() or ""
    text = re.sub(r"\s+", " ", page_text)
    week = None
    m = re.search(r"WEEK\s+(\d+)", text)
    if m:
        week = int(m.group(1))
    block = None
    if "Foundation Block" in page_text:
        block = "Foundation Block"
    elif "Ramping Block" in page_text:
        block = "Ramping Block"
    # day type — comes from the rotated column-0 label
    dt = None
    focus = None
    m2 = DAY_TYPE_RE.search(re.sub(r"\s+", " ", rotated_text(page)))
    if m2:
        dt = m2.group(1).capitalize()
        focus = m2.group(2).capitalize()
    return week, block, dt, focus


def build_col_map(table):
    """Find header row and map known headers to column indices."""
    header_row_idx = None
    for i, row in enumerate(table):
        joined = " ".join(c or "" for c in row)
        if "Exercise" in joined and "Reps" in joined:
            header_row_idx = i
            break
    if header_row_idx is None:
        return None, None
    header = table[header_row_idx]
    cmap = {}
    sub_cols = []
    for idx, cell in enumerate(header):
        h = (cell or "").replace("\n", " ")
        hl = h.lower()
        if "exercise" in hl and "exercise" not in cmap:
            cmap["exercise"] = idx
        elif "intensity" in hl:
            cmap["technique"] = idx
        elif "warm-up" in hl or "warm up" in hl:
            cmap["warmupSets"] = idx
        elif "working" in hl:
            cmap["workingSets"] = idx
        elif hl.strip() == "reps":
            cmap["reps"] = idx
        elif "early" in hl:
            cmap["earlyRpe"] = idx
        elif "last set" in hl and "rpe" in hl:
            cmap["lastRpe"] = idx
        elif hl.strip() == "rest":
            cmap["rest"] = idx
        elif "substitution" in hl:
            sub_cols.append(idx)
        elif "notes" in hl:
            cmap["notes"] = idx
    if len(sub_cols) >= 1:
        cmap["sub1"] = sub_cols[0]
    if len(sub_cols) >= 2:
        cmap["sub2"] = sub_cols[1]
    return cmap, header_row_idx


REPS_RE = re.compile(r"^(?:\d+(?:-\d+)?|Failure|N/A|AMRAP)", re.IGNORECASE)


def parse_page(page):
    week, block, day_type, focus = detect_meta(page)
    tables = page.extract_tables()
    if not tables:
        return None
    table = max(tables, key=len)
    cmap, hidx = build_col_map(table)
    if not cmap or "exercise" not in cmap:
        return None

    exercises = []
    order = 0
    for row in table[hidx + 1:]:
        ex_idx = cmap["exercise"]
        if ex_idx >= len(row):
            continue
        name = clean(row[ex_idx])
        if not name or name.lower() == "exercise":
            continue
        reps = clean(row[cmap["reps"]]) if cmap.get("reps") is not None and cmap["reps"] < len(row) else ""
        working = clean(row[cmap["workingSets"]]) if cmap.get("workingSets") is not None and cmap["workingSets"] < len(row) else ""
        # a real exercise row must have reps or working sets
        if not reps and not working:
            continue

        def g(key):
            i = cmap.get(key)
            if i is None or i >= len(row):
                return ""
            return clean(row[i])

        order += 1
        exercises.append({
            "order": order,
            "name": name,
            "lastSetIntensity": g("technique"),
            "warmupSets": g("warmupSets"),
            "workingSets": working,
            "reps": reps,
            "earlySetRpe": g("earlyRpe"),
            "lastSetRpe": g("lastRpe"),
            "rest": g("rest"),
            "substitution1": g("sub1"),
            "substitution2": fix_spacing_artifacts(g("sub2")),
            "notes": fix_spacing_artifacts(g("notes")),
        })
    return {
        "week": week,
        "block": block,
        "dayType": day_type,
        "focus": focus,
        "day": f"{day_type} ({focus} Focus)" if day_type else None,
        "page": page.page_number,
        "exercises": exercises,
    }


def main():
    pdf = pdfplumber.open(PDF)
    pages = []
    for page in pdf.pages:
        if not DAY_TYPE_RE.search(re.sub(r"\s+", " ", rotated_text(page))):
            continue  # not a workout page (cover/notes/warm-up)
        parsed = parse_page(page)
        if parsed and parsed["exercises"]:
            pages.append(parsed)

    # The block label is printed only on each block's first page; propagate by week.
    for p in pages:
        if not p["block"] and p["week"] is not None:
            p["block"] = "Foundation Block" if p["week"] <= 5 else "Ramping Block"

    program = {
        "title": "The Bodybuilding Transformation System",
        "level": "Intermediate / Advanced",
        "source": PDF,
        "totalWeeks": max((p["week"] for p in pages if p["week"]), default=0),
        "blocks": [
            {"name": "Foundation Block", "weeks": sorted({p["week"] for p in pages if p["block"] == "Foundation Block"})},
            {"name": "Ramping Block", "weeks": sorted({p["week"] for p in pages if p["block"] == "Ramping Block"})},
        ],
        "weeklySplit": [
            "Upper (Strength Focus)", "Lower (Strength Focus)", "Rest",
            "Pull (Hypertrophy Focus)", "Push (Hypertrophy Focus)", "Legs (Hypertrophy Focus)", "Rest",
        ],
        "days": pages,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(program, f, ensure_ascii=False, indent=2)

    # summary
    print(f"Parsed {len(pages)} workout days")
    print(f"Weeks: {program['totalWeeks']}")
    for b in program["blocks"]:
        print(f"  {b['name']}: weeks {b['weeks']}")
    from collections import Counter
    cnt = Counter((p["week"], p["dayType"]) for p in pages)
    dups = {k: v for k, v in cnt.items() if v != 1}
    print("Duplicate (week,day) keys:", dups or "none")
    ex_counts = Counter(len(p["exercises"]) for p in pages)
    print("Exercise-count distribution per day:", dict(ex_counts))
    # any empty critical fields?
    issues = 0
    for p in pages:
        for e in p["exercises"]:
            if not e["reps"] or not e["lastSetRpe"]:
                issues += 1
    print("Rows missing reps or lastRpe:", issues)
    # day order per week
    expected = ["Upper", "Lower", "Pull", "Push", "Legs"]
    bad_weeks = []
    for wk in range(1, program["totalWeeks"] + 1):
        seq = [p["dayType"] for p in pages if p["week"] == wk]
        if seq != expected:
            bad_weeks.append((wk, seq))
    print("Weeks with unexpected day order:", bad_weeks or "none (all Upper/Lower/Pull/Push/Legs)")
    # techniques present in later weeks
    techs = Counter()
    for p in pages:
        for e in p["exercises"]:
            techs[e["lastSetIntensity"]] += 1
    print("Last-set intensity techniques seen:", dict(techs))
    # block assignment
    print("Foundation weeks:", sorted({p["week"] for p in pages if p["block"] == "Foundation Block"}))
    print("Ramping weeks:", sorted({p["week"] for p in pages if p["block"] == "Ramping Block"}))


if __name__ == "__main__":
    main()
