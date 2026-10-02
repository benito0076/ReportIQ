import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { assertAdmin } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { handleApi } from "@/server/api";
import { getVertProject } from "@/server/vertimientos";

export async function GET(_req: Request, { params }: RouteContext<"/api/vertimientos/[id]/fp004">) {
  return handleApi(async () => {
    await assertAdmin();
    const { id } = await params;
    const project = await getVertProject(id);
    if (!project.fp004Key) throw new NotFoundError("El proyecto no tiene FP-004.");
    return NextResponse.redirect(await downloadUrl(project.fp004Key, { fileName: project.fp004Nombre ?? "FP-004.xlsx" }));
  });
}
