"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireFinanzas } from "@/lib/actions/finanzas";
import { parseCompany, parsePurchaseItems, findDefaultCategory } from "@/lib/inventario/shared";
import { repartirPagoProveedor, aplicarCreditoDisponibleProveedor, type AplicacionPago } from "@/lib/inventario/credito";

/** Mismo formato que describirAbono() en inventario-ventas.ts, para pagos a proveedores. */
function describirAbono(aplicaciones: AplicacionPago[], montoTotal: number): string {
  if (aplicaciones.length === 0) return "Pago a proveedor (crédito a favor, sin factura pendiente que cubrir)";
  const partes = aplicaciones.map((a) => {
    const pct = Math.round((a.montoAplicado / a.montoTotalCuenta) * 100);
    return `${pct}% Abono — ${a.descripcionCuenta}`;
  });
  const aplicado = aplicaciones.reduce((s, a) => s + a.montoAplicado, 0);
  if (aplicado < montoTotal) partes.push("resto queda como crédito a favor");
  return partes.join("; ");
}

function revalidateProveedores() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/proveedores");
  revalidatePath("/inventario/cuentas-por-pagar");
}

export async function upsertProveedor(nombre: string, telefono?: string | null, contacto?: string | null) {
  return prisma.proveedor.upsert({
    where: { nombre },
    update: { telefono: telefono || undefined, contacto: contacto || undefined },
    create: { nombre, telefono: telefono || null, contacto: contacto || null },
  });
}

function parseTipoProveedor(raw: FormDataEntryValue | null): string {
  const tipo = String(raw ?? "insumos");
  return tipo === "financiero" ? "financiero" : "insumos";
}

export async function crearProveedor(formData: FormData) {
  await requireFinanzas();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const contacto = String(formData.get("contacto") ?? "").trim() || null;
  const tipo = parseTipoProveedor(formData.get("tipo"));
  if (!nombre) throw new Error("El nombre del proveedor es obligatorio.");

  const existing = await prisma.proveedor.findUnique({ where: { nombre } });
  if (existing) throw new Error("Ya existe un proveedor con ese nombre.");

  await prisma.proveedor.create({ data: { nombre, telefono, contacto, tipo } });
  revalidateProveedores();
}

export async function editarProveedor(proveedorId: string, formData: FormData) {
  await requireFinanzas();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const contacto = String(formData.get("contacto") ?? "").trim() || null;
  const tipo = parseTipoProveedor(formData.get("tipo"));
  if (!nombre) throw new Error("El nombre del proveedor es obligatorio.");

  const existing = await prisma.proveedor.findUnique({ where: { nombre } });
  if (existing && existing.id !== proveedorId) throw new Error("Ya existe otro proveedor con ese nombre.");

  await prisma.proveedor.update({ where: { id: proveedorId }, data: { nombre, telefono, contacto, tipo } });
  revalidateProveedores();
}

export async function registrarCompra(formData: FormData) {
  const session = await requireFinanzas();

  const company = parseCompany(formData.get("company"));
  const proveedorId = String(formData.get("proveedorId") ?? "");
  const fechaStr = String(formData.get("fecha") ?? "");
  const numeroFactura = String(formData.get("numeroFactura") ?? "").trim() || null;
  const estado = String(formData.get("estado") ?? "pendiente");
  const recibido = formData.get("recibido") === "on";
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const items = parsePurchaseItems(formData);

  if (!proveedorId) throw new Error("Selecciona un proveedor.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (estado !== "pagada" && estado !== "pendiente") throw new Error("Estado inválido.");
  if (items.length === 0) throw new Error("Agrega al menos un producto a la compra.");

  const fecha = dateOnlyToUTC(fechaStr);
  const total = items.reduce((sum, it) => sum + it.cantidad * it.costoUnitario, 0);

  await prisma.$transaction(async (tx) => {
    let finTransactionId: string | null = null;
    if (estado === "pagada") {
      const categoria = await findDefaultCategory(company, "6135");
      const proveedor = await tx.proveedor.findUniqueOrThrow({ where: { id: proveedorId } });
      const transaction = await tx.finTransaction.create({
        data: {
          company,
          tipo: "expense",
          fecha,
          monto: total,
          categoriaId: categoria.id,
          contraparte: proveedor.nombre,
          descripcion: numeroFactura ? `Compra factura ${numeroFactura}` : "Compra de inventario",
          fuente: "manual",
          creadoPorId: session.user.id,
        },
      });
      finTransactionId = transaction.id;
    }

    const purchase = await tx.finPurchase.create({
      data: {
        company,
        proveedorId,
        fecha,
        numeroFactura,
        estado,
        recibido,
        fechaRecibido: recibido ? fecha : null,
        total,
        notas,
        finTransactionId,
        creadoPorId: session.user.id,
        items: { create: items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad, costoUnitario: it.costoUnitario })) },
      },
    });

    if (estado === "pendiente") {
      const cuenta = await tx.finCuentaPorPagar.create({
        data: {
          company,
          proveedorId,
          purchaseId: purchase.id,
          fecha,
          montoTotal: total,
          saldo: total,
          creadoPorId: session.user.id,
        },
      });
      await aplicarCreditoDisponibleProveedor(tx, cuenta.id, proveedorId);
    }
  }, { maxWait: 10000, timeout: 20000 });

  revalidateProveedores();
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/movimientos");
  revalidatePath("/finanzas/pyg");
  revalidatePath("/finanzas/canales");
}

export async function registrarPagoProveedor(formData: FormData) {
  const session = await requireFinanzas();

  const proveedorId = String(formData.get("proveedorId") ?? "");
  const company = parseCompany(formData.get("company"));
  const monto = Number(formData.get("monto"));
  const fechaStr = String(formData.get("fecha") ?? "");
  const metodoPago = String(formData.get("metodoPago") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!proveedorId) throw new Error("Selecciona un proveedor.");
  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (!(monto > 0)) throw new Error("El monto debe ser mayor a cero.");

  const fecha = dateOnlyToUTC(fechaStr);

  await prisma.$transaction(async (tx) => {
    const categoria = await findDefaultCategory(company, "6135");
    const proveedor = await tx.proveedor.findUniqueOrThrow({ where: { id: proveedorId } });

    const transaction = await tx.finTransaction.create({
      data: {
        company,
        tipo: "expense",
        fecha,
        monto,
        categoriaId: categoria.id,
        contraparte: proveedor.nombre,
        metodoPago,
        descripcion: "Pago a proveedor",
        fuente: "manual",
        creadoPorId: session.user.id,
      },
    });

    const pago = await tx.finPagoProveedor.create({
      data: {
        proveedorId,
        monto,
        fecha,
        metodoPago,
        notas,
        finTransactionId: transaction.id,
        creadoPorId: session.user.id,
      },
    });

    const aplicaciones = await repartirPagoProveedor(tx, pago.id, proveedorId, monto);
    // Cada deuda se paga en la categoría de su gasto (arriendo, pérdida de inventario...) y
    // las compras de mercancía en 6135. Si un mismo pago cubre varias categorías, se parte
    // en un gasto por categoría: el más grande queda ligado al pago y los otros lo referencian.
    const porCategoria = new Map<string, number>();
    for (const a of aplicaciones) {
      const perdida = a.montoAplicado * (a.perdidaFraccion ?? 0);
      if (perdida > 0) {
        porCategoria.set("perdida-inventario", (porCategoria.get("perdida-inventario") ?? 0) + perdida);
      }
      const clave = a.categoriaId ?? categoria.id;
      porCategoria.set(clave, (porCategoria.get(clave) ?? 0) + a.montoAplicado - perdida);
    }
    const aplicado = aplicaciones.reduce((s, a) => s + a.montoAplicado, 0);
    if (monto > aplicado) porCategoria.set(categoria.id, (porCategoria.get(categoria.id) ?? 0) + (monto - aplicado));
    const grupos = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
    const descripcion = describirAbono(aplicaciones, monto);
    await tx.finTransaction.update({
      where: { id: transaction.id },
      data: { descripcion, monto: grupos[0][1], categoriaId: grupos[0][0] },
    });
    if (grupos.length > 1) {
      const nombres = new Map((await tx.finCategory.findMany({ where: { id: { in: grupos.map((g) => g[0]) } } })).map((c) => [c.id, c.nombre]));
      for (const [categoriaId, montoGrupo] of grupos.slice(1)) {
        await tx.finTransaction.create({
          data: {
            company, tipo: "expense", fecha, monto: montoGrupo, categoriaId, contraparte: proveedor.nombre, metodoPago,
            descripcion: `${descripcion} · ${nombres.get(categoriaId) ?? "otra categoría"}`,
            fuente: "manual", extraDePagoId: pago.id, creadoPorId: session.user.id,
          },
        });
      }
    }
  }, { maxWait: 10000, timeout: 20000 });

  revalidateProveedores();
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/movimientos");
  revalidatePath("/finanzas/pyg");
}

export async function marcarCompraRecibida(purchaseId: string) {
  await requireFinanzas();
  await prisma.finPurchase.update({
    where: { id: purchaseId },
    data: { recibido: true, fechaRecibido: new Date() },
  });
  revalidateProveedores();
  revalidatePath("/inventario/productos");
  revalidatePath("/inventario/reabastecimiento");
}
