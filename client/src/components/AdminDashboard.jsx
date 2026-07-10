import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function AdminDashboard() {
  const navigate = useNavigate();

  const [attendance, setAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceInsights, setAttendanceInsights] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  const [filterForm, setFilterForm] = useState({
    search: "",
    startDate: "",
    endDate: "",
    limit: "10",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
    limit: "10",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  const [formData, setFormData] = useState({
    entryTime: "",
    breakOutTime: "",
    breakInTime: "",
    lastOutTime: "",
  });

  const [whatsappImportText, setWhatsappImportText] = useState("");
  const [whatsappImportDate, setWhatsappImportDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [importingWhatsapp, setImportingWhatsapp] = useState(false);
  const [whatsappImportResult, setWhatsappImportResult] = useState(null);

  const getAdminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const fetchAttendanceSummary = async (silent = false) => {
    try {
      const response = await axios.get("/api/attendance/summary", {
        headers: getAdminHeaders(),
        params: {
          search: appliedFilters.search.trim() || undefined,
        },
      });

      setAttendanceSummary(response.data.data || null);
    } catch (error) {
      console.error("Attendance Summary Error:", error);

      if (!silent) {
        window.showError?.(
          error.response?.data?.message || "Failed to load attendance summary."
        );
      }
    }
  };

  const getInsightMonthYear = () => {
    const sourceDate = appliedFilters.startDate
      ? new Date(appliedFilters.startDate)
      : new Date();

    if (Number.isNaN(sourceDate.getTime())) {
      const now = new Date();
      return { month: now.getMonth() + 1, year: now.getFullYear() };
    }

    return {
      month: sourceDate.getMonth() + 1,
      year: sourceDate.getFullYear(),
    };
  };

  const fetchAttendanceInsights = async (silent = false) => {
    try {
      const { month, year } = getInsightMonthYear();

      const response = await axios.get("/api/attendance/insights", {
        headers: getAdminHeaders(),
        params: {
          month,
          year,
          search: appliedFilters.search.trim() || undefined,
        },
      });

      setAttendanceInsights(response.data.data || null);
    } catch (error) {
      console.error("Attendance Insights Error:", error);

      if (!silent) {
        window.showError?.(
          error.response?.data?.message || "Failed to load late/absence/overtime insights."
        );
      }
    }
  };

  const fetchAttendance = async (targetPage = pagination.page, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);

      const response = await axios.get("/api/scan/attendance", {
        headers: getAdminHeaders(),
        params: {
          page: targetPage,
          limit: appliedFilters.limit,
          search: appliedFilters.search.trim() || undefined,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
        },
      });

      setAttendance(response.data.data || []);
      setPagination(
        response.data.pagination || {
          page: targetPage,
          limit: Number(appliedFilters.limit) || 10,
          totalRecords: 0,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        }
      );
      setSelectedUser(null);
    } catch (error) {
      console.error("Attendance Error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
        return;
      }

      window.showError?.(
        error.response?.data?.message || "Failed to load attendance records."
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

    fetchAttendance(1);
    fetchAttendanceSummary(true);
    fetchAttendanceInsights(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, navigate]);

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");

    if (!confirmLogout) return;

    localStorage.removeItem("adminToken");
    navigate("/admin-login");
  };

  const formatTime = (time) => {
    if (!time) return "-";

    return new Date(time).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-GB");
  };

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

  const toDateTimeLocal = (date) => {
    if (!date) return "";

    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());

    return d.toISOString().slice(0, 16);
  };

  const openEdit = (item) => {
    setEditRecord(item);

    setFormData({
      entryTime: toDateTimeLocal(item.entryTime),
      breakOutTime: toDateTimeLocal(item.breakOutTime),
      breakInTime: toDateTimeLocal(item.breakInTime),
      lastOutTime: toDateTimeLocal(item.lastOutTime),
    });
  };

  const updateAttendance = async () => {
    if (!editRecord) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/scan/attendance/${editRecord._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Update failed");
        setSaving(false);
        return;
      }

      alert("Attendance updated successfully");
      setEditRecord(null);
      setSaving(false);
      fetchAttendance(pagination.page, true);
      fetchAttendanceSummary(true);
      fetchAttendanceInsights(true);
    } catch (error) {
      console.error(error);
      setSaving(false);
      alert("Server error while updating attendance");
    }
  };

  const users = useMemo(() => {
    return attendance.reduce((acc, item) => {
      const key = item.userId || item.email || item.username || item._id;

      if (!acc[key]) {
        acc[key] = {
          userId: key,
          name: item.name || item.username || "-",
          username: item.username || "-",
          mobile: item.mobile || "-",
          email: item.email || "-",
          records: [],
        };
      }

      acc[key].records.push(item);
      return acc;
    }, {});
  }, [attendance]);

  const userList = Object.values(users);

  const selectedRecords = selectedUser ? selectedUser.records : attendance;

  const todayRecords = attendance.filter(
    (item) =>
      new Date(item.createdAt).toDateString() === new Date().toDateString()
  );

  const pageWorkSeconds = attendance.reduce(
    (total, item) => total + (Number(item.totalWorkSeconds) || 0),
    0
  );

  const summary = attendanceSummary || {};
  const weeklyWorkSeconds = summary.week?.totalWorkSeconds || 0;
  const monthlyWorkSeconds = summary.month?.totalWorkSeconds || 0;
  const monthlyBreakSeconds = summary.month?.totalBreakSeconds || 0;
  const todayPresentEmployees = summary.todayPresentEmployees || 0;
  const insights = attendanceInsights || {};
  const insightTotals = insights.totals || {};
  const lateDays = insightTotals.lateDays || 0;
  const absentDays = insightTotals.absentDays || 0;
  const overtimeDays = insightTotals.overtimeDays || 0;
  const totalLateSeconds = insightTotals.totalLateSeconds || 0;
  const totalOvertimeSeconds = insightTotals.totalOvertimeSeconds || 0;

  const insightSummaryMap = useMemo(() => {
    const map = {};

    (insights.employeeSummaries || []).forEach((item) => {
      if (item.userId) map[item.userId] = item;
      if (item.email && item.email !== "-") map[item.email] = item;
      if (item.username && item.username !== "-") map[item.username] = item;
    });

    return map;
  }, [insights.employeeSummaries]);

  const getUserInsight = (user) => {
    return (
      insightSummaryMap[user.userId] ||
      insightSummaryMap[user.email] ||
      insightSummaryMap[user.username] ||
      null
    );
  };


  const employeeSummaryMap = useMemo(() => {
    const map = {};

    (summary.employeeSummaries || []).forEach((item) => {
      if (item.userId) map[item.userId] = item;
      if (item.email && item.email !== "-") map[item.email] = item;
      if (item.username && item.username !== "-") map[item.username] = item;
    });

    return map;
  }, [summary.employeeSummaries]);

  const getUserSummary = (user) => {
    return (
      employeeSummaryMap[user.userId] ||
      employeeSummaryMap[user.email] ||
      employeeSummaryMap[user.username] ||
      null
    );
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();

    if (
      filterForm.startDate &&
      filterForm.endDate &&
      new Date(filterForm.startDate) > new Date(filterForm.endDate)
    ) {
      window.showWarning?.("Start date cannot be after end date.");
      return;
    }

    setAppliedFilters({ ...filterForm });
  };

  const clearFilters = () => {
    const emptyFilters = {
      search: "",
      startDate: "",
      endDate: "",
      limit: "10",
    };

    setFilterForm(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const changePage = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchAttendance(newPage);
  };

  const changeLimit = (value) => {
    const nextForm = { ...filterForm, limit: value };
    setFilterForm(nextForm);
    setAppliedFilters(nextForm);
  };

  const downloadUserPDF = () => {
    if (!selectedUser) return;

    const doc = new jsPDF("landscape", "mm", "a4");

    doc.setFontSize(18);
    doc.text("Employee Attendance Report", 14, 15);

    doc.setFontSize(11);
    doc.text(`Employee Name: ${selectedUser.name}`, 14, 25);
    doc.text(`Username: ${selectedUser.username}`, 14, 32);
    doc.text(`Mobile: ${selectedUser.mobile}`, 14, 39);
    doc.text(
      `Filtered Records On Current Page: ${selectedUser.records.length}`,
      14,
      46
    );

    autoTable(doc, {
      startY: 55,
      head: [
        [
          "No",
          "Date",
          "Entry Time",
          "Break Out",
          "Break In",
          "Out",
          "Total Break",
          "Working Hours",
        ],
      ],
      body: selectedUser.records.map((item, index) => [
        index + 1,
        item.date || formatDate(item.createdAt),
        formatTime(item.entryTime),
        formatTime(item.breakOutTime),
        formatTime(item.breakInTime),
        formatTime(item.lastOutTime),
        formatSeconds(item.totalBreakSeconds),
        formatSeconds(item.totalWorkSeconds),
      ]),
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [17, 17, 17],
      },
    });

    doc.save(`${selectedUser.username}-attendance-report.pdf`);
  };


  const fetchExportRecords = async () => {
    const adminToken = localStorage.getItem("adminToken");

    if (!adminToken) {
      throw new Error("Admin token missing. Please login again.");
    }

    const response = await axios.get("/api/attendance/export-all", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      params: {
        search: appliedFilters.search.trim() || undefined,
        startDate: appliedFilters.startDate || undefined,
        endDate: appliedFilters.endDate || undefined,
      },
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || "Export API failed.");
    }

    return response.data;
  };

  const getExportFileName = (extension) => {
    const start = appliedFilters.startDate || "all-start";
    const end = appliedFilters.endDate || "all-end";
    return `cfatd-attendance-${start}-to-${end}.${extension}`;
  };

  const downloadAllEmployeesPDF = async () => {
    try {
      setExporting(true);
      const exportData = await fetchExportRecords();
      const records = exportData.data || [];
      const summary = exportData.summary || [];

      if (records.length === 0) {
        window.showWarning?.("No records found for export.");
        return;
      }

      const doc = new jsPDF("landscape", "mm", "a4");

      doc.setFontSize(18);
      doc.text("CFATD - All Employees Attendance Export", 14, 15);

      doc.setFontSize(10);
      doc.text(`Date Range: ${appliedFilters.startDate || "All"} to ${appliedFilters.endDate || "All"}`, 14, 23);
      doc.text(`Search: ${appliedFilters.search || "None"}`, 14, 29);
      doc.text(`Total Records: ${records.length}`, 14, 35);
      doc.text(`Total Employees: ${summary.length}`, 14, 41);

      autoTable(doc, {
        startY: 48,
        head: [["Employee", "Username", "Email", "Mobile", "Records", "Total Break", "Total Work"]],
        body: summary.map((item) => [
          item.name || "-",
          item.username || "-",
          item.email || "-",
          item.mobile || "-",
          item.records || 0,
          formatSeconds(item.totalBreakSeconds),
          formatSeconds(item.totalWorkSeconds),
        ]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [17, 17, 17] },
      });

      const nextTableStartY = doc.lastAutoTable?.finalY
        ? doc.lastAutoTable.finalY + 8
        : 90;

      autoTable(doc, {
        startY: nextTableStartY,
        head: [["No", "Employee", "Username", "Date", "Entry", "Break Out", "Break In", "Out", "Break", "Work"]],
        body: records.map((item, index) => [
          index + 1,
          item.name || item.username || "-",
          item.username || "-",
          item.date || formatDate(item.createdAt),
          formatTime(item.entryTime),
          formatTime(item.breakOutTime),
          formatTime(item.breakInTime),
          formatTime(item.lastOutTime),
          formatSeconds(item.totalBreakSeconds),
          formatSeconds(item.totalWorkSeconds),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [17, 17, 17] },
      });

      doc.save(getExportFileName("pdf"));
      window.showSuccess?.("All employees PDF exported successfully.");
    } catch (error) {
      console.error("Export PDF Error:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to export PDF.";

      window.showError?.(message);
    } finally {
      setExporting(false);
    }
  };

  const escapeCsvValue = (value) => {
    const stringValue = String(value ?? "");
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const downloadAllEmployeesCSV = async () => {
    try {
      setExporting(true);
      const exportData = await fetchExportRecords();
      const records = exportData.data || [];

      if (records.length === 0) {
        window.showWarning?.("No records found for export.");
        return;
      }

      const headers = [
        "No",
        "Employee",
        "Username",
        "Email",
        "Mobile",
        "Date",
        "Entry",
        "Break Out",
        "Break In",
        "Out",
        "Total Break",
        "Work Hours",
      ];

      const rows = records.map((item, index) => [
        index + 1,
        item.name || item.username || "-",
        item.username || "-",
        item.email || "-",
        item.mobile || "-",
        item.date || formatDate(item.createdAt),
        formatTime(item.entryTime),
        formatTime(item.breakOutTime),
        formatTime(item.breakInTime),
        formatTime(item.lastOutTime),
        formatSeconds(item.totalBreakSeconds),
        formatSeconds(item.totalWorkSeconds),
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = getExportFileName("csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      window.showSuccess?.("All employees CSV exported successfully.");
    } catch (error) {
      console.error("Export CSV Error:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to export CSV.";

      window.showError?.(message);
    } finally {
      setExporting(false);
    }
  };


  const importWhatsAppAttendance = async () => {
    if (!whatsappImportText.trim()) {
      window.showWarning?.("Please paste WhatsApp attendance messages.") ||
        alert("Please paste WhatsApp attendance messages.");
      return;
    }

    try {
      setImportingWhatsapp(true);
      setWhatsappImportResult(null);

      const response = await axios.post(
        "/api/attendance/import-whatsapp",
        {
          text: whatsappImportText,
          date: whatsappImportDate,
        },
        {
          headers: {
            ...getAdminHeaders(),
            "Content-Type": "application/json",
          },
        }
      );

      setWhatsappImportResult(response.data.data || null);
      window.showSuccess?.(response.data.message || "WhatsApp attendance imported.") ||
        alert(response.data.message || "WhatsApp attendance imported.");

      fetchAttendance(1, true);
      fetchAttendanceSummary(true);
      fetchAttendanceInsights(true);
    } catch (error) {
      console.error("WhatsApp Import Error:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to import WhatsApp attendance.";

      window.showError?.(message) || alert(message);
    } finally {
      setImportingWhatsapp(false);
    }
  };

  const sampleWhatsAppText = `[29/06, 08:59] Kamal: Entry\n[29/06, 13:00] Kamal: Break out\n[29/06, 13:30] Kamal: Break in\n[29/06, 18:01] Kamal: Out`;

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 py-6 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]"></div>
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]"></div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
              <span className="text-sm text-gray-400">Admin Dashboard Online</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              CFATD
              <span className="block text-gray-500">Admin Dashboard</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Home
            </button>

            <button
              onClick={() => navigate("/services")}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              QR Scanner
            </button>

            <button
              onClick={() => navigate("/admin-attendance-qr")}
              className="rounded-2xl bg-purple-500/10 px-5 py-3 font-bold text-purple-300 transition hover:bg-purple-500/20"
            >
              Admin QR
            </button>

            <button
              onClick={() => fetchAttendance(pagination.page, true)}
              disabled={refreshing}
              className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-2xl bg-red-500/10 px-5 py-3 font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              Logout
            </button>
          </div>
        </div>


        {/* WHATSAPP ATTENDANCE IMPORT */}
        <div className="mb-8 rounded-[30px] border border-green-500/20 bg-[#050505] p-6 shadow-2xl">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-green-400">Quick Backup Attendance</p>
              <h2 className="text-2xl font-bold">WhatsApp Attendance Import</h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                Paste WhatsApp group messages. The system will match employee name and update Entry, Break Out, Break In and Out.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={whatsappImportDate}
                onChange={(e) => setWhatsappImportDate(e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
              />

              <button
                type="button"
                onClick={() => setWhatsappImportText(sampleWhatsAppText)}
                className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 font-semibold text-gray-300 hover:bg-white/10"
              >
                Paste Sample
              </button>
            </div>
          </div>

          <textarea
            value={whatsappImportText}
            onChange={(e) => setWhatsappImportText(e.target.value)}
            rows="7"
            placeholder={`Example:\n[29/06, 08:59] Kamal: Entry\n[29/06, 13:00] Kamal: Break out\n[29/06, 13:30] Kamal: Break in\n[29/06, 18:01] Kamal: Out`}
            className="w-full resize-y rounded-[24px] border border-white/10 bg-black p-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-green-500/40"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={importWhatsAppAttendance}
              disabled={importingWhatsapp}
              className="rounded-2xl bg-green-500 px-5 py-3 font-bold text-black transition hover:bg-green-400 disabled:opacity-60"
            >
              {importingWhatsapp ? "Importing..." : "Import WhatsApp Logs"}
            </button>

            <button
              type="button"
              onClick={() => {
                setWhatsappImportText("");
                setWhatsappImportResult(null);
              }}
              disabled={importingWhatsapp}
              className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              Clear
            </button>
          </div>

          {whatsappImportResult && (
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-green-500/20 bg-green-500/10 p-4">
                <p className="font-bold text-green-400">
                  Imported: {whatsappImportResult.imported?.length || 0}
                </p>
                <div className="mt-3 max-h-48 space-y-2 overflow-auto text-sm text-gray-300">
                  {(whatsappImportResult.imported || []).map((item, index) => (
                    <div key={`${item.line}-${index}`} className="rounded-xl bg-black/30 p-3">
                      <p className="font-semibold text-white">{item.employee}</p>
                      <p className="text-gray-400">
                        {item.date} • {item.time} • {item.scanType}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-4">
                <p className="font-bold text-red-400">
                  Skipped: {whatsappImportResult.skipped?.length || 0}
                </p>
                <div className="mt-3 max-h-48 space-y-2 overflow-auto text-sm text-gray-300">
                  {(whatsappImportResult.skipped || []).map((item, index) => (
                    <div key={`${item.line}-${index}`} className="rounded-xl bg-black/30 p-3">
                      <p className="text-white">{item.line}</p>
                      <p className="text-red-300">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ADMIN QUICK ACCESS */}
        <div className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Admin Tools</p>
              <h2 className="text-2xl font-bold">Admin Management Center</h2>
            </div>

            <p className="max-w-xl text-sm text-gray-500">
              Plan monthly shifts, send announcements, and manage private employee notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <button
              onClick={() => navigate("/admin-attendance-qr")}
              className="group rounded-[26px] border border-purple-500/20 bg-purple-500/10 p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 text-sm font-extrabold text-purple-300 group-hover:bg-black group-hover:text-white">
                QR
              </div>
              <h3 className="mb-2 text-2xl font-bold">Employee Self Scan QR</h3>
              <p className="text-gray-400 group-hover:text-gray-700">
                Generate the admin QR employees scan for In, Break and Sign Out.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-employees")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-sm font-extrabold text-blue-400 group-hover:bg-black group-hover:text-white">
                EMP
              </div>
              <h3 className="mb-2 text-2xl font-bold">Employee Management</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Add, edit, delete employees and regenerate employee QR access.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-analytics")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-sm font-extrabold text-cyan-400 group-hover:bg-black group-hover:text-white">
                REP
              </div>
              <h3 className="mb-2 text-2xl font-bold">Analytics Reports</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                View charts for daily trends, top employees and attendance status.
              </p>
            </button>


            <button
              onClick={() => navigate("/admin-realtime")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-sm font-extrabold text-green-400 group-hover:bg-black group-hover:text-white">
                LIVE
              </div>
              <h3 className="mb-2 text-2xl font-bold">Realtime Events</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Watch live scans, activity logs, employee updates and notifications.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-activity-logs")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-extrabold text-orange-400 group-hover:bg-black group-hover:text-white">
                LOG
              </div>
              <h3 className="mb-2 text-2xl font-bold">Activity Logs</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Track admin actions, employee changes, shifts, exports and edits.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-shift-planner")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-sm font-extrabold text-green-400 group-hover:bg-black group-hover:text-white">
                CAL
              </div>
              <h3 className="mb-2 text-2xl font-bold">Monthly Shift Planner</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Assign working weekdays and future shift times for a complete month.
              </p>
            </button>


            <button
              onClick={() => navigate("/admin-past-shifts")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-extrabold text-orange-400 group-hover:bg-black group-hover:text-white">
                PAST
              </div>
              <h3 className="mb-2 text-2xl font-bold">Add Your Past Shift</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Add or update previous employee shifts only. Future dates are blocked.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-announcements")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-400 group-hover:bg-black group-hover:text-white">
                📢
              </div>
              <h3 className="mb-2 text-2xl font-bold">Company Announcement</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Send announcements to employees or public visitors.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-personal-notifications")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl text-blue-400 group-hover:bg-black group-hover:text-white">
                👤
              </div>
              <h3 className="mb-2 text-2xl font-bold">Personal Notification</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Send private messages to individual employees.
              </p>
            </button>

            <button
              onClick={() => navigate("/admin-announcements")}
              className="group rounded-[26px] border border-white/10 bg-[#111] p-6 text-left transition hover:bg-white hover:text-black"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-2xl text-green-400 group-hover:bg-black group-hover:text-white">
                🌍
              </div>
              <h3 className="mb-2 text-2xl font-bold">Public Announcements</h3>
              <p className="text-gray-500 group-hover:text-gray-700">
                Create public updates and preview what everyone can see.
              </p>
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Filtered Total</p>
            <h2 className="mt-2 text-4xl font-bold">{pagination.totalRecords}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Current Page</p>
            <h2 className="mt-2 text-4xl font-bold">{attendance.length}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Employees This Page</p>
            <h2 className="mt-2 text-4xl font-bold">{Object.values(users).length}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Page Work Hours</p>
            <h2 className="mt-2 text-3xl font-bold text-green-400">
              {formatSeconds(pageWorkSeconds)}
            </h2>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-[28px] border border-green-500/20 bg-green-500/10 p-6">
            <p className="text-gray-400">This Week Work</p>
            <h2 className="mt-2 text-3xl font-bold text-green-400">
              {formatSeconds(weeklyWorkSeconds)}
            </h2>
          </div>

          <div className="rounded-[28px] border border-blue-500/20 bg-blue-500/10 p-6">
            <p className="text-gray-400">This Month Work</p>
            <h2 className="mt-2 text-3xl font-bold text-blue-400">
              {formatSeconds(monthlyWorkSeconds)}
            </h2>
          </div>

          <div className="rounded-[28px] border border-purple-500/20 bg-purple-500/10 p-6">
            <p className="text-gray-400">Present Today</p>
            <h2 className="mt-2 text-4xl font-bold text-purple-400">
              {todayPresentEmployees}
            </h2>
          </div>

          <div className="rounded-[28px] border border-yellow-500/20 bg-yellow-500/10 p-6">
            <p className="text-gray-400">Month Break</p>
            <h2 className="mt-2 text-3xl font-bold text-yellow-400">
              {formatSeconds(monthlyBreakSeconds)}
            </h2>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6">
            <p className="text-gray-400">Late Arrivals</p>
            <h2 className="mt-2 text-4xl font-bold text-red-400">{lateDays}</h2>
            <p className="mt-2 text-xs text-gray-500">
              Total late time: {formatSeconds(totalLateSeconds)}
            </p>
          </div>

          <div className="rounded-[28px] border border-orange-500/20 bg-orange-500/10 p-6">
            <p className="text-gray-400">Absences</p>
            <h2 className="mt-2 text-4xl font-bold text-orange-400">{absentDays}</h2>
            <p className="mt-2 text-xs text-gray-500">
              Scheduled days with no entry scan
            </p>
          </div>

          <div className="rounded-[28px] border border-cyan-500/20 bg-cyan-500/10 p-6">
            <p className="text-gray-400">Overtime Days</p>
            <h2 className="mt-2 text-4xl font-bold text-cyan-400">{overtimeDays}</h2>
            <p className="mt-2 text-xs text-gray-500">
              Overtime: {formatSeconds(totalOvertimeSeconds)}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-400">Shift Month</p>
            <h2 className="mt-2 text-3xl font-bold text-white">
              {String(insights.month || new Date().getMonth() + 1).padStart(2, "0")}/{insights.year || new Date().getFullYear()}
            </h2>
            <p className="mt-2 text-xs text-gray-500">
              Based on Monthly Shift Planner
            </p>
          </div>
        </div>

        {/* FILTERS */}
        <form
          onSubmit={handleFilterSubmit}
          className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Filters</p>
              <h2 className="text-2xl font-bold">Date Range & Pagination</h2>
            </div>

            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} • {pagination.totalRecords} matching records
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-gray-500">Search Employee</label>
              <input
                type="text"
                value={filterForm.search}
                onChange={(event) =>
                  setFilterForm({ ...filterForm, search: event.target.value })
                }
                placeholder="Name, username, email, mobile..."
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              />
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

            <div>
              <label className="mb-2 block text-sm text-gray-500">Records/Page</label>
              <select
                value={filterForm.limit}
                onChange={(event) => changeLimit(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
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

            <button
              type="button"
              onClick={downloadAllEmployeesPDF}
              disabled={exporting}
              className="rounded-2xl bg-green-500/10 px-6 py-3 font-semibold text-green-400 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export All PDF"}
            </button>

            <button
              type="button"
              onClick={downloadAllEmployeesCSV}
              disabled={exporting}
              className="rounded-2xl bg-blue-500/10 px-6 py-3 font-semibold text-blue-400 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export All CSV"}
            </button>
          </div>
        </form>

        <div className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6">
          <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Employees</p>
              <h2 className="text-2xl font-bold">Employee Records On This Page</h2>
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-gray-500">Loading records...</p>
          ) : userList.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {userList.map((user) => (
                <div
                  key={user.userId}
                  onClick={() => setSelectedUser(user)}
                  className={`cursor-pointer rounded-[24px] border p-5 transition ${
                    selectedUser?.userId === user.userId
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-[#111] text-white hover:bg-white/10"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full font-bold ${
                        selectedUser?.userId === user.userId
                          ? "bg-black text-white"
                          : "bg-[#333] text-white"
                      }`}
                    >
                      {String(user.name || "E").charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-bold">{user.name}</h3>
                      <p
                        className={`truncate text-sm ${
                          selectedUser?.userId === user.userId
                            ? "text-gray-700"
                            : "text-gray-500"
                        }`}
                      >
                        {user.username}
                      </p>
                    </div>
                  </div>

                  <p
                    className={`break-all text-sm ${
                      selectedUser?.userId === user.userId
                        ? "text-gray-700"
                        : "text-gray-500"
                    }`}
                  >
                    Email: {user.email}
                  </p>

                  <p
                    className={`text-sm ${
                      selectedUser?.userId === user.userId
                        ? "text-gray-700"
                        : "text-gray-500"
                    }`}
                  >
                    Mobile: {user.mobile}
                  </p>

                  <p className="mt-3 font-semibold">
                    Records on this page: {user.records.length}
                  </p>

                  {getUserSummary(user) && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-gray-500">Week</p>
                        <p className="mt-1 font-bold text-green-400">
                          {formatSeconds(getUserSummary(user).weekWorkSeconds)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-gray-500">Month</p>
                        <p className="mt-1 font-bold text-blue-400">
                          {formatSeconds(getUserSummary(user).monthWorkSeconds)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-gray-500">Present</p>
                        <p className="mt-1 font-bold">
                          {getUserSummary(user).monthPresentDays || 0} days
                        </p>
                      </div>

                      <div className="rounded-2xl bg-black/20 p-3">
                        <p className="text-gray-500">Avg</p>
                        <p className="mt-1 font-bold">
                          {formatSeconds(getUserSummary(user).monthAverageDailySeconds)}
                        </p>
                      </div>
                    </div>
                  )}

                  {getUserInsight(user) && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-2xl bg-red-500/10 p-3">
                        <p className="text-gray-500">Late</p>
                        <p className="mt-1 font-bold text-red-400">
                          {getUserInsight(user).lateDays || 0}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-orange-500/10 p-3">
                        <p className="text-gray-500">Absent</p>
                        <p className="mt-1 font-bold text-orange-400">
                          {getUserInsight(user).absentDays || 0}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-cyan-500/10 p-3">
                        <p className="text-gray-500">OT</p>
                        <p className="mt-1 font-bold text-cyan-400">
                          {formatSeconds(getUserInsight(user).totalOvertimeSeconds || 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-gray-500">No employees found</p>
          )}
        </div>

        {selectedUser && (
          <div className="mb-5 flex flex-col gap-4 rounded-[24px] border border-white/10 bg-[#111] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Showing Current Page Records</p>
              <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadUserPDF}
                className="rounded-2xl bg-green-500/10 px-5 py-3 font-semibold text-green-400 transition hover:bg-green-500/20"
              >
                Download PDF
              </button>

              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
              >
                Show All Employees
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#050505] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px]">
              <thead className="bg-[#111] text-white">
                <tr>
                  <th className="p-5 text-left">No</th>
                  <th className="p-5 text-left">Employee</th>
                  <th className="p-5 text-left">Username</th>
                  <th className="p-5 text-left">Mobile</th>
                  <th className="p-5 text-left">Date</th>
                  <th className="p-5 text-left">Entry</th>
                  <th className="p-5 text-left">Break Out</th>
                  <th className="p-5 text-left">Break In</th>
                  <th className="p-5 text-left">Out</th>
                  <th className="p-5 text-left">Total Break</th>
                  <th className="p-5 text-left">Work Hours</th>
                  <th className="p-5 text-left">Edit</th>
                </tr>
              </thead>

              <tbody>
                {selectedRecords.length > 0 ? (
                  selectedRecords.map((item, index) => (
                    <tr
                      key={item._id}
                      className="border-t border-white/10 transition hover:bg-white/5"
                    >
                      <td className="p-5 text-gray-400">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>

                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#333] font-bold">
                            {String(item.name || item.username || "-")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold">
                              {item.name || item.username || "-"}
                            </p>
                            <p className="text-sm text-gray-500">Employee</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-5 text-gray-300">{item.username || "-"}</td>
                      <td className="p-5 text-gray-300">{item.mobile || "-"}</td>
                      <td className="p-5 text-gray-300">
                        {item.date || formatDate(item.createdAt)}
                      </td>
                      <td className="p-5 font-semibold text-green-400">
                        {formatTime(item.entryTime)}
                      </td>
                      <td className="p-5 font-semibold text-yellow-400">
                        {formatTime(item.breakOutTime)}
                      </td>
                      <td className="p-5 font-semibold text-blue-400">
                        {formatTime(item.breakInTime)}
                      </td>
                      <td className="p-5 font-semibold text-red-400">
                        {formatTime(item.lastOutTime)}
                      </td>
                      <td className="p-5">
                        <span className="rounded-full bg-yellow-500/10 px-3 py-2 font-semibold text-yellow-400">
                          {formatSeconds(item.totalBreakSeconds)}
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="rounded-full bg-green-500/10 px-3 py-2 font-semibold text-green-400">
                          {formatSeconds(item.totalWorkSeconds)}
                        </span>
                      </td>
                      <td className="p-5">
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded-2xl bg-blue-500/10 px-4 py-2 font-semibold text-blue-400 transition hover:bg-blue-500/20"
                        >
                          Edit Shift
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="12"
                      className="py-16 text-center text-xl text-gray-500"
                    >
                      No Attendance Records Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 bg-[#080808] p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalRecords} total matching records
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => changePage(1)}
                disabled={!pagination.hasPrevPage || refreshing}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>

              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={!pagination.hasPrevPage || refreshing}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={!pagination.hasNextPage || refreshing}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

              <button
                onClick={() => changePage(pagination.totalPages)}
                disabled={!pagination.hasNextPage || refreshing}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </div>

        {editRecord && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
              <h2 className="mb-2 text-3xl font-bold">Edit Shift</h2>
              <p className="mb-6 text-gray-500">
                {editRecord.name || editRecord.username} - {" "}
                {editRecord.date || formatDate(editRecord.createdAt)}
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-gray-500">Entry Time</label>
                  <input
                    type="datetime-local"
                    value={formData.entryTime}
                    onChange={(e) =>
                      setFormData({ ...formData, entryTime: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Break Out</label>
                  <input
                    type="datetime-local"
                    value={formData.breakOutTime}
                    onChange={(e) =>
                      setFormData({ ...formData, breakOutTime: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Break In</label>
                  <input
                    type="datetime-local"
                    value={formData.breakInTime}
                    onChange={(e) =>
                      setFormData({ ...formData, breakInTime: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Out Time</label>
                  <input
                    type="datetime-local"
                    value={formData.lastOutTime}
                    onChange={(e) =>
                      setFormData({ ...formData, lastOutTime: e.target.value })
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={updateAttendance}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-white py-3 font-bold text-black transition hover:bg-gray-200 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Update"}
                </button>

                <button
                  onClick={() => setEditRecord(null)}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-red-500/10 py-3 font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                After saving, employee profile will show updated shift after refresh.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminDashboard;
