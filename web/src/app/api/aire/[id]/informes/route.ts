import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { generateAireExcel } from "@/server/aire";
import { handleApi } from "@/server/api";

export const maxDuration = 300;

/** Genera el Excel de resultados de calidad del aire (el informe Word llega en una etapa posterior). */
export async function POST(_req: Request, { params }: RouteContext<"/api/aire/[id]/informes">) {
  return handleApi(async () => {
    const user = await assertAdmin();
    const { id } = await params;
    const report = await generateAireExcel(id, user.id);
    await logActivity("informe_generado", user, report.fileName);
    return NextResponse.json({ ok: true, id: report.id, advertencias: report.advertencias });
  });
}
