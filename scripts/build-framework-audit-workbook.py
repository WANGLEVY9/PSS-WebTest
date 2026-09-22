#!/usr/bin/env python3
"""Build the framework-defect + stratified-ledger audit workbook.

Sources (all tracked or reproducible):
  - code/config/frameworks/framework-defect-matrix.v0.1.json
  - code/config/frameworks/framework-environment-manifest.v0.1.json
  - legacy/artifacts/phase2/*-pilot.json (matched-pilot summaries)

Aggregates are Excel formulas over the raw cell sheet so they recalculate if the
raw counts change.
"""
import json
import pathlib

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

REPO = pathlib.Path(__file__).resolve().parent.parent
CODE = REPO / "code"
ARTIFACTS = REPO / "artifacts" / "phase2"
OUT = REPO / "results" / "phase2" / "2026-09-12-framework-and-experiment-audit.xlsx"

FONT = "Arial"
HEADER_FILL = PatternFill("solid", start_color="DDEBF7")
NOTE_FILL = PatternFill("solid", start_color="FFF2CC")
OPEN_FILL = PatternFill("solid", start_color="FCE4D6")
HEADER_FONT = Font(name=FONT, bold=True)
BODY_FONT = Font(name=FONT)
NOTE_FONT = Font(name=FONT, italic=True)


def load_json(path):
    return json.loads(pathlib.Path(path).read_text())


def ledger_rows():
    rows = []
    for path in sorted(ARTIFACTS.glob("*-pilot.json")):
        doc = load_json(path)
        if doc.get("application") != "prestashop":
            continue
        buckets = {}
        for record in doc.get("records", []):
            arm = record.get("arm")
            if arm not in ("playwright", "visual", "hybrid"):
                continue
            bucket = buckets.setdefault(arm, {"n": 0, "pass": 0, "cats": {}})
            bucket["n"] += 1
            if record.get("cell_passed") is True:
                bucket["pass"] += 1
            category = record.get("failure_category")
            if category:
                bucket["cats"][category] = bucket["cats"].get(category, 0) + 1
        role = "plumbing-smoke" if "smoke" in str(doc.get("run_tag") or "") else "pilot-evidence"
        for arm in ("playwright", "visual", "hybrid"):
            bucket = buckets.get(arm)
            if not bucket:
                continue
            rows.append({
                "provider": doc.get("provider_id"),
                "condition": doc.get("condition"),
                "run_tag": doc.get("run_tag"),
                "arm": arm,
                "role": role,
                "n": bucket["n"],
                "pass": bucket["pass"],
                "fail": bucket["n"] - bucket["pass"],
                "cats": ", ".join(f"{k}={v}" for k, v in sorted(bucket["cats"].items())) or "none",
                "source": path.name,
            })
    return rows


def style_header(sheet, columns):
    for index in range(1, columns + 1):
        cell = sheet.cell(row=1, column=index)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical="center")


def main():
    defects = load_json(CODE / "config" / "frameworks" / "framework-defect-matrix.v0.1.json")
    manifest = load_json(CODE / "config" / "frameworks" / "framework-environment-manifest.v0.1.json")
    rows = ledger_rows()

    wb = Workbook()

    sheet = wb.active
    sheet.title = "Framework defects"
    sheet.append(["ID", "Level", "Defect", "Location", "Status"])
    for defect in defects["defects"]:
        sheet.append([defect["id"], defect["level"], defect["title"], defect["location"], defect["status"]])
    style_header(sheet, 5)
    for row in sheet.iter_rows(min_row=2, max_row=sheet.max_row, max_col=5):
        for cell in row:
            cell.font = BODY_FONT
        if row[4].value == "open":
            for cell in row:
                cell.fill = OPEN_FILL
    for index, width in enumerate([8, 8, 70, 60, 14], start=1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = "A2"

    env = wb.create_sheet("Framework environments")
    env.append(["Environment", "Track", "Framework", "Declared version", "Installed version", "Install status", "Adapter compatibility"])
    for environment in manifest["environments"]:
        env.append([
            environment["environment_id"], environment["track"], environment["framework_id"],
            (environment.get("resolved") or {}).get("version"),
            environment.get("track_equivalence", {}).get("version") if environment.get("track_equivalence", {}).get("collapsed") else (environment.get("resolved") or {}).get("version"),
            environment["install_status"],
            (environment.get("adapter_compatibility") or {}).get("status", "not-checked"),
        ])
    style_header(env, 7)
    for row in env.iter_rows(min_row=2, max_row=env.max_row, max_col=7):
        for cell in row:
            cell.font = BODY_FONT
    for index, width in enumerate([20, 24, 32, 18, 18, 26, 22], start=1):
        env.column_dimensions[get_column_letter(index)].width = width
    env.freeze_panes = "A2"

    cells = wb.create_sheet("Ledger cells")
    headers = ["Provider", "Condition", "Run tag", "Arm", "Role", "Started", "Strict passes", "Failures", "Failure categories", "Source summary"]
    cells.append(headers)
    for row in rows:
        cells.append([row["provider"], row["condition"], row["run_tag"], row["arm"], row["role"],
                      row["n"], row["pass"], row["fail"], row["cats"], row["source"]])
    style_header(cells, len(headers))
    for row in cells.iter_rows(min_row=2, max_row=cells.max_row, max_col=len(headers)):
        for cell in row:
            cell.font = BODY_FONT
    for index, width in enumerate([12, 20, 28, 12, 16, 10, 14, 10, 34, 52], start=1):
        cells.column_dimensions[get_column_letter(index)].width = width
    cells.freeze_panes = "A2"

    summary = wb.create_sheet("Stratified summary")
    summary.append(["Provider", "Condition", "Run tag", "Arm", "Started", "Strict passes", "Failures", "Strict pass rate"])
    style_header(summary, 8)
    combinations = sorted({(row["provider"], row["condition"], row["run_tag"]) for row in rows if row["role"] == "pilot-evidence"})
    line = 2
    for provider, condition, tag in combinations:
        for arm in ("playwright", "visual", "hybrid"):
            summary.cell(row=line, column=1, value=provider)
            summary.cell(row=line, column=2, value=condition)
            summary.cell(row=line, column=3, value=tag)
            summary.cell(row=line, column=4, value=arm)
            criteria = (f"'Ledger cells'!$A:$A,$A{line},'Ledger cells'!$B:$B,$B{line},"
                        f"'Ledger cells'!$C:$C,$C{line},'Ledger cells'!$D:$D,$D{line}")
            summary.cell(row=line, column=5, value=f"=SUMIFS('Ledger cells'!$F:$F,{criteria})")
            summary.cell(row=line, column=6, value=f"=SUMIFS('Ledger cells'!$G:$G,{criteria})")
            summary.cell(row=line, column=7, value=f"=E{line}-F{line}")
            summary.cell(row=line, column=8, value=f"=IF(E{line}=0,\"\",F{line}/E{line})")
            line += 1
    total = line
    summary.cell(row=total, column=4, value="ALL").font = HEADER_FONT
    summary.cell(row=total, column=5, value=f"=SUM(E2:E{total - 1})")
    summary.cell(row=total, column=6, value=f"=SUM(F2:F{total - 1})")
    summary.cell(row=total, column=7, value=f"=E{total}-F{total}")
    summary.cell(row=total, column=8, value=f"=IF(E{total}=0,\"\",F{total}/E{total})")
    for row in summary.iter_rows(min_row=2, max_row=total, max_col=8):
        for cell in row:
            cell.font = HEADER_FONT if cell.row == total else BODY_FONT
            if cell.column == 8:
                cell.number_format = "0.0%"
    for index, width in enumerate([12, 20, 28, 12, 10, 14, 10, 16], start=1):
        summary.column_dimensions[get_column_letter(index)].width = width
    summary.freeze_panes = "A2"

    notes = wb.create_sheet("Notes")
    lines = [
        "PSS-WebTest framework and experiment audit - generated 2026-09-12",
        "",
        "Evidence boundary: framework rows are engineering status; ledger rows are admission/pilot evidence.",
        "No record here is confirmatory. Provider strata and framework tracks are never pooled.",
        "",
        "Framework defects: P0 = blocks scientific validity, P1 = correctness/reproducibility risk, P2 = quality.",
        "Open rows are shaded. Full narrative: legacy/results/phase2/2026-09-12-framework-engineering-audit.md",
        "",
        "Track collapse: upstream latest equals the frozen version for browser-use (0.13.10) and agentlab (0.4.2),",
        "so only Stagehand has a genuine second track (3.0.8 vs 4.1.0). Collapsed rows are not strata.",
        "Stagehand 4.1.0 no longer exports LLMClient, so the latest track is adapter-incompatible.",
        "",
        "Ledger reading: the functional-fault condition is the only discriminating condition; clean and evolution",
        "are at ceiling. Run tags are separate blocks and must not be pooled (fault-r3 is the retained misaligned block).",
        "",
        "Aggregates on 'Stratified summary' are SUMIFS formulas over 'Ledger cells'.",
    ]
    for index, text in enumerate(lines, start=1):
        cell = notes.cell(row=index, column=1, value=text)
        cell.font = NOTE_FONT if text else BODY_FONT
        if text.startswith("Evidence boundary") or text.startswith("Track collapse"):
            cell.fill = NOTE_FILL
    notes.column_dimensions["A"].width = 130

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(json.dumps({
        "output": str(OUT),
        "defects": len(defects["defects"]),
        "open_defects": sum(1 for d in defects["defects"] if d["status"] == "open"),
        "environments": len(manifest["environments"]),
        "ledger_rows": len(rows),
        "summary_rows": total - 1,
    }))


if __name__ == "__main__":
    main()
