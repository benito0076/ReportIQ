import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { assertAdmin } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { handleApi } from "@/server/api";
import { generateVertReport } from "@/server/vertimientos";

export const maxDuration = 300;

// El informe Word de vertimientos llega en una fase posterior.
const bodySchema = z.object({ kind: z.literal("excel") });

/** Genera el Excel de resultados de vertimientos frente a la Res. 0631 de 2015. */
export async function POST(req: Request, { params }: RouteContext<"/api/vertimientos/[id]/informes">) {
  return handleApi(async () => {
    const user = await assertAdmin();
    const { id } = await params;
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ValidationError("Tipo de informe inválido.");
    const report = await generateVertReport(id, user.id);
    await logActivity("informe_generado", user, report.fileName);
    return NextResponse.json({ ok: true, id: report.id, advertencias: report.advertencias });
  });
}
