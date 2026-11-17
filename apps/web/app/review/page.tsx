"use client";

import { fetchCategories, fetchReviews, submitReview } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Images } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const [activeQueue, setActiveQueue] = useState<string>("unverified");
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [correctedCategory, setCorrectedCategory] = useState<string>("");
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["review-queue", activeQueue],
    queryFn: () => fetchReviews(activeQueue),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      obsId,
      action,
      analyst_category_id,
      notesText,
    }: {
      obsId: string;
      action: string;
      analyst_category_id?: string;
      notesText?: string;
    }) =>
      submitReview(obsId, {
        action,
        analyst_category_id,
        notes: notesText,
        reviewer_id: "analyst_console",
      }),
    onSuccess: (res) => {
      setStatusMessage(`Decision recorded: ${res.new_status}`);
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setNotes("");
      setSelectedObsId(null);
    },
  });

  const observations = data?.observations || [];

  const handleBulkAction = (action: string) => {
    if (selectedBulkIds.length === 0) return;
    fetch("/api/v1/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        observation_ids: selectedBulkIds,
        action: { action, reviewer_id: "bulk_analyst" },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setStatusMessage(`Bulk updated ${data.reviewed_count} observations`);
        setSelectedBulkIds([]);
        queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      });
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Human-in-the-Loop Review Queue</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-rose-400">
              {observations.length} Pending
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit weak-labeled machine observations, verify edge cases, and
            adjudicate model discrepancies.
          </p>
        </div>

        {/* Queue Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveQueue("unverified")}
            className={`px-3 py-1.5 rounded font-medium transition ${
              activeQueue === "unverified"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Weak Labels (Unverified)
          </button>
          <button
            onClick={() => setActiveQueue("uncertain")}
            className={`px-3 py-1.5 rounded font-medium transition ${
              activeQueue === "uncertain"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Flagged Uncertain
          </button>
          <button
            onClick={() => setActiveQueue("quarantined")}
            className={`px-3 py-1.5 rounded font-medium transition ${
              activeQueue === "quarantined"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Quarantined (Bad Geometries)
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage("")}
            className="text-slate-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Bulk Action Controls */}
      {selectedBulkIds.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-300 font-mono">
            {selectedBulkIds.length} observations selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction("confirm_label")}
              className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
            >
              Bulk Confirm Labels
            </button>
            <button
              onClick={() => handleBulkAction("reject_label")}
              className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 text-white font-semibold"
            >
              Bulk Reject Labels
            </button>
            <button
              onClick={() => setSelectedBulkIds([])}
              className="px-2 py-1.5 text-slate-400 hover:text-white"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-slate-900 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : observations.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-xl border border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-200">Review Queue Cleared</h3>
          <p className="text-xs text-slate-400 mt-1">
            No items currently requiring inspection in this queue.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {observations.map((obs) => {
            const isSelected = selectedObsId === obs.id;
            const isChecked = selectedBulkIds.includes(obs.id);

            return (
              <div
                key={obs.id}
                className={`p-5 rounded-xl bg-slate-900 border transition ${
                  isSelected
                    ? "border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Bulk Checkbox & Image Thumbnail */}
                  <div className="flex items-start gap-3 shrink-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBulkIds((prev) => [...prev, obs.id]);
                        } else {
                          setSelectedBulkIds((prev) =>
                            prev.filter((id) => id !== obs.id),
                          );
                        }
                      }}
                      className="mt-1 rounded bg-slate-950 border-slate-700"
                    />

                    <div className="w-32 h-24 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative shrink-0 flex items-center justify-center">
                      {obs.image_url ? (
                        <img
                          src={obs.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Images className="w-6 h-6 text-slate-600" />
                      )}
                      <div className="absolute top-1 left-1">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded text-white"
                          style={{
                            backgroundColor: obs.category_color || "#10b981",
                          }}
                        >
                          {obs.category_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata and Context */}
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/observations/${obs.id}`}
                          className="font-semibold text-slate-100 hover:text-emerald-400 text-sm inline-flex items-center gap-1.5"
                        >
                          <span>{obs.filename}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </Link>
                        <div className="text-slate-400 mt-0.5">
                          Dataset:{" "}
                          <span className="font-mono text-slate-300">
                            {obs.dataset_name}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {obs.verification_status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">
                          Source Label:
                        </span>
                        <span className="text-slate-200 font-medium">
                          {obs.original_feature_label}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Observed At:
                        </span>
                        <span className="text-slate-300 font-mono">
                          {obs.observed_at
                            ? new Date(obs.observed_at).toLocaleDateString()
                            : "Undated"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Location:</span>
                        <span className="text-slate-300">
                          {obs.city || obs.state || "United States"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Freshness:</span>
                        <span className="text-amber-400 font-mono uppercase">
                          {obs.staleness_state}
                        </span>
                      </div>
                    </div>

                    {/* Inline Review Action Form */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            reviewMutation.mutate({
                              obsId: obs.id,
                              action: "confirm_label",
                              notesText: notes,
                            })
                          }
                          className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 font-medium"
                        >
                          Confirm Label
                        </button>
                        <button
                          onClick={() =>
                            reviewMutation.mutate({
                              obsId: obs.id,
                              action: "reject_label",
                              notesText: notes,
                            })
                          }
                          className="px-3 py-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 font-medium"
                        >
                          Reject Label
                        </button>
                        <button
                          onClick={() =>
                            reviewMutation.mutate({
                              obsId: obs.id,
                              action: "mark_uncertain",
                              notesText: notes,
                            })
                          }
                          className="px-3 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 font-medium"
                        >
                          Mark Uncertain
                        </button>
                      </div>

                      {/* Expand notes */}
                      <button
                        onClick={() =>
                          setSelectedObsId(isSelected ? null : obs.id)
                        }
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        {isSelected
                          ? "Hide Review Notes"
                          : "Add Review Notes / Reassign"}
                      </button>
                    </div>

                    {/* Expanded Drawer for Notes and Category Reassignment */}
                    {isSelected && (
                      <div className="p-3 mt-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex gap-2">
                          <select
                            value={correctedCategory}
                            onChange={(e) =>
                              setCorrectedCategory(e.target.value)
                            }
                            className="text-xs rounded bg-slate-900 border border-slate-800 p-1.5 text-slate-200"
                          >
                            <option value="">Reassign category...</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.display_name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              if (correctedCategory) {
                                reviewMutation.mutate({
                                  obsId: obs.id,
                                  action: "reassign_category",
                                  analyst_category_id: correctedCategory,
                                  notesText: notes,
                                });
                              }
                            }}
                            disabled={!correctedCategory}
                            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-white"
                          >
                            Apply Reassignment
                          </button>
                        </div>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Audit rationale note..."
                          className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                        />
                      </div>
                    )}
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
