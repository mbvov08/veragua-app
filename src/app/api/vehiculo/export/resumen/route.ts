import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { computeResumenMensual } from "@/lib/vehiculo/resumen";
import { todayColombia } from "@/lib/date";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  let year: number;
  let monthIndex: number;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    monthIndex = m - 1;
  } else {
    const today = todayColombia();
    year = today.getUTCFullYear();
    monthIndex = today.getUTCMonth();
  }

  const filas = await computeResumenMensual(year, monthIndex);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Resumen Vehículo");
  sheet.columns = [
    { header: "Conductor", key: "conductor", width: 24 },
    { header: "Rutas completadas", key: "rutas", width: 16 },
    { header: "Monto a pagar", key: "montoAPagar", width: 16 },
    { header: "Días alquiler", key: "dias", width: 14 },
    { header: "Monto a cobrar", key: "montoACobrar", width: 16 },
    { header: "Gastos combustible/peajes", key: "gastos", width: 22 },
    { header: "Daños pendientes", key: "danosPendiente", width: 16 },
    { header: "Daños descontados", key: "danosDescontado", width: 16 },
    { header: "Daños pagados", key: "danosPagado", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const f of filas) {
    sheet.addRow({
      conductor: f.conductorNombre,
      rutas: f.rutasCompletadas,
      montoAPagar: f.montoAPagar,
      dias: f.diasAlquiler,
      montoACobrar: f.montoACobrar,
      gastos: f.gastosCombustiblePeajes,
      danosPendiente: f.danosPendiente,
      danosDescontado: f.danosDescontado,
      danosPagado: f.danosPagado,
    });
  }
  for (const key of ["montoAPagar", "montoACobrar", "gastos", "danosPendiente", "danosDescontado", "danosPagado"]) {
    sheet.getColumn(key).numFmt = "#,##0";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const monthValue = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vehiculo_resumen_${monthValue}.xlsx"`,
    },
  });
}
