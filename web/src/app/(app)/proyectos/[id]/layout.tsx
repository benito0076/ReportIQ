import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProjectTabs } from "./project-tabs";
import { PROJECT_TYPE_LABELS } from "@/db/enums";
import { isUuid } from "@/server/projects";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function ProjectLayout({ children, params }: LayoutProps<"/proyectos/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [project] = await db
    .select({ nombre: projects.nombre, tipo: projects.tipo, cliente: projects.cliente, codigo: projects.codigoInforme })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project) notFound();
  // Calidad del aire y vertimientos tienen su propia página (solo administradores).
  if (project.tipo === "aire") redirect(`/aire/${id}`);
  if (project.tipo === "vertimientos") redirect(`/vertimientos/${id}`);
  return (
    <>
      <Link href="/proyectos" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Proyectos
      </Link>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{project.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          {[PROJECT_TYPE_LABELS[project.tipo], project.codigo, project.cliente].filter(Boolean).join(" · ")}
        </p>
      </div>
      <ProjectTabs projectId={id} />
      <div className="mt-6">{children}</div>
    </>
  );
}
