import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveCompanyParam, getTransactions, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { buildTransactionsWorkbook } from "@/lib/finanzas/excel";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const selection = resolveCompanyParam(searchParams.get("company") ?? undefined);

  const perCompany = await Promise.all(
    selection.targets.map(async (c) => {
      const rows = await getTransactions({ company: c });
      return rows.map((r) => ({ ...r, companyLabel: selection.isConsolidated ? COMPANY_LABEL[c] : undefined }));
    })
  );
  const rows = perCompany.flat().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const buffer = await buildTransactionsWorkbook(rows);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="movimientos.xlsx"`,
    },
  });
}
