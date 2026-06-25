import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

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

const initialShift = {
  workingDays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  breakStartTime: "13:00",
  breakEndTime: "14:00",
  endTime: "17:00",
  notes: "",
};

const initialEdit = {
  status: "working",
  startTime: "",
  breakStartTime: "",
  breakEndTime: "",
  endTime: "",
  notes: "",
};

const AdminShiftPlanner = () => {
  const now = new Date();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [shift, setShift] = useState(initialShift);
  const [schedules, setSchedules] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [savingMonth, setSavingMonth] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [editForm, setEditForm] = useState(initialEdit);
  const [savingDate, setSavingDate] = useState(false);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const showSuccess = (message) => {
    if (window.showSuccess) window.showSuccess(message);
    else alert(message);
  };

  const showError = (message) => {
    if (window.showError) window.showError(message);
    else alert(message);
  };

  const handleAuthError = (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem("adminToken");
      navigate("/admin-login");
      return true;
    }

    return false;
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get("/api/users", {
        headers: headers(),
      });

      const employeeList = response.data.data || [];
      setEmployees(employeeList);

      if (employeeList.length > 0) {
        setEmployeeId((current) => current || employeeList[0]._id);
      }
    } catch (error) {
      console.error("Employee load error:", error);
      if (!handleAuthError(error)) {
        showError(
          error.response?.data?.message || "Unable to load employees."
        );
      }
    } finally {
      setLoadingEmployees(false);
    }
  }, [navigate]);

  const fetchSchedules = useCallback(async () => {
    if (!employeeId) {
      setSchedules([]);
      return;
    }

    try {
      setLoadingCalendar(true);

      const response = await axios.get("/api/shift-schedules", {
        params: { employeeId, year, month },
        headers: headers(),
      });

      setSchedules(response.data.data || []);
    } catch (error) {
      console.error("Schedule load error:", error);
      if (!handleAuthError(error)) {
        showError(
          error.response?.data?.message || "Unable to load monthly shifts."
        );
      }
    } finally {
      setLoadingCalendar(false);
    }
  }, [employeeId, month, navigate, year]);

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      navigate("/admin-login");
      return;
    }

    fetchEmployees();
  }, [fetchEmployees, navigate]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const selectedEmployee = employees.find(
    (employee) => employee._id === employeeId
  );

  const yearOptions = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }, (_, index) => currentYear - 1 + index);
  }, []);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const scheduleByDate = new Map(
      schedules.map((schedule) => [schedule.date, schedule])
    );
    const cells = Array.from({ length: firstDay }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;

      cells.push({
        day,
        date,
        schedule: scheduleByDate.get(date) || null,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [month, schedules, year]);

  const stats = useMemo(() => {
    return schedules.reduce(
      (result, item) => {
        result.total += 1;
        result[item.status] = (result[item.status] || 0) + 1;
        return result;
      },
      { total: 0, working: 0, off: 0, leave: 0, holiday: 0 }
    );
  }, [schedules]);

  const toggleWorkingDay = (day) => {
    setShift((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((value) => value !== day)
        : [...current.workingDays, day].sort(),
    }));
  };

  const updateShiftField = (event) => {
    const { name, value } = event.target;
    setShift((current) => ({ ...current, [name]: value }));
  };

  const applyMonthlyShift = async (event) => {
    event.preventDefault();

    if (!employeeId) {
      showError("Please select an employee.");
      return;
    }

    if (shift.workingDays.length === 0) {
      showError("Please select at least one working weekday.");
      return;
    }

    try {
      setSavingMonth(true);

      const response = await axios.post(
        "/api/shift-schedules/bulk",
        {
          employeeId,
          year,
          month,
          ...shift,
        },
        {
          headers: {
            ...headers(),
            "Content-Type": "application/json",
          },
        }
      );

      setSchedules(response.data.data || []);
      showSuccess(
        response.data.message || "Monthly shift updated successfully."
      );
    } catch (error) {
      console.error("Monthly shift update error:", error);
      showError(
        error.response?.data?.message || "Unable to update monthly shift."
      );
    } finally {
      setSavingMonth(false);
    }
  };

  const openDateEditor = (schedule) => {
    if (!schedule) return;

    setEditSchedule(schedule);
    setEditForm({
      status: schedule.status || "working",
      startTime: schedule.startTime || "",
      breakStartTime: schedule.breakStartTime || "",
      breakEndTime: schedule.breakEndTime || "",
      endTime: schedule.endTime || "",
      notes: schedule.notes || "",
    });
  };

  const saveDateShift = async () => {
    if (!editSchedule) return;

    try {
      setSavingDate(true);

      const response = await axios.put(
        `/api/shift-schedules/${editSchedule._id}`,
        editForm,
        {
          headers: {
            ...headers(),
            "Content-Type": "application/json",
          },
        }
      );

      setSchedules((current) =>
        current.map((item) =>
          item._id === editSchedule._id ? response.data.data : item
        )
      );

      setEditSchedule(null);
      showSuccess(response.data.message || "Shift date updated.");
    } catch (error) {
      console.error("Date shift update error:", error);
      showError(
        error.response?.data?.message || "Unable to update this shift date."
      );
    } finally {
      setSavingDate(false);
    }
  };

  const deleteMonth = async () => {
    if (!employeeId || schedules.length === 0) return;

    const confirmed = window.confirm(
      `Delete the complete ${MONTHS[month - 1]} ${year} shift for ${
        selectedEmployee?.username || "this employee"
      }?`
    );

    if (!confirmed) return;

    try {
      const response = await axios.delete("/api/shift-schedules/month", {
        params: { employeeId, year, month },
        headers: headers(),
      });

      setSchedules([]);
      showSuccess(response.data.message || "Monthly shift deleted.");
    } catch (error) {
      console.error("Monthly shift delete error:", error);
      showError(
        error.response?.data?.message || "Unable to delete monthly shift."
      );
    }
  };

  const statusClass = (status) => {
    if (status === "working") {
      return "border-green-500/30 bg-green-500/10 text-green-300";
    }
    if (status === "leave") {
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    }
    if (status === "holiday") {
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    }
    return "border-white/10 bg-white/5 text-gray-500";
  };

  return (
    <section className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">
                Future Shift Scheduling
              </span>
            </div>

            <h1 className="text-4xl font-extrabold md:text-6xl">
              Monthly Shift
              <span className="block text-gray-500">Planner</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchSchedules}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-semibold text-gray-300 hover:bg-white/10"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black hover:bg-gray-200"
            >
              Back to Dashboard
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-7 xl:grid-cols-[390px_1fr]">
          <form
            onSubmit={applyMonthlyShift}
            className="h-fit rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl"
          >
            <p className="text-sm text-gray-500">Bulk Schedule</p>
            <h2 className="mb-6 text-2xl font-bold">
              Set Full Month Shift
            </h2>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Employee
              </label>

              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                disabled={loadingEmployees}
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-4 text-white"
              >
                {employees.length === 0 && (
                  <option value="">No employees found</option>
                )}

                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.username} - {employee.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">
                  Month
                </label>
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-4 text-white"
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">
                  Year
                </label>
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-4 text-white"
                >
                  {yearOptions.map((yearValue) => (
                    <option key={yearValue} value={yearValue}>
                      {yearValue}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-3 block text-sm font-semibold text-gray-300">
                Working Weekdays
              </label>

              <div className="grid grid-cols-4 gap-2">
                {DAYS.map((day) => {
                  const selected = shift.workingDays.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      title={day.label}
                      onClick={() => toggleWorkingDay(day.value)}
                      className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${
                        selected
                          ? "border-green-500 bg-green-500/15 text-green-300"
                          : "border-white/10 bg-[#111] text-gray-600"
                      }`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              {[
                ["startTime", "Start Time"],
                ["breakStartTime", "Break Start"],
                ["breakEndTime", "Break End"],
                ["endTime", "End Time"],
              ].map(([name, label]) => (
                <div key={name}>
                  <label className="mb-2 block text-xs font-semibold text-gray-400">
                    {label}
                  </label>
                  <input
                    type="time"
                    name={name}
                    value={shift[name]}
                    onChange={updateShiftField}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-3 py-3 text-white"
                  />
                </div>
              ))}
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Monthly Note
              </label>
              <textarea
                name="notes"
                value={shift.notes}
                onChange={updateShiftField}
                rows={3}
                maxLength={500}
                placeholder="Optional shift note..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white placeholder:text-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={savingMonth || !employeeId}
              className="w-full rounded-2xl bg-green-600 px-5 py-4 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingMonth
                ? "Updating Full Month..."
                : "Apply Shift to Full Month"}
            </button>

            <p className="mt-4 text-xs leading-5 text-gray-600">
              Selected weekdays become working shifts. Other days become
              scheduled days off. Existing dates in this month are updated.
            </p>
          </form>

          <main className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                ["Working", stats.working, "text-green-400"],
                ["Off", stats.off, "text-gray-400"],
                ["Leave", stats.leave, "text-yellow-400"],
                ["Holiday", stats.holiday, "text-purple-400"],
                ["Total Days", stats.total, "text-white"],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-white/10 bg-[#111] p-5"
                >
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <section className="rounded-[30px] border border-white/10 bg-[#050505] p-5 shadow-2xl md:p-6">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {selectedEmployee?.username || "Select employee"}
                  </p>
                  <h2 className="text-2xl font-bold">
                    {MONTHS[month - 1]} {year}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={deleteMonth}
                  disabled={schedules.length === 0}
                  className="rounded-2xl bg-red-500/10 px-4 py-3 font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                >
                  Delete This Month
                </button>
              </div>

              {loadingCalendar ? (
                <p className="py-24 text-center text-gray-500">
                  Loading monthly calendar...
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[850px]">
                    <div className="mb-2 grid grid-cols-7 gap-2">
                      {DAYS.map((day) => (
                        <div
                          key={day.value}
                          className="px-2 py-3 text-center text-sm font-bold text-gray-500"
                        >
                          {day.label}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {calendarDays.map((cell, index) =>
                        cell ? (
                          <button
                            key={cell.date}
                            type="button"
                            onClick={() => openDateEditor(cell.schedule)}
                            disabled={!cell.schedule}
                            className={`min-h-[150px] rounded-2xl border p-3 text-left transition ${
                              cell.schedule
                                ? `${statusClass(
                                    cell.schedule.status
                                  )} hover:-translate-y-0.5`
                                : "border-dashed border-white/10 bg-[#0b0b0b] text-gray-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-lg font-extrabold">
                                {cell.day}
                              </span>

                              <span className="text-[10px] font-bold uppercase">
                                {cell.schedule?.status || "Not set"}
                              </span>
                            </div>

                            {cell.schedule?.status === "working" && (
                              <div className="mt-4 space-y-1 text-xs">
                                <p>
                                  {cell.schedule.startTime || "-"} -{" "}
                                  {cell.schedule.endTime || "-"}
                                </p>
                                <p className="opacity-70">
                                  Break:{" "}
                                  {cell.schedule.breakStartTime || "-"} -{" "}
                                  {cell.schedule.breakEndTime || "-"}
                                </p>
                              </div>
                            )}

                            {cell.schedule?.notes && (
                              <p className="mt-3 line-clamp-2 text-[11px] opacity-70">
                                {cell.schedule.notes}
                              </p>
                            )}
                          </button>
                        ) : (
                          <div
                            key={`empty-${index}`}
                            className="min-h-[150px] rounded-2xl border border-transparent"
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>

        {editSchedule && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
              <p className="text-sm text-gray-500">Individual Date</p>
              <h2 className="text-3xl font-bold">Edit {editSchedule.date}</h2>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-gray-300">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-4 text-white"
                >
                  <option value="working">Working</option>
                  <option value="off">Day Off</option>
                  <option value="leave">Leave</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              {editForm.status === "working" && (
                <div className="mt-5 grid grid-cols-2 gap-4">
                  {[
                    ["startTime", "Start Time"],
                    ["breakStartTime", "Break Start"],
                    ["breakEndTime", "Break End"],
                    ["endTime", "End Time"],
                  ].map(([name, label]) => (
                    <div key={name}>
                      <label className="mb-2 block text-sm text-gray-400">
                        {label}
                      </label>
                      <input
                        type="time"
                        value={editForm[name]}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            [name]: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <label className="mb-2 block text-sm text-gray-400">
                  Date Note
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={saveDateShift}
                  disabled={savingDate}
                  className="flex-1 rounded-2xl bg-white py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {savingDate ? "Saving..." : "Save Date"}
                </button>

                <button
                  type="button"
                  onClick={() => setEditSchedule(null)}
                  disabled={savingDate}
                  className="flex-1 rounded-2xl bg-red-500/10 py-3 font-bold text-red-400 hover:bg-red-500/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminShiftPlanner;
