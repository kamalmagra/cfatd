import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DAYS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const todayDate = () => new Date().toISOString().slice(0, 10);

const getStartOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};


const TIME_FIELDS = ["startTime", "breakStartTime", "breakEndTime", "endTime"];

const normalizeTime24 = (value) => {
  const textValue = String(value ?? "").trim().toUpperCase();

  if (!textValue) return "";

  let match = textValue.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);

  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  match = textValue.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/);

  if (match) {
    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3];

    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  match = textValue.match(/^(\d{3,4})$/);

  if (match) {
    const digits = match[1].padStart(4, "0");
    const hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2));

    if (hour <= 23 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return null;
};

const displayTime24 = (value) => {
  const normalized = normalizeTime24(value);
  return normalized === null || normalized === "" ? "-" : normalized;
};

const Time24Input = ({ label, name, value, onChange }) => {
  const updateValue = (nextValue) => {
    onChange({ target: { name, value: nextValue } });
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-400">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        name={name}
        value={value}
        placeholder="HH:MM"
        maxLength={8}
        onChange={(event) =>
          updateValue(event.target.value.replace(/[^0-9:apmAPM ]/g, ""))
        }
        onBlur={() => {
          const normalized = normalizeTime24(value);
          if (normalized !== null) updateValue(normalized);
        }}
        className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 font-mono text-white outline-none focus:border-orange-500/60"
        aria-label={`${label} in 24-hour HH:MM format`}
      />
    </div>
  );
};

function AdminPastShiftManager() {
  const navigate = useNavigate();
  const now = new Date();

  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [mode, setMode] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [singleDate, setSingleDate] = useState(todayDate());
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [status, setStatus] = useState("working");
  const [form, setForm] = useState({
    startTime: "09:00",
    breakStartTime: "13:00",
    breakEndTime: "14:00",
    endTime: "18:00",
    notes: "Past shift added by admin",
  });

  const [exportStartDate, setExportStartDate] = useState(getStartOfMonth());
  const [exportEndDate, setExportEndDate] = useState(todayDate());
  const [pastShifts, setPastShifts] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [message, setMessage] = useState("");
  const [reportEmployee, setReportEmployee] = useState(null);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const showSuccess = (text) => {
    setMessage(text);
    if (window.showSuccess) window.showSuccess(text);
  };

  const showError = (text) => {
    setMessage(text);
    if (window.showError) window.showError(text);
    else alert(text);
  };

  const selectedEmployee = useMemo(
    () => employees.find((item) => item._id === employeeId) || null,
    [employees, employeeId]
  );

  const yearOptions = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }, (_, index) => currentYear - 10 + index);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      navigate("/admin-login");
      return;
    }

    fetchEmployees();
  }, [navigate]);

  useEffect(() => {
    if (employeeId) fetchPastShiftReport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get("/api/users", { headers: headers() });
      const employeeList = response.data.data || [];
      setEmployees(employeeList);
      if (employeeList.length > 0) setEmployeeId((current) => current || employeeList[0]._id);
    } catch (error) {
      console.error("Employee load error:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
        return;
      }
      showError(error.response?.data?.message || "Unable to load employees.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const toggleDay = (day) => {
    setWorkingDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort()
    );
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const applyPastShift = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!employeeId) {
      showError("Please select an employee.");
      return;
    }

    if (mode === "month" && workingDays.length === 0) {
      showError("Please select at least one weekday.");
      return;
    }

    if (mode === "single" && singleDate > todayDate()) {
      showError("Future date is not allowed. This page is only for past shifts.");
      return;
    }

    const normalizedForm = { ...form };

    if (status === "working") {
      for (const field of TIME_FIELDS) {
        const normalized = normalizeTime24(form[field]);

        if (normalized === null) {
          showError("Use 24-hour time in HH:MM format, for example 09:00 or 18:30.");
          return;
        }

        normalizedForm[field] = normalized;
      }

      if (!normalizedForm.startTime || !normalizedForm.endTime) {
        showError("Start and end time are required for a working shift.");
        return;
      }

      const hasBreakStart = Boolean(normalizedForm.breakStartTime);
      const hasBreakEnd = Boolean(normalizedForm.breakEndTime);

      if (hasBreakStart !== hasBreakEnd) {
        showError("Enter both break start and break end, or leave both empty.");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        employeeId,
        mode,
        year,
        month,
        date: singleDate,
        workingDays,
        status,
        startTime: status === "working" ? normalizedForm.startTime : "",
        breakStartTime: status === "working" ? normalizedForm.breakStartTime : "",
        breakEndTime: status === "working" ? normalizedForm.breakEndTime : "",
        endTime: status === "working" ? normalizedForm.endTime : "",
        notes: form.notes,
      };

      const response = await axios.post("/api/past-shifts/apply", payload, {
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
      });

      showSuccess(response.data.message || "Past shift updated successfully.");
      if (status === "working") setForm((current) => ({ ...current, ...normalizedForm }));
      await fetchPastShiftReport(true);
    } catch (error) {
      console.error("Past shift save error:", error);
      showError(error.response?.data?.message || "Unable to save past shift.");
    } finally {
      setSaving(false);
    }
  };

  const fetchPastShiftReport = async (silent = false) => {
    if (!employeeId) return;

    try {
      if (!silent) setLoadingReport(true);
      const response = await axios.get(`/api/past-shifts/employee/${employeeId}`, {
        headers: headers(),
        params: {
          startDate: exportStartDate || undefined,
          endDate: exportEndDate || undefined,
        },
      });

      setPastShifts(response.data.data || []);
      setReportEmployee(response.data.employee || selectedEmployee);
    } catch (error) {
      console.error("Past shift report error:", error);
      showError(error.response?.data?.message || "Unable to load past shift report.");
    } finally {
      setLoadingReport(false);
    }
  };

  const formatShiftDate = (date) => {
    if (!date) return "";
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString("en-GB");
  };

  const getDayName = (date) => {
    if (!date) return "";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
    });
  };

  const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const downloadCSV = () => {
    if (pastShifts.length === 0) {
      showError("No past shift data found for CSV export.");
      return;
    }

    const rows = pastShifts.map((item, index) => [
      index + 1,
      reportEmployee?.username || selectedEmployee?.username || "-",
      reportEmployee?.email || selectedEmployee?.email || "-",
      item.date || "",
      formatShiftDate(item.date),
      getDayName(item.date),
      item.status || "-",
      displayTime24(item.startTime24 || item.startTime),
      displayTime24(item.breakStartTime24 || item.breakStartTime),
      displayTime24(item.breakEndTime24 || item.breakEndTime),
      displayTime24(item.endTime24 || item.endTime),
      item.notes || "",
    ]);

    const headersRow = [
      "No",
      "Employee",
      "Email",
      "Date YYYY-MM-DD",
      "Date Excel UK",
      "Day",
      "Status",
      "Start Time",
      "Break Start",
      "Break End",
      "End Time",
      "Notes",
    ];

    const csv = [headersRow, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = reportEmployee?.username || selectedEmployee?.username || "employee";

    link.href = url;
    link.download = `${name}-past-shifts-${exportStartDate || "start"}-to-${exportEndDate || "today"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess("CSV downloaded successfully. Open it in Excel.");
  };

  const downloadPDF = () => {
    if (pastShifts.length === 0) {
      showError("No past shift data found for PDF export.");
      return;
    }

    const employeeName = reportEmployee?.username || selectedEmployee?.username || "Employee";
    const doc = new jsPDF("landscape", "mm", "a4");

    doc.setFontSize(18);
    doc.text("CFATD - Employee Past Shift Report", 14, 15);

    doc.setFontSize(10);
    doc.text(`Employee: ${employeeName}`, 14, 24);
    doc.text(`Email: ${reportEmployee?.email || selectedEmployee?.email || "-"}`, 14, 30);
    doc.text(`Date Range: ${exportStartDate || "All"} to ${exportEndDate || "Today"}`, 14, 36);
    doc.text(`Total Records: ${pastShifts.length}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [[
        "No",
        "Date",
        "Day",
        "Status",
        "Start",
        "Break Start",
        "Break End",
        "End",
        "Notes",
      ]],
      body: pastShifts.map((item, index) => [
        index + 1,
        item.date || "-",
        getDayName(item.date),
        item.status || "-",
        displayTime24(item.startTime24 || item.startTime),
        displayTime24(item.breakStartTime24 || item.breakStartTime),
        displayTime24(item.breakEndTime24 || item.breakEndTime),
        displayTime24(item.endTime24 || item.endTime),
        item.notes || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [17, 17, 17] },
    });

    doc.save(`${employeeName}-past-shifts.pdf`);
    showSuccess("PDF downloaded successfully.");
  };

  const statusBadge = (value) => {
    if (value === "working") return "border-green-500/30 bg-green-500/10 text-green-300";
    if (value === "leave") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    if (value === "holiday") return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    return "border-white/10 bg-white/5 text-gray-400";
  };

  return (
    <section className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              <span className="text-sm text-gray-400">Past Shift Control</span>
            </div>
            <h1 className="text-4xl font-extrabold md:text-6xl">
              Add Your
              <span className="block text-gray-500">Past Shift</span>
            </h1>
            <p className="mt-4 max-w-2xl text-gray-500">
              Admin can add or update only past shifts. Future dates are blocked from this page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-semibold text-gray-300 hover:bg-white/10"
            >
              Back to Dashboard
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-4 text-sm text-gray-300">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-7 xl:grid-cols-[430px_1fr]">
          <form onSubmit={applyPastShift} className="h-fit rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
            <p className="text-sm text-gray-500">Create / Update</p>
            <h2 className="mb-6 text-2xl font-bold">Past Shift Form</h2>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-400">Employee</label>
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
                disabled={loadingEmployees}
                required
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.username} - {employee.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("month")}
                className={`rounded-2xl px-4 py-3 font-bold ${mode === "month" ? "bg-white text-black" : "border border-white/10 bg-[#111] text-gray-300"}`}
              >
                Full Month
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`rounded-2xl px-4 py-3 font-bold ${mode === "single" ? "bg-white text-black" : "border border-white/10 bg-[#111] text-gray-300"}`}
              >
                Single Day
              </button>
            </div>

            {mode === "month" ? (
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-400">Month</label>
                  <select
                    value={month}
                    onChange={(event) => setMonth(Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
                  >
                    {MONTHS.map((monthName, index) => (
                      <option key={monthName} value={index + 1}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-400">Year</label>
                  <select
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
                  >
                    {yearOptions.map((yearValue) => (
                      <option key={yearValue} value={yearValue}>
                        {yearValue}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-400">Past Date</label>
                <input
                  type="date"
                  value={singleDate}
                  max={todayDate()}
                  onChange={(event) => setSingleDate(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
                  required
                />
              </div>
            )}

            {mode === "month" && (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-400">Apply On Weekdays</label>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${workingDays.includes(day.value) ? "bg-white text-black" : "border border-white/10 bg-[#111] text-gray-400"}`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-400">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
              >
                <option value="working">Working</option>
                <option value="off">Off</option>
                <option value="leave">Leave</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>

            {status === "working" && (
              <div className="mb-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-400">Shift Times</p>
                  <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-300">
                    24-hour HH:MM
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Time24Input label="Start" name="startTime" value={form.startTime} onChange={handleFormChange} />
                  <Time24Input label="End" name="endTime" value={form.endTime} onChange={handleFormChange} />
                  <Time24Input label="Break Start" name="breakStartTime" value={form.breakStartTime} onChange={handleFormChange} />
                  <Time24Input label="Break End" name="breakEndTime" value={form.breakEndTime} onChange={handleFormChange} />
                </div>
                <p className="mt-2 text-xs text-gray-500">Examples: 09:00, 13:30, 18:45. AM/PM is not required.</p>
              </div>
            )}

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-400">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleFormChange}
                rows="3"
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-orange-500 px-5 py-4 font-extrabold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Past Shift"}
            </button>
          </form>

          <section className="rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm text-gray-500">Employee Report</p>
                <h2 className="text-2xl font-bold">Past Shift Records</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Download single employee shift report as CSV or PDF.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={downloadCSV} type="button" className="rounded-2xl bg-green-500/10 px-4 py-3 font-bold text-green-400 hover:bg-green-500/20">
                  Download CSV
                </button>
                <button onClick={downloadPDF} type="button" className="rounded-2xl bg-blue-500/10 px-4 py-3 font-bold text-blue-400 hover:bg-blue-500/20">
                  Download PDF
                </button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-400">From</label>
                <input type="date" value={exportStartDate} max={todayDate()} onChange={(event) => setExportStartDate(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-400">To</label>
                <input type="date" value={exportEndDate} max={todayDate()} onChange={(event) => setExportEndDate(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 outline-none" />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => fetchPastShiftReport(false)}
                  disabled={loadingReport}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-bold text-gray-300 hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingReport ? "Loading..." : "Load Report"}
                </button>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <p className="text-xs text-gray-500">Employee</p>
                <h3 className="mt-1 font-bold">{reportEmployee?.username || selectedEmployee?.username || "-"}</h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <p className="text-xs text-gray-500">Total Records</p>
                <h3 className="mt-1 text-2xl font-bold">{pastShifts.length}</h3>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <p className="text-xs text-gray-500">Working Days</p>
                <h3 className="mt-1 text-2xl font-bold text-green-400">
                  {pastShifts.filter((item) => item.status === "working").length}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-white/10">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#111] text-gray-400">
                  <tr>
                    <th className="p-4">No</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Day</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Start</th>
                    <th className="p-4">Break</th>
                    <th className="p-4">End</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pastShifts.length > 0 ? (
                    pastShifts.map((item, index) => (
                      <tr key={item._id || `${item.date}-${index}`} className="hover:bg-white/5">
                        <td className="p-4 text-gray-500">{index + 1}</td>
                        <td className="p-4 font-semibold">{item.date}</td>
                        <td className="p-4 text-gray-400">{getDayName(item.date)}</td>
                        <td className="p-4">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusBadge(item.status)}`}>
                            {item.status || "-"}
                          </span>
                        </td>
                        <td className="p-4">{displayTime24(item.startTime24 || item.startTime)}</td>
                        <td className="p-4">{displayTime24(item.breakStartTime24 || item.breakStartTime)} - {displayTime24(item.breakEndTime24 || item.breakEndTime)}</td>
                        <td className="p-4">{displayTime24(item.endTime24 || item.endTime)}</td>
                        <td className="p-4 text-gray-400">{item.notes || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-gray-500">
                        No past shifts found for selected employee/date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default AdminPastShiftManager;
