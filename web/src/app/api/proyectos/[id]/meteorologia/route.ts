import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { handleApi } from "@/server/api";
import { getProject } from "@/server/projects";
import { assertProjectAccess } from "@/server/aire";

export async function GET(_req: Request, { params }: RouteContext<"/api/proyectos/[id]/meteorologia">) {
  return handleApi(async () => {
    const user = await assertUser();
    const { id } = await params;
    const project = await getProject(id);
    assertProjectAccess(project, user);
    if (!project.meteoKey) throw new NotFoundError("El proyecto no tiene datos meteorológicos.");
    return NextResponse.redirect(
      await downloadUrl(project.meteoKey, { fileName: project.meteoNombre ?? "meteorologia.xlsx" }),
    );
  });
}
