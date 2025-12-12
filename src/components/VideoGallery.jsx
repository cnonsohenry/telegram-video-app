import { useEffect, useState } from "react";

export default function VideoGallery() {
  const [videos, setVideos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const res = await fetch("https://telegram-video-backend.onrender.com/videos");
        const data = await res.json();
        setVideos(data);
        setFiltered(data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    };
    loadVideos();
  }, []);

  // Search filter
  useEffect(() => {
    const lower = search.toLowerCase();
    const results = videos.filter(v =>
      (v.title || "").toLowerCase().includes(lower)
    );
    setFiltered(results);
    setPage(1);
  }, [search, videos]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  if (loading) {
    return <div className="p-4 text-center text-gray-300">Loading videos…</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* SEARCH BAR */}
      <input
        type="text"
        placeholder="Search videos…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2 mb-4 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none"
      />

      {/* VIDEO GRID */}
      {paginated.length === 0 ? (
        <p classnName="text-gray-400 text-center">No videos found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {paginated.map((vid, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-xl shadow-lg border border-gray-700 p-2"
            >
              <video
                controls
                className="w-full rounded-lg"
                src={vid.url}
              />
              <p className="text-gray-300 mt-2 text-sm">
                {vid.title || "Untitled video"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-6">
          <button
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Prev
          </button>

          <span className="text-gray-300">
            Page {page} of {totalPages}
          </span>

          <button
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-40"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
