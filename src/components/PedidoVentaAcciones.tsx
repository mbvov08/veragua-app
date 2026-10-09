import Link from "next/link";
import type { InfoVentaPedido } from "@/lib/pedidos/inventario";

const EMPRESA_LABEL: Record<string, string> = { VERAGUA: "Veragua", MELCOCH: "Melcoch" };

/** Acción de venta/inventario de un pedido: "Crear venta" (una por empresa si el pedido
 * mezcla Veragua y Melcoch), la marca de "venta registrada", o el aviso de que una
 * suscripción descuenta el stock sola al entregarse. */
export default function PedidoVentaAcciones({
  orderId,
  entregado,
  info,
}: {
  orderId: string;
  entregado: boolean;
  info: InfoVentaPedido | undefined;
}) {
  if (!info) return null;

  if (info.suscripcion) {
    return (
      <span className="badge bg-dorado-100 text-tierra-700">
        Suscripción · {entregado ? "stock descontado ✓" : "descuenta stock al entregar"}
      </span>
    );
  }

  const varias = info.empresas.length > 1;
  return (
    <>
      {info.empresas.map((e) =>
        e.yaVendida ? (
          <span key={e.company} className="badge bg-verde-100 text-verde-700">
            Venta{varias ? ` ${EMPRESA_LABEL[e.company]}` : ""} registrada ✓
          </span>
        ) : (
          <Link
            key={e.company}
            href={`/inventario/ventas?company=${e.company}&pedidoId=${orderId}`}
            className="chip-edit"
          >
            Crear venta{varias ? ` ${EMPRESA_LABEL[e.company]}` : ""}
          </Link>
        )
      )}
    </>
  );
}
