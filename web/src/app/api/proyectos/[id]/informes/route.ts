import { NextResponse } from "next/server";
import { z } from "zod";
import { REPORT_KINDS } from "@/db/enums";
import { ValidationError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { handleApi } from "@/server/api";
import { generateReport } from "@/server/processing";

export const maxDuration = 300;

const bodySchema = z.object({ kind: z.enum(REPORT_KINDS) });

export async function POST(req: Request, { params }: RouteContext<"/api/proyectos/[id]/informes">) {
  return handleApi(async () => {
    const user = await assertUser();
    const { id } = await params;
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new ValidationError("Tipo de informe inválido.");
    const report = await generateReport(id, body.data.kind, user.id);
    await logActivity("informe_generado", user, report.fileName);
    return NextResponse.json({ ok: true, id: report.id, advertencias: report.advertencias });
  });
}
