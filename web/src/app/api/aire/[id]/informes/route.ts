import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { generateAireReport } from "@/server/aire";
import { handleApi } from "@/server/api";

export const maxDuration = 300;

const bodySchema = z.object({ kind: z.enum(["excel", "word"]) });

/** Genera el Excel de resultados o el informe Word de calidad del aire. */
export async function POST(req: Request, { params }: RouteContext<"/api/aire/[id]/informes">) {
  return handleApi(async () => {
    const user = await assertUser();
    const { id } = await params;
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ValidationError("Tipo de informe inválido.");
    const report = await generateAireReport(id, body.data.kind, user.id);
    await logActivity("informe_generado", user, report.fileName);
    return NextResponse.json({ ok: true, id: report.id, advertencias: report.advertencias });
  });
}
