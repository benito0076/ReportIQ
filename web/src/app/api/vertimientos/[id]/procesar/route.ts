import { NextResponse } from "next/server";
import { assertUser } from "@/lib/session";
import { handleApi } from "@/server/api";
import { processVertimiento } from "@/server/vertimientos";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: RouteContext<"/api/vertimientos/[id]/procesar">) {
  return handleApi(async () => {
    await assertUser();
    const { id } = await params;
    const resultados = await processVertimiento(id);
    return NextResponse.json({ ok: true, advertencias: resultados.advertencias.length });
  });
}
