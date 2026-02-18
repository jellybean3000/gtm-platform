"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const mainNav = [
  { name: "Dashboard", href: "/", icon: "📊" },
  { name: "Knowledge Base", href: "/knowledge", icon: "📚" },
  { name: "Orchestrator", href: "/orchestrator", icon: "🎯" },
];

const agents = [
  { name: "Market Research", slug: "market-research", icon: "🔍", color: "#0EA5E9" },
  { name: "PMF", slug: "pmf", icon: "🎯", color: "#14B8A6" },
  { name: "Positioning", slug: "positioning", icon: "💎", color: "#8B5CF6" },
  { name: "Analytics", slug: "analytics", icon: "📈", color: "#6366F1" },
  { name: "Content", slug: "content", icon: "✍️", color: "#F59E0B" },
  { name: "Sales Enablement", slug: "sales-enablement", icon: "🤝", color: "#10B981" },
  { name: "Demand Gen", slug: "demand-gen", icon: "🚀", color: "#EC4899" },
  { name: "Launch Planning", slug: "launch", icon: "🏁", color: "#EF4444" },
  { name: "CRM", slug: "crm", icon: "👥", color: "#F97316" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-background-deep border-r border-border-default flex flex-col">
      <div className="p-6 border-b border-border-default flex items-center gap-3">
        <Image
          src="/logo.svg"
          alt="GTM Platform"
          width={32}
          height={32}
          className="flex-shrink-0"
        />
        <div>
          <h1 className="text-lg font-bold text-foreground font-display tracking-tight">
            GTM Platform
          </h1>
          <p className="text-[10px] uppercase tracking-[2px] text-text-muted mt-0.5">
            Multi-Agent Intelligence
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-white/5 text-foreground"
                    : "text-text-body hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          <p className="px-3 mb-2 text-[10px] uppercase tracking-[2px] text-text-muted">
            Agents
          </p>
          <div className="space-y-1">
            {agents.map((agent) => {
              const href = `/agents/${agent.slug}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={agent.slug}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${
                    isActive
                      ? "bg-white/5 text-foreground"
                      : "text-text-body hover:bg-white/5 hover:text-foreground"
                  }`}
                  style={
                    isActive
                      ? { borderLeft: `2px solid ${agent.color}` }
                      : undefined
                  }
                >
                  <span>{agent.icon}</span>
                  <span>{agent.name}</span>
                  <span
                    className="ml-auto w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: agent.color }}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-border-default">
        <UserButton
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: "w-full",
              userButtonTrigger:
                "w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors",
              userButtonBox: "flex-row-reverse w-full justify-end gap-3",
              userButtonOuterIdentifier: "text-sm text-text-body",
              avatarBox: "w-8 h-8",
            },
          }}
          showName
        />
      </div>
    </aside>
  );
}
