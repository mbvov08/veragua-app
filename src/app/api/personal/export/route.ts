import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  computeWorkedHours,
  dateOnlyToUTC,
  dayOfWeek,
  formatDateOnly,
  formatTimeCo,
} from "@/lib/date";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ? dateOnlyToUTC(searchParams.get("from")!) : addDays(new Date(), -30);
  const to = searchParams.get("to") ? dateOnlyToUTC(searchParams.get("to")!) : new Date();
  const userId = searchParams.get("userId") || undefined;

  const [entries, settings] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { workDate: { gte: from, lte: to }, ...(userId ? { userId } : {}) },
      include: { user: true },
      orderBy: [{ userId: "asc" }, { workDate: "asc" }],
    }),
    prisma.payrollSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  const horasSemanaLegal = settings?.horasSemanaLegal ?? 42;

  const weekTotals = new Map<string, number>();
  for (const e of entries) {
    if (!e.clockOut) continue;
    const dow = dayOfWeek(e.workDate);
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(e.workDate, mondayOffset);
    const key = `${e.userId}-${weekStart.toISOString()}`;
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + computeWorkedHours(e.clockIn, e.clockOut, dow));
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Control de personal");
  sheet.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Empleado(a)", key: "nombre", width: 20 },
    { header: "Entrada", key: "entrada", width: 12 },
    { header: "Salida", key: "salida", width: 12 },
    { header: "Horas trabajadas", key: "horas", width: 16 },
    { header: "Semana con horas extra (> " + horasSemanaLegal + "h)", key: "extra", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const e of entries) {
    const dow = dayOfWeek(e.workDate);
    const worked = e.clockOut ? computeWorkedHours(e.clockIn, e.clockOut, dow) : null;
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const weekStart = addDays(e.workDate, mondayOffset);
    const weekTotal = weekTotals.get(`${e.userId}-${weekStart.toISOString()}`) ?? 0;
    sheet.addRow({
      fecha: formatDateOnly(e.workDate),
      nombre: e.user.name,
      entrada: formatTimeCo(e.clockIn),
      salida: e.clockOut ? formatTimeCo(e.clockOut) : "",
      horas: worked !== null ? Number(worked.toFixed(2)) : "",
      extra: worked !== null && weekTotal > horasSemanaLegal ? "Sí" : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="control_personal_${formatDateOnly(from)}_a_${formatDateOnly(to)}.xlsx"`,
    },
  });
}
