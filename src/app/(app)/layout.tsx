import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureAllGenerated } from "@/lib/recurring";
import { todayColombia } from "@/lib/date";
import Sidebar, { NavSection } from "@/components/Sidebar";
import { Icon } from "@/components/icons";
import NotificationBell, { ReminderItem } from "@/components/NotificationBell";
import PushNotificationOptIn from "@/components/PushNotificationOptIn";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await ensureAllGenerated();

  const today = todayColombia();
  const instances = await prisma.reminderInstance.findMany({
    where: { fecha: today },
    include: { reminderRule: true, dismissals: { where: { userId: session.user.id } } },
  });
  // Mapa por título de regla en vez de un solo href fijo, ahora que hay más de un
  // origen de alertas condicionales (reabastecimiento, vehículo).
  const HREF_POR_TITULO: Record<string, string> = {
    "📦 Reabastecimiento": "/inventario/reabastecimiento",
    "🚐 Salida abierta": "/vehiculo",
    "🚐 Devolución con novedades": "/vehiculo",
    "🚐 Documentos del vehículo": "/vehiculo/ajustes",
  };
  const reminderItems: ReminderItem[] = instances
    .filter((i) => i.dismissals.length === 0 && i.reminderRule.activo !== false && i.mensajeOverride !== "")
    // Las alertas de vehículo nombran conductores y salidas de otros — son para staff,
    // no para que un conductor vea el movimiento de los demás.
    .filter((i) => !i.reminderRule.titulo.startsWith("🚐") || session.user.role === "ADMIN" || session.user.role === "EMPLEADA")
    .map((i) => ({
      instanceId: i.id,
      titulo: i.reminderRule.titulo,
      mensaje: i.mensajeOverride ?? i.reminderRule.mensaje,
      fechaLabel: "Hoy",
      href: i.mensajeOverride !== null ? HREF_POR_TITULO[i.reminderRule.titulo] : undefined,
    }));

  const isAdmin = session.user.role === "ADMIN";
  const isGalpon = session.user.role === "GALPON";
  const isConductor = session.user.role === "CONDUCTOR";
  const puedeVerFinanzas = isAdmin || session.user.puedeVerFinanzas;
  const ROL_LABEL: Record<string, string> = {
    ADMIN: "Gerencia",
    EMPLEADA: "Coordinadora de operaciones",
    GALPON: "Encargado(a) de galpón",
    CONDUCTOR: "Conductor",
  };

  const sections: NavSection[] = isGalpon
    ? [
        {
          items: [
            { href: "/", label: "Inicio", icon: "home" },
            { href: "/produccion", label: "Postura/Huevos", icon: "produccion" },
            { href: "/tareas", label: "Tareas", icon: "tareas" },
            { href: "/compras", label: "Compras", icon: "compras" },
          ],
        },
      ]
    : isConductor
    ? [
        {
          items: [
            { href: "/", label: "Inicio", icon: "home" },
            { href: "/vehiculo", label: "Vehículo", icon: "vehiculo" },
          ],
        },
      ]
    : [
        { items: [{ href: "/", label: "Inicio", icon: "home" }] },
        ...(puedeVerFinanzas
          ? [
              {
                label: "Día a día",
                items: [
                  { href: "/inventario/ventas", label: "Ventas", icon: "venta" as const },
                  { href: "/finanzas/movimientos", label: "Movimientos", icon: "movimientos" as const },
                  { href: "/finanzas/caja", label: "Cierre de Caja", icon: "caja" as const },
                  { href: "/pedidos", label: "Pedidos", icon: "pedidos" as const },
                  { href: "/produccion", label: "Postura/Huevos", icon: "produccion" as const },
                  { href: "/melcoch", label: "Melcoch", icon: "melcoch" as const },
                  { href: "/inventario/reabastecimiento", label: "Reabastecimiento", icon: "reabastecimiento" as const },
                  { href: "/compras", label: "Compras", icon: "compras" as const },
                  { href: "/vehiculo", label: "Vehículo", icon: "vehiculo" as const },
                ],
              },
              {
                label: "Gestión gerencial",
                items: [
                  { href: "/finanzas", label: "Resumen", icon: "finanzas" as const },
                  { href: "/finanzas/pyg", label: "PyG", icon: "receipt" as const },
                  { href: "/finanzas/estadisticas", label: "Estadísticas", icon: "estadisticas" as const },
                  { href: "/finanzas/canales", label: "Canales", icon: "canales" as const },
                  { href: "/inventario/clientes", label: "Clientes", icon: "venta" as const },
                  { href: "/inventario/cuentas-por-cobrar", label: "Cuentas por Cobrar", icon: "receipt" as const },
                  { href: "/inventario/proveedores", label: "Proveedores", icon: "compras" as const },
                  { href: "/inventario/cuentas-por-pagar", label: "Cuentas por Pagar", icon: "receipt" as const },
                  { href: "/inventario/productos", label: "Productos", icon: "inventario" as const },
                  {
                    href: "/finanzas/ajustes/categorias",
                    label: "Ajustes",
                    icon: "tag" as const,
                    children: [
                      { href: "/finanzas/ajustes/categorias", label: "Categorías (Finanzas)" },
                      { href: "/inventario/ajustes/categorias", label: "Categorías (Inventario)" },
                      { href: "/finanzas/ajustes/canales", label: "Canales de venta" },
                      { href: "/inventario/historial", label: "Historial de ajustes" },
                      { href: "/vehiculo/ajustes", label: "Flota de vehículos" },
                    ],
                  },
                ],
              },
            ]
          : [
              {
                items: [
                  { href: "/pedidos", label: "Pedidos", icon: "pedidos" as const },
                  { href: "/produccion", label: "Postura/Huevos", icon: "produccion" as const },
                  { href: "/melcoch", label: "Melcoch", icon: "melcoch" as const },
                  { href: "/compras", label: "Compras", icon: "compras" as const },
                  { href: "/vehiculo", label: "Vehículo", icon: "vehiculo" as const },
                ],
              },
            ]),
        {
          label: "Equipo",
          items: [
            { href: "/personal", label: "Personal", icon: "personal" },
            ...(isAdmin ? [{ href: "/nomina", label: "Nómina", icon: "nomina" as const }] : []),
            { href: "/tareas", label: "Tareas", icon: "tareas" },
            { href: "/calendario", label: "Calendario", icon: "calendario" },
            { href: "/recordatorios", label: "Recordatorios", icon: "recordatorios" },
          ],
        },
        ...(isAdmin
          ? [{ label: "Administración", items: [{ href: "/usuarios", label: "Usuarios", icon: "usuarios" as const }] }]
          : []),
      ];

  const logout = (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        <Icon name="logout" className="h-5 w-5 shrink-0" />
        Salir
      </button>
    </form>
  );

  const desktopTopBarRight = (
    <>
      <PushNotificationOptIn />
      <NotificationBell items={reminderItems} />
    </>
  );

  return (
    <Sidebar
      sections={sections}
      userName={session.user.name ?? session.user.username}
      roleLabel={ROL_LABEL[session.user.role] ?? session.user.role}
      logout={logout}
      desktopTopBarRight={desktopTopBarRight}
      mobileTopBarRight={<NotificationBell items={reminderItems} />}
    >
      {children}
    </Sidebar>
  );
}
