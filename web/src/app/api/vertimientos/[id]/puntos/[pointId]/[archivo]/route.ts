import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { assertAdmin } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { handleApi } from "@/server/api";
import { getWaterPoint } from "@/server/vertimientos";

/** Descarga el reporte del laboratorio (archivo = "informe") o la foto del punto (archivo = "foto"). */
export async function GET(_req: Request, { params }: RouteContext<"/api/vertimientos/[id]/puntos/[pointId]/[archivo]">) {
  return handleApi(async () => {
    await assertAdmin();
    const { id, pointId, archivo } = await params;
    const point = await getWaterPoint(id, pointId);
    if (archivo === "informe" && point.informeKey) {
      return NextResponse.redirect(
        await downloadUrl(point.informeKey, { fileName: point.informeNombre ?? "reporte.pdf" }),
      );
    }
    if (archivo === "foto" && point.fotoKey) return NextResponse.redirect(await downloadUrl(point.fotoKey));
    throw new NotFoundError("El archivo no existe.");
  });
}
