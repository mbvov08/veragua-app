"use client";

import { useSyncExternalStore } from "react";

type ContactsManager = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]>;
};

const noSubscription = () => () => {};
const getSoportadoCliente = () =>
  typeof navigator !== "undefined" && !!(navigator as unknown as { contacts?: ContactsManager }).contacts?.select;
const getSoportadoServidor = () => false;

/** Botón que solo aparece si el navegador soporta la Contact Picker API (Chrome/Android —
 * no existe en iPhone ni en Chrome de escritorio). Rellena los campos del formulario por
 * id en vez de controlar el estado, para no tener que convertir estos formularios
 * server-rendered en componentes controlados. */
export default function ImportarContactoButton({
  nombreInputId,
  telefonoInputId,
}: {
  nombreInputId: string;
  telefonoInputId?: string;
}) {
  // El soporte de esta API nunca cambia durante la vida de la página, así que no hace
  // falta una suscripción real — solo leer el valor del lado del cliente sin desajustar
  // la hidratación (el servidor siempre "ve" que no está soportado).
  const soportado = useSyncExternalStore(noSubscription, getSoportadoCliente, getSoportadoServidor);

  async function importar() {
    const contacts = (navigator as unknown as { contacts?: ContactsManager }).contacts;
    if (!contacts) return;
    try {
      const props = telefonoInputId ? ["name", "tel"] : ["name"];
      const seleccionados = await contacts.select(props, { multiple: false });
      const contacto = seleccionados[0];
      if (!contacto) return;

      const nombreInput = document.getElementById(nombreInputId) as HTMLInputElement | null;
      if (nombreInput && contacto.name?.[0]) {
        nombreInput.value = contacto.name[0];
        nombreInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (telefonoInputId && contacto.tel?.[0]) {
        const telefonoInput = document.getElementById(telefonoInputId) as HTMLInputElement | null;
        if (telefonoInput) telefonoInput.value = contacto.tel[0];
      }
    } catch {
      // el usuario canceló el selector — no hay nada que hacer
    }
  }

  if (!soportado) return null;

  return (
    <button type="button" onClick={importar} className="chip-edit inline-flex items-center gap-1">
      📇 Importar de contactos
    </button>
  );
}
