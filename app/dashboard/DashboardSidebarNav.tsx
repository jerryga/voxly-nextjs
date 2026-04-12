"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SidebarLink = {
  id: "overview" | "transcriptions" | "settings" | "billing" | "contact";
  label: string;
  href: string;
};

type DashboardSidebarNavProps = {
  links: readonly SidebarLink[];
  activePath: SidebarLink["id"] | "workspace" | "intelligence" | "operations";
  activeProjectId?: string | null;
};

function isDashboardSurface(id: SidebarLink["id"]) {
  return id === "overview" || id === "transcriptions" || id === "settings";
}

function surfaceForLink(id: SidebarLink["id"]) {
  if (id === "transcriptions") {
    return "transcriptions";
  }
  if (id === "settings") {
    return "settings";
  }
  return "overview";
}

export function DashboardSidebarNav({
  links,
  activePath,
  activeProjectId = null,
}: DashboardSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [clientActivePath, setClientActivePath] = useState(activePath);

  useEffect(() => {
    setClientActivePath(activePath);
  }, [activePath]);

  useEffect(() => {
    for (const link of links) {
      router.prefetch(link.href);
    }
  }, [links, router]);

  return (
    <nav className="mt-3 space-y-1">
      {links.map((item) => {
        const isActive =
          clientActivePath === item.id &&
          !(item.id === "transcriptions" && activeProjectId);

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={(event) => {
              if (!isDashboardSurface(item.id) || !pathname.startsWith("/dashboard")) {
                return;
              }

              event.preventDefault();
              setClientActivePath(item.id);
              window.history.pushState(null, "", item.href);
              window.dispatchEvent(
                new CustomEvent("voxly:navigate-dashboard-surface", {
                  detail: {
                    surface: surfaceForLink(item.id),
                    settingsSection: item.id === "settings" ? "personal" : undefined,
                    projectFilter: "all",
                  },
                }),
              );
              window.scrollTo({ top: 0, behavior: "auto" });
            }}
            className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition ${
              isActive
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-[#f7f7f3] hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
