"use client";

import { useActionState, useState, useTransition } from "react";
import { createUserAction, resetPasswordAction, setRoleAction, updateUserProfileAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/db/enums";
import { ProfileForm } from "../perfil/profile-form";

export function NewUserForm() {
  const [state, action] = useActionState<ActionState, FormData>(createUserAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3">
      <FormError message={state.error} />
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      <Field label="Nombre" htmlFor="fullName" error={fe.fullName}>
        <Input id="fullName" name="fullName" defaultValue={state.values?.fullName} />
      </Field>
      <Field label="Cargo" htmlFor="cargo" error={fe.cargo} hint="Firma «Elaboró» junto al nombre.">
        <Input id="cargo" name="cargo" defaultValue={state.values?.cargo} />
      </Field>
      <Field label="Correo electrónico" htmlFor="email" required error={fe.email}>
        <Input id="email" name="email" type="email" required defaultValue={state.values?.email} />
      </Field>
      <Field label="Contraseña inicial" htmlFor="password" required error={fe.password} hint="Mínimo 10 caracteres.">
        <Input id="password" name="password" type="text" autoComplete="off" required minLength={10} />
      </Field>
      <Field label="Rol" htmlFor="role">
        <select id="role" name="role" className={selectClass} defaultValue={state.values?.role ?? "user"}>
          <option value="user">Usuario</option>
          <option value="admin">Administrador</option>
        </select>
      </Field>
      <SubmitButton>Crear usuario</SubmitButton>
    </form>
  );
}

export function RoleSelect({ id, role, disabled }: { id: string; role: UserRole; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Rol"
      className={`${selectClass} h-7 w-36`}
      defaultValue={role}
      disabled={disabled || pending}
      onChange={(e) => {
        const value = e.target.value as UserRole;
        start(async () => {
          const res = await setRoleAction(id, value);
          if (res.error) window.alert(res.error);
        });
      }}
    >
      <option value="user">Usuario</option>
      <option value="admin">Administrador</option>
    </select>
  );
}

export function PasswordForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction.bind(null, id), {});
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cambiar contraseña
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <Input name="password" type="text" autoComplete="off" placeholder="Nueva contraseña" minLength={10} required className="h-7 w-44" />
      <SubmitButton size="sm">Guardar</SubmitButton>
      <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
        Cerrar
      </Button>
      {state.error && <p className="w-full text-xs text-peligro">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-exito">{state.message}</p>}
    </form>
  );
}

/** Nombre y cargo de otro usuario (firma «Elaboró»). */
export function EditProfile({ id, fullName, cargo }: { id: string; fullName: string; cargo: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Nombre y cargo
      </Button>
    );
  }
  return (
    <div className="grid w-full gap-2 rounded-lg border bg-muted/30 p-3">
      <ProfileForm action={updateUserProfileAction.bind(null, id)} values={{ fullName, cargo }} idPrefijo={`${id}-`} />
      <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setOpen(false)}>
        Cerrar
      </Button>
    </div>
  );
}
