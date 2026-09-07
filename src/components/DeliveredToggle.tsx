"use client";

import { useTransition } from "react";
import { toggleDelivered } from "@/lib/actions/orders";

export default function DeliveredToggle({
  orderId,
  entregado,
}: {
  orderId: string;
  entregado: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={entregado}
        disabled={isPending}
        onChange={(e) => startTransition(() => toggleDelivered(orderId, e.target.checked))}
        className="h-4 w-4 rounded border-tierra-300 text-verde-600 focus:ring-verde-400"
      />
      Entregado
    </label>
  );
}
