"use client";

import { fetchDatasets, fetchImportJobs } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, Terminal } from "lucide-react";
import { useState } from "react";

export default function DataSourcesPage() {
  const [triggerStatus, setTriggerStatus] = useState<string>("");

  const {
    data: datasets = [],
    isLoading: isDatasetsLoading,
    refetch: refetchDatasets,
  } = useQuery({
    queryKey: ["datasets"],
    queryFn: fetchDatasets,
  });

  const {
    data: importJobs = [],
    isLoading: isJobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: fetchImportJobs,
  });

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Data Sources & Ingestion Pipeline</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
              CC BY 4.0 Attributed
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            First-class integration with real-world Hugging Face street-level
            observation repositories.
          </p>
        </div>

        <button
          onClick={() => {
            refetchDatasets();
            refetchJobs();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Datasets Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {datasets.map((ds) => (
          <div
            key={ds.id}
            className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                    Hugging Face Dataset
                  </span>
                  <h2 className="text-base font-bold text-white mt-0.5">
                    {ds.display_name}
                  </h2>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">
                  {ds.license}
                </span>
              </div>

              <a
                href={ds.repository_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>{ds.repository_url}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <p className="text-xs text-slate-300 leading-relaxed">
                {ds.description}
              </p>
            </div>

            {/* Metrics */}
            <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">
                    Imported Rows
                  </span>
                  <span className="text-sm font-bold text-white">
                    {ds.imported_records.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">
                    Images Resolved
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {ds.image_records}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">
                    Metadata-only
                  </span>
                  <span className="text-sm font-bold text-slate-400">
                    {(ds.imported_records - ds.image_records).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                <strong className="text-slate-300">
                  Provenance Attribution:{" "}
                </strong>
                {ds.attribution}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CLI Ingestion Commands Card */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Reusable Python Ingestion CLI</span>
        </div>
        <p className="text-xs text-slate-400">
          Run dataset downloads, coordinate sanitization, and batch embedding
          directly from terminal:
        </p>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 space-y-1 overflow-x-auto">
          <div># Import green infrastructure dataset</div>
          <div className="text-slate-200">
            python -m ingestion import green-infrastructure --limit 10000
          </div>
          <div className="pt-1 text-slate-500">
            # Import construction and public works dataset
          </div>
          <div className="text-slate-200">
            python -m ingestion import construction --limit 10000
          </div>
          <div className="pt-1 text-slate-500">
            # Check global ingestion status
          </div>
          <div className="text-slate-200">python -m ingestion status</div>
        </div>
      </div>

      {/* Import Jobs History Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Import Execution History
            </h2>
            <p className="text-xs text-slate-400">
              Idempotent background ingestion jobs logged in PostgreSQL
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-2.5">Job ID</th>
                <th className="p-2.5">Dataset</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Imported Rows</th>
                <th className="p-2.5">Images Resolved</th>
                <th className="p-2.5">Started At</th>
                <th className="p-2.5">Completed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {importJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/40">
                  <td className="p-2.5 text-slate-300 truncate max-w-[150px]">
                    {job.id}
                  </td>
                  <td className="p-2.5 text-slate-200">{job.dataset_id}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2.5 text-white">
                    {job.imported_rows.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-emerald-400">
                    {job.images_resolved}
                  </td>
                  <td className="p-2.5 text-slate-400 text-[11px]">
                    {job.started_at
                      ? new Date(job.started_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="p-2.5 text-slate-400 text-[11px]">
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
