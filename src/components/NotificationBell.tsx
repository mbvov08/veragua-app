"use client";

import { useState, useTransition } from "react";
import { dismissReminderInstance } from "@/lib/actions/reminders";

export type ReminderItem = {
  instanceId: string;
  titulo: string;
  mensaje: string | null;
  fechaLabel: string;
};

export default function NotificationBell({ items }: { items: ReminderItem[] }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = items.filter((i) => !dismissed.has(i.instanceId));

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => {
      dismissReminderInstance(id);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-verde-50"
        aria-label="Notificaciones"
      >
        <span className="text-xl">🔔</span>
        {visible.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-tierra-500 text-[10px] font-bold text-white">
            {visible.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-verde-100 bg-white shadow-lg">
            <div className="border-b border-verde-100 px-4 py-2 text-sm font-semibold text-verde-800">
              Recordatorios de hoy
            </div>
            <div className="max-h-80 overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-tierra-500">
                  No hay recordatorios pendientes.
                </p>
              ) : (
                visible.map((item) => (
                  <div key={item.instanceId} className="border-b border-verde-50 px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-tierra-800">{item.titulo}</p>
                        {item.mensaje && (
                          <p className="mt-0.5 text-xs text-tierra-500">{item.mensaje}</p>
                        )}
                      </div>
                      <button
                        disabled={isPending}
                        onClick={() => handleDismiss(item.instanceId)}
                        className="shrink-0 rounded-md bg-verde-50 px-2 py-1 text-xs font-medium text-verde-700 hover:bg-verde-100"
                      >
                        Listo
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
