import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removePhotoAction } from "@/app/actions/projects";
import { ConfirmButton } from "@/components/confirm-button";
import { Notice } from "@/components/notice";
import { UploadButton } from "@/components/upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppError } from "@/lib/errors";
import { getPoint } from "@/server/projects";
import { PointForm } from "../point-form";

export const metadata: Metadata = { title: "Punto de monitoreo" };

export default async function PointPage({ params, searchParams }: PageProps<"/proyectos/[id]/puntos/[pointId]">) {
  const { id, pointId } = await params;
  const { creado } = await searchParams;
  const point = await getPoint(id, pointId).catch((e) => {
    if (isAppError(e) && e.status === 404) notFound();
    throw e;
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>
            Punto {point.orden}: {point.nombre}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {creado && <Notice tone="success">Punto creado. Puede agregarle una foto a la derecha.</Notice>}
          <PointForm projectId={id} point={point} />
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Foto del punto</CardTitle>
          <CardDescription>Aparece en la tarjeta de descripción del punto en el informe.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {point.fotoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/proyectos/${id}/puntos/${point.id}/foto?v=${encodeURIComponent(point.fotoKey)}`}
              alt={`Foto del punto ${point.nombre}`}
              className="w-full rounded-lg border object-cover"
            />
          ) : (
            <div className="flex aspect-4/3 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Sin foto
            </div>
          )}
          <div className="flex gap-2">
            <UploadButton
              target={{ kind: "foto", projectId: id, pointId: point.id }}
              label={point.fotoKey ? "Cambiar foto" : "Subir foto"}
            />
            {point.fotoKey && (
              <ConfirmButton action={removePhotoAction.bind(null, id, point.id)} confirm="¿Quitar la foto del punto?" variant="ghost">
                <Trash2 /> Quitar
              </ConfirmButton>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
