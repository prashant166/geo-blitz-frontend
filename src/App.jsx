import React, { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const API_BASE = import.meta.env?.VITE_API_BASE || ""; // e.g. "/api"

export default function App() {
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const isLikelyValidIP = useMemo(() => {
    if (!ip) return false;
    return isIPv4(ip) || isIPv6(ip);
  }, [ip]);

  async function onLookup(targetIP) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const ipParam = targetIP ?? ip;
      if (!ipParam) {
        throw new Error("Please enter an IP or use 'Use my IP'.");
      }
      const url = `${API_BASE}/geo?ip=${encodeURIComponent(ipParam)}`;
      const res = await fetch(url, { method: "GET" });
      const text = await res.text();
      if (!res.ok) {
        // Try to parse server error JSON if possible
        let msg = text;
        try {
          const e = JSON.parse(text);
          if (e?.error) msg = e.error;
        } catch {}
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const json = JSON.parse(text);
      setResult(json);
    } catch (e) {
      setError(e?.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  async function onUseMyIP() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      // Prefer IPv6-capable endpoint, works for both v4/v6
      const my = await fetch("https://api64.ipify.org?format=json", { cache: "no-store" }).then(r => r.json());
      const myIP = my?.ip;
      if (!myIP) throw new Error("Could not determine your public IP");
      setIp(myIP);
      await onLookup(myIP);
    } catch (e) {
      setError(e?.message || "Could not fetch your public IP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-slate-900 text-white font-bold">GB</span>
            <h1 className="text-lg sm:text-xl font-semibold">Geo Blitz</h1>
          </div>
          <div className="text-xs sm:text-sm text-slate-500">Fast IP → Location lookup</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label htmlFor="ip" className="block text-sm font-medium text-slate-600 mb-1">IP address (IPv4 or IPv6)</label>
              <input
                id="ip"
                value={ip}
                onChange={(e) => setIp(e.target.value.trim())}
                placeholder="e.g., 8.8.8.8 or 2404:6800:4003:c03::8a"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                inputMode="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {ip && !isLikelyValidIP && (
                <p className="mt-1 text-xs text-amber-600">This doesn’t look like a valid IP. You can still try lookup.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onLookup()}
                disabled={loading || (!ip && !isLikelyValidIP)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-white shadow hover:bg-black disabled:opacity-50"
              >
                <SearchIcon />
                Lookup
              </button>
              <button
                type="button"
                onClick={onUseMyIP}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-slate-900 hover:bg-slate-200"
              >
                <BoltIcon />
                Use my IP
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <QuickChip onClick={setIp} label="8.8.8.8" />
            <QuickChip onClick={setIp} label="1.1.1.1" />
            <QuickChip onClick={setIp} label="9.9.9.9" />
            <QuickChip onClick={setIp} label="2001:4860:4860::8888" />
          </div>
        </section>

        <section className="mt-6">
          {loading && <LoadingCard />}
          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 text-red-800">
              <div className="flex items-center gap-2 font-medium"><ErrorIcon /> Error</div>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}
          {!loading && !error && result && (
            <ResultCard data={result} />
          )}
          {!loading && !error && !result && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
              Enter an IP or click <span className="font-medium text-slate-700">Use my IP</span> to see a lookup.
            </div>
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-500">
          Built with Go backend + local MaxMind/IP2Location • UI by React + Tailwind • © {new Date().getFullYear()} Geo Blitz
        </footer>
      </main>
    </div>
  );
}

function ResultCard({ data }) {
  const {
    ip,
    country_code,
    country_name,
    region,
    city,
    lat,
    lon,
    source,
    lookup_ms,
  } = data || {};

  const flag = country_code ? ccToFlag(country_code) : "";
  const position = (lat && lon) ? [lat, lon] : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg sm:text-xl font-semibold flex items-center gap-2">
          <GlobeIcon />
          <span>{ip || "—"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            <SparkleIcon /> source: <span className="font-medium text-slate-900">{source || "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            <TimerIcon /> lookup: <span className="font-medium text-slate-900">{typeof lookup_ms === 'number' ? `${lookup_ms} ms` : "—"}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoTile label="Country" value={<span className="inline-flex items-center gap-2">{flag && <span className="text-xl">{flag}</span>}<span>{country_name || "—"} {country_code && (<span className="text-slate-500">({country_code})</span>)}</span></span>} />
        <InfoTile label="Region" value={region || "—"} />
        <InfoTile label="City" value={city || "—"} />
        <InfoTile label="Latitude" value={lat ?? "—"} />
        <InfoTile label="Longitude" value={lon ?? "—"} />
      </div>

      {/* Embedded map */}
      {position && (
        <div className="mt-4 h-64 w-full rounded-xl overflow-hidden border border-slate-200">
          <MapContainer center={position} zoom={9} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker
              position={position}
              icon={L.icon({
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                iconSize: [25, 41],
                iconAnchor: [12, 41],
              })}
            >
              <Popup>
                {city ? `${city}, ${country_name}` : country_name || "Unknown location"}
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ChevronDownIcon className="transition-transform group-open:rotate-180" /> Raw JSON
        </summary>
        <pre className="mt-2 rounded-xl bg-slate-50 border border-slate-200 p-3 overflow-auto text-xs text-slate-800">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white/60">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm sm:text-base text-slate-900 break-words">{value}</div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="mt-2 h-4 w-32 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickChip({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-100 text-xs"
    >
      <PinIcon /> {label}
    </button>
  );
}

// --- helpers ---
function isIPv4(s) {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  return ipv4.test(s);
}
function isIPv6(s) {
  // permissive IPv6 (allows :: compression)
  const ipv6 = /^(([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|([0-9A-Fa-f]{1,4}:){1,7}:|:([0-9A-Fa-f]{1,4}:){1,7}|([0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|([0-9A-Fa-f]{1,4}:){1,5}(:[0-9A-Fa-f]{1,4}){1,2}|([0-9A-Fa-f]{1,4}:){1,4}(:[0-9A-Fa-f]{1,4}){1,3}|([0-9A-Fa-f]{1,4}:){1,3}(:[0-9A-Fa-f]{1,4}){1,4}|([0-9A-Fa-f]{1,4}:){1,2}(:[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:((:[0-9A-Fa-f]{1,4}){1,6}))$/;
  return ipv6.test(s);
}
function ccToFlag(cc) {
  try {
    if (!cc) return "";
    const up = cc.trim().toUpperCase();
    if (up.length !== 2) return "";
    const codePoints = [...up].map(c => 0x1F1E6 - 65 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "";
  }
}

// --- icons (pure SVG, no external libs) ---
function SearchIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}
function BoltIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
function GlobeIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z"></path>
    </svg>
  );
}
function SparkleIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l2.2 5.3L20 9l-5.3 1.7L12 16l-2.7-5.3L4 9l5.8-1.7L12 2z" />
    </svg>
  );
}
function TimerIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 6v6l4 2"></path>
    </svg>
  );
}
function ChevronDownIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}
function ErrorIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12" y2="16" />
    </svg>
  );
}
function PinIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 10c0 5.25-9 12-9 12S3 15.25 3 10a9 9 0 1 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
