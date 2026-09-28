import "server-only";
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";

/** Convierte los errores de negocio en respuestas JSON { error } con su código HTTP. */
export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Error inesperado en el servidor." }, { status: 500 });
  }
}
