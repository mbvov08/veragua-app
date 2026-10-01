import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMPANIES, type Company } from "@/lib/finanzas/queries";

// Única ruta pública de toda la app (ver src/proxy.ts) — la consume veragua-website
// para el catálogo público. Nunca debe exponer cantidades/stock ni datos internos.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyParam = (searchParams.get("company") ?? "").toUpperCase();
  if (!COMPANIES.includes(companyParam as Company)) {
    return NextResponse.json({ error: "Parámetro 'company' inválido. Usa VERAGUA o MELCOCH." }, { status: 400 });
  }
  const company = companyParam as Company;

  const categorias = await prisma.finProductCategory.findMany({
    where: { company },
    orderBy: { nombre: "asc" },
    include: {
      productos: {
        where: { activo: true, visibleEnCatalogo: true },
        orderBy: { nombre: "asc" },
        select: { nombre: true, descripcion: true, precio: true, imagenUrl: true },
      },
    },
  });

  const body = {
    categorias: categorias
      .filter((c) => c.productos.length > 0)
      .map((c) => ({ nombre: c.nombre, productos: c.productos })),
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
