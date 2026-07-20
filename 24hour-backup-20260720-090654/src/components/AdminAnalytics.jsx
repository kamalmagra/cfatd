import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      search: "",
    };
  });

  const getAdminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const response = await axios.get("/api/attendance/analytics", {
        headers: getAdminHeaders(),
        params: {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          search: filters.search.trim() || undefined,
        },
      });

      setAnalytics(response.data.data || null);
    } catch (error) {
      console.error("Analytics Error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
        return;
      }

      window.showError?.(
        error.response?.data?.message || "Failed to load analytics."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      navigate("/admin-login");
      return;
    }

    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const formatSeconds = (seconds) => {
    if (!seconds || seconds <= 0) return "00:00:00";

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}:${String(s).padStart(2, "0")}`;
  };

  const formatHours = (seconds) => {
    const hours = (Number(seconds) || 0) / 3600;
    return `${hours.toFixed(1)}h`;
  };

  const maxDailyWork = useMemo(() => {
    return Math.max(
      ...((analytics?.dailyTrends || []).map((item) => item.totalWorkSeconds) || [0]),
      1
    );
  }, [analytics]);

  const maxEmployeeWork = useMemo(() => {
    return Math.max(
      ...((analytics?.topEmployees || []).map((item) => item.totalWorkSeconds) || [0]),
      1
    );
  }, [analytics]);

  const totals = analytics?.totals || {};
  const status = analytics?.statusDistribution || {};

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      filters.startDate &&
      filters.endDate &&
      new Date(filters.startDate) > new Date(filters.endDate)
    ) {
      window.showWarning?.("Start date cannot be after end date.");
      return;
    }

    fetchAnalytics();
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 py-6 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]"></div>
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]"></div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span className="text-sm text-gray-400">Analytics Dashboard</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Reports
              <span className="block text-gray-500">Charts & Analytics</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Admin Dashboard
            </button>

            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Analytics Filters</p>
              <h2 className="text-2xl font-bold">Date Range & Employee Search</h2>
            </div>

            <p className="text-sm text-gray-500">
              Default view shows last 30 days.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm text-gray-500">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters({ ...filters, startDate: event.target.value })
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-500">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters({ ...filters, endDate: event.target.value })
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-gray-500">Search Employee</label>
              <input
                type="text"
                value={filters.search}
                onChange={(event) =>
                  setFilters({ ...filters, search: event.target.value })
                }
                placeholder="Name, username, email, mobile..."
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Apply Analytics Filters
            </button>

            <button
              type="button"
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 29);
                setFilters({
                  startDate: start.toISOString().slice(0, 10),
                  endDate: end.toISOString().slice(0, 10),
                  search: "",
                });
                setTimeout(() => fetchAnalytics(true), 0);
              }}
              className="rounded-2xl border border-white/10 bg-[#111] px-6 py-3 font-semibold text-gray-300 transition hover:bg-white/10"
            >
              Reset 30 Days
            </button>
          </div>
        </form>

        {loading ? (
          <div className="rounded-[30px] border border-white/10 bg-[#050505] p-10 text-center text-gray-500">
            Loading analytics...
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
              <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
                <p className="text-gray-500">Total Records</p>
                <h2 className="mt-2 text-4xl font-bold">{totals.records || 0}</h2>
              </div>

              <div className="rounded-[28px] border border-green-500/20 bg-green-500/10 p-6">
                <p className="text-gray-400">Total Work</p>
                <h2 className="mt-2 text-3xl font-bold text-green-400">
                  {formatSeconds(totals.totalWorkSeconds)}
                </h2>
              </div>

              <div className="rounded-[28px] border border-blue-500/20 bg-blue-500/10 p-6">
                <p className="text-gray-400">Present Days</p>
                <h2 className="mt-2 text-4xl font-bold text-blue-400">
                  {totals.presentDays || 0}
                </h2>
              </div>

              <div className="rounded-[28px] border border-yellow-500/20 bg-yellow-500/10 p-6">
                <p className="text-gray-400">Average Daily Work</p>
                <h2 className="mt-2 text-3xl font-bold text-yellow-400">
                  {formatSeconds(totals.averageDailySeconds)}
                </h2>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
              <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6">
                <p className="text-gray-400">Late Days</p>
                <h2 className="mt-2 text-4xl font-bold text-red-400">
                  {status.lateDays || 0}
                </h2>
                <p className="mt-2 text-xs text-gray-500">
                  Late time: {formatSeconds(status.totalLateSeconds)}
                </p>
              </div>

              <div className="rounded-[28px] border border-orange-500/20 bg-orange-500/10 p-6">
                <p className="text-gray-400">Absent Days</p>
                <h2 className="mt-2 text-4xl font-bold text-orange-400">
                  {status.absentDays || 0}
                </h2>
              </div>

              <div className="rounded-[28px] border border-cyan-500/20 bg-cyan-500/10 p-6">
                <p className="text-gray-400">Overtime Days</p>
                <h2 className="mt-2 text-4xl font-bold text-cyan-400">
                  {status.overtimeDays || 0}
                </h2>
                <p className="mt-2 text-xs text-gray-500">
                  OT: {formatSeconds(status.totalOvertimeSeconds)}
                </p>
              </div>

              <div className="rounded-[28px] border border-purple-500/20 bg-purple-500/10 p-6">
                <p className="text-gray-400">Employees</p>
                <h2 className="mt-2 text-4xl font-bold text-purple-400">
                  {totals.totalEmployees || 0}
                </h2>
                <p className="mt-2 text-xs text-gray-500">
                  Active in range: {totals.activeEmployees || 0}
                </p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-[30px] border border-white/10 bg-[#050505] p-6">
                <div className="mb-6">
                  <p className="text-sm text-gray-500">Daily Trend</p>
                  <h2 className="text-2xl font-bold">Work Hours by Day</h2>
                </div>

                <div className="space-y-3">
                  {(analytics?.dailyTrends || []).map((day) => {
                    const width = Math.max(
                      3,
                      Math.round((day.totalWorkSeconds / maxDailyWork) * 100)
                    );

                    return (
                      <div key={day.date} className="grid grid-cols-[92px_1fr_88px] items-center gap-3">
                        <p className="text-xs text-gray-500">{day.label}</p>
                        <div className="h-8 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="flex h-full items-center rounded-full bg-white/80 px-3 text-xs font-bold text-black"
                            style={{ width: `${width}%` }}
                          >
                            {day.records > 0 ? `${day.records} rec` : ""}
                          </div>
                        </div>
                        <p className="text-right text-sm font-semibold text-green-400">
                          {formatHours(day.totalWorkSeconds)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[#050505] p-6">
                <div className="mb-6">
                  <p className="text-sm text-gray-500">Top Employees</p>
                  <h2 className="text-2xl font-bold">Monthly / Range Work Ranking</h2>
                </div>

                {(analytics?.topEmployees || []).length > 0 ? (
                  <div className="space-y-4">
                    {(analytics?.topEmployees || []).map((employee, index) => {
                      const width = Math.max(
                        4,
                        Math.round((employee.totalWorkSeconds / maxEmployeeWork) * 100)
                      );

                      return (
                        <div key={employee.userId || employee.username || index}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                #{index + 1} {employee.name || employee.username || "Employee"}
                              </p>
                              <p className="truncate text-xs text-gray-500">
                                {employee.username || "-"} • {employee.email || "-"}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-green-400">
                              {formatHours(employee.totalWorkSeconds)}
                            </p>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-green-400" style={{ width: `${width}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-10 text-center text-gray-500">No employee work data found.</p>
                )}
              </div>
            </div>

            <div className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-500">Status Distribution</p>
                <h2 className="text-2xl font-bold">Present / Late / Absent / Overtime</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[
                  ["Present", status.presentDays || 0, "bg-blue-400"],
                  ["Late", status.lateDays || 0, "bg-red-400"],
                  ["Absent", status.absentDays || 0, "bg-orange-400"],
                  ["Overtime", status.overtimeDays || 0, "bg-cyan-400"],
                ].map(([label, value, className]) => {
                  const maxValue = Math.max(
                    status.presentDays || 0,
                    status.lateDays || 0,
                    status.absentDays || 0,
                    status.overtimeDays || 0,
                    1
                  );
                  const height = Math.max(12, Math.round((Number(value) / maxValue) * 180));

                  return (
                    <div key={label} className="rounded-[24px] border border-white/10 bg-[#111] p-5 text-center">
                      <div className="mb-4 flex h-48 items-end justify-center rounded-2xl bg-black/40 p-4">
                        <div className={`w-16 rounded-t-2xl ${className}`} style={{ height: `${height}px` }}></div>
                      </div>
                      <p className="text-gray-500">{label}</p>
                      <h3 className="mt-1 text-3xl font-bold">{value}</h3>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-[#050505] p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-500">Recent Status Details</p>
                <h2 className="text-2xl font-bold">Late, Absent & Overtime Records</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-[#111]">
                    <tr>
                      <th className="p-4 text-left">Date</th>
                      <th className="p-4 text-left">Employee</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-left">Scheduled</th>
                      <th className="p-4 text-left">Entry</th>
                      <th className="p-4 text-left">Late</th>
                      <th className="p-4 text-left">Overtime</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(analytics?.recentStatusRows || []).length > 0 ? (
                      (analytics?.recentStatusRows || []).map((row, index) => (
                        <tr key={`${row.date}-${row.employeeId}-${index}`} className="border-t border-white/10">
                          <td className="p-4 text-gray-300">{row.date}</td>
                          <td className="p-4">
                            <p className="font-semibold">{row.name || row.username || "-"}</p>
                            <p className="text-xs text-gray-500">{row.username || "-"}</p>
                          </td>
                          <td className="p-4">
                            <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold capitalize">
                              {row.attendanceStatus || "-"}
                            </span>
                          </td>
                          <td className="p-4 text-gray-300">
                            {row.scheduledStart || "-"} - {row.scheduledEnd || "-"}
                          </td>
                          <td className="p-4 text-gray-300">
                            {row.entryTime ? new Date(row.entryTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, hourCycle: "h23" }) : "-"}
                          </td>
                          <td className="p-4 text-red-400">{formatSeconds(row.lateSeconds)}</td>
                          <td className="p-4 text-cyan-400">{formatSeconds(row.overtimeSeconds)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-500">
                          No status issue records found for this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AdminAnalytics;
