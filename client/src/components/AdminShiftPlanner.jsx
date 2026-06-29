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

const initialRangeShift = {
  employeeIds: [],
  applyToAll: false,
  startDate: "",
  endDate: "",
  workingDays: [1, 2, 3, 4, 5],
  status: "working",
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

const getDateInputValue = (date) => {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() - nextDate.getTimezoneOffset());
  return nextDate.toISOString().slice(0, 10);
};

const getNextMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  return {
    startDate: getDateInputValue(first),
    endDate: getDateInputValue(last),
  };
};

const AdminShiftPlanner = () => {
  const now = new Date();
  const navigate = useNavigate();
  const nextMonthRange = useMemo(() => getNextMonthRange(), []);

  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [shift, setShift] = useState(initialShift);
  const [rangeShift, setRangeShift] = useState({
    ...initialRangeShift,
    ...nextMonthRange,
  });
  const [schedules, setSchedules] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [savingMonth, setSavingMonth] = useState(false);
  const [savingRange, setSavingRange] = useState(false);
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
        setRangeShift((current) => ({
          ...current,
          employeeIds:
            current.employeeIds.length > 0 ? current.employeeIds : [employeeList[0]._id],
        }));
      }
    } catch (error) {
      console.error("Employee load error:", error);
      if (!handleAuthError(error)) {
        showError(error.response?.data?.message || "Unable to load employees.");
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
        showError(error.response?.data?.message || "Unable to load monthly shifts.");
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

  const selectedEmployee = employees.find((employee) => employee._id === employeeId);

  const yearOptions = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }, (_, index) => currentYear - 3 + index);
  }, []);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const scheduleByDate = new Map(schedules.map((schedule) => [schedule.date, schedule]));
    const cells = Array.from({ length: firstDay }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

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

  const toggleRangeWorkingDay = (day) => {
    setRangeShift((current) => ({
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

  const updateRangeField = (event) => {
    const { name, value } = event.target;
    setRangeShift((current) => ({ ...current, [name]: value }));
  };

  const toggleRangeEmployee = (id) => {
    setRangeShift((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(id)
        ? current.employeeIds.filter((value) => value !== id)
        : [...current.employeeIds, id],
    }));
  };

  const toggleApplyToAll = () => {
    setRangeShift((current) => ({
      ...current,
      applyToAll: !current.applyToAll,
      employeeIds: !current.applyToAll ? employees.map((employee) => employee._id) : [],
    }));
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
      showSuccess(response.data.message || "Monthly shift updated successfully.");
    } catch (error) {
      console.error("Monthly shift update error:", error);
      if (!handleAuthError(error)) {
        showError(error.response?.data?.message || "Unable to update monthly shift.");
      }
    } finally {
      setSavingMonth(false);
    }
  };

  const applyRangeShift = async (event) => {
    event.preventDefault();

    const selectedIds = rangeShift.applyToAll
      ? employees.map((employee) => employee._id)
      : rangeShift.employeeIds;

    if (selectedIds.length === 0) {
      showError("Please select at least one employee.");
      return;
    }

    if (!rangeShift.startDate || !rangeShift.endDate) {
      showError("Please select start and end date.");
      return;
    }

    if (new Date(rangeShift.startDate) > new Date(rangeShift.endDate)) {
      showError("Start date cannot be after end date.");
      return;
    }

    if (rangeShift.workingDays.length === 0) {
      showError("Please select at least one weekday.");
      return;
    }

    try {
      setSavingRange(true);

      const response = await axios.post(
        "/api/shift-schedules/range-bulk",
        {
          employeeIds: selectedIds,
          startDate: rangeShift.startDate,
          endDate: rangeShift.endDate,
          workingDays: rangeShift.workingDays,
          status: rangeShift.status,
          startTime: rangeShift.startTime,
          breakStartTime: rangeShift.breakStartTime,
          breakEndTime: rangeShift.breakEndTime,
          endTime: rangeShift.endTime,
          notes: rangeShift.notes,
        },
        {
          headers: {
            ...headers(),
            "Content-Type": "application/json",
          },
        }
      );

      showSuccess(response.data.message || "Shift range updated successfully.");
      fetchSchedules();
    } catch (error) {
      console.error("Range shift update error:", error);
      if (!handleAuthError(error)) {
        showError(error.response?.data?.message || "Unable to update shift range.");
      }
    } finally {
      setSavingRange(false);
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

  const createSingleDateShift = async (date) => {
    if (!employeeId || !date) return;

    try {
      const response = await axios.post(
        "/api/shift-schedules/range-bulk",
        {
          employeeIds: [employeeId],
          startDate: date,
          endDate: date,
          workingDays: [new Date(`${date}T00:00:00.000Z`).getUTCDay()],
          status: "working",
          startTime: shift.startTime,
          breakStartTime: shift.breakStartTime,
          breakEndTime: shift.breakEndTime,
          endTime: shift.endTime,
          notes: shift.notes || "Single day shift",
        },
        {
          headers: {
            ...headers(),
            "Content-Type": "application/json",
          },
        }
      );

      showSuccess(response.data.message || "Single date shift created.");
      fetchSchedules();
    } catch (error) {
      console.error("Single date shift create error:", error);
      if (!handleAuthError(error)) {
        showError(error.response?.data?.message || "Unable to create this date shift.");
      }
    }
  };

  const saveDateShift = async () => {
    if (!editSchedule) return;

    try {
      setSavingDate(true);

      const response = await axios.put(`/api/shift-schedules/${editSchedule._id}`, editForm, {
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
      });

      setSchedules((current) =>
        current.map((item) => (item._id === editSchedule._id ? response.data.data : item))
      );

      setEditSchedule(null);
      showSuccess(response.data.message || "Shift date updated.");
    } catch (error) {
      console.error("Date shift update error:", error);
      if (!handleAuthError(error)) {
        showError(error.response?.data?.message || "Unable to update this shift date.");
      }
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
      if (!handleAuthError(error)) {
        showError(error.response?.data?.message || "Unable to delete monthly shift.");
      }
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

  const renderShiftTimeFields = (source, handler) => (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-500">Start</label>
        <input
          type="time"
          name="startTime"
          value={source.startTime}
          onChange={handler}
          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-500">Break Out</label>
        <input
          type="time"
          name="breakStartTime"
          value={source.breakStartTime}
          onChange={handler}
          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-500">Break In</label>
        <input
          type="time"
          name="breakEndTime"
          value={source.breakEndTime}
          onChange={handler}
          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-500">End</label>
        <input
          type="time"
          name="endTime"
          value={source.endTime}
          onChange={handler}
          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
        />
      </div>
    </div>
  );

  return (
    <section className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">Past & Future Shift Scheduling</span>
            </div>

            <h1 className="text-4xl font-extrabold md:text-6xl">
              Shift
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

        <div className="grid grid-cols-1 gap-7 xl:grid-cols-[410px_1fr]">
          <div className="space-y-7">
            <form
              onSubmit={applyMonthlyShift}
              className="h-fit rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl"
            >
              <p className="text-sm text-gray-500">Month Schedule</p>
              <h2 className="mb-6 text-2xl font-bold">Set Full Month Shift</h2>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-500">Employee</label>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  disabled={loadingEmployees}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                >
                  {loadingEmployees ? (
                    <option>Loading employees...</option>
                  ) : employees.length === 0 ? (
                    <option>No employees found</option>
                  ) : (
                    employees.map((employee) => (
                      <option key={employee._id} value={employee._id}>
                        {employee.username} - {employee.email}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-500">Month</label>
                  <select
                    value={month}
                    onChange={(event) => setMonth(Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                  >
                    {MONTHS.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-500">Year</label>
                  <select
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                  >
                    {yearOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-3 block text-sm font-semibold text-gray-500">Working Days</label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <button
                      type="button"
                      key={day.value}
                      onClick={() => toggleWorkingDay(day.value)}
                      className={`rounded-2xl border px-2 py-3 text-xs font-bold transition ${
                        shift.workingDays.includes(day.value)
                          ? "border-green-500/40 bg-green-500/15 text-green-300"
                          : "border-white/10 bg-[#111] text-gray-500"
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">{renderShiftTimeFields(shift, updateShiftField)}</div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-500">Notes</label>
                <textarea
                  name="notes"
                  value={shift.notes}
                  onChange={updateShiftField}
                  rows="3"
                  placeholder="Example: Regular morning shift"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingMonth || loadingEmployees}
                className="w-full rounded-2xl bg-white px-5 py-4 font-bold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingMonth ? "Saving..." : "Apply Full Month"}
              </button>

              <p className="mt-3 text-xs text-gray-600">
                This can update past, current, or future month for selected employee.
              </p>
            </form>

            <form
              onSubmit={applyRangeShift}
              className="h-fit rounded-[30px] border border-blue-500/20 bg-blue-500/5 p-6 shadow-2xl"
            >
              <p className="text-sm text-blue-300">New Update</p>
              <h2 className="mb-6 text-2xl font-bold">Date Range Shift</h2>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-500">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={rangeShift.startDate}
                    onChange={updateRangeField}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-500">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={rangeShift.endDate}
                    onChange={updateRangeField}
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-500">Shift Status</label>
                <select
                  name="status"
                  value={rangeShift.status}
                  onChange={updateRangeField}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                >
                  <option value="working">Working</option>
                  <option value="off">Off</option>
                  <option value="leave">Leave</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              <div className="mb-5">
                <label className="mb-3 block text-sm font-semibold text-gray-500">Apply On Days</label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <button
                      type="button"
                      key={day.value}
                      onClick={() => toggleRangeWorkingDay(day.value)}
                      className={`rounded-2xl border px-2 py-3 text-xs font-bold transition ${
                        rangeShift.workingDays.includes(day.value)
                          ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                          : "border-white/10 bg-[#111] text-gray-500"
                      }`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>

              {rangeShift.status === "working" && (
                <div className="mb-5">{renderShiftTimeFields(rangeShift, updateRangeField)}</div>
              )}

              <div className="mb-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-gray-500">Employees</label>
                  <button
                    type="button"
                    onClick={toggleApplyToAll}
                    className="rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10"
                  >
                    {rangeShift.applyToAll ? "Clear All" : "Select All"}
                  </button>
                </div>

                <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-3">
                  {employees.map((employee) => {
                    const selected = rangeShift.employeeIds.includes(employee._id);

                    return (
                      <label
                        key={employee._id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                          selected ? "border-blue-500/30 bg-blue-500/10" : "border-white/10 bg-black/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRangeEmployee(employee._id)}
                        />
                        <span className="text-sm">
                          <span className="font-semibold">{employee.username}</span>
                          <span className="block text-xs text-gray-500">{employee.email}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-500">Notes</label>
                <textarea
                  name="notes"
                  value={rangeShift.notes}
                  onChange={updateRangeField}
                  rows="3"
                  placeholder="Example: Next month full shift"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingRange || loadingEmployees}
                className="w-full rounded-2xl bg-blue-500 px-5 py-4 font-bold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingRange ? "Updating Range..." : "Apply Past/Future Range"}
              </button>

              <p className="mt-3 text-xs text-gray-500">
                Use this for next month, previous month, or custom date range. Existing shifts will update automatically.
              </p>
            </form>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  {selectedEmployee?.username || "Employee"} - {MONTHS[month - 1]} {year}
                </p>
                <h2 className="text-3xl font-bold">Shift Calendar</h2>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-green-500/10 px-3 py-1 text-green-300">
                  Working: {stats.working || 0}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-gray-300">
                  Off: {stats.off || 0}
                </span>
                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-yellow-300">
                  Leave: {stats.leave || 0}
                </span>
                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-purple-300">
                  Holiday: {stats.holiday || 0}
                </span>
              </div>
            </div>

            {loadingCalendar ? (
              <div className="py-20 text-center text-gray-500">Loading calendar...</div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <div key={day.value} className="text-center text-xs font-bold uppercase text-gray-500">
                      {day.short}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((cell, index) => {
                    if (!cell) {
                      return <div key={`empty-${index}`} className="min-h-28 rounded-3xl border border-white/5 bg-black/20" />;
                    }

                    const schedule = cell.schedule;

                    return (
                      <button
                        type="button"
                        key={cell.date}
                        onClick={() => (schedule ? openDateEditor(schedule) : createSingleDateShift(cell.date))}
                        className={`min-h-28 rounded-3xl border p-3 text-left transition hover:scale-[1.01] ${
                          schedule ? statusClass(schedule.status) : "border-white/10 bg-[#111] text-gray-500"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="text-lg font-bold">{cell.day}</span>
                          <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-bold uppercase">
                            {schedule?.status || "Add"}
                          </span>
                        </div>

                        {schedule ? (
                          <div className="space-y-1 text-xs">
                            {schedule.status === "working" ? (
                              <>
                                <p className="font-semibold">
                                  {schedule.startTime || "-"} - {schedule.endTime || "-"}
                                </p>
                                <p className="text-gray-400">
                                  Break: {schedule.breakStartTime || "-"} - {schedule.breakEndTime || "-"}
                                </p>
                              </>
                            ) : (
                              <p className="font-semibold capitalize">{schedule.status}</p>
                            )}

                            {schedule.notes && (
                              <p className="line-clamp-2 text-gray-500">{schedule.notes}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600">Click to add one day</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Total scheduled days in this month: {stats.total}
              </p>

              <button
                type="button"
                onClick={deleteMonth}
                disabled={!employeeId || schedules.length === 0}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-bold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete This Month
              </button>
            </div>
          </div>
        </div>

        {editSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div className="w-full max-w-lg rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
              <div className="mb-6">
                <p className="text-sm text-gray-500">Edit Date Shift</p>
                <h2 className="text-2xl font-bold">{editSchedule.date}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-500">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, status: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                  >
                    <option value="working">Working</option>
                    <option value="off">Off</option>
                    <option value="leave">Leave</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>

                {editForm.status === "working" && (
                  <div className="grid grid-cols-2 gap-3">
                    {["startTime", "breakStartTime", "breakEndTime", "endTime"].map((field) => (
                      <div key={field}>
                        <label className="mb-2 block text-xs font-semibold text-gray-500">
                          {field === "startTime"
                            ? "Start"
                            : field === "breakStartTime"
                            ? "Break Out"
                            : field === "breakEndTime"
                            ? "Break In"
                            : "End"}
                        </label>
                        <input
                          type="time"
                          value={editForm[field]}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, [field]: event.target.value }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-500">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows="3"
                    className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={saveDateShift}
                    disabled={savingDate}
                    className="flex-1 rounded-2xl bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-60"
                  >
                    {savingDate ? "Saving..." : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSchedule(null)}
                    className="flex-1 rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-bold text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminShiftPlanner;
