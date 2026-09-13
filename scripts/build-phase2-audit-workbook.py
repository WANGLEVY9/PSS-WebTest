#!/usr/bin/env python3
"""Build the stratified Phase 2 ledger audit workbook.

Input: matched-pilot summary JSON files written by the PrestaShop orchestrator.
Output: a workbook whose aggregates are Excel formulas (SUMIFS) over the raw
cell sheet, so the numbers recalculate if the raw counts change.
"""
import json
import pathlib
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

REPO = pathlib.Path(__file__).resolve().parent.parent
ARTIFACTS = REPO / "artifacts" / "phase2"
OUT = REPO / "results" / "phase2" / "2026-09-12-phase2-stratified-ledger-audit.xlsx"

FONT = "Arial"
HEADER_FILL = PatternFill("solid", start_color="DDEBF7")
NOTE_FILL = PatternFill("solid", start_color="FFF2CC")
HEADER_FONT = Font(name=FONT, bold=True)
BODY_FONT = Font(name=FONT)
NOTE_FONT = Font(name=FONT, italic=True)


def load_cells():
    rows = []
    for path in sorted(ARTIFACTS.glob("*-pilot.json")):
        doc = json.loads(path.read_text())
        if doc.get("application") != "prestashop":
            continue
        provider = doc.get("provider_id")
        model = doc.get("model_id")
        condition = doc.get("condition")
        tag = doc.get("run_tag")
        by_arm = {}
        for record in doc.get("records", []):
            arm = record.get("arm")
            if arm not in ("playwright", "visual", "hybrid"):
                continue
            bucket = by_arm.setdefault(arm, {"n": 0, "pass": 0, "cats": {}})
            bucket["n"] += 1
            if record.get("cell_passed") is True:
                bucket["pass"] += 1
            cat = record.get("failure_category")
            if cat:
                bucket["cats"][cat] = bucket["cats"].get(cat, 0) + 1
        for arm in ("playwright", "visual", "hybrid"):
            bucket = by_arm.get(arm)
            if not bucket:
                continue
            cats = ", ".join(f"{k}={v}" for k, v in sorted(bucket["cats"].items())) or "none"
            # Plumbing smoke tags validated the runner and are not pilot
            # evidence. They are retained for audit but excluded from the
            # stratified summary, and run tags are never pooled with each other.
            role = "plumbing-smoke" if "smoke" in str(tag or "") else "pilot-evidence"
            rows.append({
                "provider": provider,
                "model": model,
                "condition": condition,
                "run_tag": tag,
                "arm": arm,
                "n": bucket["n"],
                "pass": bucket["pass"],
                "fail": bucket["n"] - bucket["pass"],
                "cats": cats,
                "source": path.name,
                "role": role,
            })
    return rows


def build():
    rows = load_cells()
    if not rows:
        sys.exit("no PrestaShop matched-pilot summaries found")

    wb = Workbook()
    cells = wb.active
    cells.title = "Ledger cells"
    headers = ["Provider", "Model", "Condition", "Run tag", "Arm", "Role",
               "Started executions", "Strict passes", "Failures",
               "Failure categories", "Source summary"]
    cells.append(headers)
    for row in rows:
        cells.append([row["provider"], row["model"], row["condition"], row["run_tag"],
                      row["arm"], row["role"], row["n"], row["pass"], row["fail"],
                      row["cats"], row["source"]])
    for index, _ in enumerate(headers, start=1):
        cell = cells.cell(row=1, column=index)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical="center")
    for row in cells.iter_rows(min_row=2, max_row=cells.max_row, max_col=len(headers)):
        for cell in row:
            cell.font = BODY_FONT
    widths = [12, 30, 18, 22, 12, 16, 20, 15, 11, 34, 52]
    for index, width in enumerate(widths, start=1):
        cells.column_dimensions[get_column_letter(index)].width = width
    cells.freeze_panes = "A2"

    # Run tags are never pooled: each (provider, condition, run tag, arm) is its
    # own row, and plumbing smoke blocks are excluded from the summary.
    summary = wb.create_sheet("Stratified summary")
    summary.append(["Provider", "Condition", "Run tag", "Arm", "Started executions",
                    "Strict passes", "Failures", "Strict pass rate"])
    for row in summary[1]:
        row.font = HEADER_FONT
        row.fill = HEADER_FILL
    combinations = sorted({(r["provider"], r["condition"], r["run_tag"])
                           for r in rows if r["role"] == "pilot-evidence"})
    line = 2
    for provider, condition, tag in combinations:
        for arm in ("playwright", "visual", "hybrid"):
            summary.cell(row=line, column=1, value=provider)
            summary.cell(row=line, column=2, value=condition)
            summary.cell(row=line, column=3, value=tag)
            summary.cell(row=line, column=4, value=arm)
            criteria = (f"'Ledger cells'!$A:$A,$A{line},'Ledger cells'!$C:$C,$B{line},"
                        f"'Ledger cells'!$D:$D,$C{line},'Ledger cells'!$E:$E,$D{line}")
            summary.cell(row=line, column=5, value=f"=SUMIFS('Ledger cells'!$G:$G,{criteria})")
            summary.cell(row=line, column=6, value=f"=SUMIFS('Ledger cells'!$H:$H,{criteria})")
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
    for index, width in enumerate([12, 20, 26, 12, 20, 15, 11, 16], start=1):
        summary.column_dimensions[get_column_letter(index)].width = width
    summary.freeze_panes = "A2"

    notes = wb.create_sheet("Notes")
    lines = [
        "Phase 2 stratified ledger audit — generated 2026-09-12",
        "",
        "Evidence boundary: every row is admission/pilot evidence. No record here is confirmatory.",
        "Provider/model strata are never pooled: each provider row is a separate estimate.",
        "",
        "Strict pass = status completed AND the intended checkpoint was independently reached AND the emitted",
        "verdict equals the hidden ground truth. oracle_only_success is NOT a strict pass.",
        "",
        "Reading the fault condition: the Qwen stratum is 3/9 and the DeepSeek stratum is 9/9. Wilson 95%",
        "intervals for Qwen visual [0.000, 0.561] and DeepSeek visual [0.439, 1.000] overlap, so the difference",
        "is a directional planning signal, not a separated estimate.",
        "",
        "Reading the clean and evolution conditions: both are at ceiling (all arms 100%), so they carry no",
        "discriminating information and must not be used to estimate effect sizes.",
        "",
        "The 'fault-r3' rows are the retained misaligned block (the runner expected a different product than the",
        "mutation renamed). They are kept as evidence and must not be pooled with 'fault-r4'.",
        "",
        "Aggregates on the 'Stratified summary' sheet are SUMIFS formulas over the 'Ledger cells' sheet.",
    ]
    for index, text in enumerate(lines, start=1):
        cell = notes.cell(row=index, column=1, value=text)
        cell.font = NOTE_FONT if text else BODY_FONT
        if text.startswith("Evidence boundary") or text.startswith("Strict pass ="):
            cell.fill = NOTE_FILL
    notes.column_dimensions["A"].width = 130

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(json.dumps({"output": str(OUT), "ledger_rows": len(rows), "summary_rows": total - 1}))


if __name__ == "__main__":
    build()
