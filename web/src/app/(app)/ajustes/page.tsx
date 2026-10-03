import type { Metadata } from "next";
import { Download, Trash2 } from "lucide-react";
import { removeTemplateAction } from "@/app/actions/admin";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { UploadButton } from "@/components/upload";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/session";
import { getSettings } from "@/server/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requireAdminPage();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plantilla del informe Word</CardTitle>
            <CardDescription>
              Si no carga una plantilla propia, se usa la incluida (estructura del informe ER-731-26). Una plantilla
              propia debe conservar los mismos encabezados de tabla: la aplicación ubica las tablas por su encabezado.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm">
              Plantilla actual: <strong>{s.plantillaNombre ?? "Plantilla incluida"}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <UploadButton target={{ kind: "plantilla" }} label={s.plantillaKey ? "Reemplazar plantilla" : "Cargar plantilla .docx"} />
              {s.plantillaKey && (
                <>
                  <a href="/api/plantilla" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    <Download /> Descargar
                  </a>
                  <ConfirmButton
                    action={removeTemplateAction}
                    confirm="¿Volver a la plantilla incluida?"
                    variant="ghost"
                  >
                    <Trash2 /> Usar la incluida
                  </ConfirmButton>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Firmas y planos</CardTitle>
            <CardDescription>
              Cuadro de control del informe Word: «Elaboró» se llena con el nombre y cargo de quien genera el informe
              (cada usuario los configura en Mi perfil); aquí se define «Autorizó» y un respaldo para «Elaboró».
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              settings={{
                elaboradoPor: s.elaboradoPor,
                elaboroNombre: s.elaboroNombre,
                elaboroCargo: s.elaboroCargo,
                autorizoNombre: s.autorizoNombre,
                autorizoCargo: s.autorizoCargo,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
