"use client";

import { useActionState } from "react";
import { setupAction } from "@/app/actions/auth";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SetupForm() {
  const [state, action] = useActionState<ActionState, FormData>(setupAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración inicial</CardTitle>
        <CardDescription>
          Cree la cuenta de administrador. Después podrá agregar a los demás usuarios desde el menú Usuarios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <FormError message={state.error} />
          <Field label="Nombre" htmlFor="fullName" error={fe.fullName}>
            <Input id="fullName" name="fullName" autoComplete="name" defaultValue={state.values?.fullName} />
          </Field>
          <Field label="Correo electrónico" htmlFor="email" required error={fe.email}>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
          </Field>
          <Field label="Contraseña" htmlFor="password" required error={fe.password} hint="Mínimo 10 caracteres.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <SubmitButton className="w-full">Crear administrador</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
