import Link from "next/link";

const KINDS = [
  {
    kind: "venta",
    title: "Nueva venta",
    description: "Un ingreso por venta de productos, con su canal (Local, Domicilio, WhatsApp...).",
  },
  {
    kind: "gasto",
    title: "Nuevo gasto",
    description: "Costos, nómina, arriendo, impuestos y cualquier otro egreso del negocio.",
  },
  {
    kind: "otro",
    title: "Otro movimiento",
    description: "Ingresos no operacionales, devoluciones u otros casos que no son venta ni gasto típico.",
  },
] as const;

export default function TransactionKindChooser() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {KINDS.map((k) => (
        <Link key={k.kind} href={`/finanzas/nuevo?kind=${k.kind}`} className="card block transition-colors hover:border-verde-300">
          <h3 className="font-semibold text-verde-800">{k.title}</h3>
          <p className="mt-1 text-xs text-tierra-500">{k.description}</p>
        </Link>
      ))}
    </div>
  );
}
