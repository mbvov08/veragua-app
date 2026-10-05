// Set mínimo de iconos de línea, dibujados a mano (sin dependencia externa) para
// usarlos en la barra lateral y en las tarjetas de cuentas por cobrar/pagar.
export type IconName =
  | "menu"
  | "x"
  | "home"
  | "finanzas"
  | "inventario"
  | "personal"
  | "nomina"
  | "pedidos"
  | "produccion"
  | "melcoch"
  | "tareas"
  | "compras"
  | "calendario"
  | "recordatorios"
  | "usuarios"
  | "logout"
  | "chevron-right"
  | "receipt"
  | "download"
  | "venta"
  | "movimientos"
  | "caja"
  | "reabastecimiento"
  | "estadisticas"
  | "canales"
  | "tag";

const PATHS: Record<IconName, React.ReactNode> = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  finanzas: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  inventario: (
    <>
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 7.5V16l9 4.5 9-4.5V7.5" />
      <path d="M12 12v8.5" />
    </>
  ),
  personal: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M16.2 14.2c2.6.4 4.6 2.5 4.8 5.8" />
    </>
  ),
  nomina: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9h0M17.5 15h0" strokeLinecap="round" />
    </>
  ),
  pedidos: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  produccion: (
    <>
      <path d="M12 21c3.5 0 6-2.9 6-7 0-4.2-3-8.3-6-10.5C9 5.7 6 9.8 6 14c0 4.1 2.5 7 6 7Z" />
    </>
  ),
  melcoch: (
    <>
      <rect x="4" y="9" width="16" height="7" rx="3.5" />
      <path d="M8 9V7.5a1.5 1.5 0 0 1 3 0M13 9V7.5a1.5 1.5 0 0 1 3 0" />
    </>
  ),
  tareas: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="m8.5 12.5 2.3 2.3L16 9.6" />
    </>
  ),
  compras: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  calendario: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  recordatorios: <path d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.5 1.5 5.5h-13S7 14 7 10Z M10 18a2 2 0 0 0 4 0" />,
  usuarios: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.6 3-6.5 7-6.5s7 2.9 7 6.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M14 15.5 18.5 11 14 6.5M18.5 11h-10" />
    </>
  ),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  receipt: (
    <>
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  venta: (
    <>
      <circle cx="8" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20.5 8H6" />
    </>
  ),
  movimientos: (
    <>
      <path d="M4 7h13M17 7l-3-3M17 7l-3 3" />
      <path d="M20 17H7M7 17l3-3M7 17l3 3" />
    </>
  ),
  caja: (
    <>
      <rect x="3" y="10" width="18" height="10" rx="1.5" />
      <path d="M3 10 6 4h12l3 6" />
      <path d="M10 15h4" />
    </>
  ),
  reabastecimiento: (
    <>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 16" />
      <path d="M4 20v-4h4" />
    </>
  ),
  estadisticas: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>
  ),
  canales: (
    <>
      <circle cx="6" cy="12" r="2.3" />
      <circle cx="18" cy="6" r="2.3" />
      <circle cx="18" cy="18" r="2.3" />
      <path d="m8 11 8-3.5M8 13l8 3.5" />
    </>
  ),
  tag: (
    <>
      <path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5a1.5 1.5 0 0 0 .44 1.06l9 9a1.5 1.5 0 0 0 2.12 0l6.5-6.5a1.5 1.5 0 0 0 0-2.12l-9-9a1.5 1.5 0 0 0-1.06-.44Z" />
      <circle cx="8.3" cy="8.3" r="1.3" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
