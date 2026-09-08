"use client";

import { useTransition } from "react";
import { marcarComprado } from "@/lib/actions/compras";

export default function CompradoToggle({ id, comprado }: { id: string; comprado: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        defaultChecked={comprado}
        disabled={isPending}
        onChange={(e) => startTransition(() => marcarComprado(id, e.target.checked))}
        className="h-4 w-4 rounded border-tierra-300 text-verde-600 focus:ring-verde-400"
      />
      Comprado
    </label>
  );
}
