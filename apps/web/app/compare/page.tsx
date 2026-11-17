"use client";

import { compareAreas } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Info, Scale } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PRESET_COMPARISONS = [
  {
    name: "San Francisco, CA vs Portland, OR",
    areaA: { name: "San Francisco, CA", bbox: [-122.52, 37.7, -122.35, 37.83] },
    areaB: { name: "Portland, OR", bbox: [-122.75, 45.45, -122.58, 45.6] },
  },
  {
    name: "San Diego, CA vs Sacramento, CA",
    areaA: { name: "San Diego, CA", bbox: [-117.25, 32.65, -117.05, 32.85] },
    areaB: { name: "Sacramento, CA", bbox: [-121.55, 38.5, -121.38, 38.65] },
  },
];

export default function AreaComparisonPage() {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const currentPreset = PRESET_COMPARISONS[selectedPresetIndex];

  const { data, isLoading } = useQuery({
    queryKey: ["compare-areas", currentPreset.name],
    queryFn: () =>
      compareAreas({
        area_a_name: currentPreset.areaA.name,
        area_a_bbox: currentPreset.areaA.bbox,
        area_b_name: currentPreset.areaB.name,
        area_b_bbox: currentPreset.areaB.bbox,
      }),
  });

  const areaA = data?.areaA;
  const areaB = data?.areaB;

  // Build comparative category chart data
  const categoryNames = Array.from(
    new Set([
      ...Object.keys(areaA?.category_counts || {}),
      ...Object.keys(areaB?.category_counts || {}),
    ]),
  );

  const comparativeChartData = categoryNames.map((cat) => ({
    category: cat,
    [areaA?.name || "Area A"]: areaA?.category_counts?.[cat] || 0,
    [areaB?.name || "Area B"]: areaB?.category_counts?.[cat] || 0,
  }));

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Geographic Area Comparison</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
              Spatial Benchmarks
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Analyze observation coverage, recorded infrastructure diversity, and
            imagery availability across regions.
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-slate-500" />
          <select
            value={selectedPresetIndex}
            onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
            className="text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            {PRESET_COMPARISONS.map((p, idx) => (
              <option key={p.name} value={idx}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Critical Methodological Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/50 flex items-start gap-3 text-xs text-amber-300">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Important Observational Disclaimer:</strong> Differences in
          density and recorded categories reflect street-level collection
          campaigns, vehicle routes, and imagery ingestion availability rather
          than complete physical infrastructure reality. An area with fewer
          observations must never be interpreted as lacking infrastructure.
        </p>
      </div>

      {/* Side-by-side Metrics Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
          <div className="h-72 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Area A */}
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                  Region A
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {areaA?.name}
                </h2>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {areaA?.area_square_km.toFixed(1)} km²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Total Observations
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  {areaA?.total_observations.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Observation Density
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {areaA?.density_per_sq_km.toFixed(1)}
                  <span className="text-xs text-slate-500 font-normal">
                    {" "}
                    /km²
                  </span>
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Category Diversity
                </span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {areaA?.category_diversity}{" "}
                  <span className="text-xs text-slate-500 font-normal">
                    types
                  </span>
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Imagery Availability
                </span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {areaA?.image_availability_pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Freshness breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">
                Freshness Breakdown:
              </span>
              <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-center">
                <div className="p-1 rounded bg-slate-950 text-emerald-400">
                  {areaA?.staleness_breakdown?.recent || 0} Recent
                </div>
                <div className="p-1 rounded bg-slate-950 text-amber-400">
                  {areaA?.staleness_breakdown?.aging || 0} Aging
                </div>
                <div className="p-1 rounded bg-slate-950 text-rose-400">
                  {areaA?.staleness_breakdown?.stale || 0} Stale
                </div>
                <div className="p-1 rounded bg-slate-950 text-slate-400">
                  {areaA?.staleness_breakdown?.undated || 0} Undated
                </div>
              </div>
            </div>
          </div>

          {/* Area B */}
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                  Region B
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {areaB?.name}
                </h2>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {areaB?.area_square_km.toFixed(1)} km²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Total Observations
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  {areaB?.total_observations.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Observation Density
                </span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {areaB?.density_per_sq_km.toFixed(1)}
                  <span className="text-xs text-slate-500 font-normal">
                    {" "}
                    /km²
                  </span>
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Category Diversity
                </span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {areaB?.category_diversity}{" "}
                  <span className="text-xs text-slate-500 font-normal">
                    types
                  </span>
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">
                  Imagery Availability
                </span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {areaB?.image_availability_pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Freshness breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">
                Freshness Breakdown:
              </span>
              <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-center">
                <div className="p-1 rounded bg-slate-950 text-emerald-400">
                  {areaB?.staleness_breakdown?.recent || 0} Recent
                </div>
                <div className="p-1 rounded bg-slate-950 text-amber-400">
                  {areaB?.staleness_breakdown?.aging || 0} Aging
                </div>
                <div className="p-1 rounded bg-slate-950 text-rose-400">
                  {areaB?.staleness_breakdown?.stale || 0} Stale
                </div>
                <div className="p-1 rounded bg-slate-950 text-slate-400">
                  {areaB?.staleness_breakdown?.undated || 0} Undated
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparative Category Chart */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Side-by-Side Category Breakdown
            </h2>
            <p className="text-xs text-slate-400">
              Comparing recorded observations between selected geographic
              regions
            </p>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparativeChartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <XAxis
                dataKey="category"
                stroke="#64748b"
                fontSize={11}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Bar
                dataKey={areaA?.name || "Area A"}
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey={areaB?.name || "Area B"}
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
