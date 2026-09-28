import { NextResponse } from "next/server";
import { assertUser } from "@/lib/session";
import { handleApi } from "@/server/api";
import { reportDownloadUrl } from "@/server/processing";

export async function GET(_req: Request, { params }: RouteContext<"/api/proyectos/[id]/informes/[reportId]">) {
  return handleApi(async () => {
    await assertUser();
    const { id, reportId } = await params;
    return NextResponse.redirect(await reportDownloadUrl(id, reportId));
  });
}
