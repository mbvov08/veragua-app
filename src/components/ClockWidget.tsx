"use client";

import { useState, useTransition } from "react";
import { clockIn, clockOut } from "@/lib/actions/personal";

export default function ClockWidget({
  status,
  clockInLabel,
  clockOutLabel,
  workedLabel,
}: {
  status: "none" | "in" | "done";
  clockInLabel?: string;
  clockOutLabel?: string;
  workedLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error");
      }
    });
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold text-verde-800">Mi horario de hoy</h2>

      {status === "none" && (
        <button
          disabled={isPending}
          onClick={() => handle(clockIn)}
          className="btn-primary w-full text-base py-3"
        >
          ▶ Marcar entrada
        </button>
      )}

      {status === "in" && (
        <div className="space-y-3">
          <p className="text-sm text-tierra-600">
            Entrada: <span className="font-medium text-tierra-800">{clockInLabel}</span>
          </p>
          <button
            disabled={isPending}
            onClick={() => handle(clockOut)}
            className="btn-danger w-full text-base py-3"
          >
            ■ Marcar salida
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-1">
          <p className="text-sm text-tierra-600">
            Entrada: <span className="font-medium text-tierra-800">{clockInLabel}</span>
          </p>
          <p className="text-sm text-tierra-600">
            Salida: <span className="font-medium text-tierra-800">{clockOutLabel}</span>
          </p>
          <p className="text-sm text-verde-700">
            Horas trabajadas: <span className="font-semibold">{workedLabel}</span>
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
