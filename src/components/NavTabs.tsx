"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

export default function NavTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-verde-100 bg-white px-2">
      {tabs.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
              active
                ? "border-verde-600 text-verde-700"
                : "border-transparent text-tierra-600 hover:text-verde-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
