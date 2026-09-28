"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <FormError message={state.error} />
          <Field label="Correo electrónico" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
          </Field>
          <Field label="Contraseña" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton className="w-full">Entrar</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
