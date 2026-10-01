import Link from "next/link";

const SUBNAV = [
  { href: "/inventario", label: "Resumen" },
  { href: "/inventario/productos", label: "Productos" },
  { href: "/inventario/ventas", label: "Ventas" },
  { href: "/inventario/clientes", label: "Clientes (CxC)" },
  { href: "/inventario/proveedores", label: "Proveedores (CxP)" },
  { href: "/inventario/ajustes/categorias", label: "Categorías" },
];

export default function InventarioLayout({ children }: { children: React.ReactNode }) {
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
