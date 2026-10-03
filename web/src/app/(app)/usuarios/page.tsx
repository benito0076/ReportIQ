import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { deleteUserAction } from "@/app/actions/admin";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/session";
import { listUsers } from "@/server/users";
import { NewUserForm, PasswordForm, RoleSelect } from "./user-forms";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireAdminPage();
  const list = await listUsers();
  return (
    <>
      <PageHeader title="Usuarios" description="Personas con acceso a la aplicación. Los administradores gestionan usuarios y ajustes." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="grid gap-2">
            {list.map((u) => (
              <div key={u.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="font-medium">
                    {u.fullName ?? u.email}
                    {u.id === me.id && <span className="ml-1 text-xs text-muted-foreground">(usted)</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleSelect id={u.id} role={u.role} disabled={u.id === me.id} />
                  <PasswordForm id={u.id} />
                  {u.id !== me.id && (
                    <ConfirmButton
                      action={deleteUserAction.bind(null, u.id)}
                      confirm={`¿Eliminar el acceso de ${u.email}?`}
                      size="icon-sm"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="text-peligro" />
                    </ConfirmButton>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Nuevo usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <NewUserForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
