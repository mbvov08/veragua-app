import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShortEs } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slipId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { slipId } = await params;
  const slip = await prisma.payrollSlip.findUnique({
    where: { id: slipId },
    include: { user: { include: { employeeProfile: true } } },
  });
  if (!slip) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const detalle = JSON.parse(slip.detalleJson) as { advertencias?: string[] };

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, "Comprobante de nómina quincenal");

    doc.font("Helvetica-Bold").fontSize(14).fillColor(BRAND.verdeHeader).text(slip.user.name, 50, doc.y);
    if (slip.user.employeeProfile?.cedula) {
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(`CC ${slip.user.employeeProfile.cedula}`);
    }
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(
      `Periodo: ${formatDateShortEs(slip.periodStart)} — ${formatDateShortEs(slip.periodEnd)}`
    );
    doc.moveDown(1);

    drawSectionTitle(doc, "Devengado");
    drawRow(doc, "Salario base (quincena)", COP.format(slip.salarioBase / 2));
    if (slip.horasExtraDiu > 0) {
      drawRow(doc, `Horas extra diurnas (${slip.horasExtraDiu.toFixed(2)} h)`, COP.format(slip.valorExtraDiu));
    }
    if (slip.horasExtraNoc > 0) {
      drawRow(doc, `Horas extra nocturnas (${slip.horasExtraNoc.toFixed(2)} h)`, COP.format(slip.valorExtraNoc));
    }
    if (slip.extraFijo > 0) {
      drawRow(doc, slip.extraFijoLabel ?? "Extra", COP.format(slip.extraFijo));
    }
    drawRow(doc, "Auxilio de transporte", COP.format(slip.auxTransporte));
    drawRow(doc, "Total devengado", COP.format(slip.totalDevengado), { bold: true });

    drawSectionTitle(doc, "Deducciones");
    drawRow(doc, "Salud (4%)", `- ${COP.format(slip.saludDeduccion)}`);
    drawRow(doc, "Pensión (4%)", `- ${COP.format(slip.pensionDeduccion)}`);
    drawRow(doc, "Total deducciones", `- ${COP.format(slip.totalDeducciones)}`, { bold: true });

    if (slip.descuentoFaltante > 0) {
      drawSectionTitle(doc, "Descuento por faltante (autorizado en contrato)");
      drawRow(doc, slip.descuentoFaltanteConcepto ?? "Faltante", `- ${COP.format(slip.descuentoFaltante)}`);
    }

    drawSectionTitle(doc, "Neto a pagar");
    drawRow(doc, "Total", COP.format(slip.netoPagar), { bold: true, color: BRAND.verdeHeader });

    if (slip.horasExtraDiu + slip.horasExtraNoc > 0) {
      drawSectionTitle(doc, "Horas extra según autoevaluación");
      drawRow(doc, "Justificadas", `${slip.horasJustificadas.toFixed(2)} h`);
      drawRow(doc, "No justificadas", `${slip.horasNoJustificadas.toFixed(2)} h`);
    }

    if (detalle.advertencias && detalle.advertencias.length > 0) {
      drawSectionTitle(doc, "Advertencias");
      for (const a of detalle.advertencias) {
        doc.font("Helvetica").fontSize(9).fillColor(BRAND.grisTexto).text(`• ${a}`, 50, doc.y, {
          width: doc.page.width - 100,
        });
        doc.moveDown(0.3);
      }
    }

    drawFooter(
      doc,
      "Cálculo automático de referencia según la Ley 2101 y la normativa vigente. Verifica los valores con tu contador antes de pagar."
    );
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nomina_${slip.user.name.replace(/\s+/g, "_")}_${formatDateShortEs(slip.periodStart).replace(/\//g, "-")}.pdf"`,
    },
  });
}
