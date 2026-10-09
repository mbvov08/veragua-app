import TransactionForm, { type TransactionKind } from "@/components/finanzas/TransactionForm";
import TransactionKindChooser from "@/components/finanzas/TransactionKindChooser";
import { getTransactionFormData } from "@/lib/finanzas/queries";
import { prisma } from "@/lib/prisma";

const VALID_KINDS: TransactionKind[] = ["venta", "gasto", "otro"];

const TITLES: Record<TransactionKind, string> = {
  venta: "Nueva venta",
  gasto: "Nuevo gasto",
  otro: "Otro movimiento",
};

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const companies = await getTransactionFormData();
  // Para autocompletar "a quién se le paga" con nombres ya usados (evita "Sanorigen" vs "Sanorigen SAS").
  const [proveedores, previos] = await Promise.all([
    prisma.proveedor.findMany({ select: { nombre: true } }),
    prisma.finTransaction.findMany({ where: { tipo: "expense", contraparte: { not: null } }, select: { contraparte: true }, distinct: ["contraparte"], take: 300 }),
  ]);
  const sugerencias = [...new Set([...proveedores.map((p) => p.nombre), ...previos.map((p) => p.contraparte!)])].sort((a, b) => a.localeCompare(b));
  const validKind = VALID_KINDS.includes(kind as TransactionKind) ? (kind as TransactionKind) : null;

  if (!validKind) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-verde-800">Nuevo movimiento</h1>
        <TransactionKindChooser />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-semibold text-verde-800">{TITLES[validKind]}</h1>
      <div className="card">
        <TransactionForm companies={companies} kind={validKind} sugerenciasContraparte={sugerencias} />
      </div>
    </div>
  );
}
