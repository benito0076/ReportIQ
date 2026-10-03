import type { Metadata } from "next";
import { updateMyProfileAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/server/settings";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PerfilPage() {
  const user = await requireUser();
  const s = await getSettings();
  const respaldo = [s.elaboroNombre, s.elaboroCargo].filter(Boolean).join(" · ");
  return (
    <>
      <PageHeader title="Mi perfil" description={user.email} />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Firma «Elaboró» de los informes</CardTitle>
          <CardDescription>
            Los informes Word que usted genere (ruido, calidad del aire y vertimientos) llevan este nombre y cargo en
            «Elaboró» del cuadro de control. «Autorizó» lo configura el administrador en Ajustes.
            {!user.fullName?.trim() &&
              (respaldo
                ? ` Mientras no escriba su nombre se usa el de Ajustes: ${respaldo}.`
                : " Mientras no escriba su nombre se deja el de la plantilla.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm action={updateMyProfileAction} values={{ fullName: user.fullName ?? "", cargo: user.cargo }} />
        </CardContent>
      </Card>
    </>
  );
}
