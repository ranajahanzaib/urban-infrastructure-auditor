"use client";

import { fetchCategories, fetchGeoObservations } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Filter, Images, X } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function MapExplorerPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [selectedObs, setSelectedObs] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [onlyWithImages, setOnlyWithImages] = useState<boolean>(false);
  const [bboxString, setBboxString] = useState<string>("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const {
    data: geoData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "geo-observations",
      bboxString,
      selectedCategory,
      selectedGroup,
      onlyWithImages,
    ],
    queryFn: () =>
      fetchGeoObservations({
        bbox: bboxString || undefined,
        category_id: selectedCategory !== "all" ? selectedCategory : undefined,
        category_group: selectedGroup !== "all" ? selectedGroup : undefined,
        limit: 1500,
      }),
  });

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Use clean free OpenStreetMap tile style
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-122.4194, 37.7749], // San Francisco default center
      zoom: 10,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );

    map.on("load", () => {
      // Add GeoJSON source with clustering
      map.addSource("observations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Clusters layer
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "observations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#10b981",
            20,
            "#06b6d4",
            50,
            "#f59e0b",
            100,
            "#ef4444",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            20,
            24,
            50,
            30,
            100,
            36,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.85,
        },
      });

      // Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "observations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual unclustered observation points
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "observations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["coalesce", ["get", "color_hex"], "#10b981"],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Click on cluster zooms in
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const clusterId = features[0].properties.cluster_id;
        const source: any = map.getSource("observations");
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({
            center: (features[0].geometry as any).coordinates,
            zoom: zoom,
          });
        });
      });

      // Click on individual observation
      map.on("click", "unclustered-point", (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        setSelectedObs(props);
      });

      map.on(
        "mouseenter",
        "clusters",
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on(
        "mouseleave",
        "clusters",
        () => (map.getCanvas().style.cursor = ""),
      );
      map.on(
        "mouseenter",
        "unclustered-point",
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on(
        "mouseleave",
        "unclustered-point",
        () => (map.getCanvas().style.cursor = ""),
      );

      // Update bbox on move end
      map.on("moveend", () => {
        const bounds = map.getBounds();
        const bbox = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
        setBboxString(bbox);
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map source whenever geoData changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.isStyleLoaded() && map.getSource("observations") && geoData) {
      let filteredFeatures = geoData.features || [];
      if (onlyWithImages) {
        filteredFeatures = filteredFeatures.filter(
          (f) => f.properties.image_availability === "available",
        );
      }
      (map.getSource("observations") as any).setData({
        type: "FeatureCollection",
        features: filteredFeatures,
      });
    }
  }, [geoData, onlyWithImages]);

  // Jump to representative cities
  const flyToCity = (lon: number, lat: number, zoom = 11) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lon, lat], zoom, essential: true });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] flex overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainer} className="flex-1 w-full h-full bg-slate-950" />

      {/* Floating Filter Overlay */}
      <div className="absolute top-4 left-4 z-10 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Map Layers & Filters</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {geoData?.features
              ? `${geoData.features.length} in view`
              : "Loading..."}
          </span>
        </div>

        {/* Group Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300">
            Infrastructure Group
          </label>
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
            <button
              onClick={() => setSelectedGroup("all")}
              className={`py-1 rounded font-medium transition ${
                selectedGroup === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedGroup("green_infrastructure")}
              className={`py-1 rounded font-medium transition ${
                selectedGroup === "green_infrastructure"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Green
            </button>
            <button
              onClick={() => setSelectedGroup("construction_public_works")}
              className={`py-1 rounded font-medium transition ${
                selectedGroup === "construction_public_works"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Works
            </button>
          </div>
        </div>

        {/* Specific Category Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-300">
            Feature Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 p-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All 12 Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} (
                {c.category_group === "green_infrastructure"
                  ? "Green"
                  : "Construction"}
                )
              </option>
            ))}
          </select>
        </div>

        {/* Image Availability Toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Images className="w-3.5 h-3.5 text-amber-400" />
            <span>Only with images</span>
          </span>
          <button
            onClick={() => setOnlyWithImages(!onlyWithImages)}
            className={`w-9 h-5 rounded-full transition relative p-0.5 ${
              onlyWithImages ? "bg-emerald-500" : "bg-slate-800"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition transform ${
                onlyWithImages ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Quick Location Jumps */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-medium text-slate-400">
            Quick Focus Cities
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => flyToCity(-122.4194, 37.7749)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              San Francisco, CA
            </button>
            <button
              onClick={() => flyToCity(-122.6784, 45.5152)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Portland, OR
            </button>
            <button
              onClick={() => flyToCity(-117.1611, 32.7157)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              San Diego, CA
            </button>
            <button
              onClick={() => flyToCity(-121.4944, 38.5816)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Sacramento, CA
            </button>
          </div>
        </div>
      </div>

      {/* Selected Observation Inspection Drawer */}
      {selectedObs && (
        <div className="absolute right-4 top-4 bottom-4 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-5 overflow-y-auto z-20 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded text-white"
                  style={{
                    backgroundColor: selectedObs.color_hex || "#10b981",
                  }}
                >
                  {selectedObs.category_name}
                </span>
                <h3 className="text-sm font-semibold text-white mt-1.5 truncate">
                  {selectedObs.filename}
                </h3>
              </div>
              <button
                onClick={() => setSelectedObs(null)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="aspect-[4/3] rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative">
              {selectedObs.image_url ? (
                <img
                  src={selectedObs.image_url}
                  alt={selectedObs.original_feature_label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Images className="w-8 h-8 text-slate-700 mx-auto mb-1" />
                  <span className="text-xs font-mono text-slate-500">
                    Metadata-only Observation
                  </span>
                </div>
              )}
            </div>

            {/* Provenance Metadata Table */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Weak Source Label</span>
                <span className="text-slate-200 font-medium">
                  {selectedObs.original_feature_label}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Location</span>
                <span className="text-slate-200 font-medium">
                  {selectedObs.city
                    ? `${selectedObs.city}, ${selectedObs.state || ""}`
                    : selectedObs.state || "United States"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Observed At</span>
                <span className="text-slate-200 font-mono">
                  {selectedObs.observed_at
                    ? new Date(selectedObs.observed_at).toLocaleDateString()
                    : "Undated"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Verification</span>
                <span className="font-mono text-emerald-400 font-medium">
                  {selectedObs.verification_status}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-medium">
                Methodological note:{" "}
              </span>
              This observation provides evidence of recorded visual features at
              capture time. It does not establish current operational status or
              physical completeness.
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <Link
              href={`/observations/${selectedObs.id}`}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition"
            >
              <span>Open Complete Observation Audit</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
