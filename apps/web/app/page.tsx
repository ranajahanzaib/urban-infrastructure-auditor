"use client";

import { fetchSummary } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Database,
  ExternalLink,
  Images,
  Layers,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardPage() {
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchSummary,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-slate-900 border border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 bg-slate-900 border border-slate-800 rounded-xl animate-pulse lg:col-span-2" />
          <div className="h-72 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8">
        <div className="p-6 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200">
          <h2 className="font-semibold text-lg mb-1">
            Failed to connect to Observation API
          </h2>
          <p className="text-sm text-red-300">
            Ensure the Go backend server is running on port 8080.
          </p>
        </div>
      </div>
    );
  }

  const categoryChartData = summary.category_counts.map((c) => ({
    name: c.display_name,
    count: c.count,
    images: c.image_count,
    color: c.color_hex,
  }));

  const stalenessPieData = [
    {
      name: "Recent (< 1 yr)",
      value: summary.staleness_breakdown.recent,
      color: "#10b981",
    },
    {
      name: "Aging (1-3 yrs)",
      value: summary.staleness_breakdown.aging,
      color: "#f59e0b",
    },
    {
      name: "Stale (> 3 yrs)",
      value: summary.staleness_breakdown.stale,
      color: "#ef4444",
    },
    {
      name: "Undated",
      value: summary.staleness_breakdown.undated,
      color: "#64748b",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Hero Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Street-Level Observation Intelligence</span>
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Live Ledger
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Geospatial audit platform for exploring street-level visual
            infrastructure evidence. Distinguishes raw recorded observations,
            machine-generated multimodal embeddings, and analyst verifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/map"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition shadow-sm"
          >
            <MapPin className="w-4 h-4" />
            <span>Launch Map Explorer</span>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Observations */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Records</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {summary.total_observations.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ingested evidence
          </div>
        </div>

        {/* Categories */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Taxonomy</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            12
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            2 primary groups
          </div>
        </div>

        {/* Cities Represented */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Geographic Footprint</span>
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {summary.cities_count}{" "}
            <span className="text-xs font-normal text-slate-400">cities</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {summary.states_count} US states/regions
          </div>
        </div>

        {/* Images Available */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Resolved Imagery</span>
            <Images className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {summary.with_images_count}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Embedded with SigLIP/DINO
          </div>
        </div>

        {/* Review Queue */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Review Queue</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400">
            {summary.review_queue_count.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Weak labels awaiting audit
          </div>
        </div>

        {/* Stale Observations */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Stale Records</span>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {summary.stale_count.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            &gt; 3 yrs old (reinspect)
          </div>
        </div>
      </div>

      {/* Two Column Section: Category Distribution & Staleness Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown Bar Chart */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Infrastructure Observation Categories
              </h2>
              <p className="text-xs text-slate-400">
                Distribution across green infrastructure and construction works
              </p>
            </div>
            <Link
              href="/observations"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <span>View all records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
              >
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={11}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [
                    `${Number(val).toLocaleString()} records`,
                    "Count",
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Observation Freshness / Staleness Assessment */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">
              Temporal Freshness Assessment
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Observations age over time; older records flag reinspection
              priority rather than physical absence.
            </p>
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stalenessPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stalenessPieData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            {stalenessPieData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-mono text-slate-400 font-medium">
                  {item.value.toLocaleString()} (
                  {((item.value / summary.total_observations) * 100).toFixed(1)}
                  %)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real Datasets Status */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              First-Class Hugging Face Datasets
            </h2>
            <p className="text-xs text-slate-400">
              Authentic street-level observation datasets with CC BY 4.0
              provenance
            </p>
          </div>
          <Link
            href="/data-sources"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Manage sources</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.datasets_status.map((ds) => (
            <div
              key={ds.id}
              className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-sm text-slate-100">
                    {ds.display_name}
                  </h3>
                  <a
                    href={ds.repository_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-emerald-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{ds.id}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {ds.license}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {ds.description}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                <span className="text-slate-500">Source: {ds.attribution}</span>
                <span className="font-mono text-slate-300 font-medium">
                  {ds.imported_records.toLocaleString()} rows (
                  {ds.image_records} images)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Observations with Real Image Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Recent Street-Level Observations
            </h2>
            <p className="text-xs text-slate-400">
              Inspected records with image evidence, source labels, and spatial
              coordinates
            </p>
          </div>
          <Link
            href="/observations"
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Explore all observations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {summary.recent_observations.map((obs) => (
            <Link
              key={obs.id}
              href={`/observations/${obs.id}`}
              className="group rounded-xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-slate-700 transition flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-950 relative overflow-hidden flex items-center justify-center">
                {obs.image_url ? (
                  <img
                    src={obs.image_url}
                    alt={obs.original_feature_label}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Images className="w-8 h-8 text-slate-700 mx-auto mb-1" />
                    <span className="text-[11px] font-mono text-slate-600">
                      Metadata-only Record
                    </span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm text-white"
                    style={{ backgroundColor: obs.category_color || "#10b981" }}
                  >
                    {obs.category_name}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-slate-300 backdrop-blur">
                    {obs.staleness_state.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-xs font-medium text-slate-200 truncate group-hover:text-emerald-400 transition">
                    {obs.filename}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">
                      {obs.city
                        ? `${obs.city}, ${obs.state || ""}`
                        : obs.state || "United States"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {obs.observed_at
                      ? new Date(obs.observed_at).toLocaleDateString()
                      : "Undated"}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {obs.verification_status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
