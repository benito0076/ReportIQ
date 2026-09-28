import { isAppError } from "@/lib/errors";

export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Valores enviados, para volver a llenar el formulario si hay un error. */
  values?: Record<string, string>;
}

export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string" && !k.startsWith("$") && k !== "password") out[k] = v;
  }
  return out;
}

/** Convierte un error de negocio en estado de formulario; relanza los inesperados. */
export function toActionState(e: unknown, form?: FormData): ActionState {
  if (!isAppError(e)) throw e;
  return { error: e.message, fieldErrors: e.fieldErrors, values: form ? formValues(form) : undefined };
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}
