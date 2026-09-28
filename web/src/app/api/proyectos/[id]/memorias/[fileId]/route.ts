import { NextResponse } from "next/server";
import { assertUser } from "@/lib/session";
import { downloadUrl } from "@/lib/storage";
import { handleApi } from "@/server/api";
import { getMemoryFile } from "@/server/projects";

export async function GET(_req: Request, { params }: RouteContext<"/api/proyectos/[id]/memorias/[fileId]">) {
  return handleApi(async () => {
    await assertUser();
    const { id, fileId } = await params;
    const file = await getMemoryFile(id, fileId);
    return NextResponse.redirect(await downloadUrl(file.fileKey, { fileName: file.fileName }));
  });
}
