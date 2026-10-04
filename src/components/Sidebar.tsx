"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavSection = { label?: string; items: NavItem[] };

export default function Sidebar({
  sections,
  userName,
  roleLabel,
  logout,
  topBarRight,
}: {
  sections: NavSection[];
  userName: string;
  roleLabel: string;
  logout: React.ReactNode;
  topBarRight: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <span className="font-serif text-xl text-verde-900" style={{ letterSpacing: "0.05em" }}>
          veragua
        </span>
      </div>
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-verde-50 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-verde-600 text-sm font-semibold text-white">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-tierra-800">{userName}</p>
          <p className="truncate text-xs text-tierra-500">{roleLabel}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map((section, i) => (
          <div key={i} className="mb-3">
            {section.label && (
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-tierra-400">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-dorado-100 text-verde-900"
                        : "text-tierra-600 hover:bg-verde-50 hover:text-verde-800"
                    }`}
                  >
                    <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-verde-100 px-2 py-3">{logout}</div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-verde-100 bg-white px-3 py-2 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-tierra-600 hover:bg-verde-50"
          aria-label="Abrir menú"
        >
          <Icon name="menu" className="h-6 w-6" />
        </button>
        <span className="font-serif text-lg text-verde-900" style={{ letterSpacing: "0.05em" }}>
          veragua
        </span>
        <div className="flex items-center gap-1">{topBarRight}</div>
      </div>

      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-verde-100 md:bg-white">
        {navContent}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <div className="flex justify-end px-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-tierra-500 hover:bg-verde-50"
                aria-label="Cerrar menú"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
