"use client";

import { useTransition } from "react";
import Link from "next/link";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly } from "@/lib/date";
import { voidTransaction } from "@/lib/actions/finanzas";
import type { FinCategory, FinChannel, FinTransaction } from "@prisma/client";

export type TransactionRow = FinTransaction & {
  categoria: FinCategory;
  canal: FinChannel | null;
};

export default function TransactionTable({ transactions }: { transactions: TransactionRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-tierra-500">No hay movimientos registrados todavía para este período.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
            <th className="py-2">Fecha</th>
            <th className="py-2">Tipo</th>
            <th className="py-2">Categoría</th>
            <th className="py-2">Canal</th>
            <th className="py-2">Descripción</th>
            <th className="py-2 text-right">Monto</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-verde-50">
              <td className="whitespace-nowrap py-2">{formatDateOnly(t.fecha)}</td>
              <td className="py-2">
                <span className={`badge ${t.tipo === "income" ? "bg-verde-100 text-verde-700" : "bg-tierra-100 text-tierra-700"}`}>
                  {t.tipo === "income" ? "Ingreso" : "Egreso"}
                </span>
              </td>
              <td className="whitespace-nowrap py-2">{t.categoria.codigo} · {t.categoria.nombre}</td>
              <td className="whitespace-nowrap py-2">{t.canal?.nombre ?? "—"}</td>
              <td className="max-w-[220px] truncate py-2">{t.descripcion ?? "—"}</td>
              <td className="whitespace-nowrap py-2 text-right">{formatCOP(t.monto)}</td>
              <td className="whitespace-nowrap py-2 text-right">
                <Link href={`/finanzas/${t.id}/editar`} className="chip-edit mr-2">
                  Editar
                </Link>
                <button
                  disabled={isPending}
                  onClick={() => startTransition(() => voidTransaction(t.id))}
                  className="chip-danger"
                >
                  Anular
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
