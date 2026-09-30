"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { parseOrThrow, setupSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { setupFirstAdmin } from "@/server/users";
import { str, toActionState, type ActionState } from "./state";

/** Solo acepta rutas internas para evitar redirecciones abiertas. */
function safeCallback(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/proyectos";
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: safeCallback(str(form, "callbackUrl")),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Correo o contraseña incorrectos.", values: { email: str(form, "email") } };
    }
    throw e; // la redirección de éxito es una excepción interna de Next.js
  }
}

export async function setupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const input = parseOrThrow(setupSchema, {
      fullName: str(form, "fullName"),
      email: str(form, "email"),
      password: str(form, "password"),
    });
    await setupFirstAdmin(input);
    await signIn("credentials", { email: input.email, password: input.password, redirectTo: "/proyectos" });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return { error: "Cuenta creada, pero no se pudo iniciar sesión. Intente en /login." };
    return toActionState(e, form);
  }
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await logActivity("logout", user);
  await signOut({ redirectTo: "/login" });
}
