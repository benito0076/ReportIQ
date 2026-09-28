import { NextResponse } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { handleApi } from "@/server/api";
import { getSettings } from "@/server/settings";

export async function GET() {
  return handleApi(async () => {
    await assertUser();
    const s = await getSettings();
    if (!s.plantillaKey) throw new NotFoundError("No hay una plantilla propia cargada.");
    return NextResponse.redirect(await downloadUrl(s.plantillaKey, { fileName: s.plantillaNombre ?? "plantilla.docx" }));
  });
}
