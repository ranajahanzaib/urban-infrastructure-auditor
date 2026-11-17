import AppShell from "@/components/AppShell";
import QueryProvider from "@/components/QueryProvider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "Urban Infrastructure Auditor | Geospatial Infrastructure Intelligence",
  description:
    "Street-level infrastructure observation intelligence platform integrating computer vision embeddings, PostGIS spatial analysis, multimodal SigLIP visual search, and human-in-the-loop verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
