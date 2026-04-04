// ─────────────────────────────────────────────────────────────────────────────
// Excel Output Generator
// Single-sheet MoM layout matching CRW reference format.
// ─────────────────────────────────────────────────────────────────────────────

import ExcelJS from "exceljs";
import type { MoMData, TemplateStructure } from "@/types";

const HEADER_BG  = "FF1E3A8A"; // dark navy
const HEADER_FG  = "FFFFFFFF";
const SECTION_BG = "FF2563EB"; // brand blue
const SECTION_FG = "FFFFFFFF";
const ALT_ROW    = "FFDBEAFE"; // light blue
const BORDER_COL = "FF93C5FD";

// ─── EST conversion ──────────────────────────────────────────────────────────
// Attempts to parse a time string from the transcript and re-format in EST.
// Handles formats like "10:00 AM IST", "3:30 PM GMT+5:30", "14:00 UTC", etc.
// Falls back to the original string with "(EST)" appended if un-parseable.
function toEST(timeStr: string): string {
  if (!timeStr || timeStr.toLowerCase().includes("not specified")) return timeStr;

  // Try to extract hours, minutes, and AM/PM
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return `${timeStr} (EST)`;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();

  // Convert to 24h
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  // Detect source timezone offset from string
  let offsetHours = 0; // assume UTC if not specified
  const upperStr = timeStr.toUpperCase();
  if (upperStr.includes("IST")) offsetHours = 5.5;       // India +5:30
  else if (upperStr.includes("GMT+5:30")) offsetHours = 5.5;
  else if (upperStr.includes("CST") && !upperStr.includes("UTC")) offsetHours = -6;
  else if (upperStr.includes("PST")) offsetHours = -8;
  else if (upperStr.includes("PDT")) offsetHours = -7;
  else if (upperStr.includes("CDT")) offsetHours = -5;
  else if (upperStr.includes("MST")) offsetHours = -7;
  else if (upperStr.includes("MDT")) offsetHours = -6;
  else if (upperStr.includes("BST")) offsetHours = 1;
  else if (upperStr.includes("CET")) offsetHours = 1;
  else if (upperStr.includes("AEST")) offsetHours = 10;

  // EST = UTC-5
  const totalMinutesUTC = hours * 60 + minutes - offsetHours * 60;
  let estMinutes = totalMinutesUTC - (-5 * 60); // subtract EST offset
  // Normalise
  estMinutes = ((estMinutes % (24 * 60)) + 24 * 60) % (24 * 60);

  const estH = Math.floor(estMinutes / 60);
  const estM = estMinutes % 60;
  const period = estH >= 12 ? "PM" : "AM";
  const displayH = estH % 12 === 0 ? 12 : estH % 12;
  const displayM = String(estM).padStart(2, "0");

  return `${displayH}:${displayM} ${period} EST`;
}

// ─── Styling helpers ──────────────────────────────────────────────────────────
function applyThin(cell: ExcelJS.Cell) {
  cell.border = {
    top:    { style: "thin", color: { argb: BORDER_COL } },
    left:   { style: "thin", color: { argb: BORDER_COL } },
    bottom: { style: "thin", color: { argb: BORDER_COL } },
    right:  { style: "thin", color: { argb: BORDER_COL } },
  };
}

function styleColumnHeader(cell: ExcelJS.Cell) {
  cell.font  = { bold: true, color: { argb: HEADER_FG }, size: 10 };
  cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  applyThin(cell);
}

function styleSectionLabel(cell: ExcelJS.Cell) {
  cell.font  = { bold: true, color: { argb: SECTION_FG }, size: 11 };
  cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_BG } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  applyThin(cell);
}

function styleData(cell: ExcelJS.Cell, alt = false) {
  if (alt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW } };
  cell.alignment = { vertical: "top", wrapText: true };
  applyThin(cell);
}

// ─── Agenda brief builder ─────────────────────────────────────────────────────
// Joins agenda items into a short paragraph (max ~4 sentences).
function buildAgendaBrief(items: string[]): string {
  if (!items || items.length === 0) return "No agenda items specified.";
  const sentences = items.map((item, i) => {
    const clean = item.replace(/^\d+[\.\)]\s*/, "").trim();
    return i === 0 ? `The meeting covered ${clean}.` : `${clean} was also discussed.`;
  });
  // Cap at 4 sentences
  return sentences.slice(0, 4).join(" ");
}

// ─── Main generator ───────────────────────────────────────────────────────────
export async function generateExcelOutput(
  mom: MoMData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _templateStructure: TemplateStructure | null
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MoM Forge";
  wb.created = new Date();

  const ws = wb.addWorksheet("Minutes of Meeting");
  const COLS = 5; // A–E

  // Set column widths
  ws.getColumn(1).width = 6;   // # / label
  ws.getColumn(2).width = 38;  // main content / action
  ws.getColumn(3).width = 26;  // owner / org
  ws.getColumn(4).width = 16;  // due date
  ws.getColumn(5).width = 24;  // status / decisions

  let row = 1;

  // ── Title block ─────────────────────────────────────────────────────────────
  ws.mergeCells(row, 1, row, COLS);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = mom.meeting_title || "Minutes of Meeting";
  titleCell.font  = { bold: true, size: 16, color: { argb: HEADER_FG } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(row).height = 38;
  row++;

  // ── Meta row ─────────────────────────────────────────────────────────────────
  ws.mergeCells(row, 1, row, COLS);
  const metaCell = ws.getCell(row, 1);
  metaCell.value =
    `Date: ${mom.meeting_date}   |   Time: ${toEST(mom.meeting_time)}   |   Facilitator: ${mom.facilitator}`;
  metaCell.font = { italic: true, size: 10, color: { argb: "FF374151" } };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
  metaCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(row).height = 22;
  row++;

  // ── SECTION: Overview ────────────────────────────────────────────────────────
  row++; // blank spacer
  ws.mergeCells(row, 1, row, COLS);
  const ovHeader = ws.getCell(row, 1);
  ovHeader.value = "OVERVIEW";
  styleSectionLabel(ovHeader);
  ws.getRow(row).height = 22;
  row++;

  ws.mergeCells(row, 1, row, COLS);
  const agendaCell = ws.getCell(row, 1);
  agendaCell.value = buildAgendaBrief(mom.agenda_items);
  agendaCell.font  = { size: 10 };
  agendaCell.alignment = { vertical: "top", wrapText: true };
  applyThin(agendaCell);
  ws.getRow(row).height = 60;
  row++;

  // ── SECTION: Attendees ───────────────────────────────────────────────────────
  row++; // spacer
  ws.mergeCells(row, 1, row, COLS);
  const attHeader = ws.getCell(row, 1);
  attHeader.value = "ATTENDEES";
  styleSectionLabel(attHeader);
  ws.getRow(row).height = 22;
  row++;

  // Column headers — Name (cols 1-3), Organization (cols 4-5)
  ws.mergeCells(row, 1, row, 3);
  styleColumnHeader(ws.getCell(row, 1));
  ws.getCell(row, 1).value = "Name";
  ws.mergeCells(row, 4, row, COLS);
  styleColumnHeader(ws.getCell(row, 4));
  ws.getCell(row, 4).value = "Organization";
  ws.getRow(row).height = 20;
  row++;

  mom.attendees.forEach((a, i) => {
    ws.mergeCells(row, 1, row, 3);
    const nameCell = ws.getCell(row, 1);
    nameCell.value = a.name;
    styleData(nameCell, i % 2 === 1);

    ws.mergeCells(row, 4, row, COLS);
    const orgCell = ws.getCell(row, 4);
    orgCell.value = a.organization;
    styleData(orgCell, i % 2 === 1);

    ws.getRow(row).height = 18;
    row++;
  });

  // ── SECTION: Discussion & Decisions ─────────────────────────────────────────
  row++;
  ws.mergeCells(row, 1, row, COLS);
  const discHeader = ws.getCell(row, 1);
  discHeader.value = "DISCUSSION & DECISIONS";
  styleSectionLabel(discHeader);
  ws.getRow(row).height = 22;
  row++;

  // Column headers
  styleColumnHeader(ws.getCell(row, 1));  ws.getCell(row, 1).value = "#";
  ws.mergeCells(row, 2, row, 3);
  styleColumnHeader(ws.getCell(row, 2));  ws.getCell(row, 2).value = "Topic & Summary";
  ws.mergeCells(row, 4, row, COLS);
  styleColumnHeader(ws.getCell(row, 4));  ws.getCell(row, 4).value = "Decisions";
  ws.getRow(row).height = 20;
  row++;

  mom.discussion_summary.forEach((d, i) => {
    const alt = i % 2 === 1;
    const numCell = ws.getCell(row, 1);
    numCell.value = i + 1;
    numCell.alignment = { horizontal: "center", vertical: "top" };
    styleData(numCell, alt);

    ws.mergeCells(row, 2, row, 3);
    const topicCell = ws.getCell(row, 2);
    topicCell.value = `${d.topic}\n\n${d.summary}`;
    topicCell.font  = { size: 10 };
    styleData(topicCell, alt);

    ws.mergeCells(row, 4, row, COLS);
    const decCell = ws.getCell(row, 4);
    decCell.value  = d.decisions.length > 0 ? "• " + d.decisions.join("\n• ") : "—";
    decCell.font   = { size: 10 };
    styleData(decCell, alt);

    ws.getRow(row).height = Math.max(40, (d.decisions.length + 1) * 16);
    row++;
  });

  // ── SECTION: Action Items ────────────────────────────────────────────────────
  row++;
  ws.mergeCells(row, 1, row, COLS);
  const actSec = ws.getCell(row, 1);
  actSec.value = "ACTION ITEMS";
  styleSectionLabel(actSec);
  ws.getRow(row).height = 22;
  row++;

  // Column headers
  styleColumnHeader(ws.getCell(row, 1)); ws.getCell(row, 1).value = "#";
  styleColumnHeader(ws.getCell(row, 2)); ws.getCell(row, 2).value = "Action";
  styleColumnHeader(ws.getCell(row, 3)); ws.getCell(row, 3).value = "Owner";
  styleColumnHeader(ws.getCell(row, 4)); ws.getCell(row, 4).value = "Due Date";
  styleColumnHeader(ws.getCell(row, 5)); ws.getCell(row, 5).value = "Status / Remarks";
  ws.getRow(row).height = 20;
  row++;

  mom.action_items.forEach((a, i) => {
    const alt = i % 2 === 1;
    [
      [1, i + 1],
      [2, a.action],
      [3, a.owner],
      [4, a.due_date],
      [5, a.status_remarks],
    ].forEach(([col, val]) => {
      const cell = ws.getCell(row, col as number);
      cell.value = val;
      if (col === 1) cell.alignment = { horizontal: "center", vertical: "top" };
      styleData(cell, alt);
    });
    ws.getRow(row).height = Math.max(24, 18);
    row++;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
