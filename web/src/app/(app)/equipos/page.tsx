import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { deleteEquipmentAction } from "@/app/actions/admin";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listEquipment } from "@/server/equipment";
import { EquipmentForm } from "./equipment-form";

export const metadata: Metadata = { title: "Equipos" };

export default async function EquipmentPage() {
  const items = await listEquipment();
  return (
    <>
      <PageHeader
        title="Inventario de equipos"
        description="Sonómetros de la empresa. El número de serie leído en cada memoria se busca aquí para llenar la tabla «Equipos de medición» del informe."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="grid gap-2">
            {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No hay equipos.</p>}
            {items.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <EquipmentForm item={e} />
                </div>
                <ConfirmButton
                  action={deleteEquipmentAction.bind(null, e.id)}
                  confirm={`¿Eliminar el equipo ${e.codigo || e.serial}?`}
                  size="icon-sm"
                  title="Eliminar"
                >
                  <Trash2 className="text-red-600" />
                </ConfirmButton>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Agregar equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <EquipmentForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
