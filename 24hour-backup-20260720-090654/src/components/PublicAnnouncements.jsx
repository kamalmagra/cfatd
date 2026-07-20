import React, { useCallback, useEffect, useState } from "react";

const PublicAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/announcements/public");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load announcements.");
      }

      setAnnouncements(result.data || []);
    } catch (fetchError) {
      console.error("Public announcements error:", fetchError);
      setError(fetchError.message || "Unable to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 pb-16 pt-32 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]" />
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-green-600/15 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">
                Cargo Force Public Updates
              </span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Public
              <span className="block text-gray-500">Announcements</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-400">
              Official notices, service updates and important information from
              Cargo Force.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchAnnouncements}
            disabled={loading}
            className="h-fit rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {loading ? (
          <div className="rounded-[30px] border border-white/10 bg-[#050505] px-6 py-24 text-center shadow-2xl">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-purple-500" />
            <p className="text-gray-500">Loading public announcements...</p>
          </div>
        ) : error ? (
          <div className="rounded-[30px] border border-red-500/20 bg-red-500/10 px-6 py-20 text-center">
            <h2 className="text-2xl font-bold text-red-400">
              Announcements unavailable
            </h2>
            <p className="mt-3 text-gray-400">{error}</p>

            <button
              type="button"
              onClick={fetchAnnouncements}
              className="mt-6 rounded-2xl bg-white px-6 py-3 font-bold text-black hover:bg-gray-200"
            >
              Try Again
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-white/10 bg-[#050505] px-6 py-24 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-2xl">
              !
            </div>

            <h2 className="text-2xl font-bold">No public announcements</h2>
            <p className="mt-3 text-gray-500">
              New public updates will appear here when they are published.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {announcements.map((announcement, index) => (
              <article
                key={announcement._id}
                className="fade-up rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl md:p-8"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-black">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold uppercase text-green-400">
                        Public Notice
                      </span>

                      <span className="text-xs text-gray-600">
                        {formatDate(announcement.createdAt)}
                      </span>
                    </div>

                    <h2 className="break-words text-2xl font-bold md:text-3xl">
                      {announcement.title}
                    </h2>

                    <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7 text-gray-400">
                      {announcement.message}
                    </p>

                    <div className="mt-6 border-t border-white/10 pt-4">
                      <p className="text-sm text-gray-600">
                        Published by{" "}
                        <span className="font-semibold text-gray-400">
                          {announcement.createdBy || "Cargo Force Admin"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PublicAnnouncements;
