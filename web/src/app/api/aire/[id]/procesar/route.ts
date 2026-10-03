import { NextResponse } from "next/server";
import { assertUser } from "@/lib/session";
import { processAire } from "@/server/aire";
import { handleApi } from "@/server/api";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: RouteContext<"/api/aire/[id]/procesar">) {
  return handleApi(async () => {
    await assertUser();
    const { id } = await params;
    const resultados = await processAire(id);
    return NextResponse.json({ ok: true, advertencias: resultados.advertencias.length });
  });
}
