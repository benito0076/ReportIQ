import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasUsers } from "@/server/users";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Configuración inicial" };

export default async function SetupPage() {
  await connection(); // depende de la base de datos: se renderiza en cada petición
  if (await hasUsers()) redirect("/login");
  return <SetupForm />;
}
