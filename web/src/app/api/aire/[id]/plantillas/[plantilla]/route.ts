import { NextResponse } from "next/server";
import { PLANTILLAS_AIRE, type PlantillaAire } from "@/db/enums";
import { NotFoundError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { getAirFile } from "@/server/aire";
import { handleApi } from "@/server/api";

export async function GET(_req: Request, { params }: RouteContext<"/api/aire/[id]/plantillas/[plantilla]">) {
  return handleApi(async () => {
    await assertUser();
    const { id, plantilla } = await params;
    const clave = decodeURIComponent(plantilla);
    if (!(PLANTILLAS_AIRE as readonly string[]).includes(clave)) throw new NotFoundError("El archivo no existe.");
    const file = await getAirFile(id, clave as PlantillaAire);
    return NextResponse.redirect(await downloadUrl(file.fileKey, { fileName: file.fileName }));
  });
}
