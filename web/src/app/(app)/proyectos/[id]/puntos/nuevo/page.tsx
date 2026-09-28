import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject } from "@/server/projects";
import { PointForm } from "../point-form";

export const metadata: Metadata = { title: "Nuevo punto" };

export default async function NewPointPage({ params }: PageProps<"/proyectos/[id]/puntos/nuevo">) {
  const { id } = await params;
  await getProject(id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo punto de monitoreo</CardTitle>
      </CardHeader>
      <CardContent>
        <PointForm projectId={id} />
      </CardContent>
    </Card>
  );
}
