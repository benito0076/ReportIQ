import type { Metadata } from "next";
import { Wind } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/session";

export const metadata: Metadata = { title: "Calidad del aire" };

/** Matriz en desarrollo: solo el administrador puede entrar. */
export default async function AirePage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Calidad del aire" description="Informes de calidad del aire.">
        <Badge variant="outline">En desarrollo · solo administrador</Badge>
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Wind className="size-10 text-muted-foreground" />
          <p className="font-medium">Este módulo está en construcción.</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Los usuarios normales todavía no ven esta matriz. Cuando esté lista se habilitará para todos.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
