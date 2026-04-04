// ─────────────────────────────────────────────────────────────────────────────
// Excel Output Generator
// Converts a MoMData object into a well-formatted .xlsx file, mirroring the
// structure detected in the uploaded template.
// ─────────────────────────────────────────────────────────────────────────────

import ExcelJS from "exceljs";
import type { MoMData, TemplateStructure } from "@/types";

const BRAND_BLUE = "FF2563EB";
const HEADER_BG = "FF1E3A8A";
const HEADER_FG = "FFFFFFFF";
const ALT_ROW = "FFDBEAFE";

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_BG },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    bottom: { style: "thin", color: { argb: BRAND_BLUE } },
  };
}

function styleDataRow(row: ExcelJS.Row, rowIndex: number) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    if (rowIndex % 2 === 0) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ALT_ROW },
      };
    }
  });
}

function addTitleBlock(
  ws: ExcelJS.Worksheet,
  mom: MoMData,
  totalCols: number
) {
  // Merge title row
  ws.mergeCells(1, 1, 1, totalCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = mom.meeting_title;
  titleCell.font = { bold: true, size: 16, color: { argb: HEADER_FG } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  // Meta row
  ws.mergeCells(2, 1, 2, totalCols);
  const metaCell = ws.getCell(2, 1);
  metaCell.value =
    `Date: ${mom.meeting_date}  |  Time: ${mom.meeting_time}  |  ` +
    `Platform: ${mom.location_or_platform}  |  Facilitator: ${mom.facilitator}`;
  metaCell.font = { italic: true, size: 10 };
  metaCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 20;
}

export async function generateExcelOutput(
  mom: MoMData,
  templateStructure: TemplateStructure | null
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MoM Forge";
  wb.created = new Date();

  // ─── Overview sheet ───────────────────────────────────────────────────────
  const overview = wb.addWorksheet("Overview");
  overview.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 55 },
  ];
  addTitleBlock(overview, mom, 2);

  const overviewData = [
    ["Meeting Title", mom.meeting_title],
    ["Date", mom.meeting_date],
    ["Time", mom.meeting_time],
    ["Location / Platform", mom.location_or_platform],
    ["Facilitator", mom.facilitator],
    ["Agenda Items", mom.agenda_items.join("; ")],
    ["Next Meeting Date", mom.next_meeting.date],
    ["Next Meeting Time", mom.next_meeting.time],
    ["Next Meeting Agenda", mom.next_meeting.agenda],
    ["Additional Notes", mom.additional_notes],
  ];

  const headerRow = overview.getRow(3);
  headerRow.values = ["Field", "Value"];
  headerRow.eachCell(styleHeader);
  headerRow.height = 24;

  overviewData.forEach(([field, value], i) => {
    const row = overview.addRow({ field, value });
    styleDataRow(row, i);
  });

  // ─── Attendees sheet ──────────────────────────────────────────────────────
  const attendeesWs = wb.addWorksheet("Attendees");
  attendeesWs.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Role", key: "role", width: 28 },
    { header: "Organization", key: "organization", width: 30 },
  ];
  addTitleBlock(attendeesWs, mom, 3);
  const attHeader = attendeesWs.getRow(3);
  attHeader.values = ["Name", "Role", "Organization"];
  attHeader.eachCell(styleHeader);
  attHeader.height = 24;
  mom.attendees.forEach((a, i) => {
    const row = attendeesWs.addRow(a);
    styleDataRow(row, i);
  });

  // ─── Discussion & Decisions sheet ────────────────────────────────────────
  const discussionWs = wb.addWorksheet("Discussion & Decisions");
  discussionWs.columns = [
    { header: "Topic", key: "topic", width: 28 },
    { header: "Summary", key: "summary", width: 50 },
    { header: "Decisions", key: "decisions", width: 50 },
  ];
  addTitleBlock(discussionWs, mom, 3);
  const discHeader = discussionWs.getRow(3);
  discHeader.values = ["Topic", "Summary", "Decisions"];
  discHeader.eachCell(styleHeader);
  discHeader.height = 24;
  mom.discussion_summary.forEach((d, i) => {
    const row = discussionWs.addRow({
      topic: d.topic,
      summary: d.summary,
      decisions: d.decisions.join("\n• "),
    });
    styleDataRow(row, i);
    row.height = Math.max(30, d.decisions.length * 18);
  });

  // ─── Action Items sheet ───────────────────────────────────────────────────
  const actionsWs = wb.addWorksheet("Action Items");
  actionsWs.columns = [
    { header: "#", key: "num", width: 6 },
    { header: "Action", key: "action", width: 50 },
    { header: "Owner", key: "owner", width: 28 },
    { header: "Due Date", key: "due_date", width: 16 },
    { header: "Status / Remarks", key: "status_remarks", width: 28 },
  ];
  addTitleBlock(actionsWs, mom, 5);
  const actHeader = actionsWs.getRow(3);
  actHeader.values = ["#", "Action", "Owner", "Due Date", "Status / Remarks"];
  actHeader.eachCell(styleHeader);
  actHeader.height = 24;
  mom.action_items.forEach((a, i) => {
    const row = actionsWs.addRow({ num: i + 1, ...a });
    styleDataRow(row, i);
  });

  // ─── Apply template sheet order if structure provided ─────────────────────
  if (templateStructure) {
    // Re-order sheets to match template where possible (best effort)
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    templateStructure.sheets.forEach((ts) => {
      const purpose = ts.purpose;
      let targetName: string | undefined;
      if (purpose === "action_items") targetName = "Action Items";
      else if (purpose === "attendees") targetName = "Attendees";
      else if (purpose === "discussion_summary") targetName = "Discussion & Decisions";
      else if (purpose === "overview") targetName = "Overview";

      if (targetName && sheetNames.includes(targetName)) {
        // ExcelJS doesn't expose sheet reordering directly – this is a placeholder
        // for a future enhancement to fully mirror arbitrary templates
      }
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
