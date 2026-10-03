import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { handleApi } from "@/server/api";
import { generateVertReport } from "@/server/vertimientos";

export const maxDuration = 300;

const bodySchema = z.object({ kind: z.enum(["excel", "word"]) });

/** Genera el Excel de resultados o el informe Word de vertimientos (Res. 0631 de 2015). */
export async function POST(req: Request, { params }: RouteContext<"/api/vertimientos/[id]/informes">) {
  return handleApi(async () => {
    const user = await assertUser();
    const { id } = await params;
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ValidationError("Tipo de informe inválido.");
    const report = await generateVertReport(id, body.data.kind, user.id);
    await logActivity("informe_generado", user, report.fileName);
    return NextResponse.json({ ok: true, id: report.id, advertencias: report.advertencias });
  });
}
