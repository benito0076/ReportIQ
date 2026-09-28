import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasUsers } from "@/server/users";

export default async function Home() {
  if (await getCurrentUser()) redirect("/proyectos");
  redirect((await hasUsers()) ? "/login" : "/setup");
}
