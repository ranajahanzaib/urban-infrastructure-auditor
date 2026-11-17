"use client";

import { fetchObservations, fetchTimeline } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, Clock, Images, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function TimelinePage() {
  const [selectedStaleness, setSelectedStaleness] = useState<string>("");

  const { data: timelineData = [], isLoading: isTimelineLoading } = useQuery({
    queryKey: ["timeline"],
    queryFn: fetchTimeline,
  });

  const { data: observationsData, isLoading: isObsLoading } = useQuery({
    queryKey: ["timeline-observations", selectedStaleness],
    queryFn: () =>
      fetchObservations({
        limit: 16,
        staleness: selectedStaleness || undefined,
        sort_by: "observed_at",
      }),
  });

  const observations = observationsData?.observations || [];

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Timeline Explorer</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-400">
              Temporal Distribution
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyze when infrastructure features were observed and identify
            historical sightings vs stale records requiring reinspection.
          </p>
        </div>

        {/* Staleness quick filter */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedStaleness}
            onChange={(e) => setSelectedStaleness(e.target.value)}
            className="text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Staleness Tiers</option>
            <option value="recent">Recent (&lt; 1 yr ago)</option>
            <option value="aging">Aging (1 - 3 yrs ago)</option>
            <option value="stale">Stale (&gt; 3 yrs ago)</option>
          </select>
        </div>
      </div>

      {/* Temporal Chart */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Monthly Observation Frequency
            </h2>
            <p className="text-xs text-slate-400">
              Green infrastructure vs construction records over time
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Capture Timestamps
          </span>
        </div>

        <div className="h-72">
          {isTimelineLoading ? (
            <div className="w-full h-full bg-slate-950 rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWorks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                />
                <Area
                  type="monotone"
                  dataKey="green_infrastructure"
                  name="Green Infrastructure"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorGreen)"
                />
                <Area
                  type="monotone"
                  dataKey="construction_public_works"
                  name="Construction & Works"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorWorks)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chronologically Ordered Observations Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Chronological Records
            </h2>
            <p className="text-xs text-slate-400">
              Inspecting visual observations sorted by capture date
            </p>
          </div>
          <Link
            href="/observations"
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Open in Explorer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <Images className="w-8 h-8 text-slate-700" />
                )}
                <div className="absolute top-2 left-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded text-white shadow"
                    style={{ backgroundColor: obs.category_color || "#10b981" }}
                  >
                    {obs.category_name}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-amber-400">
                    {obs.staleness_state.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-1.5">
                <div className="text-xs font-medium text-slate-200 truncate group-hover:text-emerald-400 transition">
                  {obs.filename}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span className="truncate">
                    {obs.city
                      ? `${obs.city}, ${obs.state || ""}`
                      : obs.state || "United States"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800 flex justify-between">
                  <span className="flex items-center gap-1 font-mono text-slate-300">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {obs.observed_at
                      ? new Date(obs.observed_at).toLocaleDateString()
                      : "Undated"}
                  </span>
                  <span className="font-mono text-slate-400">
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
