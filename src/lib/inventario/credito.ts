import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type AplicacionPago = {
  cuentaId: string;
  montoAplicado: number;
  montoTotalCuenta: number;
  descripcionCuenta: string;
  categoriaId?: string | null;
  /** Fracción (0–1) del monto aplicado que corresponde a mercancía perdida. */
  perdidaFraccion?: number;
};

/**
 * Reparte un pago recién creado contra las cuentas abiertas de un cliente/proveedor,
 * de la más antigua a la más nueva, hasta agotar el pago o las cuentas. Lo que sobra
 * queda como crédito disponible (pago sin aplicar del todo). Devuelve el detalle de
 * cada factura afectada, para armar una descripción legible del pago (ej. "100% Abono
 * — 2 Café 500gr"), igual al estilo que ya traían los datos históricos de Treinta.
 */
export async function repartirPagoCliente(tx: Tx, pagoId: string, clienteId: string, monto: number): Promise<AplicacionPago[]> {
  const cuentasAbiertas = await tx.finCuentaPorCobrar.findMany({
    where: { clienteId, saldo: { gt: 0 } },
    include: { venta: { include: { items: { include: { producto: true } } } } },
    orderBy: { fecha: "asc" },
  });

  const aplicaciones: AplicacionPago[] = [];
  let restante = monto;
  for (const cuenta of cuentasAbiertas) {
    if (restante <= 0) break;
    const aplicar = Math.min(restante, cuenta.saldo);
    if (aplicar <= 0) continue;
    await tx.finPagoClienteAplicacion.create({
      data: { pagoId, cuentaId: cuenta.id, montoAplicado: aplicar },
    });
    await tx.finCuentaPorCobrar.update({
      where: { id: cuenta.id },
      data: { saldo: cuenta.saldo - aplicar },
    });
    const descripcionCuenta =
      cuenta.venta && cuenta.venta.items.length > 0
        ? cuenta.venta.items.map((it) => `${it.cantidad} ${it.producto.nombre}`).join(", ")
        : cuenta.notas ?? "saldo pendiente";
    aplicaciones.push({ cuentaId: cuenta.id, montoAplicado: aplicar, montoTotalCuenta: cuenta.montoTotal, descripcionCuenta, categoriaId: cuenta.categoriaId });
    restante -= aplicar;
  }
  return aplicaciones;
}

export async function repartirPagoProveedor(tx: Tx, pagoId: string, proveedorId: string, monto: number, cuentaId?: string): Promise<AplicacionPago[]> {
  const cuentasAbiertas = await tx.finCuentaPorPagar.findMany({
    where: { proveedorId, saldo: { gt: 0 }, ...(cuentaId ? { id: cuentaId } : {}) },
    include: { purchase: { include: { items: { include: { producto: true } } } } },
    orderBy: { fecha: "asc" },
  });

  const aplicaciones: AplicacionPago[] = [];
  let restante = monto;
  for (const cuenta of cuentasAbiertas) {
    if (restante <= 0) break;
    const aplicar = Math.min(restante, cuenta.saldo);
    if (aplicar <= 0) continue;
    await tx.finPagoProveedorAplicacion.create({
      data: { pagoId, cuentaId: cuenta.id, montoAplicado: aplicar },
    });
    await tx.finCuentaPorPagar.update({
      where: { id: cuenta.id },
      data: { saldo: cuenta.saldo - aplicar },
    });
    const descripcionCuenta =
      cuenta.purchase && cuenta.purchase.items.length > 0
        ? cuenta.purchase.items.map((it) => `${it.cantidad} ${it.producto.nombre}`).join(", ")
        : cuenta.notas ?? "saldo pendiente";
    aplicaciones.push({ cuentaId: cuenta.id, montoAplicado: aplicar, montoTotalCuenta: cuenta.montoTotal, descripcionCuenta, categoriaId: cuenta.categoriaId, perdidaFraccion: cuenta.perdidaMonto ? cuenta.perdidaMonto / cuenta.montoTotal : 0 });
    restante -= aplicar;
  }
  return aplicaciones;
}

/**
 * Al crear una factura nueva, consume el crédito disponible del cliente (pagos ya
 * registrados que no alcanzaron a aplicarse del todo a ninguna cuenta), de más
 * antiguo a más nuevo, y descuenta el saldo de la cuenta nueva de una vez.
 */
export async function aplicarCreditoDisponibleCliente(tx: Tx, cuentaId: string, clienteId: string) {
  const cuenta = await tx.finCuentaPorCobrar.findUniqueOrThrow({ where: { id: cuentaId } });
  if (cuenta.saldo <= 0) return;

  const pagos = await tx.finPagoCliente.findMany({
    where: { clienteId },
    include: { aplicaciones: true },
    orderBy: { fecha: "asc" },
  });

  let saldoRestante = cuenta.saldo;
  for (const pago of pagos) {
    if (saldoRestante <= 0) break;
    const aplicadoDelPago = pago.aplicaciones.reduce((sum, a) => sum + a.montoAplicado, 0);
    const creditoDisponible = pago.monto - aplicadoDelPago;
    if (creditoDisponible <= 0) continue;
    const aplicar = Math.min(creditoDisponible, saldoRestante);
    await tx.finPagoClienteAplicacion.create({
      data: { pagoId: pago.id, cuentaId: cuenta.id, montoAplicado: aplicar },
    });
    saldoRestante -= aplicar;
  }

  if (saldoRestante !== cuenta.saldo) {
    await tx.finCuentaPorCobrar.update({ where: { id: cuenta.id }, data: { saldo: saldoRestante } });
  }
}

export async function aplicarCreditoDisponibleProveedor(tx: Tx, cuentaId: string, proveedorId: string) {
  const cuenta = await tx.finCuentaPorPagar.findUniqueOrThrow({ where: { id: cuentaId } });
  if (cuenta.saldo <= 0) return;

  const pagos = await tx.finPagoProveedor.findMany({
    where: { proveedorId },
    include: { aplicaciones: true },
    orderBy: { fecha: "asc" },
  });

  let saldoRestante = cuenta.saldo;
  for (const pago of pagos) {
    if (saldoRestante <= 0) break;
    const aplicadoDelPago = pago.aplicaciones.reduce((sum, a) => sum + a.montoAplicado, 0);
    const creditoDisponible = pago.monto - aplicadoDelPago;
    if (creditoDisponible <= 0) continue;
    const aplicar = Math.min(creditoDisponible, saldoRestante);
    await tx.finPagoProveedorAplicacion.create({
      data: { pagoId: pago.id, cuentaId: cuenta.id, montoAplicado: aplicar },
    });
    saldoRestante -= aplicar;
  }

  if (saldoRestante !== cuenta.saldo) {
    await tx.finCuentaPorPagar.update({ where: { id: cuenta.id }, data: { saldo: saldoRestante } });
  }
}

export async function creditoDisponibleCliente(clienteId: string): Promise<number> {
  const pagos = await prisma.finPagoCliente.findMany({
    where: { clienteId },
    include: { aplicaciones: true },
  });
  return pagos.reduce((sum, p) => sum + (p.monto - p.aplicaciones.reduce((s, a) => s + a.montoAplicado, 0)), 0);
}

export async function creditoDisponibleProveedor(proveedorId: string): Promise<number> {
  const pagos = await prisma.finPagoProveedor.findMany({
    where: { proveedorId },
    include: { aplicaciones: true },
  });
  return pagos.reduce((sum, p) => sum + (p.monto - p.aplicaciones.reduce((s, a) => s + a.montoAplicado, 0)), 0);
}
