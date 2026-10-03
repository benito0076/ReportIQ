import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { getStation } from "@/server/aire";
import { handleApi } from "@/server/api";

export async function GET(_req: Request, { params }: RouteContext<"/api/aire/[id]/estaciones/[stationId]/foto">) {
  return handleApi(async () => {
    await assertUser();
    const { id, stationId } = await params;
    const station = await getStation(id, stationId);
    if (!station.fotoKey) throw new NotFoundError("La estación no tiene foto.");
    return NextResponse.redirect(await downloadUrl(station.fotoKey));
  });
}
