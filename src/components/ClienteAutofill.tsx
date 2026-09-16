"use client";

import { useEffect } from "react";

type Cliente = { nombre: string; direccion: string; telefono: string | null; zona: string };

export default function ClienteAutofill({ clientes }: { clientes: Cliente[] }) {
  useEffect(() => {
    const clienteInput = document.getElementById("cliente") as HTMLInputElement | null;
    const direccionInput = document.getElementById("direccion") as HTMLInputElement | null;
    const telefonoInput = document.getElementById("telefono") as HTMLInputElement | null;
    const zonaSelect = document.getElementById("zona") as HTMLSelectElement | null;
    if (!clienteInput) return;

    const porNombre = new Map(clientes.map((c) => [c.nombre.trim().toLowerCase(), c]));

    function autocompletar() {
      const match = porNombre.get(clienteInput!.value.trim().toLowerCase());
      if (!match) return;
      if (direccionInput && !direccionInput.value) direccionInput.value = match.direccion;
      if (telefonoInput && !telefonoInput.value) telefonoInput.value = match.telefono ?? "";
      if (zonaSelect) zonaSelect.value = match.zona;
    }

    clienteInput.addEventListener("change", autocompletar);
    clienteInput.addEventListener("blur", autocompletar);
    return () => {
      clienteInput.removeEventListener("change", autocompletar);
      clienteInput.removeEventListener("blur", autocompletar);
    };
  }, [clientes]);

  return (
    <datalist id="clientes-existentes">
      {clientes.map((c) => (
        <option key={c.nombre} value={c.nombre} />
      ))}
    </datalist>
  );
}
