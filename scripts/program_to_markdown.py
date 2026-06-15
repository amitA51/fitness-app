"""Render the extracted program JSON into a readable markdown overview."""
import json

d = json.load(open("program_extracted.json", encoding="utf-8"))
days = d["days"]


def get(wk, dt):
    return next(p for p in days if p["week"] == wk and p["dayType"] == dt)


DAY_ORDER = ["Upper", "Lower", "Pull", "Push", "Legs"]
BLOCKS = [("Foundation Block", range(1, 6)), ("Ramping Block", range(6, 13))]

out = []
out.append(f"# {d['title']} — {d['level']}\n")
out.append(f"Extracted from: `{d['source']}`\n")
out.append(f"**{d['totalWeeks']} weeks** · 5-day split · 2 training blocks\n")
out.append("**Weekly schedule:** Day 1 Upper (Strength) · Day 2 Lower (Strength) · "
           "Day 3 Rest · Day 4 Pull (Hypertrophy) · Day 5 Push (Hypertrophy) · "
           "Day 6 Legs (Hypertrophy) · Day 7 Rest\n")
out.append("Within each block the **exercise selection is fixed**; sets, reps, RPE and "
           "the last-set intensity technique **progress week to week**.\n")
out.append("\n---\n")

for block_name, weeks in BLOCKS:
    wk0 = list(weeks)[0]
    out.append(f"\n## {block_name} (weeks {list(weeks)[0]}–{list(weeks)[-1]})\n")
    for dt in DAY_ORDER:
        base = get(wk0, dt)
        focus = base["focus"]
        out.append(f"\n### {dt} ({focus} Focus)\n")
        # exercise selection (constant across the block)
        out.append("| # | Exercise | Substitution 1 | Substitution 2 | Notes |")
        out.append("|---|----------|----------------|----------------|-------|")
        for e in base["exercises"]:
            notes = e["notes"].replace("|", "/")
            out.append(f"| {e['order']} | **{e['name']}** | {e['substitution1']} | "
                       f"{e['substitution2']} | {notes} |")
        # weekly progression matrix
        out.append("\n**Weekly progression** (Working Sets × Reps @ Early→Last RPE · technique):\n")
        header = "| Exercise | " + " | ".join(f"W{w}" for w in weeks) + " |"
        sep = "|---|" + "|".join("---" for _ in weeks) + "|"
        out.append(header)
        out.append(sep)
        for idx, e0 in enumerate(base["exercises"]):
            cells = []
            for w in weeks:
                e = get(w, dt)["exercises"][idx]
                tech = e["lastSetIntensity"]
                tech = "" if tech in ("N/A", "") else f" · {tech}"
                cells.append(f"{e['workingSets']}×{e['reps']} @{e['earlySetRpe']}→{e['lastSetRpe']}{tech}")
            out.append(f"| {e0['name']} | " + " | ".join(cells) + " |")
        out.append("")

md = "\n".join(out)
open("PROGRAM_EXTRACTED.md", "w", encoding="utf-8").write(md)
print(f"Wrote PROGRAM_EXTRACTED.md ({len(md)} chars, {md.count(chr(10))} lines)")
