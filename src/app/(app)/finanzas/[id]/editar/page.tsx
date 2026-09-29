import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTransactionFormData, COMPANY_LABEL } from "@/lib/finanzas/queries";
import TransactionForm from "@/components/finanzas/TransactionForm";

export default async function EditarMovimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [transaction, companies] = await Promise.all([
    prisma.finTransaction.findUnique({ where: { id } }),
    getTransactionFormData(),
  ]);

  if (!transaction) notFound();

  const companyData = companies.find((c) => c.company === transaction.company);
  if (!companyData) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-semibold text-verde-800">
        Editar movimiento — {COMPANY_LABEL[companyData.company]}
      </h1>
      <div className="card">
        <TransactionForm companies={[companyData]} kind="otro" transaction={transaction} />
      </div>
    </div>
  );
}
