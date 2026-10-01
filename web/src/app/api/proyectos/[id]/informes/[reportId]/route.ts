import { NextResponse } from "next/server";
import { assertUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { handleApi } from "@/server/api";
import { reportDownloadUrl } from "@/server/processing";
import { assertProjectAccess } from "@/server/aire";
import { getProject } from "@/server/projects";

export async function GET(_req: Request, { params }: RouteContext<"/api/proyectos/[id]/informes/[reportId]">) {
  return handleApi(async () => {
    const user = await assertUser();
    const { id, reportId } = await params;
    assertProjectAccess(await getProject(id), user);
    const { url, fileName } = await reportDownloadUrl(id, reportId);
    await logActivity("informe_descargado", user, fileName);
    return NextResponse.redirect(url);
  });
}
