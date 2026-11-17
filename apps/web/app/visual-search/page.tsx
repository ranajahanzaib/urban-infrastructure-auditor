"use client";

import { fetchCategories, searchVisual } from "@/lib/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Images, Info, MapPin, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const SUGGESTIONS = [
  "A residential street lined with mature trees",
  "An electric vehicle charging station",
  "A public road with active construction work",
  "A street with a dedicated bicycle lane",
  "A building with rooftop solar panels",
  "An urban rain garden beside a sidewalk",
  "Heavy earthmoving excavators and digging",
  "Scaffolding erected along an urban building facade",
];

export default function VisualSearchPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const searchMutation = useMutation({
    mutationFn: (searchQuery: string) =>
      searchVisual(searchQuery, {
        limit: 24,
        category_id: selectedCategory || undefined,
      }),
  });

  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    searchMutation.mutate(q);
  };

  const results = searchMutation.data?.results || [];

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multimodal Cross-Modal Search Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Natural-Language Visual Search
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Type an open-vocabulary visual description. The query is embedded via
          SigLIP 2 into a 768-d vector and matched across all indexed
          street-level observation vectors in pgvector.
        </p>
      </div>

      {/* Main Search Bar Card */}
      <div className="max-w-3xl mx-auto space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(query);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. An electric vehicle charging station beside a curb..."
              className="w-full text-sm pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={searchMutation.isPending || !query.trim()}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
          >
            {searchMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Encoding...</span>
              </span>
            ) : (
              <span>Search Imagery</span>
            )}
          </button>
        </form>

        {/* Suggested Queries */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            Suggested Prompts:
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSearch(s)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-400 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Epistemic Calibration Banner */}
      <div className="max-w-3xl mx-auto p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Visual Similarity Scoring:</strong> Returned scores reflect
          normalized cosine similarity between the query text vector and stored
          image embeddings. These values represent relative ranking criteria
          rather than calibrated statistical probabilities.
        </p>
      </div>

      {/* Results Section */}
      {searchMutation.isError && (
        <div className="max-w-3xl mx-auto p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-xs">
          Search request failed: {searchMutation.error.message}
        </div>
      )}

      {searchMutation.data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <span className="text-slate-400">
              Found{" "}
              <strong className="text-white font-mono">{results.length}</strong>{" "}
              visual matches for: &ldquo;
              <span className="text-emerald-400">
                {searchMutation.data.query}
              </span>
              &rdquo;
            </span>
            <span className="font-mono text-slate-500">
              Model: {searchMutation.data.model}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((obs) => (
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
                    <Images className="w-8 h-8 text-slate-700" />
                  )}
                  <div className="absolute top-2 left-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded text-white shadow"
                      style={{
                        backgroundColor: obs.category_color || "#10b981",
                      }}
                    >
                      {obs.category_name}
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/85 text-emerald-400 font-bold border border-emerald-500/30 backdrop-blur">
                      Sim:{" "}
                      {obs.visual_similarity
                        ? obs.visual_similarity.toFixed(4)
                        : "N/A"}
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
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80 flex justify-between">
                    <span>Source: {obs.original_feature_label}</span>
                    <span className="font-mono text-slate-400">
                      {obs.verification_status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
