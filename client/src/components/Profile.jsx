import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SUPPORT_EMAIL = "cfatd.notification@gmail.com";
const EMPLOYEE_REFRESH_EVENTS = [
  "myShiftUpdated",
  "myAttendanceUpdated",
  "personalNotificationCreated",
  "myProfileUpdated",
  "myQrRegenerated",
];

const getLocalDateString = (date) => {
  const localDate = new Date(date);
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().slice(0, 10);
};

const Profile = () => {
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceInsights, setAttendanceInsights] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [pastShifts, setPastShifts] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [whatsappText, setWhatsappText] = useState("");
  const [whatsappDate, setWhatsappDate] = useState(getLocalDateString(new Date()));
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState(null);
  const navigate = useNavigate();

  const loadEmployeeData = useCallback(
    async (token, options = {}) => {
      try {
        if (options.showLoading) {
          setMessagesLoading(true);
        }

        const todayDate = new Date();
        const today = getLocalDateString(todayDate);

        const lastYearDate = new Date(todayDate);
        lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
        const lastYear = getLocalDateString(lastYearDate);

        const monthStart = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          1
        );
        const shiftEndDate = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth() + 4,
          0
        );

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          attendanceResponse,
          summaryResponse,
          insightResponse,
          announcementResponse,
          notificationResponse,
          shiftResponse,
          pastShiftResponse,
        ] = await Promise.all([
          fetch("/api/my/attendance", { headers }),
          fetch("/api/my/attendance/summary", { headers }),
          fetch("/api/my/attendance/insights", { headers }),
          fetch("/api/announcements/employee", { headers }),
          fetch("/api/personal-notifications/me", { headers }),
          fetch(
            `/api/shift-schedules/me?startDate=${getLocalDateString(
              monthStart
            )}&endDate=${getLocalDateString(shiftEndDate)}&limit=120`,
            { headers }
          ),
          fetch(
            `/api/shift-schedules/me?startDate=${lastYear}&endDate=${today}&limit=370`,
            { headers }
          ),
        ]);

        if (
          [
            attendanceResponse,
            summaryResponse,
            insightResponse,
            announcementResponse,
            notificationResponse,
            shiftResponse,
            pastShiftResponse,
          ].some((response) => response.status === 401 || response.status === 403)
        ) {
          localStorage.removeItem("userToken");
          navigate("/login");
          return;
        }

        const attendanceData = await attendanceResponse.json();
        const summaryData = await summaryResponse.json();
        const insightData = await insightResponse.json();
        const announcementData = await announcementResponse.json();
        const notificationData = await notificationResponse.json();
        const shiftData = await shiftResponse.json();
        const pastShiftData = await pastShiftResponse.json();

        const myRecords = attendanceData.data || [];
        const employeeAnnouncements = announcementData.data || [];
        const personalNotifications = notificationData.data || [];
        const shiftRecords = shiftData.data || [];
        const pastShiftRecords = (pastShiftData.data || [])
          .filter((item) => item.date <= today)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));

        setAttendance(myRecords);
        setAttendanceSummary(summaryData.data || null);
        setAttendanceInsights(insightData.data || null);
        setAnnouncements(employeeAnnouncements);
        setNotifications(personalNotifications);
        setUpcomingShifts(shiftRecords);
        setPastShifts(pastShiftRecords);

        const popupNotification = personalNotifications.find(
          (item) => item.showPopup && !item.isRead
        );

        if (popupNotification) {
          if (window.showInfo) {
            window.showInfo(
              `${popupNotification.title}\n\n${popupNotification.message}`
            );
          }

          fetch(`/api/personal-notifications/${popupNotification._id}/read`, {
            method: "PATCH",
            headers,
          })
            .then((response) => {
              if (response.ok) {
                setNotifications((current) =>
                  current.map((item) =>
                    item._id === popupNotification._id
                      ? { ...item, isRead: true }
                      : item
                  )
                );
              }
            })
            .catch((error) =>
              console.error("Mark notification read error:", error)
            );
        } else {
          const popupAnnouncement = employeeAnnouncements.find(
            (item) =>
              item.showPopup &&
              sessionStorage.getItem(`announcement-popup-${item._id}`) !==
                "shown"
          );

          if (popupAnnouncement) {
            if (window.showInfo) {
              window.showInfo(
                `${popupAnnouncement.title}\n\n${popupAnnouncement.message}`
              );
            }

            sessionStorage.setItem(
              `announcement-popup-${popupAnnouncement._id}`,
              "shown"
            );
          }
        }
      } catch (error) {
        console.error("Employee profile data error:", error);
      } finally {
        setMessagesLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const token = localStorage.getItem("userToken");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const decodedUser = JSON.parse(atob(token.split(".")[1]));

      const currentUser = {
        id: decodedUser.id || decodedUser._id || decodedUser.userId || "",
        username: decodedUser.username || "",
        email: decodedUser.email || "",
        mobile: decodedUser.mobile || "Not Added",
        currentQrVersion: decodedUser.currentQrVersion || "",
        profilePic: `https://ui-avatars.com/api/?name=${
          decodedUser.username || "Employee"
        }&background=111111&color=fff`,
      };

      setUser(currentUser);
      loadEmployeeData(token, { showLoading: true });
    } catch (error) {
      console.error("Invalid token");
      localStorage.removeItem("userToken");
      navigate("/login");
    }
  }, [loadEmployeeData, navigate]);

  useEffect(() => {
    const token = localStorage.getItem("userToken");

    if (!token) return undefined;

    const source = new EventSource(
      `/api/realtime/employee-stream?token=${encodeURIComponent(token)}`
    );

    EMPLOYEE_REFRESH_EVENTS.forEach((eventName) => {
      source.addEventListener(eventName, () => {
        loadEmployeeData(token);
      });
    });

    source.onerror = () => {
      console.warn("Employee realtime stream disconnected. Reconnecting...");
    };

    return () => {
      source.close();
    };
  }, [loadEmployeeData]);

  const refreshEmployeeData = () => {
    const token = localStorage.getItem("userToken");

    if (!token) {
      navigate("/login");
      return;
    }

    loadEmployeeData(token, { showLoading: true });
  };

  const importMyWhatsAppAttendance = async () => {
    const token = localStorage.getItem("userToken");

    if (!token) {
      navigate("/login");
      return;
    }

    if (!whatsappText.trim()) {
      if (window.showWarning) {
        window.showWarning("Please paste your WhatsApp attendance messages.");
      } else {
        alert("Please paste your WhatsApp attendance messages.");
      }
      return;
    }

    try {
      setWhatsappSaving(true);
      setWhatsappResult(null);

      const response = await fetch("/api/my/attendance/import-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: whatsappText,
          date: whatsappDate,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save WhatsApp attendance.");
      }

      setWhatsappResult(result.data || null);

      if (window.showSuccess) {
        window.showSuccess(result.message || "WhatsApp attendance saved.");
      } else {
        alert(result.message || "WhatsApp attendance saved.");
      }

      await loadEmployeeData(token, { showLoading: true });
    } catch (error) {
      console.error("My WhatsApp attendance import error:", error);

      if (window.showError) {
        window.showError(error.message || "Unable to save WhatsApp attendance.");
      } else {
        alert(error.message || "Unable to save WhatsApp attendance.");
      }
    } finally {
      setWhatsappSaving(false);
    }
  };

  const whatsappSampleText = `[29/06, 08:59] ${user?.username || "Kamal"}: In
[29/06, 13:00] ${user?.username || "Kamal"}: Break out
[29/06, 13:30] ${user?.username || "Kamal"}: Break in
[29/06, 18:01] ${user?.username || "Kamal"}: Out`;

  const whatsappNoBreakSampleText = `[29/06, 08:59] ${user?.username || "Kamal"}: In
[29/06, 18:01] ${user?.username || "Kamal"}: Out without break`;


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

  const formatMessageDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const markNotificationRead = async (notificationId) => {
    const token = localStorage.getItem("userToken");

    if (!token) return;

    try {
      const response = await fetch(
        `/api/personal-notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications((current) =>
          current.map((item) =>
            item._id === notificationId
              ? { ...item, isRead: true }
              : item
          )
        );
      }
    } catch (error) {
      console.error("Notification update error:", error);
    }
  };

  const priorityClass = (priority) => {
    if (priority === "urgent") return "bg-red-500/10 text-red-400";
    if (priority === "important") {
      return "bg-yellow-500/10 text-yellow-400";
    }
    return "bg-blue-500/10 text-blue-400";
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

  const monthOptions = [
    ...new Set(
      attendance.map((item) => {
        const date = new Date(item.createdAt || item.date);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      })
    ),
  ];

  const filteredAttendance = selectedMonth
    ? attendance.filter((item) => {
        const date = new Date(item.createdAt || item.date);
        const month = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        return month === selectedMonth;
      })
    : attendance;

  const myWeekSummary = attendanceSummary?.week || {};
  const myMonthSummary = attendanceSummary?.month || {};
  const myInsightTotals = attendanceInsights?.totals || {};
  const myLateDays = myInsightTotals.lateDays || 0;
  const myAbsentDays = myInsightTotals.absentDays || 0;
  const myOvertimeDays = myInsightTotals.overtimeDays || 0;
  const myLateSeconds = myInsightTotals.totalLateSeconds || 0;
  const myOvertimeSeconds = myInsightTotals.totalOvertimeSeconds || 0;

  const raiseQuery = (item) => {
    const subject = `Attendance Correction Query - ${
      item.date || formatDate(item.createdAt)
    }`;

    const message = `Hello Admin,

I want to raise an attendance correction query.

Employee Name: ${user?.username}
Email: ${user?.email}
Mobile: ${user?.mobile}

Date: ${item.date || formatDate(item.createdAt)}
Entry Time: ${formatTime(item.entryTime)}
Break Out: ${formatTime(item.breakOutTime)}
Break In: ${formatTime(item.breakInTime)}
Last Out: ${formatTime(item.lastOutTime)}
Total Break: ${formatSeconds(item.totalBreakSeconds)}
Working Hours: ${formatSeconds(item.totalWorkSeconds)}

Issue:
My shift/attendance details are different or wrong. Please check and correct this record.

Thank you.`;

    const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(message)}`;

    window.location.href = emailUrl;
  };

  return (
    <section className="relative min-h-screen bg-black text-white px-4 pt-32 pb-10 overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-gray-400 text-sm">Employee Profile</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            My
            <span className="block text-gray-500">Attendance</span>
          </h1>
        </div>

        <section className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
          <div className="mb-6">
            <p className="text-sm text-gray-500">Attendance Summary</p>
            <h2 className="text-2xl font-bold">My Weekly & Monthly Hours</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="rounded-[24px] border border-green-500/20 bg-green-500/10 p-5">
              <p className="text-sm text-gray-400">This Week Hours</p>
              <h3 className="mt-2 text-2xl font-bold text-green-400">
                {formatSeconds(myWeekSummary.totalWorkSeconds)}
              </h3>
            </div>

            <div className="rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-5">
              <p className="text-sm text-gray-400">This Month Hours</p>
              <h3 className="mt-2 text-2xl font-bold text-blue-400">
                {formatSeconds(myMonthSummary.totalWorkSeconds)}
              </h3>
            </div>

            <div className="rounded-[24px] border border-purple-500/20 bg-purple-500/10 p-5">
              <p className="text-sm text-gray-400">Present Days This Month</p>
              <h3 className="mt-2 text-3xl font-bold text-purple-400">
                {myMonthSummary.presentDays || 0}
              </h3>
            </div>

            <div className="rounded-[24px] border border-yellow-500/20 bg-yellow-500/10 p-5">
              <p className="text-sm text-gray-400">Month Break Time</p>
              <h3 className="mt-2 text-2xl font-bold text-yellow-400">
                {formatSeconds(myMonthSummary.totalBreakSeconds)}
              </h3>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-gray-500">WhatsApp Attendance</p>
              <h2 className="text-2xl font-bold">Add My WhatsApp Entry</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                Paste your own WhatsApp attendance messages. Supported actions:
                In, Break out, Break in, Out. If you write Out without break,
                break time will be saved as 00:00:00 and only In/Out will be used.
              </p>
            </div>

            <input
              type="date"
              value={whatsappDate}
              onChange={(event) => setWhatsappDate(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white"
            />
          </div>

          <textarea
            rows={7}
            value={whatsappText}
            onChange={(event) => setWhatsappText(event.target.value)}
            placeholder="[29/06, 08:59] Kamal: In&#10;[29/06, 13:00] Kamal: Break out&#10;[29/06, 13:30] Kamal: Break in&#10;[29/06, 18:01] Kamal: Out"
            className="w-full resize-y rounded-3xl border border-white/10 bg-[#111] p-5 text-white placeholder:text-gray-600"
          />

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setWhatsappText(whatsappSampleText)}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-semibold text-gray-300 transition hover:bg-white/10"
            >
              Normal Sample
            </button>

            <button
              type="button"
              onClick={() => setWhatsappText(whatsappNoBreakSampleText)}
              className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-5 py-3 font-semibold text-yellow-400 transition hover:bg-yellow-500/20"
            >
              Out Without Break Sample
            </button>

            <button
              type="button"
              onClick={importMyWhatsAppAttendance}
              disabled={whatsappSaving}
              className="rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {whatsappSaving ? "Saving..." : "Save WhatsApp Entry"}
            </button>
          </div>

          {whatsappResult && (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-5">
                <h3 className="font-bold text-green-400">
                  Saved Lines ({whatsappResult.imported?.length || 0})
                </h3>

                {(whatsappResult.imported || []).length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">No lines saved.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {(whatsappResult.imported || []).map((item, index) => (
                      <div key={`${item.attendanceId}-${index}`} className="rounded-2xl bg-black/20 p-3 text-sm">
                        <p className="font-semibold text-white">
                          {item.date} - {item.time} - {item.scanType}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 break-words">
                          {item.line}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5">
                <h3 className="font-bold text-red-400">
                  Skipped Lines ({whatsappResult.skipped?.length || 0})
                </h3>

                {(whatsappResult.skipped || []).length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">No skipped lines.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {(whatsappResult.skipped || []).map((item, index) => (
                      <div key={`${item.line}-${index}`} className="rounded-2xl bg-black/20 p-3 text-sm">
                        <p className="font-semibold text-red-300">{item.reason}</p>
                        <p className="mt-1 text-xs text-gray-500 break-words">
                          {item.line}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
          <div className="mb-6">
            <p className="text-sm text-gray-500">Shift Insights</p>
            <h2 className="text-2xl font-bold">Late, Absence & Overtime</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5">
              <p className="text-sm text-gray-400">Late Days This Month</p>
              <h3 className="mt-2 text-3xl font-bold text-red-400">
                {myLateDays}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                Late time: {formatSeconds(myLateSeconds)}
              </p>
            </div>

            <div className="rounded-[24px] border border-orange-500/20 bg-orange-500/10 p-5">
              <p className="text-sm text-gray-400">Absent Days This Month</p>
              <h3 className="mt-2 text-3xl font-bold text-orange-400">
                {myAbsentDays}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                Working days with no entry scan
              </p>
            </div>

            <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-5">
              <p className="text-sm text-gray-400">Overtime Days</p>
              <h3 className="mt-2 text-3xl font-bold text-cyan-400">
                {myOvertimeDays}
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                OT time: {formatSeconds(myOvertimeSeconds)}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#111] p-5">
              <p className="text-sm text-gray-400">Grace Time</p>
              <h3 className="mt-2 text-3xl font-bold text-white">
                {attendanceInsights?.graceMinutes || 10} min
              </h3>
              <p className="mt-2 text-xs text-gray-500">
                Late count starts after scheduled start + grace
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <p className="text-gray-500 text-sm">Future Rota</p>
              <h2 className="text-2xl font-bold">My Upcoming Shifts</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={refreshEmployeeData}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
              >
                Refresh
              </button>

              <span className="bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                {upcomingShifts.filter((item) => item.status === "working").length}{" "}
                Working Days
              </span>
            </div>
          </div>

          {messagesLoading ? (
            <p className="text-center text-gray-500 py-12">
              Loading current and upcoming shifts...
            </p>
          ) : upcomingShifts.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-3xl py-12 text-center">
              <p className="text-gray-500">
                No current or upcoming shifts have been scheduled yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max pb-2">
                {upcomingShifts.map((shiftItem) => (
                  <article
                    key={shiftItem._id}
                    className={`w-56 rounded-3xl border p-5 ${
                      shiftItem.status === "working"
                        ? "border-green-500/30 bg-green-500/10"
                        : shiftItem.status === "leave"
                        ? "border-yellow-500/30 bg-yellow-500/10"
                        : shiftItem.status === "holiday"
                        ? "border-purple-500/30 bg-purple-500/10"
                        : "border-white/10 bg-[#111]"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase text-gray-500">
                      {new Date(`${shiftItem.date}T00:00:00`).toLocaleDateString(
                        "en-GB",
                        { weekday: "long" }
                      )}
                    </p>

                    <h3 className="text-xl font-bold mt-1">
                      {new Date(`${shiftItem.date}T00:00:00`).toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </h3>

                    <span className="inline-block mt-3 rounded-full bg-black/20 px-3 py-1 text-xs font-bold uppercase">
                      {shiftItem.status}
                    </span>

                    {shiftItem.status === "working" && (
                      <div className="mt-4 text-sm">
                        <p className="font-semibold">
                          {shiftItem.startTime || "-"} -{" "}
                          {shiftItem.endTime || "-"}
                        </p>
                        <p className="text-gray-500 mt-1">
                          Break: {shiftItem.breakStartTime || "-"} -{" "}
                          {shiftItem.breakEndTime || "-"}
                        </p>
                      </div>
                    )}

                    {shiftItem.notes && (
                      <p className="text-xs text-gray-500 mt-3 line-clamp-2">
                        {shiftItem.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>



        <section className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <p className="text-gray-500 text-sm">Past Rota Updates</p>
              <h2 className="text-2xl font-bold">My Past Shift Updates</h2>
              <p className="text-gray-500 text-sm mt-1">
                Admin added or updated past shifts will appear here.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={refreshEmployeeData}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
              >
                Refresh
              </button>

              <span className="bg-orange-500/10 text-orange-400 px-4 py-2 rounded-full text-sm font-semibold">
                {pastShifts.length} Records
              </span>
            </div>
          </div>

          {messagesLoading ? (
            <p className="text-center text-gray-500 py-12">
              Loading past shift updates...
            </p>
          ) : pastShifts.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-3xl py-12 text-center">
              <p className="text-gray-500">
                No past shift updates found yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-white/10">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#111] text-gray-400">
                  <tr>
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
                  {pastShifts.slice(0, 60).map((shiftItem) => (
                    <tr key={shiftItem._id || shiftItem.date} className="hover:bg-white/5">
                      <td className="p-4 font-semibold">{shiftItem.date}</td>
                      <td className="p-4 text-gray-400">
                        {new Date(`${shiftItem.date}T00:00:00`).toLocaleDateString("en-GB", {
                          weekday: "long",
                        })}
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">
                          {shiftItem.status || "-"}
                        </span>
                      </td>
                      <td className="p-4">{shiftItem.startTime || "-"}</td>
                      <td className="p-4">
                        {shiftItem.breakStartTime || "-"} - {shiftItem.breakEndTime || "-"}
                      </td>
                      <td className="p-4">{shiftItem.endTime || "-"}</td>
                      <td className="p-4 text-gray-500">{shiftItem.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <section className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-gray-500 text-sm">Company Updates</p>
                <h2 className="text-2xl font-bold">
                  Employee Announcements
                </h2>
              </div>

              <span className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-sm font-semibold">
                {announcements.length}
              </span>
            </div>

            {messagesLoading ? (
              <p className="text-center text-gray-500 py-12">
                Loading announcements...
              </p>
            ) : announcements.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-3xl py-12 text-center">
                <p className="text-gray-500">No employee announcements.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[430px] overflow-y-auto pr-1">
                {announcements.map((announcement) => (
                  <article
                    key={announcement._id}
                    className="bg-[#111] border border-white/10 rounded-3xl p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-xs font-bold uppercase">
                        Employee Notice
                      </span>

                      <span className="text-gray-600 text-xs">
                        {formatMessageDate(announcement.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold break-words">
                      {announcement.title}
                    </h3>

                    <p className="text-gray-400 text-sm leading-6 mt-3 whitespace-pre-wrap break-words">
                      {announcement.message}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-gray-500 text-sm">Private Inbox</p>
                <h2 className="text-2xl font-bold">
                  Personal Notifications
                </h2>
              </div>

              <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
                {notifications.filter((item) => !item.isRead).length} New
              </span>
            </div>

            {messagesLoading ? (
              <p className="text-center text-gray-500 py-12">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-3xl py-12 text-center">
                <p className="text-gray-500">No personal notifications.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[430px] overflow-y-auto pr-1">
                {notifications.map((notification) => (
                  <article
                    key={notification._id}
                    className={`border rounded-3xl p-5 ${
                      notification.isRead
                        ? "bg-[#111] border-white/10"
                        : "bg-blue-500/10 border-blue-500/30"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${priorityClass(
                          notification.priority
                        )}`}
                      >
                        {notification.priority || "normal"}
                      </span>

                      <span className="text-gray-600 text-xs">
                        {formatMessageDate(notification.createdAt)}
                      </span>

                      {!notification.isRead && (
                        <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                          New
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold break-words">
                      {notification.title}
                    </h3>

                    <p className="text-gray-400 text-sm leading-6 mt-3 whitespace-pre-wrap break-words">
                      {notification.message}
                    </p>

                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() =>
                          markNotificationRead(notification._id)
                        }
                        className="mt-4 bg-white text-black px-4 py-2 rounded-2xl text-sm font-bold hover:bg-gray-200 transition"
                      >
                        Mark as Read
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl">
            <div className="text-center">
              <img
                src={user?.profilePic}
                alt="Profile"
                className="h-28 w-28 mx-auto rounded-full border border-white/10 shadow-lg"
              />

              <h2 className="text-3xl font-bold mt-5">
                {user?.username || "-"}
              </h2>

              <p className="text-gray-500 mt-2 break-all">
                {user?.email || "-"}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                <p className="text-gray-500 text-sm">Mobile</p>
                <h3 className="text-lg font-bold mt-2">
                  {user?.mobile || "Not Added"}
                </h3>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                <p className="text-gray-500 text-sm">Total Records</p>
                <h3 className="text-3xl font-bold mt-2">
                  {attendance.length}
                </h3>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                <p className="text-gray-500 text-sm">This Week</p>
                <h3 className="text-2xl font-bold mt-2 text-green-400">
                  {formatSeconds(myWeekSummary.totalWorkSeconds)}
                </h3>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                <p className="text-gray-500 text-sm">This Month</p>
                <h3 className="text-2xl font-bold mt-2 text-blue-400">
                  {formatSeconds(myMonthSummary.totalWorkSeconds)}
                </h3>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                <p className="text-gray-500 text-sm">QR Security</p>
                <h3 className="text-lg font-bold mt-2 text-green-400">
                  Latest QR Only
                </h3>
                <p className="text-gray-500 text-xs mt-2 break-all">
                  {user?.currentQrVersion || "QR version not found. Login again."}
                </p>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                <p className="text-gray-500 text-sm">Access</p>
                <h3 className="text-lg font-bold mt-2 text-green-400">
                  Read Only
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <p className="text-gray-500 text-sm">Monthly Records</p>
                <h2 className="text-2xl font-bold">Attendance History</h2>
              </div>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[#111] border border-white/10 rounded-2xl px-5 py-3 text-white outline-none"
              >
                <option value="">All Months</option>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-[#111] text-white">
                  <tr>
                    <th className="p-4 text-left">No</th>
                    <th className="p-4 text-left">Date</th>
                    <th className="p-4 text-left">Entry</th>
                    <th className="p-4 text-left">Break Out</th>
                    <th className="p-4 text-left">Break In</th>
                    <th className="p-4 text-left">Out</th>
                    <th className="p-4 text-left">Total Break</th>
                    <th className="p-4 text-left">Work Hours</th>
                    <th className="p-4 text-left">Query</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttendance.length > 0 ? (
                    filteredAttendance.map((item, index) => (
                      <tr
                        key={item._id}
                        className="border-t border-white/10 hover:bg-white/5 transition"
                      >
                        <td className="p-4 text-gray-400">{index + 1}</td>
                        <td className="p-4 text-gray-300">
                          {item.date || formatDate(item.createdAt)}
                        </td>
                        <td className="p-4 text-green-400 font-semibold">
                          {formatTime(item.entryTime)}
                        </td>
                        <td className="p-4 text-yellow-400 font-semibold">
                          {formatTime(item.breakOutTime)}
                        </td>
                        <td className="p-4 text-blue-400 font-semibold">
                          {formatTime(item.breakInTime)}
                        </td>
                        <td className="p-4 text-red-400 font-semibold">
                          {formatTime(item.lastOutTime)}
                        </td>
                        <td className="p-4">
                          {formatSeconds(item.totalBreakSeconds)}
                        </td>
                        <td className="p-4">
                          {formatSeconds(item.totalWorkSeconds)}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => raiseQuery(item)}
                            className="bg-green-500/10 text-green-400 px-4 py-2 rounded-2xl font-semibold hover:bg-green-500/20 transition"
                          >
                            Email Query
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        className="text-center py-16 text-gray-500 text-xl"
                      >
                        No attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-gray-500 text-sm mt-5">
              Employees can only view records. For corrections, use Email Query
              to send the attendance details to {SUPPORT_EMAIL}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Profile;
