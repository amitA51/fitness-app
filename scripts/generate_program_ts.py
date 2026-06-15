# -*- coding: utf-8 -*-
"""Generate src/data/bbtProgram.generated.ts (typed, bilingual) from program_extracted.json."""
import json
import re

SRC = "program_extracted.json"
OUT = "src/data/bbtProgram.generated.ts"

# --- Hebrew exercise-name map (108 unique) -------------------------------------
HE = {
    "1-Arm 45° Cable Rear Delt Flye": "פרפר אחורי בכבל יד אחת 45°",
    "45° Hyperextension": "היפר-אקסטנשן 45°",
    "45° Incline Barbell Press": "לחיצת מוט בשיפוע 45°",
    "45° Incline DB Press": "לחיצת משקולות בשיפוע 45°",
    "45° Incline Machine Press": "לחיצת חזה במכונה בשיפוע 45°",
    "Ab Wheel Rollout": "גלגל בטן (רולאאוט)",
    "Arm-Out Single-Arm DB Row": "חתירת משקולת יד אחת מרפק פתוח",
    "Barbell Bench Press": "לחיצת חזה במוט",
    "Barbell RDL": "דדליפט רומני במוט",
    "Bayesian Cable Curl": "כפיפת מרפקים בכבל בייסיאן",
    "Bench Dip": "מקבילים על ספסל (דיפס)",
    "Bottom-Half DB Flye": "פרפר משקולות חצי תחתון",
    "Bottom-Half Seated Cable Flye": "פרפר בכבל בישיבה חצי תחתון",
    "Cable Crossover Ladder": "קרוסאובר בכבלים (סולם)",
    "Cable Crunch": "כפיפות בטן בכבל",
    "Cable Hip Abduction": "הרחקת ירך בכבל",
    "Cable Hip Adduction": "קירוב ירך בכבל",
    "Cable Paused Shrug-In": "משיכת כתפיים בכבל עם עצירה",
    "Cable Pull-Through": "משיכה בין הרגליים בכבל (פול-תרו)",
    "Cable Rope Hammer Curl": "כפיפת פטיש בכבל עם חבל",
    "Cable Shoulder Press": "לחיצת כתפיים בכבל",
    "Cable Triceps Kickback": "בעיטת טריצפס בכבל",
    "Chest-Supported Machine Row": "חתירה במכונה בתמיכת חזה",
    "Chest-Supported T-Bar Row": "חתירת T-Bar בתמיכת חזה",
    "Concentration Cable Curl": "כפיפת ריכוז בכבל",
    "Copenhagen Hip Adduction": "קירוב ירך קופנהגן",
    "DB Bench Press": "לחיצת חזה במשקולות",
    "DB Bulgarian Split Squat": "סקוואט בולגרי במשקולות",
    "DB Concentration Curl": "כפיפת ריכוז במשקולת",
    "DB Curl": "כפיפת מרפקים במשקולות",
    "DB Hammer Curl": "כפיפת פטיש במשקולות",
    "DB Preacher Curl": "כפיפת מרפקים על ספסל סקוט במשקולת",
    "DB RDL": "דדליפט רומני במשקולות",
    "DB Shrug": "משיכת כתפיים במשקולות",
    "DB Skull Crusher": "סקאל-קראשר במשקולות",
    "DB Static Lunge": "לאנג' סטטי במשקולות",
    "DB Step-Up": "עליית מדרגה במשקולות",
    "DB Triceps Kickback": "בעיטת טריצפס במשקולות",
    "DB Walking Lunge": "לאנג' בהליכה במשקולות",
    "Decline Weighted Crunch": "כפיפות בטן בשיפוע שלילי עם משקל",
    "Dual-Handle Elbows-Out Cable Row": "חתירה בכבל ידיות כפולות מרפקים פתוחים",
    "Dual-Handle Lat Pulldown": "משיכת פולי עליון ידית כפולה",
    "EZ-Bar Cable Curl": "כפיפת מרפקים בכבל מוט EZ",
    "EZ-Bar Curl": "כפיפת מרפקים במוט EZ",
    "EZ-Bar Preacher Curl": "כפיפת סקוט במוט EZ",
    "EZ-Bar Skull Crusher": "סקאל-קראשר במוט EZ",
    "Glute-Ham Raise": "הרמת ירך-תאומים (GHR)",
    "Goblet Squat": "סקוואט גביע",
    "Hack Squat": "האק סקוואט",
    "Hammer Preacher Curl": "כפיפת פטיש על ספסל סקוט",
    "Hanging Leg Raise": "הרמת רגליים בתלייה",
    "Helms Row": "חתירת הלמס",
    "High-Bar Back Squat": "סקוואט גב אחיזה גבוהה",
    "High-Cable Cuffed Lateral Raise": "הרחקה לצדדים בכבל גבוה עם רצועה",
    "High-Cable Lateral Raise": "הרחקה לצדדים בכבל גבוה",
    "Incline Chest-Supported DB Row": "חתירת משקולות בתמיכת חזה בשיפוע",
    "Incline DB Stretch Curl": "כפיפת מרפקים במשקולות בשיפוע (מתיחה)",
    "Katana Triceps Extension": "פשיטת טריצפס קטאנה",
    "Lateral Band Walk": "הליכה צידית עם גומייה",
    "Lean-Back Lat Pulldown": "משיכת פולי עליון בנטייה אחורה",
    "Lean-Back Machine Pulldown": "משיכה במכונה בנטייה אחורה",
    "Lean-In DB Lateral Raise": "הרחקה לצדדים במשקולת בנטייה",
    "Leg Extension": "פשיטת ברכיים",
    "Leg Press": "לחיצת רגליים",
    "Leg Press Calf Press": "לחיצת תאומים במכונת רגליים",
    "Long-Lever Plank": "פלאנק זרוע ארוכה",
    "Low-to-High Cable Crossover": "קרוסאובר בכבל מלמטה למעלה",
    "Lying Leg Curl": "כפיפת ברכיים בשכיבה",
    "Machine Chest Press": "לחיצת חזה במכונה",
    "Machine Crunch": "כפיפות בטן במכונה",
    "Machine Hip Abduction": "הרחקת ירך במכונה",
    "Machine Hip Adduction": "קירוב ירך במכונה",
    "Machine Preacher Curl": "כפיפת סקוט במכונה",
    "Machine Shoulder Press": "לחיצת כתפיים במכונה",
    "Machine Shrug": "משיכת כתפיים במכונה",
    "Meadows Row": "חתירת מדווז",
    "Modified Candlestick": "נר הפוך מותאם (candlestick)",
    "Neutral-Grip Lat Pulldown": "משיכת פולי עליון אחיזה ניטרלית",
    "Neutral-Grip Pull-Up": "מתח אחיזה ניטרלית",
    "Neutral-Grip Seated Cable Row": "חתירת כבל בישיבה אחיזה ניטרלית",
    "Nordic Ham Curl": "כפיפת ירך נורדית",
    "Overhead Cable Triceps Extension (Bar)": "פשיטת טריצפס מעל הראש בכבל (מוט)",
    "Overhead Cable Triceps Extension (Rope)": "פשיטת טריצפס מעל הראש בכבל (חבל)",
    "Pec Deck": "פק-דק (פרפר במכונה)",
    "Pendlay Deficit Row": "חתירת פנדליי מדפלציט",
    "Pull-Up": "מתח",
    "Reverse Nordic": "נורדי הפוך",
    "Reverse Pec Deck": "פק-דק הפוך",
    "Roman Chair Leg Raise": "הרמת רגליים בכיסא רומי",
    "Rope Face Pull": "משיכה לפנים בחבל (פייס-פול)",
    "Seated Calf Raise": "הרמת תאומים בישיבה",
    "Seated DB Shoulder Press": "לחיצת כתפיים במשקולות בישיבה",
    "Seated Leg Curl": "כפיפת ברכיים בישיבה",
    "Seated Super-Bayesian High Cable Curl": "כפיפת מרפקים בכבל גבוה בייסיאן בישיבה",
    "Single-Arm DB Row": "חתירת משקולת יד אחת",
    "Sissy Squat": "סיסי סקוואט",
    "Smith Machine Row": "חתירה בסמית' מאשין",
    "Smith Machine Squat": "סקוואט בסמית' מאשין",
    "Smith Machine Static Lunge": "לאנג' סטטי בסמית' מאשין",
    "Smith Machine Static Lunge w/ Elevated Front Foot": "לאנג' סטטי בסמית' עם רגל קדמית מוגבהת",
    "Snatch-Grip RDL": "דדליפט רומני אחיזת חטיפה",
    "Standing Calf Raise": "הרמת תאומים בעמידה",
    "Swiss Ball Rollout": "רולאאוט על כדור פיזיו",
    "Triceps Pressdown (Bar)": "פשיטת טריצפס בפולי (מוט)",
    "Triceps Pressdown (Rope)": "פשיטת טריצפס בפולי (חבל)",
    "Walking Lunge": "לאנג' בהליכה",
    "Wide-Grip Lat Pulldown": "משיכת פולי עליון אחיזה רחבה",
    "Wide-Grip Pull-Up": "מתח אחיזה רחבה",
}

TECH_HE = {
    "": "",
    "N/A": "",
    "Failure": "כשל",
    "Failure + LLPs (Extend set)": "כשל + חזרות חלקיות בעומס (הארכת סט)",
    "Static Stretch (30s)": "מתיחה סטטית (30 שניות)",
    "Myo-reps": "מיו-רפס",
}

DAY_HE = {
    "Upper": "פלג גוף עליון",
    "Lower": "פלג גוף תחתון",
    "Pull": "משיכה",
    "Push": "דחיפה",
    "Legs": "רגליים",
}
FOCUS_HE = {"Strength": "דגש כוח", "Hypertrophy": "דגש היפרטרופיה"}
BLOCK_HE = {"Foundation Block": "בלוק יסוד", "Ramping Block": "בלוק העצמה"}


def he(name):
    return HE.get(name, name)


def classify_muscle(name):
    n = name.lower()
    if any(k in n for k in ["crunch", "plank", "leg raise", "rollout", "candlestick", "ab wheel", "roman chair"]):
        return "Core"
    if "pull-through" in n:
        return "Legs"
    if any(k in n for k in ["squat", "lunge", "leg press", "leg extension", "calf", "hip ad", "hip abduction",
                            "adduction", "abduction", "step-up", "sissy", "glute", "hack", "copenhagen",
                            "band walk", "nordic", "leg curl", "rdl", "deadlift",
                            # Posterior-chain hip-hinge movements (e.g. "45° Hyperextension"):
                            # map to Legs like the rest of the posterior chain (RDL, Glute-Ham
                            # Raise, Cable Pull-Through) instead of falling through to "Other".
                            "hyperextension", "hyper-extension", "back extension", "good morning", "reverse hyper"]):
        return "Legs"
    if any(k in n for k in ["triceps", "skull", "pressdown", "kickback", "katana"]) or n == "bench dip":
        return "Triceps"
    if "curl" in n:
        return "Biceps"
    if any(k in n for k in ["lateral raise", "rear delt", "face pull", "reverse pec deck", "shoulder press"]):
        return "Shoulders"
    if "shrug" in n:
        return "Back"
    if any(k in n for k in ["row", "pulldown", "pull-up", "pullover", "meadows", "helms"]):
        return "Back"
    if any(k in n for k in ["press", "flye", "fly", "pec deck", "crossover", "dip"]):
        return "Chest"
    return "Other"


def rest_seconds(rest):
    if not rest:
        return 90
    m = re.findall(r"\d+", rest)
    if not m:
        return 90
    nums = [int(x) for x in m]
    # The LOW end of the range is the timer target (shorter default rest),
    # matching parseRestRange(...).min used by the runtime rest timer. "sec"
    # ranges are already in seconds; everything else is minutes.
    is_sec = ("sec" in rest.lower()) and ("min" not in rest.lower())
    unit = 1 if is_sec else 60
    return int(nums[0] * unit)


def low_reps(reps):
    m = re.findall(r"\d+", reps or "")
    return int(m[0]) if m else 10


def js(s):
    return json.dumps(s if s is not None else "", ensure_ascii=False)


def main():
    d = json.load(open(SRC, encoding="utf-8"))
    days = d["days"]

    lines = []
    lines.append("// AUTO-GENERATED from program_extracted.json by scripts/generate_program_ts.py")
    lines.append("// The Bodybuilding Transformation System (Intermediate/Advanced) — 12-week program.")
    lines.append("// Do not edit by hand; re-run the generator to regenerate.")
    lines.append("")
    lines.append("export interface BbtExercise {")
    lines.append("  order: number;")
    lines.append("  name: string;        // English (canonical)")
    lines.append("  nameHe: string;      // Hebrew")
    lines.append("  muscle: string;")
    lines.append("  warmupSets: string;")
    lines.append("  workingSets: number;")
    lines.append("  reps: string;        // rep range, e.g. '8-10'")
    lines.append("  targetReps: number;  // low end of the range")
    lines.append("  earlyRpe: string;")
    lines.append("  lastRpe: string;")
    lines.append("  rpeTarget: number | null; // numeric last-set RPE ceiling (10 = failure)")
    lines.append("  rest: string;")
    lines.append("  restSeconds: number;")
    lines.append("  technique: string;   // last-set intensity technique (English, '' if none)")
    lines.append("  techniqueHe: string;")
    lines.append("  sub1: string; sub1He: string;")
    lines.append("  sub2: string; sub2He: string;")
    lines.append("  notes: string;")
    lines.append("}")
    lines.append("")
    lines.append("export interface BbtDay {")
    lines.append("  week: number;")
    lines.append("  block: string; blockHe: string;")
    lines.append("  dayType: 'Upper' | 'Lower' | 'Pull' | 'Push' | 'Legs';")
    lines.append("  focus: string;")
    lines.append("  day: string; dayHe: string;")
    lines.append("  exercises: BbtExercise[];")
    lines.append("}")
    lines.append("")
    lines.append("export interface BbtProgram {")
    lines.append("  id: string;")
    lines.append("  title: string; titleHe: string;")
    lines.append("  level: string;")
    lines.append("  totalWeeks: number;")
    lines.append("  blocks: { name: string; nameHe: string; weeks: number[] }[];")
    lines.append("  weeklySplit: { dayType: string; labelHe: string; rest?: boolean }[];")
    lines.append("  days: BbtDay[];")
    lines.append("}")
    lines.append("")

    def rpe_ceiling(last_rpe, tech):
        if "Failure" in (tech or ""):
            return 10
        m = re.findall(r"\d+", last_rpe or "")
        return int(m[-1]) if m else None

    day_objs = []
    for p in days:
        exs = []
        for e in p["exercises"]:
            tech = "" if e["lastSetIntensity"] in ("N/A", "") else e["lastSetIntensity"]
            ex = {
                "order": e["order"],
                "name": e["name"],
                "nameHe": he(e["name"]),
                "muscle": classify_muscle(e["name"]),
                "warmupSets": e["warmupSets"],
                "workingSets": int(re.findall(r"\d+", e["workingSets"])[0]) if re.findall(r"\d+", e["workingSets"]) else 2,
                "reps": e["reps"],
                "targetReps": low_reps(e["reps"]),
                "earlyRpe": e["earlySetRpe"],
                "lastRpe": e["lastSetRpe"],
                "rpeTarget": rpe_ceiling(e["lastSetRpe"], tech),
                "rest": e["rest"],
                "restSeconds": rest_seconds(e["rest"]),
                "technique": tech,
                "techniqueHe": TECH_HE.get(tech, tech),
                "sub1": e["substitution1"], "sub1He": he(e["substitution1"]),
                "sub2": e["substitution2"], "sub2He": he(e["substitution2"]),
                "notes": e["notes"],
            }
            exs.append(ex)
        day_objs.append({
            "week": p["week"],
            "block": p["block"], "blockHe": BLOCK_HE.get(p["block"], p["block"]),
            "dayType": p["dayType"],
            "focus": p["focus"],
            "day": p["day"], "dayHe": f"{DAY_HE.get(p['dayType'], p['dayType'])} · {FOCUS_HE.get(p['focus'], p['focus'])}",
            "exercises": exs,
        })

    # Emit days array
    def emit_ex(ex):
        return (
            "        { "
            f"order: {ex['order']}, name: {js(ex['name'])}, nameHe: {js(ex['nameHe'])}, "
            f"muscle: {js(ex['muscle'])}, warmupSets: {js(ex['warmupSets'])}, "
            f"workingSets: {ex['workingSets']}, reps: {js(ex['reps'])}, targetReps: {ex['targetReps']}, "
            f"earlyRpe: {js(ex['earlyRpe'])}, lastRpe: {js(ex['lastRpe'])}, "
            f"rpeTarget: {('null' if ex['rpeTarget'] is None else ex['rpeTarget'])}, "
            f"rest: {js(ex['rest'])}, restSeconds: {ex['restSeconds']}, "
            f"technique: {js(ex['technique'])}, techniqueHe: {js(ex['techniqueHe'])}, "
            f"sub1: {js(ex['sub1'])}, sub1He: {js(ex['sub1He'])}, "
            f"sub2: {js(ex['sub2'])}, sub2He: {js(ex['sub2He'])}, "
            f"notes: {js(ex['notes'])} }},"
        )

    lines.append("const DAYS: BbtDay[] = [")
    for dy in day_objs:
        lines.append("  {")
        lines.append(f"    week: {dy['week']}, block: {js(dy['block'])}, blockHe: {js(dy['blockHe'])},")
        lines.append(f"    dayType: {js(dy['dayType'])}, focus: {js(dy['focus'])},")
        lines.append(f"    day: {js(dy['day'])}, dayHe: {js(dy['dayHe'])},")
        lines.append("    exercises: [")
        for ex in dy["exercises"]:
            lines.append(emit_ex(ex))
        lines.append("    ],")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    lines.append("export const BBT_PROGRAM: BbtProgram = {")
    lines.append("  id: 'bbt-intermediate-advanced',")
    lines.append("  title: 'The Bodybuilding Transformation System',")
    lines.append("  titleHe: 'מערכת השינוי לפיתוח גוף',")
    lines.append("  level: 'Intermediate / Advanced',")
    lines.append("  totalWeeks: 12,")
    lines.append("  blocks: [")
    lines.append("    { name: 'Foundation Block', nameHe: 'בלוק יסוד', weeks: [1, 2, 3, 4, 5] },")
    lines.append("    { name: 'Ramping Block', nameHe: 'בלוק העצמה', weeks: [6, 7, 8, 9, 10, 11, 12] },")
    lines.append("  ],")
    lines.append("  weeklySplit: [")
    lines.append("    { dayType: 'Upper', labelHe: 'פלג גוף עליון · דגש כוח' },")
    lines.append("    { dayType: 'Lower', labelHe: 'פלג גוף תחתון · דגש כוח' },")
    lines.append("    { dayType: 'Rest', labelHe: 'מנוחה', rest: true },")
    lines.append("    { dayType: 'Pull', labelHe: 'משיכה · דגש היפרטרופיה' },")
    lines.append("    { dayType: 'Push', labelHe: 'דחיפה · דגש היפרטרופיה' },")
    lines.append("    { dayType: 'Legs', labelHe: 'רגליים · דגש היפרטרופיה' },")
    lines.append("    { dayType: 'Rest', labelHe: 'מנוחה', rest: true },")
    lines.append("  ],")
    lines.append("  days: DAYS,")
    lines.append("};")
    lines.append("")

    # verify all names covered
    missing = sorted({n for p in days for e in p["exercises"]
                      for n in (e["name"], e["substitution1"], e["substitution2"])
                      if n and n not in HE})
    out = "\n".join(lines)
    open(OUT, "w", encoding="utf-8").write(out)
    print(f"Wrote {OUT} ({len(out)} chars, {out.count(chr(10))} lines), {len(day_objs)} days")
    print("Missing HE translations:", missing or "none")


if __name__ == "__main__":
    main()
