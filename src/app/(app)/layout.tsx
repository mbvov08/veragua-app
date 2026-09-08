import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureAllGenerated } from "@/lib/recurring";
import { todayColombia } from "@/lib/date";
import NavTabs from "@/components/NavTabs";
import NotificationBell, { ReminderItem } from "@/components/NotificationBell";

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
  const ROL_LABEL: Record<string, string> = {
    ADMIN: "Administradora",
    EMPLEADA: "Empleada",
    GALPON: "Encargado(a) de galpón",
  };

  const tabs = isGalpon
    ? [
        { href: "/", label: "Inicio" },
        { href: "/produccion", label: "Producción" },
        { href: "/tareas", label: "Tareas" },
        { href: "/compras", label: "Compras" },
      ]
    : [
        { href: "/", label: "Inicio" },
        { href: "/personal", label: "Personal" },
        ...(isAdmin ? [{ href: "/nomina", label: "Nómina" }] : []),
        { href: "/pedidos", label: "Pedidos" },
        { href: "/produccion", label: "Producción" },
        { href: "/melcoch", label: "Melcoch" },
        { href: "/caja", label: "Caja" },
        { href: "/tareas", label: "Tareas" },
        { href: "/compras", label: "Compras" },
        { href: "/calendario", label: "Calendario" },
        { href: "/recordatorios", label: "Recordatorios" },
        ...(isAdmin ? [{ href: "/usuarios", label: "Usuarios" }] : []),
      ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-verde-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg text-verde-900" style={{ letterSpacing: "0.05em" }}>
            veragua
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell items={reminderItems} />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-tierra-800">{session.user.name}</p>
            <p className="text-xs text-tierra-500">{ROL_LABEL[session.user.role] ?? session.user.role}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn-outline text-xs">
              Salir
            </button>
          </form>
        </div>
      </header>
      <NavTabs tabs={tabs} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
