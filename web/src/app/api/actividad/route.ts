import { assertAdmin } from "@/lib/session";
import { activityCsv } from "@/server/activity";
import { handleApi } from "@/server/api";

/** Descarga del registro de actividad (con los filtros de la pantalla) como CSV para Excel. */
export async function GET(req: Request) {
  return handleApi(async () => {
    await assertAdmin();
    const sp = new URL(req.url).searchParams;
    const csv = await activityCsv({
      email: sp.get("usuario") ?? "",
      event: sp.get("evento") ?? "",
      desde: sp.get("desde") ?? "",
      hasta: sp.get("hasta") ?? "",
    });
    const hoy = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="actividad-${hoy}.csv"`,
      },
    });
  });
}
