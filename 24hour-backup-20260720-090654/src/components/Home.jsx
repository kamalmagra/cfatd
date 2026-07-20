import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const Home = () => {
  const [publicAnnouncements, setPublicAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const steps = [
    {
      number: "01",
      title: "Employee Login",
      text: "Employee signs in to access their QR identity page.",
    },
    {
      number: "02",
      title: "Generate QR",
      text: "Employee creates and downloads their personal attendance QR code.",
    },
    {
      number: "03",
      title: "Choose Scan Method",
      text: "Admin scans employee QR, or employee chooses an action and scans the admin QR.",
    },
  ];

  useEffect(() => {
    const fetchPublicAnnouncements = async () => {
      try {
        const response = await fetch("/api/announcements/public");
        const result = await response.json();

        if (response.ok && result.success) {
          setPublicAnnouncements((result.data || []).slice(0, 3));
        }
      } catch (error) {
        console.error("Home announcement error:", error);
      } finally {
        setAnnouncementsLoading(false);
      }
    };

    fetchPublicAnnouncements();
  }, []);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 pt-28 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]" />
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid min-h-[80vh] grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">
                QR Attendance System
              </span>
            </div>

            <h1 className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
              Cargo Force
              <span className="block text-gray-500">Attendance</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-400">
              A modern employee attendance management system using QR codes for
              Entry, Last Out, Break Out and Break In tracking.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="rounded-2xl bg-white px-7 py-4 font-bold text-black transition hover:bg-gray-200"
              >
                Employee Login
              </Link>

              <Link
                to="/contacts"
                className="rounded-2xl border border-white/10 bg-[#111] px-7 py-4 font-bold text-white transition hover:bg-white/10"
              >
                Generate QR
              </Link>

              <Link
                to="/employee-scan"
                className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-7 py-4 font-bold text-purple-300 transition hover:bg-purple-500/20"
              >
                Scan Admin QR
              </Link>

              <Link
                to="/public-announcements"
                className="rounded-2xl border border-green-500/20 bg-green-500/10 px-7 py-4 font-bold text-green-400 transition hover:bg-green-500/20"
              >
                Public Updates
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
            <div className="mb-5 rounded-[28px] border border-white/10 bg-[#111] p-6">
              <p className="text-sm text-gray-500">System Flow</p>
              <h2 className="mt-2 text-3xl font-bold">
                Login → Choose Action → Scan → Saved
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="flex gap-4 rounded-3xl border border-white/10 bg-[#111] p-5 transition hover:bg-white/5"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white font-extrabold text-black">
                    {step.number}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold">{step.title}</h3>
                    <p className="mt-1 text-gray-500">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="pb-12 pt-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-green-400">
                Official Company Updates
              </p>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                Latest Public Announcements
              </h2>
            </div>

            <Link
              to="/public-announcements"
              className="w-fit rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              View All Announcements
            </Link>
          </div>

          {announcementsLoading ? (
            <div className="rounded-[28px] border border-white/10 bg-[#111] py-14 text-center text-gray-500">
              Loading announcements...
            </div>
          ) : publicAnnouncements.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-[#050505] py-14 text-center">
              <h3 className="text-xl font-bold text-gray-300">
                No public announcements
              </h3>
              <p className="mt-2 text-gray-600">
                New company updates will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {publicAnnouncements.map((announcement) => (
                <article
                  key={announcement._id}
                  className="rounded-[28px] border border-white/10 bg-[#111] p-6 transition hover:bg-white/5"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold uppercase text-green-400">
                      Public Notice
                    </span>

                    <span className="text-xs text-gray-600">
                      {formatDate(announcement.createdAt)}
                    </span>
                  </div>

                  <h3 className="break-words text-xl font-bold">
                    {announcement.title}
                  </h3>

                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-gray-500">
                    {announcement.message}
                  </p>

                  <Link
                    to="/public-announcements"
                    className="mt-5 inline-block font-semibold text-green-400 hover:text-green-300"
                  >
                    Read announcement
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-5 pb-12 md:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Feature</p>
            <h3 className="mt-2 text-2xl font-bold">QR Scan</h3>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Tracking</p>
            <h3 className="mt-2 text-2xl font-bold">Break Time</h3>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Dashboard</p>
            <h3 className="mt-2 text-2xl font-bold">My Records</h3>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Communication</p>
            <h3 className="mt-2 text-2xl font-bold">Live Notices</h3>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
