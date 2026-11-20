"use client";

import {
  fetchCategories,
  fetchHistory,
  fetchNeighbors,
  fetchObservation,
  fetchReviewHistory,
  fetchSimilar,
  submitReview,
} from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Cpu,
  FileText,
  Images,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function ObservationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [selectedNewCategory, setSelectedNewCategory] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  const {
    data: obs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["observation", id],
    queryFn: () => fetchObservation(id),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: rawNeighbors = [] } = useQuery({
    queryKey: ["neighbors", id],
    queryFn: () => fetchNeighbors(id),
    enabled: !!obs,
  });
  const neighbors = rawNeighbors || [];

  const { data: rawSimilar = [] } = useQuery({
    queryKey: ["similar", id],
    queryFn: () => fetchSimilar(id),
    enabled: !!obs && obs.image_availability === "available",
  });
  const similar = rawSimilar || [];

  const { data: rawHistory = [] } = useQuery({
    queryKey: ["history", id],
    queryFn: () => fetchHistory(id),
    enabled: !!obs,
  });
  const history = rawHistory || [];

  const { data: rawAuditEvents = [] } = useQuery({
    queryKey: ["review-history", id],
    queryFn: () => fetchReviewHistory(id),
    enabled: !!obs,
  });
  const auditEvents = rawAuditEvents || [];

  const reviewMutation = useMutation({
    mutationFn: (actionData: {
      action: string;
      analyst_category_id?: string;
      notes?: string;
    }) => submitReview(id, actionData),
    onSuccess: (data) => {
      setReviewMessage(`Review action saved: ${data.new_status}`);
      queryClient.invalidateQueries({ queryKey: ["observation", id] });
      queryClient.invalidateQueries({ queryKey: ["review-history", id] });
      setNotes("");
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        <div className="h-6 w-32 bg-slate-800 rounded animate-pulse" />
        <div className="h-96 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !obs) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="p-6 bg-red-950/40 border border-red-800 rounded-xl text-red-200">
          <h2 className="font-semibold text-lg">Observation Not Found</h2>
          <p className="text-sm mt-1">Unable to locate record {id}.</p>
          <Link
            href="/observations"
            className="text-sm text-red-400 underline mt-4 inline-block"
          >
            Back to Observations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Nav Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/observations"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Observation Explorer</span>
        </Link>
        <span className="font-mono text-xs text-slate-500">ID: {obs.id}</span>
      </div>

      {/* Main Grid: Image Viewer & Core Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Large Image Viewer */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="aspect-[4/3] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative shadow-lg">
            {obs.image_url ? (
              <img
                src={obs.image_url}
                alt={obs.original_feature_label}
                className="w-full h-full object-contain bg-black/60"
              />
            ) : (
              <div className="text-center p-8">
                <Images className="w-16 h-16 text-slate-700 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-400">
                  Image Data Unavailable
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  This metadata observation was ingested from the Hugging Face
                  repository without an archive image file.
                </p>
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded shadow-md text-white"
                style={{ backgroundColor: obs.category_color || "#10b981" }}
              >
                {obs.category_name}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/80 text-slate-300 border border-slate-700/60 backdrop-blur">
                {obs.image_availability.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Image Provenance Info */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono truncate">{obs.filename}</span>
            {obs.image_checksum && (
              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]">
                SHA: {obs.image_checksum.substring(0, 16)}...
              </span>
            )}
          </div>
        </div>

        {/* Right: Provenance & Observation Ledger Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                Observation Evidence Ledger
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {obs.category_name}
              </h2>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {obs.city
                    ? `${obs.city}, ${obs.state || ""}`
                    : obs.state || "United States"}
                </span>
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Source Feature Label</span>
                <span className="text-slate-200 font-medium">
                  {obs.original_feature_label}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Capture Timestamp</span>
                <span className="text-slate-200 font-mono">
                  {obs.observed_at
                    ? new Date(obs.observed_at).toLocaleString()
                    : "Undated"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Coordinates (WGS84)</span>
                <span className="text-slate-200 font-mono">
                  {obs.latitude.toFixed(6)}, {obs.longitude.toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Dataset Origin</span>
                <span className="text-slate-200">{obs.dataset_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Attribution</span>
                <span className="text-slate-300 truncate max-w-[220px]">
                  {obs.source_attribution}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Freshness / Staleness</span>
                <span className="font-mono text-amber-400 uppercase font-semibold">
                  {obs.staleness_state}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Verification State</span>
                <span className="font-mono text-emerald-400 uppercase font-semibold">
                  {obs.verification_status}
                </span>
              </div>
            </div>

            {/* Crucial Methodological Warning */}
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/60 text-[11px] text-amber-300 leading-relaxed">
              <strong>Epistemic Warning:</strong> Source labels were generated
              via query-driven embedding similarity. This record is evidence of
              visual observation at capture time; it does not confirm
              present-day physical existence or operational status.
            </div>
          </div>
        </div>
      </div>

      {/* 5 Distinct Conceptual Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Machine-Generated Visual Analysis */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white pb-3 border-b border-slate-800">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Machine-Generated Visual Analysis</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400 font-medium">
                SigLIP 2 Embeddings
              </div>
              <div className="font-mono text-xs text-white">
                {obs.siglip_status}
              </div>
              <div className="text-[10px] text-slate-500">
                768-d multimodal vector
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-400 font-medium">
                DINOv2 Embeddings
              </div>
              <div className="font-mono text-xs text-white">
                {obs.dinov2_status}
              </div>
              <div className="text-[10px] text-slate-500">
                768-d structural representation
              </div>
            </div>
          </div>

          {obs.phash && (
            <div className="text-xs font-mono p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
              <span className="text-slate-400">Perceptual Hash (pHash):</span>
              <span className="text-slate-200">{obs.phash}</span>
            </div>
          )}
        </div>

        {/* Section 2: Analyst Verification Action Station */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white pb-3 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Analyst Verification Station</span>
          </div>

          {reviewMessage && (
            <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300">
              {reviewMessage}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  reviewMutation.mutate({ action: "confirm_label", notes })
                }
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-semibold transition"
              >
                Confirm Source Label
              </button>
              <button
                onClick={() =>
                  reviewMutation.mutate({ action: "reject_label", notes })
                }
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-semibold transition"
              >
                Reject Label
              </button>
              <button
                onClick={() =>
                  reviewMutation.mutate({ action: "mark_uncertain", notes })
                }
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-semibold transition"
              >
                Mark Uncertain
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Reassign Category (if mislabeled):
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedNewCategory}
                  onChange={(e) => setSelectedNewCategory(e.target.value)}
                  className="flex-1 text-xs rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-200"
                >
                  <option value="">Select corrected category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedNewCategory) {
                      reviewMutation.mutate({
                        action: "reassign_category",
                        analyst_category_id: selectedNewCategory,
                        notes,
                      });
                    }
                  }}
                  disabled={!selectedNewCategory}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-white transition"
                >
                  Reassign
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">
                Analyst Inspection Notes:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter observations, visual artifacts, or audit rationale..."
                className="w-full text-xs p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 h-16"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Geographic Spatial Neighbors */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Geographic Spatial Neighbors</span>
          </div>
          <span className="text-xs text-slate-400">Within 2,000 meters</span>
        </div>

        {neighbors.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No other recorded observations within 2km.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {neighbors.map((nb) => (
              <Link
                key={nb.id}
                href={`/observations/${nb.id}`}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-medium text-slate-200 truncate max-w-[150px]">
                    {nb.filename}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {nb.category_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-emerald-400">
                    {nb.distance_meters
                      ? `${Math.round(nb.distance_meters)}m`
                      : "Nearby"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: DINOv2 Visually Similar Imagery */}
      {obs.image_availability === "available" && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                Visually Similar Observations (DINOv2 Nearest Neighbors)
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Computed via pgvector cosine similarity
            </span>
          </div>

          {similar.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No visually similar matches found.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {similar.map((sim) => (
                <Link
                  key={sim.id}
                  href={`/observations/${sim.id}`}
                  className="group rounded-lg bg-slate-950 border border-slate-800 overflow-hidden hover:border-slate-700 transition flex flex-col"
                >
                  <div className="aspect-[4/3] bg-black/40 overflow-hidden relative">
                    {sim.image_url && (
                      <img
                        src={sim.image_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    )}
                    <div className="absolute top-1 right-1">
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/80 text-emerald-400 font-semibold">
                        {sim.visual_similarity
                          ? `${(sim.visual_similarity * 100).toFixed(0)}%`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 text-[11px]">
                    <div className="font-medium text-slate-300 truncate">
                      {sim.category_name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {sim.city || sim.state}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 5: Verification Audit History Trail */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white pb-3 border-b border-slate-800">
          <FileText className="w-4 h-4 text-purple-400" />
          <span>Audit & Decision History</span>
        </div>

        {auditEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No review actions recorded yet for this observation.
          </p>
        ) : (
          <div className="divide-y divide-slate-800 text-xs">
            {auditEvents.map((ev) => (
              <div
                key={ev.id}
                className="py-2.5 flex items-start justify-between"
              >
                <div>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {ev.action}
                  </span>
                  <span className="text-slate-400 ml-2">
                    by {ev.reviewer_id}
                  </span>
                  {ev.notes && (
                    <p className="text-slate-300 mt-1 italic">
                      &ldquo;{ev.notes}&rdquo;
                    </p>
                  )}
                </div>
                <span className="font-mono text-slate-500 text-[11px]">
                  {new Date(ev.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
