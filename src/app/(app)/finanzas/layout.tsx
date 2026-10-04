import Link from "next/link";

const SUBNAV = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/movimientos", label: "Movimientos" },
  { href: "/finanzas/pyg", label: "PyG" },
  { href: "/finanzas/canales", label: "Canales" },
  { href: "/inventario/clientes", label: "Cuentas por Cobrar" },
  { href: "/inventario/proveedores", label: "Cuentas por Pagar" },
  { href: "/finanzas/ajustes/categorias", label: "Categorías" },
  { href: "/finanzas/ajustes/canales", label: "Canales de venta" },
];

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b border-verde-100 pb-2">
        {SUBNAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-1 text-xs font-medium text-tierra-600 hover:bg-verde-50 hover:text-verde-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
