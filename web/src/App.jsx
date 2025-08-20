import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

function useDebouncedValue(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function Dot({ status }) {
  const color = status === 'ok' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function HealthBadge() {
  const [status, setStatus] = useState('unknown');
  useEffect(() => {
    let mounted = true;
    axios
      .get('/health')
      .then((r) => mounted && setStatus(r.data?.status === 'ok' ? 'ok' : 'down'))
      .catch(() => mounted && setStatus('down'));
    const id = setInterval(() => {
      axios
        .get('/health')
        .then((r) => setStatus(r.data?.status === 'ok' ? 'ok' : 'down'))
        .catch(() => setStatus('down'));
    }, 10000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);
  const label = status === 'ok' ? 'API: Healthy' : status === 'down' ? 'API: Down' : 'API: Checking…';
  const tone = status === 'ok' ? 'text-emerald-700 bg-emerald-50 ring-emerald-200' : status === 'down' ? 'text-rose-700 bg-rose-50 ring-rose-200' : 'text-gray-700 bg-gray-50 ring-gray-200';
  return (
    <span className={`inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full ring-1 ${tone}`}>
      <Dot status={status === 'unknown' ? 'degraded' : status} />
      {label}
    </span>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark((v) => !v)}
      className="text-xs md:text-sm px-2.5 py-1 rounded-full ring-1 ring-gray-200 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      aria-label="Toggle dark mode"
    >
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}

function StarRating({ value }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <div className="flex items-center gap-1" aria-label={`Rating ${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className={`w-4 h-4 ${n <= filled ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-300'}`}>
          <path d="M10 15l-5.878 3.09 1.123-6.545L.49 6.91l6.565-.954L10 0l2.945 5.956 6.565.954-4.755 4.635 1.123 6.545z" />
        </svg>
      ))}
    </div>
  );
}

function RatingsHistogram({ location, term = 'CVS Pharmacy' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!location) return;
    setLoading(true);
    setError('');
    axios
      .get(`/api/yelp/cvs/ratings-histogram`, { params: { location, term } })
      .then((res) => {
        const hist = res.data.histogram || {};
        setData(Object.entries(hist).map(([rating, count]) => ({ rating, count })));
      })
      .catch((e) => {
        setData([]);
        setError(e?.response?.data?.error || 'Unable to load histogram');
      })
      .finally(() => setLoading(false));
  }, [location, term]);

  if (loading) {
    return <div className="h-80 animate-pulse bg-gray-100 rounded" />;
  }
  if (error) {
    return <div className="text-sm text-rose-600">{error}</div>;
  }
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="rating" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReviewsTimeline({ businessId }) {
  const [labels, setLabels] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    axios
      .get(`/api/yelp/business/${businessId}/reviews`)
      .then((res) => {
        const r = res.data.reviews || [];
        setLabels(r.map((x) => new Date(x.time_created).toLocaleDateString()));
        setRatings(r.map((x) => x.rating));
      })
      .catch((e) => setError(e?.response?.data?.error || 'Unable to load reviews'))
      .finally(() => setLoading(false));
  }, [businessId]);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Rating',
          data: ratings,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.2,
        },
      ],
    }),
    [labels, ratings]
  );

  const options = useMemo(
    () => ({ scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } } }),
    []
  );

  if (!businessId) {
    return <div className="text-sm text-gray-500">Select a store to see timeline.</div>;
  }
  if (loading) {
    return <div className="h-80 animate-pulse bg-gray-100 rounded" />;
  }
  if (error) {
    return <div className="text-sm text-rose-600">{error}</div>;
  }
  return (
    <div className="h-80">
      <Line data={chartData} options={options} />
    </div>
  );
}

function BusinessDetails({ businessId, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    axios
      .get(`/api/yelp/business/${businessId}`)
      .then((res) => setDetails(res.data))
      .catch((e) => setError(e?.response?.data?.error || 'Failed to load details'))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (!businessId) return null;

  return (
    <div className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Details</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
        </div>
        {loading && <div className="h-40 animate-pulse bg-gray-100 dark:bg-gray-700 rounded" />}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {details && (
          <div className="space-y-2">
            <div className="text-xl font-medium">{details.name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{details.location?.address1}, {details.location?.city}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{details.phone}</div>
            <div className="flex items-center gap-2 text-sm">
              <StarRating value={details.rating} />
              <span>{details.rating}/5</span>
              <span className="text-gray-300">·</span>
              <span>{details.review_count} reviews</span>
            </div>
            {details.categories && (
              <div className="flex flex-wrap gap-2 text-xs">
                {details.categories.map((c) => (
                  <span key={c.alias} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{c.title}</span>
                ))}
              </div>
            )}
            {details.url && (
              <a href={details.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">View on Yelp</a>
            )}
            {details.coordinates?.latitude && details.coordinates?.longitude && (
              <a
                href={`https://www.google.com/maps?q=${details.coordinates.latitude},${details.coordinates.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View on map
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [locationInput, setLocationInput] = useState('San Francisco, CA');
  const [termInput, setTermInput] = useState('CVS Pharmacy');
  const debouncedLocation = useDebouncedValue(locationInput, 500);
  const debouncedTerm = useDebouncedValue(termInput, 500);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [priceFilter, setPriceFilter] = useState(['1', '2', '3', '4']);
  const [sortBy, setSortBy] = useState('best_match');
  const [page, setPage] = useState(0);
  const limit = 10;
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem('favorites');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [compareLocation, setCompareLocation] = useState('New York, NY');
  const debouncedCompare = useDebouncedValue(compareLocation, 500);

  useEffect(() => {
    if (!debouncedLocation || !debouncedTerm) return;
    setLoading(true);
    setError('');
    axios
      .get('/api/yelp/search', {
        params: {
          term: debouncedTerm,
          location: debouncedLocation,
          limit,
          offset: page * limit,
          price: priceFilter.sort().join(','),
          sort_by: sortBy,
        },
      })
      .then((res) => setSearchResults((res.data.businesses || []).filter((b) => (b.rating || 0) >= minRating)))
      .catch((e) => setError(e?.response?.data?.error || 'Search failed'))
      .finally(() => setLoading(false));
  }, [debouncedLocation, debouncedTerm, page, priceFilter, sortBy, minRating]);

  function togglePrice(p) {
    setPage(0);
    setPriceFilter((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function changeSort(value) {
    setPage(0);
    setSortBy(value);
  }

  function changeMinRating(value) {
    setPage(0);
    setMinRating(Number(value));
  }

  function nextPage() {
    setPage((p) => p + 1);
  }
  function prevPage() {
    setPage((p) => Math.max(p - 1, 0));
  }

  function toggleFavorite(business) {
    setFavorites((prev) => {
      const next = { ...prev };
      if (next[business.id]) delete next[business.id];
      else next[business.id] = business;
      localStorage.setItem('favorites', JSON.stringify(next));
      return next;
    });
  }

  function exportCsv() {
    const rows = [
      ['id', 'name', 'rating', 'review_count', 'price', 'phone', 'city', 'url'],
      ...searchResults.map((b) => [
        b.id,
        b.name,
        b.rating,
        b.review_count,
        b.price || '',
        b.phone || '',
        b.location?.city || '',
        b.url || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yelp_${debouncedTerm}_${debouncedLocation}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 text-white grid place-content-center font-semibold">C</div>
            <h1 className="text-xl md:text-2xl font-semibold">CVS Reviews Monitor</h1>
          </div>
          <div className="flex items-center gap-3">
            <HealthBadge />
            <ThemeToggle />
            <a
              href="/health"
              target="_blank"
              rel="noreferrer"
              className="text-xs md:text-sm text-gray-500 hover:text-gray-700"
            >
              Open /health
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <section className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-lg shadow-sm ring-1 ring-gray-100 dark:ring-gray-700">
          <div className="grid lg:grid-cols-2 gap-3 md:items-center">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-20">Location</label>
              <input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
                placeholder="City, State"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-20">Search</label>
              <input
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
                placeholder="e.g. CVS Pharmacy, Coffee, Pizza"
              />
            </div>
          </div>
          <div className="mt-3 grid md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium mr-2">Price</span>
              {['1', '2', '3', '4'].map((p) => (
                <button
                  key={p}
                  onClick={() => togglePrice(p)}
                  className={`px-2 py-1 rounded border text-sm ${priceFilter.includes(p) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  {'$'.repeat(Number(p))}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value)}
                className="border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                <option value="best_match">Best match</option>
                <option value="rating">Rating</option>
                <option value="review_count">Review count</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Min rating</label>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={minRating}
                onChange={(e) => changeMinRating(e.target.value)}
              />
              <span className="text-sm">{minRating}+</span>
            </div>
          </div>
          {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading && (
              <>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 rounded border bg-gray-50 dark:bg-gray-700 dark:border-gray-700 animate-pulse" />
                ))}
              </>
            )}
            {!loading && searchResults.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className={`group text-left border rounded p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition dark:border-gray-700 ${
                  selected?.id === b.id ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium line-clamp-1">{b.name}</div>
                  <div className="shrink-0"><StarRating value={b.rating} /></div>
                </div>
                <div className="mt-1 text-sm text-gray-600 flex items-center gap-2">
                  <span className="whitespace-nowrap">{b.rating?.toFixed?.(1) ?? b.rating}/5</span>
                  <span className="text-gray-300">·</span>
                  <span className="whitespace-nowrap">{b.review_count} reviews</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{b.location?.city}</div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {b.price && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{b.price}</span>}
                  {b.phone && <span>{b.phone}</span>}
                  {b.url && (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(b); }}
                    className={`ml-auto text-sm ${favorites[b.id] ? 'text-rose-600' : 'text-gray-400 hover:text-rose-500'}`}
                    aria-label="Toggle favorite"
                    title="Toggle favorite"
                  >
                    {favorites[b.id] ? '♥' : '♡'}
                  </button>
                </div>
              </button>
            ))}
            {!loading && !searchResults.length && !error && (
              <div className="text-sm text-gray-500">No results.</div>
            )}
            {!loading && searchResults.length > 0 && (
              <div className="col-span-full flex items-center justify-between mt-2">
                <div className="flex gap-2">
                  <button onClick={prevPage} disabled={page === 0} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
                  <button onClick={nextPage} className="px-3 py-1 border rounded">Next</button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Page {page + 1}</span>
                  <button onClick={exportCsv} className="px-3 py-1 border rounded">Export CSV</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-lg shadow-sm ring-1 ring-gray-100 dark:ring-gray-700">
          <h2 className="text-lg font-semibold mb-4">Ratings Histogram (CVS in {debouncedLocation})</h2>
          <RatingsHistogram location={debouncedLocation} term={debouncedTerm} />
        </section>

        <section className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-lg shadow-sm ring-1 ring-gray-100 dark:ring-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Reviews Timeline</h2>
            <div className="text-sm text-gray-600">
              {selected ? selected.name : 'Select a store above'}
            </div>
          </div>
          <ReviewsTimeline businessId={selected?.id} />
        </section>

        <section className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-lg shadow-sm ring-1 ring-gray-100 dark:ring-gray-700">
          <h2 className="text-lg font-semibold mb-3">Compare Locations</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm mb-2">{debouncedLocation}</div>
              <RatingsHistogram location={debouncedLocation} term={debouncedTerm} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={compareLocation}
                  onChange={(e) => setCompareLocation(e.target.value)}
                  className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700"
                  placeholder="Compare city, state"
                />
              </div>
              <RatingsHistogram location={debouncedCompare} term={debouncedTerm} />
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-8 border-t bg-white/70 dark:bg-gray-900/70">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>Demo app for monitoring & visualization</span>
          <span>React · Tailwind · Recharts · Chart.js</span>
        </div>
      </footer>

      {selected && (
        <BusinessDetails businessId={selected.id} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

