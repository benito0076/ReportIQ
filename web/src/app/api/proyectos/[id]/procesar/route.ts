import { NextResponse } from "next/server";
import { assertUser } from "@/lib/session";
import { handleApi } from "@/server/api";
import { processProject } from "@/server/processing";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: RouteContext<"/api/proyectos/[id]/procesar">) {
  return handleApi(async () => {
    await assertUser();
    const { id } = await params;
    const resultados = await processProject(id);
    return NextResponse.json({ ok: true, advertencias: resultados.advertencias.length });
  });
}
