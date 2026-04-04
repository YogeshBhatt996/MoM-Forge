// GET /api/pdf/:id – generate and stream a PDF of the completed MoM

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";
import type { MoMData } from "@/types";

// ── colours ──────────────────────────────────────────────────────────────────
const NAVY   = "#1E3A8A";
const BLUE   = "#2563EB";
const LGRAY  = "#F3F4F6";
const DGRAY  = "#374151";
const BLACK  = "#111827";

function toEST(timeStr: string): string {
  if (!timeStr || timeStr.toLowerCase().includes("not specified")) return timeStr;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return `${timeStr} (EST)`;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  let offsetHours = 0;
  const u = timeStr.toUpperCase();
  if (u.includes("IST")) offsetHours = 5.5;
  else if (u.includes("PST")) offsetHours = -8;
  else if (u.includes("PDT")) offsetHours = -7;
  else if (u.includes("CST")) offsetHours = -6;
  else if (u.includes("CDT")) offsetHours = -5;
  const totalMin = hours * 60 + minutes - offsetHours * 60;
  let estMin = ((totalMin - (-5 * 60)) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(estMin / 60), m = estMin % 60;
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2,"0")} ${p} EST`;
}

function buildAgendaBrief(items: string[]): string {
  if (!items?.length) return "No agenda items specified.";
  const s = items.map((item, i) => {
    const c = item.replace(/^\d+[\.\)]\s*/, "").trim();
    return i === 0 ? `The meeting covered ${c}.` : `${c} was also discussed.`;
  });
  return s.slice(0, 4).join(" ");
}

async function buildPDF(mom: MoMData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100; // usable width

    // ── Title ──────────────────────────────────────────────────────────────
    doc.rect(50, 40, W, 40).fill(NAVY);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(16)
      .text(mom.meeting_title || "Minutes of Meeting", 60, 50, { width: W - 20, align: "center" });

    // ── Meta ───────────────────────────────────────────────────────────────
    doc.rect(50, 80, W, 22).fill("#E0E7FF");
    const meta = `Date: ${mom.meeting_date}   |   Time: ${toEST(mom.meeting_time)}   |   Facilitator: ${mom.facilitator}`;
    doc.fillColor(DGRAY).font("Helvetica-Oblique").fontSize(9)
      .text(meta, 55, 86, { width: W - 10, align: "center" });

    let y = 116;

    // helper: section header
    const section = (title: string) => {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      doc.rect(50, y, W, 20).fill(BLUE);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(10)
        .text(title, 56, y + 5, { width: W - 12 });
      y += 24;
    };

    // helper: label + value row
    const row = (label: string, value: string, alt: boolean) => {
      const rowH = 18;
      if (y + rowH > doc.page.height - 50) { doc.addPage(); y = 50; }
      if (alt) doc.rect(50, y, W, rowH).fill(LGRAY);
      doc.fillColor(DGRAY).font("Helvetica-Bold").fontSize(9).text(label, 56, y + 4, { width: 140 });
      doc.fillColor(BLACK).font("Helvetica").fontSize(9).text(value || "—", 200, y + 4, { width: W - 155 });
      y += rowH;
    };

    // helper: table header
    const tableHeader = (cols: { label: string; x: number; w: number }[]) => {
      if (y + 20 > doc.page.height - 50) { doc.addPage(); y = 50; }
      doc.rect(50, y, W, 18).fill(NAVY);
      cols.forEach(c => {
        doc.fillColor("white").font("Helvetica-Bold").fontSize(8)
          .text(c.label, c.x, y + 4, { width: c.w, align: "center" });
      });
      y += 18;
    };

    // ── OVERVIEW ───────────────────────────────────────────────────────────
    section("OVERVIEW");
    const brief = buildAgendaBrief(mom.agenda_items);
    const briefH = Math.max(36, Math.ceil(brief.length / 90) * 13 + 10);
    if (y + briefH > doc.page.height - 50) { doc.addPage(); y = 50; }
    doc.rect(50, y, W, briefH).fill(LGRAY);
    doc.fillColor(BLACK).font("Helvetica").fontSize(9)
      .text(brief, 56, y + 6, { width: W - 12 });
    y += briefH + 8;

    // ── ATTENDEES ──────────────────────────────────────────────────────────
    section("ATTENDEES");
    tableHeader([
      { label: "Name", x: 56, w: (W / 2) - 10 },
      { label: "Organization", x: 56 + W / 2, w: W / 2 - 10 },
    ]);
    mom.attendees.forEach((a, i) => {
      const rh = 16;
      if (y + rh > doc.page.height - 50) { doc.addPage(); y = 50; }
      if (i % 2 === 1) doc.rect(50, y, W, rh).fill(LGRAY);
      doc.fillColor(BLACK).font("Helvetica").fontSize(9)
        .text(a.name || "—", 56, y + 3, { width: W / 2 - 10 })
        .text(a.organization || "—", 56 + W / 2, y + 3, { width: W / 2 - 10 });
      y += rh;
    });
    y += 8;

    // ── DISCUSSION & DECISIONS ─────────────────────────────────────────────
    section("DISCUSSION & DECISIONS");
    tableHeader([
      { label: "#", x: 50, w: 20 },
      { label: "Topic & Summary", x: 74, w: W / 2 },
      { label: "Decisions", x: 74 + W / 2, w: W / 2 - 24 },
    ]);
    mom.discussion_summary.forEach((d, i) => {
      const topicText = `${d.topic}\n${d.summary}`;
      const decisionsText = d.decisions.length ? "• " + d.decisions.join("\n• ") : "—";
      const linesT = Math.ceil(topicText.length / 60);
      const linesD = Math.max(1, d.decisions.length);
      const rh = Math.max(30, Math.max(linesT, linesD) * 12 + 8);
      if (y + rh > doc.page.height - 50) { doc.addPage(); y = 50; }
      if (i % 2 === 1) doc.rect(50, y, W, rh).fill(LGRAY);
      doc.fillColor(DGRAY).font("Helvetica-Bold").fontSize(8)
        .text(String(i + 1), 55, y + 4, { width: 16, align: "center" });
      doc.fillColor(BLACK).font("Helvetica").fontSize(8)
        .text(topicText, 74, y + 4, { width: W / 2 - 4 });
      doc.fillColor(BLACK).font("Helvetica").fontSize(8)
        .text(decisionsText, 74 + W / 2, y + 4, { width: W / 2 - 28 });
      y += rh;
    });
    y += 8;

    // ── ACTION ITEMS ───────────────────────────────────────────────────────
    section("ACTION ITEMS");
    const aw = [20, W * 0.38, W * 0.18, W * 0.14, W * 0.22];
    const ax = [50, 70, 70 + aw[1], 70 + aw[1] + aw[2], 70 + aw[1] + aw[2] + aw[3]];
    tableHeader([
      { label: "#", x: ax[0], w: aw[0] },
      { label: "Action", x: ax[1], w: aw[1] },
      { label: "Owner", x: ax[2], w: aw[2] },
      { label: "Due Date", x: ax[3], w: aw[3] },
      { label: "Status / Remarks", x: ax[4], w: aw[4] },
    ]);
    mom.action_items.forEach((a, i) => {
      const rh = Math.max(20, Math.ceil(a.action.length / 55) * 11 + 8);
      if (y + rh > doc.page.height - 50) { doc.addPage(); y = 50; }
      if (i % 2 === 1) doc.rect(50, y, W, rh).fill(LGRAY);
      doc.fillColor(DGRAY).font("Helvetica-Bold").fontSize(8)
        .text(String(i + 1), ax[0] + 2, y + 4, { width: aw[0] - 4, align: "center" });
      [[1,a.action],[2,a.owner],[3,a.due_date],[4,a.status_remarks]].forEach(([ci, val]) => {
        const idx = ci as number;
        doc.fillColor(BLACK).font("Helvetica").fontSize(8)
          .text(String(val || "—"), ax[idx], y + 4, { width: aw[idx] - 4 });
      });
      y += rh;
    });

    doc.end();
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: job } = await service
    .from("jobs")
    .select("ai_raw_json, status, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "completed" || !job.ai_raw_json) {
    return NextResponse.json({ error: "Job not completed" }, { status: 400 });
  }

  const pdfBuffer = await buildPDF(job.ai_raw_json as unknown as MoMData);

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="minutes_${id}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}
