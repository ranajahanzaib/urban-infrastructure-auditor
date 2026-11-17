"use client";

import {
  CheckSquare,
  Database,
  Download,
  History,
  Images,
  Layers,
  LayoutDashboard,
  ListTree,
  MapPin,
  Menu,
  Scale,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Map Explorer", href: "/map", icon: MapPin },
  { name: "Observations", href: "/observations", icon: ListTree },
  { name: "Visual Search", href: "/visual-search", icon: Sparkles },
  { name: "Similarity & Duplicates", href: "/similarity", icon: Images },
  { name: "Timeline Explorer", href: "/timeline", icon: History },
  { name: "Review Queue", href: "/review", icon: CheckSquare },
  { name: "Area Comparison", href: "/compare", icon: Scale },
  { name: "Data Sources", href: "/data-sources", icon: Database },
];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white leading-tight">
              Urban Infrastructure
            </div>
            <div className="text-[11px] font-mono text-emerald-400/80 uppercase tracking-wider">
              Auditor Platform
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Provenance Badge & Model Status */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Inference Stack
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                MPS / CPU
              </span>
            </div>
            <div className="text-slate-300 font-mono text-[10px] truncate">
              SigLIP 2 + DINOv2 Base
            </div>
            <div className="text-[10px] text-slate-400 leading-tight">
              Weak labels from EDK-Earth CC BY 4.0
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md text-slate-400 hover:bg-slate-800"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                POSTGIS 3.7
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-block">
                PGVECTOR 0.8
              </span>
            </div>
          </div>

          {/* Quick Actions & Exports */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/visual-search"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 text-slate-300 text-xs hover:bg-slate-700/80 border border-slate-700 transition"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Natural Language Search...</span>
              <kbd className="font-mono text-[10px] bg-slate-900 px-1 py-0.5 rounded text-slate-400">
                /
              </kbd>
            </Link>

            <a
              href="/api/v1/export/observations.geojson"
              download="observations.geojson"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 border border-slate-700 transition"
              title="Export GeoJSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">GeoJSON</span>
            </a>

            <a
              href="/api/v1/export/observations.csv"
              download="observations.csv"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 border border-slate-700 transition"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">CSV</span>
            </a>
          </div>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 p-3 space-y-1 z-20">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-slate-400 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
