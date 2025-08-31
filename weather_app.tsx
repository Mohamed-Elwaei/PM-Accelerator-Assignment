"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

// --- Types ---
interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
}

interface CurrentWeather {
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  relative_humidity_2m: number;
}

interface DailyWeather {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max?: number[]; // Open-Meteo may omit depending on params
}

interface WeatherResponse {
  latitude: number;
  longitude: number;
  timezone?: string;
  current: CurrentWeather;
  daily: DailyWeather;
}

// --- Utilities ---
const WMO_CODE_MAP: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear sky", emoji: "☀️" },
  1: { label: "Mainly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫️" },
  48: { label: "Depositing rime fog", emoji: "🌫️" },
  51: { label: "Light drizzle", emoji: "🌦️" },
  53: { label: "Moderate drizzle", emoji: "🌦️" },
  55: { label: "Dense drizzle", emoji: "🌧️" },
  56: { label: "Light freezing drizzle", emoji: "🌧️🥶" },
  57: { label: "Dense freezing drizzle", emoji: "🌧️🥶" },
  61: { label: "Slight rain", emoji: "🌦️" },
  63: { label: "Moderate rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  66: { label: "Light freezing rain", emoji: "🌧️🥶" },
  67: { label: "Heavy freezing rain", emoji: "🌧️🥶" },
  71: { label: "Slight snow", emoji: "🌨️" },
  73: { label: "Moderate snow", emoji: "🌨️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  77: { label: "Snow grains", emoji: "🌨️" },
  80: { label: "Rain showers (slight)", emoji: "🌦️" },
  81: { label: "Rain showers (moderate)", emoji: "🌧️" },
  82: { label: "Rain showers (violent)", emoji: "⛈️" },
  85: { label: "Snow showers (slight)", emoji: "🌨️" },
  86: { label: "Snow showers (heavy)", emoji: "❄️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm w/ slight hail", emoji: "⛈️🧊" },
  99: { label: "Thunderstorm w/ heavy hail", emoji: "⛈️🧊" },
};

function codeToEmoji(code?: number) {
  if (code == null) return "❓";
  return WMO_CODE_MAP[code]?.emoji ?? "❓";
}
function codeToLabel(code?: number) {
  if (code == null) return "Unknown";
  return WMO_CODE_MAP[code]?.label ?? `Code ${code}`;
}

function formatPlace(g: GeoResult) {
  const parts = [g.name, g.admin1, g.country].filter(Boolean);
  return parts.join(", ");
}

function isLatLonInput(q: string) {
  const m = q.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*$/);
  return !!m;
}

function parseLatLon(q: string): { lat: number; lon: number } | null {
  const m = q.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

// --- Component ---
export default function Page() {
  const [query, setQuery] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<GeoResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);

  const tempUnit = units === "metric" ? "°C" : "°F";
  const speedUnit = units === "metric" ? "m/s" : "mph";

  // Convert metric to imperial for display when needed
  const convertTemp = useCallback(
    (c: number) => (units === "imperial" ? c * 9/5 + 32 : c),
    [units]
  );
  const convertSpeed = useCallback(
    (ms: number) => (units === "imperial" ? ms * 2.236936 : ms),
    [units]
  );

  const fetchSuggestions = useCallback(async (text: string) => {
    if (!text || isLatLonInput(text)) { setSuggestions([]); return; }
    try {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", text);
      url.searchParams.set("count", "5");
      url.searchParams.set("language", "en");
      const res = await fetch(url.toString());
      const data = await res.json();
      setSuggestions(
        (data?.results || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          country: r.country,
          admin1: r.admin1,
          admin2: r.admin2,
          admin3: r.admin3,
          admin4: r.admin4,
        }))
      );
    } catch (e) {
      // ignore autosuggest errors
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  const resolveAndFetch = useCallback(async (lat: number, lon: number, chosenPlace?: GeoResult) => {
    setLoading(true);
    setError(null);
    setWeather(null);
    try {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        timezone: "auto",
        current: [
          "temperature_2m",
          "apparent_temperature",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "relative_humidity_2m",
        ].join(","),
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
          "wind_speed_10m_max",
        ].join(","),
        forecast_days: "7",
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch weather");
      const raw = await res.json();

      const current: CurrentWeather = raw.current;
      const daily: DailyWeather = raw.daily;

      setWeather({
        latitude: raw.latitude,
        longitude: raw.longitude,
        timezone: raw.timezone,
        current,
        daily,
      });

      if (chosenPlace) setPlace(chosenPlace);
      else setPlace({ id: 0, name: `(${lat.toFixed(3)}, ${lon.toFixed(3)})`, latitude: lat, longitude: lon });
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    // 1) Direct lat,lon input
    const ll = parseLatLon(query);
    if (ll) {
      await resolveAndFetch(ll.lat, ll.lon);
      return;
    }

    // 2) Geocode by name / postal / landmark
    try {
      setLoading(true);
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", query.trim());
      url.searchParams.set("count", "1");
      url.searchParams.set("language", "en");
      const res = await fetch(url.toString());
      const data = await res.json();
      const first = data?.results?.[0];
      if (!first) throw new Error("No matching locations found");
      const chosen: GeoResult = {
        id: first.id,
        name: first.name,
        latitude: first.latitude,
        longitude: first.longitude,
        country: first.country,
        admin1: first.admin1,
        admin2: first.admin2,
        admin3: first.admin3,
        admin4: first.admin4,
      };
      await resolveAndFetch(chosen.latitude, chosen.longitude, chosen);
    } catch (e: any) {
      setError(e?.message ?? "Failed to resolve location");
    } finally {
      setLoading(false);
    }
  }, [query, resolveAndFetch]);

  const useMyLocation = useCallback(() => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported in this browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolveAndFetch(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Failed to get your location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [resolveAndFetch]);

  const fiveDay = useMemo(() => {
    if (!weather?.daily) return [] as Array<{
      date: string;
      code?: number;
      tmax?: number;
      tmin?: number;
      ppop?: number;
      wmax?: number;
    }>;
    const d = weather.daily;
    const out = d.time.map((t, i) => ({
      date: t,
      code: d.weather_code?.[i],
      tmax: d.temperature_2m_max?.[i],
      tmin: d.temperature_2m_min?.[i],
      ppop: d.precipitation_probability_max?.[i],
      wmax: d.wind_speed_10m_max?.[i],
    }));
    return out.slice(0, 5);
  }, [weather]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Weather App — Next.js</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm">Units:</span>
            <button
              className={`rounded-full px-3 py-1 text-sm border ${units === "metric" ? "bg-black text-white" : "bg-white"}`}
              onClick={() => setUnits("metric")}
              aria-pressed={units === "metric"}
            >
              Metric
            </button>
            <button
              className={`rounded-full px-3 py-1 text-sm border ${units === "imperial" ? "bg-black text-white" : "bg-white"}`}
              onClick={() => setUnits("imperial")}
              aria-pressed={units === "imperial"}
            >
              Imperial
            </button>
          </div>
        </header>

        <section className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm text-gray-600">
              Enter a location (City, Town, ZIP/Postal Code, Landmark, or "lat, lon"):
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring"
                placeholder="e.g., Tampa, FL • 10001 • Eiffel Tower • 27.95, -82.46"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit" className="rounded-xl bg-black px-4 py-2 text-white">
                Get Weather
              </button>
              <button type="button" onClick={useMyLocation} className="rounded-xl border px-4 py-2">
                Use My Location
              </button>
            </div>

            {/* Lightweight inline suggestions */}
            {suggestions.length > 0 && (
              <div className="-mt-1 rounded-xl border bg-white">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      setQuery(formatPlace(s));
                      resolveAndFetch(s.latitude, s.longitude, s);
                      setSuggestions([]);
                    }}
                  >
                    {formatPlace(s)} ({s.latitude.toFixed(2)}, {s.longitude.toFixed(2)})
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                {error}
              </div>
            )}
          </form>
        </section>

        {loading && (
          <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
            <div className="animate-pulse text-lg">Fetching live weather…</div>
          </div>
        )}

        {weather && (
          <section className="space-y-4">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-500">Location</div>
                  <div className="text-lg font-semibold">
                    {place ? formatPlace(place) : `(${weather.latitude.toFixed(3)}, ${weather.longitude.toFixed(3)})`}
                  </div>
                  {weather.timezone && (
                    <div className="text-xs text-gray-500">Timezone: {weather.timezone}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-5xl">
                  <span>{codeToEmoji(weather.current.weather_code)}</span>
                  <span className="text-4xl font-bold">
                    {convertTemp(weather.current.temperature_2m).toFixed(0)}{tempUnit}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Condition" value={codeToLabel(weather.current.weather_code)} />
                <Stat label="Feels like" value={`${convertTemp(weather.current.apparent_temperature).toFixed(0)}${tempUnit}`} />
                <Stat label="Humidity" value={`${Math.round(weather.current.relative_humidity_2m)}%`} />
                <Stat label="Wind" value={`${convertSpeed(weather.current.wind_speed_10m).toFixed(1)} ${speedUnit}`} />
                <Stat label="Precip" value={`${weather.current.precipitation.toFixed(1)} mm`} />
                <Stat label="Coords" value={`${weather.latitude.toFixed(2)}, ${weather.longitude.toFixed(2)}`} />
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">5‑Day Forecast</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
                {fiveDay.map((d) => (
                  <div key={d.date} className="rounded-xl border p-4 text-center">
                    <div className="text-sm text-gray-500">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                    <div className="my-2 text-4xl">{codeToEmoji(d.code)}</div>
                    <div className="text-sm">{codeToLabel(d.code)}</div>
                    <div className="mt-2 font-semibold">
                      {convertTemp(d.tmax ?? NaN).toFixed(0)}{tempUnit}
                      <span className="text-gray-400"> / </span>
                      {convertTemp(d.tmin ?? NaN).toFixed(0)}{tempUnit}
                    </div>
                    {typeof d.ppop === "number" && (
                      <div className="text-xs text-gray-600">Precip prob: {Math.round(d.ppop)}%</div>
                    )}
                    {typeof d.wmax === "number" && (
                      <div className="text-xs text-gray-600">Wind max: {convertSpeed(d.wmax).toFixed(1)} {speedUnit}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-gray-500">
          Live data from Open‑Meteo APIs. No API key required.
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
