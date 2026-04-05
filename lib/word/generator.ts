import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, ShadingType, BorderStyle,
  PageBreak, convertInchesToTwip, TableLayoutType,
} from "docx";
import type { MoMData } from "@/types";

// ── EST conversion (reused from Excel generator) ────────────────────────────
const TZ_OFFSET: Record<string, number> = {
  IST: 5.5, BST: 1, CET: 1, EET: 2, GST: 4,
  PKT: 5, BDT: 6, ICT: 7, CST: 8, JST: 9, AEST: 10,
  PST: -8, PDT: -7, MST: -7, MDT: -6, CST_US: -6, CDT: -5,
  EST: -5, EDT: -4, AST: -4, GMT: 0, UTC: 0,
};

function toEST(timeStr: string): string {
  if (!timeStr || timeStr === "Not specified in transcript") return timeStr;
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*([A-Z]{2,5})?/i);
  if (!m) return timeStr;
  let [, h, min, ampm, tz] = m;
  let hour = parseInt(h);
  if (ampm?.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm?.toUpperCase() === "AM" && hour === 12) hour = 0;
  const srcOff = TZ_OFFSET[(tz ?? "").toUpperCase()] ?? null;
  if (srcOff === null) return `${timeStr} (EST unverified)`;
  if (srcOff === -5) return timeStr;
  const utcHour = hour - srcOff;
  const estHour = ((utcHour - 5) % 24 + 24) % 24;
  const period = estHour >= 12 ? "PM" : "AM";
  const h12 = estHour % 12 === 0 ? 12 : estHour % 12;
  return `${h12}:${min} ${period} EST`;
}

// ── Style helpers ────────────────────────────────────────────────────────────
const NAVY = "0A2342";
const BLUE = "1E40AF";
const LIGHT_BLUE = "DBEAFE";
const GRAY = "F8FAFC";
const TEXT = "1E293B";
const MUTED = "64748B";
const WHITE = "FFFFFF";
const BORDER_COLOR = "CBD5E1";

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        color: WHITE,
        size: 22,
        font: "Calibri",
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
    spacing: { before: 280, after: 160 },
    indent: { left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
  });
}

function bodyParagraph(text: string, opts?: { bold?: boolean; color?: string; indent?: number }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 20,
        font: "Calibri",
        bold: opts?.bold,
        color: opts?.color ?? TEXT,
      }),
    ],
    spacing: { before: 60, after: 60 },
    indent: opts?.indent ? { left: convertInchesToTwip(opts.indent) } : undefined,
  });
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, font: "Calibri", color: TEXT }),
      new TextRun({ text: value || "—", size: 20, font: "Calibri", color: TEXT }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

function tableCell(text: string, opts?: { header?: boolean; width?: number }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts?.header,
            size: opts?.header ? 20 : 18,
            font: "Calibri",
            color: opts?.header ? WHITE : TEXT,
          }),
        ],
        spacing: { before: 80, after: 80 },
        indent: { left: convertInchesToTwip(0.08), right: convertInchesToTwip(0.08) },
      }),
    ],
    shading: opts?.header ? { type: ShadingType.SOLID, color: NAVY, fill: NAVY } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    },
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function agendaBrief(agendaItems: string[]): string {
  if (!agendaItems || agendaItems.length === 0) return "No agenda provided.";
  if (agendaItems.length === 1) return agendaItems[0];
  const last = agendaItems[agendaItems.length - 1];
  const rest = agendaItems.slice(0, -1);
  return `The meeting covered ${rest.join(", ")}, and ${last}.`;
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateWordOutput(momData: MoMData): Promise<Buffer> {
  const estTime = toEST(momData.meeting_time ?? "");
  const metaLine = [
    momData.meeting_date ? `Date: ${momData.meeting_date}` : null,
    estTime && estTime !== "Not specified in transcript" ? `Time: ${estTime}` : null,
    momData.facilitator && momData.facilitator !== "Not specified in transcript" ? `Facilitator: ${momData.facilitator}` : null,
  ].filter(Boolean).join("   |   ");

  const sections: (Paragraph | Table)[] = [];

  // ── Title block ─────────────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: "MINUTES OF MEETING", bold: true, size: 36, font: "Calibri", color: WHITE })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
      spacing: { before: 0, after: 0 },
      indent: { left: 0, right: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: momData.meeting_title ?? "Meeting", bold: true, size: 26, font: "Calibri", color: WHITE })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: BLUE, fill: BLUE },
      spacing: { before: 0, after: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: metaLine, size: 18, font: "Calibri", color: TEXT })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: LIGHT_BLUE, fill: LIGHT_BLUE },
      spacing: { before: 100, after: 200 },
    }),
  );

  // ── Overview ─────────────────────────────────────────────────────────────────
  sections.push(sectionHeading("OVERVIEW"));
  sections.push(bodyParagraph(agendaBrief(momData.agenda_items ?? [])));

  // ── Attendees ─────────────────────────────────────────────────────────────────
  sections.push(sectionHeading("ATTENDEES"));

  const attendees = (momData.attendees ?? []).filter(
    (a) => a.name && a.name !== "Not specified in transcript"
  );

  if (attendees.length > 0) {
    const attTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            tableCell("Name", { header: true, width: 40 }),
            tableCell("Organisation", { header: true, width: 60 }),
          ],
          tableHeader: true,
        }),
        ...attendees.map((a, i) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: a.name ?? "—", size: 18, font: "Calibri", color: TEXT })], spacing: { before: 80, after: 80 }, indent: { left: convertInchesToTwip(0.08) } })],
                shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: GRAY, fill: GRAY } : undefined,
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
                width: { size: 40, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: a.organization ?? "—", size: 18, font: "Calibri", color: TEXT })], spacing: { before: 80, after: 80 }, indent: { left: convertInchesToTwip(0.08) } })],
                shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: GRAY, fill: GRAY } : undefined,
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
                width: { size: 60, type: WidthType.PERCENTAGE },
              }),
            ],
          })
        ),
      ],
    });
    sections.push(attTable);
  } else {
    sections.push(bodyParagraph("No attendee information extracted.", { color: MUTED }));
  }

  sections.push(new Paragraph({ children: [], spacing: { before: 160 } }));

  // ── Discussion & Decisions ────────────────────────────────────────────────────
  sections.push(sectionHeading("DISCUSSION & DECISIONS"));

  const discussions = momData.discussion_summary ?? [];
  if (discussions.length > 0) {
    discussions.forEach((item, idx) => {
      sections.push(bodyParagraph(`${idx + 1}. ${item.topic ?? "Topic"}`, { bold: true }));
      if (item.summary) sections.push(bodyParagraph(item.summary, { indent: 0.25 }));
      if (item.decisions && item.decisions.length > 0) {
        sections.push(bodyParagraph("Decisions:", { bold: true, indent: 0.25 }));
        item.decisions.forEach((d) => {
          sections.push(bodyParagraph(`• ${d}`, { indent: 0.4 }));
        });
      }
      sections.push(new Paragraph({ children: [], spacing: { before: 80 } }));
    });
  } else {
    sections.push(bodyParagraph("No discussion items extracted.", { color: MUTED }));
  }

  // ── Action Items ───────────────────────────────────────────────────────────────
  sections.push(sectionHeading("ACTION ITEMS"));

  const actions = (momData.action_items ?? []).filter(
    (a) => a.action && a.action !== "Not specified in transcript"
  );

  if (actions.length > 0) {
    const actionTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            tableCell("Action Item", { header: true, width: 40 }),
            tableCell("Owner", { header: true, width: 20 }),
            tableCell("Due Date", { header: true, width: 20 }),
            tableCell("Status / Remarks", { header: true, width: 20 }),
          ],
          tableHeader: true,
        }),
        ...actions.map((a, i) =>
          new TableRow({
            children: [a.action ?? "—", a.owner ?? "—", a.due_date ?? "—", a.status_remarks ?? "—"].map((text, ci) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: "Calibri", color: TEXT })], spacing: { before: 80, after: 80 }, indent: { left: convertInchesToTwip(0.08) } })],
                shading: i % 2 === 1 ? { type: ShadingType.SOLID, color: GRAY, fill: GRAY } : undefined,
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
                width: { size: [40, 20, 20, 20][ci], type: WidthType.PERCENTAGE },
              })
            ),
          })
        ),
      ],
    });
    sections.push(actionTable);
  } else {
    sections.push(bodyParagraph("No action items extracted.", { color: MUTED }));
  }

  // ── Footer note ───────────────────────────────────────────────────────────────
  sections.push(new Paragraph({ children: [], spacing: { before: 280 } }));
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Generated by MoM Forge  ·  AI-powered minutes", size: 16, font: "Calibri", color: MUTED, italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
      spacing: { before: 160 },
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.9),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.9),
            },
          },
        },
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
