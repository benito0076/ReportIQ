const dateFmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function formatDate(d: Date | string | null | undefined): string {
  return d ? dateFmt.format(new Date(d)) : "";
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return d ? dateTimeFmt.format(new Date(d)) : "";
}

/** Número con coma decimal, como en el informe ("57,8"). */
export function fmtNum(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals).replace(".", ",");
}
