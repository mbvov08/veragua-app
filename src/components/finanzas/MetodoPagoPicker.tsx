"use client";

import { useState } from "react";

const METODOS = [
  { value: "Efectivo", emoji: "💵" },
  { value: "Tarjeta", emoji: "💳" },
  { value: "Transferencia", emoji: "🏦" },
  { value: "Nequi", emoji: "📱" },
  { value: "Daviplata", emoji: "📲" },
  { value: "Otro", emoji: "➕" },
];

export default function MetodoPagoPicker({ name = "metodoPago" }: { name?: string }) {
  const [metodo, setMetodo] = useState("Efectivo");

  return (
    <div className="sm:col-span-2">
      <label className="label">Método de pago</label>
      <input type="hidden" name={name} value={metodo} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {METODOS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMetodo(m.value)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
              metodo === m.value
                ? "border-verde-400 bg-verde-50 text-verde-800"
                : "border-verde-100 text-tierra-600 hover:bg-verde-50/60"
            }`}
          >
            <span className="text-lg">{m.emoji}</span>
            {m.value}
          </button>
        ))}
      </div>
    </div>
  );
}
