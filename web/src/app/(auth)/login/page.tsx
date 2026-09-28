import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasUsers } from "@/server/users";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection(); // depende de la base de datos: se renderiza en cada petición
  if (!(await hasUsers())) redirect("/setup");
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/proyectos"} />;
}
