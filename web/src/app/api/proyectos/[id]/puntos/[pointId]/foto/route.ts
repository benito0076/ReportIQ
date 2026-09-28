import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { handleApi } from "@/server/api";
import { getPoint } from "@/server/projects";

export async function GET(_req: Request, { params }: RouteContext<"/api/proyectos/[id]/puntos/[pointId]/foto">) {
  return handleApi(async () => {
    await assertUser();
    const { id, pointId } = await params;
    const point = await getPoint(id, pointId);
    if (!point.fotoKey) throw new NotFoundError("El punto no tiene foto.");
    return NextResponse.redirect(await downloadUrl(point.fotoKey));
  });
}
