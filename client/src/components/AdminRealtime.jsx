import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminRealtime = () => {
  const navigate = useNavigate();
  const eventSourceRef = useRef(null);

  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [statusData, setStatusData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const getAdminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const addEvent = (type, payload = {}) => {
    setEvents((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message: payload.message || type,
        data: payload,
        createdAt: payload.createdAt || new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 100));
  };

  const fetchRealtimeStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await axios.get("/api/realtime/status", {
        headers: getAdminHeaders(),
      });

      setStatusData(response.data.data || null);
    } catch (error) {
      console.error("Realtime status error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
      }
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      navigate("/admin-login");
      return undefined;
    }

    const source = new EventSource(
      `/api/realtime/admin-stream?token=${encodeURIComponent(token)}`
    );

    eventSourceRef.current = source;

    source.onopen = () => {
      setConnectionStatus("Connected");
      fetchRealtimeStatus();
    };

    source.onerror = () => {
      setConnectionStatus("Disconnected / Reconnecting...");
    };

    const eventNames = [
      "connected",
      "activityLogCreated",
      "attendanceUpdated",
      "attendanceEdited",
      "employeeCreated",
      "employeeUpdated",
      "employeeDeleted",
      "employeeQrRegenerated",
      "announcementCreated",
      "personalNotificationCreated",
      "shiftScheduleUpdated",
      "ping",
    ];

    eventNames.forEach((eventName) => {
      source.addEventListener(eventName, (event) => {
        let payload = {};

        try {
          payload = JSON.parse(event.data || "{}");
        } catch (error) {
          payload = { message: event.data || eventName };
        }

        if (eventName !== "ping") {
          addEvent(eventName, payload);
          fetchRealtimeStatus();
        }
      });
    });

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const statusClass = useMemo(() => {
    if (connectionStatus === "Connected") return "text-green-400 bg-green-500/10 border-green-500/20";
    if (connectionStatus.includes("Reconnecting")) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  }, [connectionStatus]);

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

  const clearEvents = () => setEvents([]);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 py-6 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-green-600/20 blur-[120px]"></div>
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]"></div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 ${statusClass}`}>
              <span className="h-2 w-2 rounded-full bg-current"></span>
              <span className="text-sm">Realtime: {connectionStatus}</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Realtime
              <span className="block text-gray-500">Live Events</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Dashboard
            </button>

            <button
              onClick={fetchRealtimeStatus}
              disabled={loadingStatus}
              className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingStatus ? "Refreshing..." : "Refresh Status"}
            </button>

            <button
              onClick={clearEvents}
              className="rounded-2xl bg-red-500/10 px-5 py-3 font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              Clear Screen
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Admin Connections</p>
            <h2 className="mt-2 text-4xl font-bold text-green-400">
              {statusData?.adminConnections ?? 0}
            </h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Employee Connections</p>
            <h2 className="mt-2 text-4xl font-bold text-blue-400">
              {statusData?.employeeConnections ?? 0}
            </h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Employee Keys</p>
            <h2 className="mt-2 text-4xl font-bold text-purple-400">
              {statusData?.employeeKeys ?? 0}
            </h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Events On Screen</p>
            <h2 className="mt-2 text-4xl font-bold text-yellow-400">
              {events.length}
            </h2>
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Live Feed</p>
              <h2 className="text-2xl font-bold">Latest Realtime Activity</h2>
            </div>

            <p className="text-sm text-gray-500">
              Open another browser/device and scan QR or create activity to test.
            </p>
          </div>

          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-[#111] p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-gray-300">
                        {item.type}
                      </div>
                      <h3 className="text-xl font-bold">{item.message}</h3>
                    </div>

                    <p className="text-sm text-gray-500">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>

                  {item.data?.username && (
                    <p className="mt-3 text-sm text-gray-400">
                      Username: {item.data.username}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-[#111] p-12 text-center">
              <h3 className="text-2xl font-bold">Waiting for live events...</h3>
              <p className="mt-3 text-gray-500">
                Scan attendance, edit employee, create announcement, or update shift to see live events here.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminRealtime;
