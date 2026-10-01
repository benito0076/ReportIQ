import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Volume2, Wind } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { matricesVisibles } from "@/lib/matrices";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Inicio" };

const ICONOS = { ruido: Volume2, aire: Wind };

export default async function InicioPage() {
  const user = await requireUser();
  const matrices = matricesVisibles(user.role);
  return (
    <>
      <PageHeader title="¿Con qué matriz va a trabajar?" description="Seleccione el tipo de informe." />
      <div className="grid gap-4 sm:grid-cols-2">
        {matrices.map((m) => {
          const Icono = ICONOS[m.clave];
          return (
            <Link key={m.clave} href={m.href} className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <Card className="h-full transition-colors group-hover:border-primary/60 group-hover:bg-muted/40">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icono className="size-6" />
                    </span>
                    {m.soloAdmin && <Badge variant="outline">En desarrollo · solo administrador</Badge>}
                  </div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {m.titulo}
                    <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription>{m.descripcion}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
