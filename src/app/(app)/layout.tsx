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
  const reminderItems: ReminderItem[] = instances
    .filter((i) => i.dismissals.length === 0 && i.reminderRule.activo !== false)
    .map((i) => ({
      instanceId: i.id,
      titulo: i.reminderRule.titulo,
      mensaje: i.reminderRule.mensaje,
      fechaLabel: "Hoy",
    }));

  const isAdmin = session.user.role === "ADMIN";
  const isGalpon = session.user.role === "GALPON";
  const puedeVerFinanzas = isAdmin || session.user.puedeVerFinanzas;
  const ROL_LABEL: Record<string, string> = {
    ADMIN: "Administradora",
    EMPLEADA: "Empleada",
    GALPON: "Encargado(a) de galpón",
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
    : [
        { items: [{ href: "/", label: "Inicio", icon: "home" }] },
        {
          label: "Gestiona tu negocio",
          items: [
            ...(puedeVerFinanzas ? [{ href: "/finanzas", label: "Finanzas", icon: "finanzas" as const }] : []),
            ...(puedeVerFinanzas ? [{ href: "/inventario", label: "Inventario", icon: "inventario" as const }] : []),
            { href: "/pedidos", label: "Pedidos", icon: "pedidos" as const },
            { href: "/produccion", label: "Postura/Huevos", icon: "produccion" as const },
            { href: "/melcoch", label: "Melcoch", icon: "melcoch" as const },
            { href: "/compras", label: "Compras", icon: "compras" as const },
          ],
        },
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

  const topBarRight = (
    <>
      <PushNotificationOptIn />
      <NotificationBell items={reminderItems} />
    </>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sections={sections}
        userName={session.user.name ?? session.user.username}
        roleLabel={ROL_LABEL[session.user.role] ?? session.user.role}
        logout={logout}
        topBarRight={topBarRight}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="hidden items-center justify-end gap-3 border-b border-verde-100 bg-white px-4 py-2 md:flex">
          {topBarRight}
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
