"use client";

import { useState } from "react";

export default function EstadoPagoToggle({
  name = "estado",
  defaultValue = "pagada",
}: {
  name?: string;
  defaultValue?: "pagada" | "pendiente";
}) {
  const [estado, setEstado] = useState<"pagada" | "pendiente">(defaultValue);

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name={name} value={estado} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setEstado("pagada")}
          className={estado === "pagada" ? "btn-primary" : "btn-outline"}
        >
          Pagado
        </button>
        <button
          type="button"
          onClick={() => setEstado("pendiente")}
          className={estado === "pendiente" ? "btn-primary" : "btn-outline"}
        >
          Deuda
        </button>
      </div>
    </div>
  );
}
