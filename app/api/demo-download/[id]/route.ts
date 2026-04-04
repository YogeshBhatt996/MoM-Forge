// GET /api/demo-download/:id
// Serves the in-memory Excel buffer from demoOutputs directly as a file download.
// Only active in demo mode — no Supabase Storage needed.

import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-auth";
import { demoJobs, demoOutputs, getDemoUserFromToken } from "@/lib/demo-store";

const DEMO_COOKIE = "demo_session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { id } = await params;

  const token = req.cookies.get(DEMO_COOKIE)?.value;
  const demoUser = token ? getDemoUserFromToken(token) : null;
  if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = demoJobs.get(id);
  if (!job || job.userId !== demoUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = demoOutputs.get(id);
  if (!buffer) {
    return NextResponse.json({ error: "Output not ready" }, { status: 404 });
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="minutes_${id}.xlsx"`,
      "Content-Length": String(buffer.length),
    },
  });
}
