// ─────────────────────────────────────────────────────────────────────────────
// Template Analysis Service
// Inspects an uploaded .xlsx template and returns a structured description of
// its sheets, columns, and inferred purpose — used to guide AI mapping.
// ─────────────────────────────────────────────────────────────────────────────

import ExcelJS from "exceljs";
import type { TemplateColumn, TemplateSheet, TemplateStructure } from "@/types";

/** Heuristic: map sheet/column names to a known MoM section */
function inferPurpose(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("action") || n.includes("task")) return "action_items";
  if (n.includes("decision") || n.includes("resolved")) return "decisions";
  if (n.includes("discussion") || n.includes("topic") || n.includes("agenda"))
    return "discussion_summary";
  if (n.includes("attend") || n.includes("participant")) return "attendees";
  if (n.includes("summary") || n.includes("overview")) return "overview";
  if (n.includes("note")) return "additional_notes";
  return "general";
}

function inferDataType(values: string[]): TemplateColumn["dataType"] {
  const nonEmpty = values.filter(Boolean);
  if (nonEmpty.length === 0) return "unknown";
  const datePattern = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
  if (nonEmpty.some((v) => datePattern.test(v))) return "date";
  if (nonEmpty.every((v) => !isNaN(Number(v)))) return "number";
  return "text";
}

export async function analyzeExcelTemplate(
  buffer: ArrayBuffer
): Promise<TemplateStructure> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(buffer) as any);

  const sheets: TemplateSheet[] = [];

  workbook.eachSheet((worksheet, sheetIndex) => {
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as ExcelJS.CellValue[])
        .slice(1) // ExcelJS rows are 1-indexed; index 0 is undefined
        .map((v) => (v == null ? "" : String(v)));
      rows.push(cells);
    });

    if (rows.length === 0) return;

    const headerRow = rows[0] ?? [];
    const dataRows = rows.slice(1, 6); // sample up to 5 data rows

    const columns: TemplateColumn[] = headerRow.map((header, colIdx) => {
      const samples = dataRows
        .map((r) => r[colIdx] ?? "")
        .filter(Boolean)
        .slice(0, 3);

      return {
        header: header || `Column_${colIdx + 1}`,
        index: colIdx,
        dataType: inferDataType(samples),
        sample_values: samples,
      };
    });

    sheets.push({
      name: worksheet.name,
      index: sheetIndex - 1,
      columns,
      row_count: rows.length,
      purpose: inferPurpose(worksheet.name),
    });
  });

  if (sheets.length === 0) {
    throw new Error("Excel template appears to be empty or has no readable sheets.");
  }

  const primarySheet =
    sheets.find((s) => s.purpose !== "general")?.name ?? sheets[0].name;

  const detectedSections = [...new Set(sheets.map((s) => s.purpose))];

  return {
    sheets,
    primary_sheet: primarySheet,
    detected_sections: detectedSections,
    has_header_row: true,
  };
}

/** Render template structure as a text description for the AI prompt */
export function describeTemplateForPrompt(structure: TemplateStructure): string {
  return structure.sheets
    .map(
      (sheet) =>
        `Sheet: "${sheet.name}" (purpose: ${sheet.purpose})\n` +
        `Columns: ${sheet.columns.map((c) => `"${c.header}"`).join(", ")}`
    )
    .join("\n\n");
}
