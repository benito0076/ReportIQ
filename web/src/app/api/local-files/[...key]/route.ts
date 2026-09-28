import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { contentDisposition, isLocalStorage, resolveLocalPath, verifyLocalSignature } from "@/lib/storage";

/**
 * Almacenamiento local (solo desarrollo, STORAGE_DRIVER=local): equivalente
 * a las URLs firmadas de S3, protegidas con HMAC y fecha de expiración.
 */
async function authorize(req: NextRequest, params: Promise<{ key: string[] }>, op: "get" | "put") {
  if (!isLocalStorage()) return null;
  const key = (await params).key.join("/");
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  return verifyLocalSignature(op, key, exp, sig) ? key : null;
}

export async function GET(req: NextRequest, { params }: RouteContext<"/api/local-files/[...key]">) {
  const key = await authorize(req, params, "get");
  if (!key) return new NextResponse("No autorizado", { status: 403 });
  try {
    const data = await readFile(resolveLocalPath(key));
    const name = req.nextUrl.searchParams.get("name");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        ...(name ? { "Content-Disposition": contentDisposition(name) } : {}),
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext<"/api/local-files/[...key]">) {
  const key = await authorize(req, params, "put");
  if (!key) return new NextResponse("No autorizado", { status: 403 });
  const target = resolveLocalPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await req.arrayBuffer()));
  return new NextResponse(null, { status: 200 });
}
