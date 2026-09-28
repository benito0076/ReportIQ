"use client";

import { useActionState } from "react";
import { createEquipmentAction, updateEquipmentAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/state";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import type { Equipment } from "@/db/schema";

export function EquipmentForm({ item }: { item?: Equipment }) {
  const action = item ? updateEquipmentAction.bind(null, item.id) : createEquipmentAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? item ?? { nombre: "", codigo: "", serial: "" };
  const inline = !!item;
  return (
    <form
      action={formAction}
      className={inline ? "grid items-end gap-2 sm:grid-cols-[1fr_110px_130px_auto]" : "grid gap-3"}
    >
      {state.error && (
        <div className={inline ? "sm:col-span-4" : ""}>
          <FormError message={state.error} />
        </div>
      )}
      <Field label="Nombre" htmlFor={`nombre-${item?.id ?? "nuevo"}`} error={fe.nombre}>
        <Input id={`nombre-${item?.id ?? "nuevo"}`} name="nombre" required defaultValue={v.nombre} />
      </Field>
      <Field label="Código" htmlFor={`codigo-${item?.id ?? "nuevo"}`} error={fe.codigo}>
        <Input id={`codigo-${item?.id ?? "nuevo"}`} name="codigo" defaultValue={v.codigo} />
      </Field>
      <Field label="Serial" htmlFor={`serial-${item?.id ?? "nuevo"}`} error={fe.serial}>
        <Input id={`serial-${item?.id ?? "nuevo"}`} name="serial" required defaultValue={v.serial} />
      </Field>
      <div>
        <SubmitButton size={inline ? "sm" : "default"} variant={inline ? "outline" : "default"}>
          {inline ? (state.ok ? "Guardado ✓" : "Guardar") : "Agregar"}
        </SubmitButton>
      </div>
    </form>
  );
}
