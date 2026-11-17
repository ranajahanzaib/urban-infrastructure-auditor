"use client";

import { fetchCategories, fetchObservations } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Grid,
  Images,
  List as ListIcon,
  MapPin,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ObservationsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedAvail, setSelectedAvail] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedStaleness, setSelectedStaleness] = useState("");
  const [page, setPage] = useState(1);
  const limit = 24;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: [
      "observations",
      page,
      limit,
      search,
      selectedCategory,
      selectedGroup,
      selectedAvail,
      selectedStatus,
      selectedStaleness,
    ],
    queryFn: () =>
      fetchObservations({
        page,
        limit,
        search: search || undefined,
        category_id: selectedCategory || undefined,
        category_group: selectedGroup || undefined,
        image_availability: selectedAvail || undefined,
        verification_status: selectedStatus || undefined,
        staleness: selectedStaleness || undefined,
      }),
  });

  const observations = data?.observations || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 24,
    total: 0,
    total_pages: 1,
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Observation Explorer</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {pagination.total.toLocaleString()} records
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse normalized physical infrastructure evidence recorded from
            street-level imagery.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition ${
                viewMode === "grid"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded transition ${
                viewMode === "table"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Table View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search filename, label, city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>

          {/* Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Groups</option>
            <option value="green_infrastructure">Green Infrastructure</option>
            <option value="construction_public_works">
              Construction & Public Works
            </option>
          </select>

          {/* Image Availability */}
          <select
            value={selectedAvail}
            onChange={(e) => {
              setSelectedAvail(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Imagery Status</option>
            <option value="available">Image Available (Resolved)</option>
            <option value="missing">Metadata Only (Missing Image)</option>
          </select>

          {/* Staleness Filter */}
          <select
            value={selectedStaleness}
            onChange={(e) => {
              setSelectedStaleness(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Freshness</option>
            <option value="recent">Recent (&lt; 1 yr)</option>
            <option value="aging">Aging (1 - 3 yrs)</option>
            <option value="stale">Stale (&gt; 3 yrs)</option>
            <option value="undated">Undated</option>
          </select>
        </div>
      </div>

      {/* Grid or Table Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : observations.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-xl border border-slate-800">
          <Images className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-300">
            No observations matched your filters
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Try resetting search keywords or category filters.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {observations.map((obs) => (
            <Link
              key={obs.id}
              href={`/observations/${obs.id}`}
              className="group rounded-xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-slate-700 transition flex flex-col justify-between"
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
                    <span className="text-[11px] font-mono text-slate-500">
                      Metadata-only
                    </span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded shadow text-white"
                    style={{ backgroundColor: obs.category_color || "#10b981" }}
                  >
                    {obs.category_name}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-slate-300 backdrop-blur">
                    {obs.staleness_state.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-2">
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
      ) : (
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
              <tr>
                <th className="p-3">File / Image</th>
                <th className="p-3">Category</th>
                <th className="p-3">Weak Label</th>
                <th className="p-3">Location</th>
                <th className="p-3">Capture Date</th>
                <th className="p-3">Verification</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {observations.map((obs) => (
                <tr key={obs.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {obs.image_url ? (
                          <img
                            src={obs.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Images className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div className="font-medium text-slate-200 truncate max-w-[180px]">
                        {obs.filename}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                      style={{
                        backgroundColor: obs.category_color || "#10b981",
                      }}
                    >
                      {obs.category_name}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">
                    {obs.original_feature_label}
                  </td>
                  <td className="p-3 text-slate-400">
                    {obs.city
                      ? `${obs.city}, ${obs.state || ""}`
                      : obs.state || "United States"}
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    {obs.observed_at
                      ? new Date(obs.observed_at).toLocaleDateString()
                      : "Undated"}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {obs.verification_status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/observations/${obs.id}`}
                      className="text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Inspect
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
        <div>
          Showing page{" "}
          <span className="font-mono text-white">{pagination.page}</span> of{" "}
          <span className="font-mono text-white">{pagination.total_pages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>
          <button
            onClick={() =>
              setPage((p) => Math.min(pagination.total_pages, p + 1))
            }
            disabled={page >= pagination.total_pages}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
