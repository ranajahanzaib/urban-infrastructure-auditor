"use client";

import { fetchSimilarGroups, submitReview } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Calendar, Images, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function SimilarityPage() {
  const queryClient = useQueryClient();
  const [selectedRelationType, setSelectedRelationType] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["similar-groups", selectedRelationType, selectedState],
    queryFn: () =>
      fetchSimilarGroups({
        relation_type: selectedRelationType || undefined,
        verification_state: selectedState || undefined,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      relationId,
      obsId,
      action,
    }: {
      relationId: string;
      obsId: string;
      action: string;
    }) => submitReview(obsId, { action, relation_id: relationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["similar-groups"] });
    },
  });

  const relations = data?.relations || [];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Image Similarity & Candidate Duplicates</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
              {relations.length} Pairs Discovered
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            DINOv2 embedding neighborhoods and perceptual hash matching for
            near-duplicate candidate review.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={selectedRelationType}
            onChange={(e) => setSelectedRelationType(e.target.value)}
            className="text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Relation Types</option>
            <option value="near_duplicate">
              Near Duplicates (Sim &gt; 90%)
            </option>
            <option value="possible_repeat">Possible Repeat Sighting</option>
            <option value="visually_similar">Visually Similar</option>
          </select>

          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Review States</option>
            <option value="needs_review">Needs Review</option>
            <option value="proposed">Proposed</option>
            <option value="confirmed_duplicate">Confirmed Duplicate</option>
            <option value="not_related">Not Related</option>
          </select>
        </div>
      </div>

      {/* Epistemic Guidance Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
        <p>
          <strong className="text-slate-200">
            Non-Destructive Duplicate Handling:
          </strong>{" "}
          High visual similarity between two records does not automatically
          trigger record deletion or merging. Analysts manually review proposed
          relationships to confirm whether two captures represent identical
          assets, temporal repetitions, or distinct physical features.
        </p>
      </div>

      {/* Pairs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : relations.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-xl border border-slate-800">
          <Images className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-300">
            No candidate relationships found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Run embedding processing or adjust the filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {relations.map((rel) => {
            const s = rel.source_observation;
            const t = rel.target_observation;
            if (!s || !t) return null;

            return (
              <div
                key={rel.id}
                className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-4"
              >
                {/* Pair Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Visual Sim: {(rel.confidence_score * 100).toFixed(1)}%
                    </span>
                    <span className="font-mono text-slate-400">
                      Distance: {Math.round(rel.distance_meters)} meters
                    </span>
                    <span className="font-mono text-slate-400">
                      Time Gap: {Math.round(rel.days_apart)} days
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {rel.relation_type.replace("_", " ")}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-semibold">
                      {rel.verification_state}
                    </span>
                  </div>
                </div>

                {/* Side-by-side Images and Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source Card */}
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-mono text-[11px]">
                        Primary Record
                      </span>
                      <Link
                        href={`/observations/${s.id}`}
                        className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="aspect-[4/3] rounded bg-black/60 overflow-hidden relative">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          No Image
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded text-white shadow"
                          style={{
                            backgroundColor: s.category_color || "#10b981",
                          }}
                        >
                          {s.category_name}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="font-medium text-slate-200 truncate">
                        {s.filename}
                      </div>
                      <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{s.city || "United States"}</span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {s.observed_at
                            ? new Date(s.observed_at).toLocaleDateString()
                            : "Undated"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Target Card */}
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-mono text-[11px]">
                        Candidate Match
                      </span>
                      <Link
                        href={`/observations/${t.id}`}
                        className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="aspect-[4/3] rounded bg-black/60 overflow-hidden relative">
                      {t.image_url ? (
                        <img
                          src={t.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          No Image
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded text-white shadow"
                          style={{
                            backgroundColor: t.category_color || "#10b981",
                          }}
                        >
                          {t.category_name}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="font-medium text-slate-200 truncate">
                        {t.filename}
                      </div>
                      <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{t.city || "United States"}</span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {t.observed_at
                            ? new Date(t.observed_at).toLocaleDateString()
                            : "Undated"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analyst Decision Action Bar */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">
                    Classify proposed relationship:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        reviewMutation.mutate({
                          relationId: rel.id,
                          obsId: s.id,
                          action: "confirm_duplicate",
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 font-semibold transition"
                    >
                      Confirm Duplicate
                    </button>
                    <button
                      onClick={() =>
                        reviewMutation.mutate({
                          relationId: rel.id,
                          obsId: s.id,
                          action: "related_observation",
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 font-semibold transition"
                    >
                      Related Sighting
                    </button>
                    <button
                      onClick={() =>
                        reviewMutation.mutate({
                          relationId: rel.id,
                          obsId: s.id,
                          action: "reject_duplicate",
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 font-semibold transition"
                    >
                      Not Related
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
