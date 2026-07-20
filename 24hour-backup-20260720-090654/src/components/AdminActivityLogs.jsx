import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminActivityLogs = () => {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const [filterForm, setFilterForm] = useState({
    search: "",
    category: "All",
    action: "All",
    startDate: "",
    endDate: "",
    limit: "20",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    category: "All",
    action: "All",
    startDate: "",
    endDate: "",
    limit: "20",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalRecords: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  const getAdminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const fetchLogs = async (targetPage = 1, silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await axios.get("/api/admin/activity-logs", {
        headers: getAdminHeaders(),
        params: {
          page: targetPage,
          limit: appliedFilters.limit,
          search: appliedFilters.search.trim() || undefined,
          category:
            appliedFilters.category && appliedFilters.category !== "All"
              ? appliedFilters.category
              : undefined,
          action:
            appliedFilters.action && appliedFilters.action !== "All"
              ? appliedFilters.action
              : undefined,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
        },
      });

      setLogs(response.data.data || []);
      setCategories(response.data.categories || []);
      setActions(response.data.actions || []);
      setPagination(
        response.data.pagination || {
          page: targetPage,
          limit: Number(appliedFilters.limit) || 20,
          totalRecords: 0,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        }
      );
    } catch (error) {
      console.error("Activity log error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
        return;
      }

      window.showError?.(
        error.response?.data?.message || "Failed to load activity logs."
      );
      alert(error.response?.data?.message || "Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      navigate("/admin-login");
      return;
    }

    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, navigate]);

  const formatDateTime = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });
  };

  const getCategoryClass = (category = "") => {
    const value = category.toLowerCase();

    if (value.includes("employee")) return "bg-blue-500/10 text-blue-400";
    if (value.includes("attendance")) return "bg-green-500/10 text-green-400";
    if (value.includes("shift")) return "bg-purple-500/10 text-purple-400";
    if (value.includes("announcement")) return "bg-yellow-500/10 text-yellow-400";
    if (value.includes("notification")) return "bg-cyan-500/10 text-cyan-400";
    if (value.includes("export")) return "bg-orange-500/10 text-orange-400";
    if (value.includes("auth")) return "bg-red-500/10 text-red-400";

    return "bg-white/10 text-gray-300";
  };

  const topStats = useMemo(() => {
    const categoryCount = logs.reduce((acc, log) => {
      const key = log.category || "General";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      pageRecords: logs.length,
      totalRecords: pagination.totalRecords || 0,
      categoriesOnPage: Object.keys(categoryCount).length,
      latestAction: logs[0]?.action || "-",
    };
  }, [logs, pagination.totalRecords]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();

    if (
      filterForm.startDate &&
      filterForm.endDate &&
      new Date(filterForm.startDate) > new Date(filterForm.endDate)
    ) {
      alert("Start date cannot be after end date.");
      return;
    }

    setAppliedFilters({ ...filterForm });
  };

  const clearFilters = () => {
    const emptyFilters = {
      search: "",
      category: "All",
      action: "All",
      startDate: "",
      endDate: "",
      limit: "20",
    };

    setFilterForm(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const changePage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchLogs(page, true);
  };

  const clearAllLogs = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all activity logs? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setClearing(true);

      await axios.delete("/api/admin/activity-logs", {
        headers: getAdminHeaders(),
      });

      alert("Activity logs cleared successfully.");
      fetchLogs(1, true);
    } catch (error) {
      console.error("Clear logs error:", error);
      alert(error.response?.data?.message || "Failed to clear activity logs.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 py-6 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-orange-600/20 blur-[120px]"></div>
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]"></div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-orange-400"></span>
              <span className="text-sm text-gray-400">Audit Log Online</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Activity Logs
              <span className="block text-gray-500">Admin History</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Dashboard
            </button>

            <button
              onClick={() => fetchLogs(pagination.page, true)}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Refresh
            </button>

            <button
              onClick={clearAllLogs}
              disabled={clearing || pagination.totalRecords === 0}
              className="rounded-2xl bg-red-500/10 px-5 py-3 font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clearing ? "Clearing..." : "Clear Logs"}
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Total Matching Logs</p>
            <h2 className="mt-2 text-4xl font-bold">{topStats.totalRecords}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Current Page Logs</p>
            <h2 className="mt-2 text-4xl font-bold">{topStats.pageRecords}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Categories On Page</p>
            <h2 className="mt-2 text-4xl font-bold">{topStats.categoriesOnPage}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Latest Action</p>
            <h2 className="mt-2 break-all text-xl font-bold text-orange-400">
              {topStats.latestAction}
            </h2>
          </div>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Filters</p>
              <h2 className="text-2xl font-bold">Search Activity History</h2>
            </div>

            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} • {pagination.totalRecords} records
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-gray-500">Search</label>
              <input
                type="text"
                value={filterForm.search}
                onChange={(event) =>
                  setFilterForm({ ...filterForm, search: event.target.value })
                }
                placeholder="Action, admin, target, description..."
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-500">Category</label>
              <select
                value={filterForm.category}
                onChange={(event) =>
                  setFilterForm({ ...filterForm, category: event.target.value })
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              >
                <option value="All">All</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-500">Action</label>
              <select
                value={filterForm.action}
                onChange={(event) =>
                  setFilterForm({ ...filterForm, action: event.target.value })
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              >
                <option value="All">All</option>
                {actions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-500">Start Date</label>
              <input
                type="date"
                value={filterForm.startDate}
                onChange={(event) =>
                  setFilterForm({ ...filterForm, startDate: event.target.value })
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-500">End Date</label>
              <input
                type="date"
                value={filterForm.endDate}
                onChange={(event) =>
                  setFilterForm({ ...filterForm, endDate: event.target.value })
                }
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Apply Filters
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border border-white/10 bg-[#111] px-6 py-3 font-semibold text-gray-300 transition hover:bg-white/10"
            >
              Clear Filters
            </button>

            <select
              value={filterForm.limit}
              onChange={(event) => {
                const nextForm = { ...filterForm, limit: event.target.value };
                setFilterForm(nextForm);
                setAppliedFilters(nextForm);
              }}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
            >
              <option value="10">10/Page</option>
              <option value="20">20/Page</option>
              <option value="50">50/Page</option>
              <option value="100">100/Page</option>
            </select>
          </div>
        </form>

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#050505] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-[#111] text-white">
                <tr>
                  <th className="p-5 text-left">Time</th>
                  <th className="p-5 text-left">Category</th>
                  <th className="p-5 text-left">Action</th>
                  <th className="p-5 text-left">Admin</th>
                  <th className="p-5 text-left">Target</th>
                  <th className="p-5 text-left">Description</th>
                  <th className="p-5 text-left">IP</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-16 text-center text-xl text-gray-500">
                      Loading activity logs...
                    </td>
                  </tr>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr
                      key={log._id}
                      className="border-t border-white/10 transition hover:bg-white/5"
                    >
                      <td className="p-5 text-sm text-gray-300">
                        {formatDateTime(log.createdAt)}
                      </td>

                      <td className="p-5">
                        <span className={`rounded-full px-3 py-2 text-sm font-semibold ${getCategoryClass(log.category)}`}>
                          {log.category || "General"}
                        </span>
                      </td>

                      <td className="p-5">
                        <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white">
                          {log.action || "-"}
                        </span>
                      </td>

                      <td className="p-5 text-gray-300">{log.adminUsername || "System"}</td>

                      <td className="p-5">
                        <p className="font-semibold text-white">{log.targetName || "-"}</p>
                        <p className="text-sm text-gray-500">{log.targetType || "-"}</p>
                      </td>

                      <td className="p-5 text-gray-300">
                        {log.description || "-"}
                      </td>

                      <td className="p-5 text-sm text-gray-500">{log.ipAddress || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-16 text-center text-xl text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 bg-[#080808] p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalRecords} total matching logs
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => changePage(1)}
                disabled={!pagination.hasPrevPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>

              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={!pagination.hasPrevPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={!pagination.hasNextPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

              <button
                onClick={() => changePage(pagination.totalPages)}
                disabled={!pagination.hasNextPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminActivityLogs;
