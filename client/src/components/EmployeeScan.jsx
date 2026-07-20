import React, { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

const ACTIONS = [
  {
    type: "ENTRY",
    title: "In",
    subtitle: "Start your shift",
    icon: "IN",
    buttonClass: "bg-white text-black hover:bg-gray-200",
    selectedClass: "border-white bg-white/10",
  },
  {
    type: "BREAK_OUT",
    title: "Take Break",
    subtitle: "Start your break",
    icon: "BO",
    buttonClass: "bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
    selectedClass: "border-yellow-400 bg-yellow-500/10",
  },
  {
    type: "BREAK_IN",
    title: "End Break",
    subtitle: "Return to work",
    icon: "BI",
    buttonClass: "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
    selectedClass: "border-blue-400 bg-blue-500/10",
  },
  {
    type: "OUT",
    title: "Sign Out",
    subtitle: "Finish your shift",
    icon: "OUT",
    buttonClass: "bg-red-500/10 text-red-300 hover:bg-red-500/20",
    selectedClass: "border-red-400 bg-red-500/10",
  },
];

const getActionTitle = (type) =>
  ACTIONS.find((item) => item.type === type)?.title || type;

const formatWhatsAppStamp = (value) => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const partValue = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `[${partValue("day")}/${partValue("month")}, ${partValue(
    "hour"
  )}:${partValue("minute")}]`;
};

const createWhatsAppMessage = (employeeName, type, scannedAt) =>
  `${formatWhatsAppStamp(scannedAt)} ${
    employeeName || "Employee"
  }: ${getActionTitle(type)}`;

const getLondonDateKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const partValue = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
};

const EmployeeScan = () => {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanLockRef = useRef(false);
  const lastRequestStatusRef = useRef("");

  const [employee, setEmployee] = useState(null);
  const [scanType, setScanType] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(
    "Choose an action, then scan the latest admin QR."
  );
  const [todayRecord, setTodayRecord] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [reentryRequest, setReentryRequest] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const getToken = () => localStorage.getItem("userToken");

  const decodeToken = (token) => {
    const payload = token.split(".")[1];
    const normalised = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalised.padEnd(
      normalised.length + ((4 - (normalised.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(padded));
  };

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch (error) {
        console.warn("Employee scanner stop error:", error.message);
      }

      try {
        await scanner.clear();
      } catch (error) {
        console.warn("Employee scanner clear error:", error.message);
      }
    }

    scannerRef.current = null;
    setIsScanning(false);
  }, []);

  const loadTodayAttendance = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/my/attendance", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("userToken");
        navigate("/login");
        return;
      }

      const result = await response.json();
      const today = getLondonDateKey();
      const record = (result.data || []).find((item) => item.date === today);
      setTodayRecord(record || null);
    } catch (error) {
      console.error("Load today attendance error:", error);
    }
  }, [navigate]);

  const loadReentryRequest = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/my/reentry-request/today", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const result = await response.json();
      const request = result.data || null;
      const previousStatus = lastRequestStatusRef.current;

      setReentryRequest(request);

      if (!request) {
        lastRequestStatusRef.current = "";
        return;
      }

      if (
        previousStatus === "pending" &&
        request.status === "approved"
      ) {
        const approvedAt = request.requestedAt || request.decidedAt || new Date().toISOString();

        setLastResult({
          type: "ENTRY",
          message:
            "Admin approved your re-entry. Your In was added to today's same shift.",
          scannedAt: approvedAt,
          whatsappMessage: createWhatsAppMessage(
            employee?.username,
            "ENTRY",
            approvedAt
          ),
        });
        setMessage(
          "Re-entry approved. Your In time is now included in today's shift."
        );
        await loadTodayAttendance();

        window.showSuccess?.(
          "Admin approved your re-entry. Your In has been added."
        );
      }

      if (
        previousStatus === "pending" &&
        request.status === "denied"
      ) {
        setMessage(
          request.decisionNote
            ? `Re-entry denied: ${request.decisionNote}`
            : "Your re-entry request was denied by admin."
        );

        window.showError?.(
          request.decisionNote
            ? `Re-entry denied: ${request.decisionNote}`
            : "Your re-entry request was denied by admin."
        );
      }

      lastRequestStatusRef.current = request.status;
    } catch (error) {
      console.error("Load re-entry request error:", error);
    }
  }, [employee?.username, loadTodayAttendance]);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      navigate("/login");
      return undefined;
    }

    try {
      const decoded = decodeToken(token);
      setEmployee({
        id: decoded.id || decoded._id || decoded.userId || "",
        username: decoded.username || "Employee",
        email: decoded.email || "",
      });
      loadTodayAttendance();
    } catch (error) {
      console.error("Employee token decode error:", error);
      localStorage.removeItem("userToken");
      navigate("/login");
    }

    return () => {
      stopScanner();
    };
  }, [loadTodayAttendance, navigate, stopScanner]);

  useEffect(() => {
    if (!employee) return undefined;

    loadReentryRequest();

    const interval = window.setInterval(() => {
      loadReentryRequest();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [employee, loadReentryRequest]);

  const normalizeAdminQr = (decodedText) => {
    const data = JSON.parse(decodedText);
    const qrVersion =
      data.v ||
      data.qrVersion ||
      data.adminQrVersion ||
      data.currentQrVersion ||
      "";
    const qrType = data.a || data.type || data.kind || "";

    if (!qrVersion || !["CF", "ADMIN_ATTENDANCE", "CFATD_ADMIN_ATTENDANCE"].includes(qrType)) {
      throw new Error("This is not a valid admin attendance QR.");
    }

    return { qrVersion };
  };

  const saveAttendance = async (decodedText, selectedType) => {
    const token = getToken();

    if (!token) {
      navigate("/login");
      return false;
    }

    try {
      setIsSaving(true);
      setMessage("Admin QR detected. Saving your attendance...");
      const { qrVersion } = normalizeAdminQr(decodedText);

      const response = await fetch("/api/my/scan-admin-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scanType: selectedType,
          qrVersion,
        }),
      });

      const result = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("userToken");
        navigate("/login");
        return false;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Attendance could not be saved.");
      }

      if (result.approvalRequired) {
        const request = result.request || {
          status: "pending",
          requestedAt: new Date().toISOString(),
        };

        lastRequestStatusRef.current = request.status || "pending";
        setReentryRequest(request);
        setLastResult(null);
        setMessage(
          result.message ||
            "Re-entry request sent to admin. Wait for approval."
        );
        setScanType("");
        await loadTodayAttendance();

        window.showWarning?.(
          result.message ||
            "Re-entry request sent to admin. Wait for approval."
        );

        return true;
      }

      const scannedAt = new Date().toISOString();

      setLastResult({
        type: selectedType,
        message: result.message,
        scannedAt,
        whatsappMessage: createWhatsAppMessage(
          employee?.username,
          selectedType,
          scannedAt
        ),
      });
      setMessage(result.message || "Attendance saved successfully.");
      setScanType("");
      await loadTodayAttendance();

      if (window.showSuccess) {
        window.showSuccess(result.message || "Attendance saved successfully.");
      }

      return true;
    } catch (error) {
      console.error("Employee self scan error:", error);
      setMessage(error.message || "Attendance scan failed.");

      if (window.showError) {
        window.showError(error.message || "Attendance scan failed.");
      } else {
        alert(error.message || "Attendance scan failed.");
      }

      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDetectedQr = async (decodedText, selectedType) => {
    if (scanLockRef.current) return;

    scanLockRef.current = true;
    await stopScanner();
    await saveAttendance(decodedText, selectedType);
    scanLockRef.current = false;
  };

  const startScanner = async (selectedType) => {
    if (scanLockRef.current || isSaving) return;

    try {
      await stopScanner();
      setScanType(selectedType);
      setLastResult(null);
      setMessage("Opening camera. Point it at the admin QR.");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera is not supported. Upload a QR image instead.");
      }

      const html5QrCode = new Html5Qrcode("reader", { verbose: false });
      scannerRef.current = html5QrCode;

      const cameras = await Html5Qrcode.getCameras();

      if (!cameras.length) {
        throw new Error("No camera found. Upload a QR image instead.");
      }

      const camera =
        cameras.find((item) => /back|rear|environment/i.test(item.label)) ||
        cameras[cameras.length - 1];

      setIsScanning(true);
      setMessage("Camera active. Keep the admin QR inside the square.");

      await html5QrCode.start(
        { deviceId: { exact: camera.id } },
        {
          fps: 20,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.72);
            return { width: size, height: size };
          },
          aspectRatio: 1,
          disableFlip: false,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decodedText) => handleDetectedQr(decodedText, selectedType),
        () => {}
      );
    } catch (error) {
      console.error("Employee camera start error:", error);
      await stopScanner();
      setMessage(error.message || "Camera could not start.");

      if (window.showWarning) {
        window.showWarning(error.message || "Camera could not start.");
      }
    }
  };

  const processImageFile = async (file) => {
    if (!file) return;

    if (!scanType) {
      const warning = "Choose In, Take Break, End Break or Sign Out first.";
      setMessage(warning);
      if (window.showWarning) window.showWarning(warning);
      else alert(warning);
      return;
    }

    if (!file.type.startsWith("image/")) {
      const warning = "Please select a QR image file.";
      setMessage(warning);
      if (window.showWarning) window.showWarning(warning);
      else alert(warning);
      return;
    }

    let fileScanner;

    try {
      setMessage("Reading admin QR image...");
      fileScanner = new Html5Qrcode("reader-file");
      const decodedText = await fileScanner.scanFile(file, true);
      await handleDetectedQr(decodedText, scanType);
    } catch (error) {
      console.error("Employee QR image scan error:", error);
      const warning = "QR was not detected. Upload a clear image of the latest admin QR.";
      setMessage(warning);
      if (window.showError) window.showError(warning);
      else alert(warning);
    } finally {
      try {
        await fileScanner?.clear();
      } catch (error) {
        console.warn("File scanner clear error:", error.message);
      }
    }
  };

  const formatTime = (value) => {
    if (!value) return "--:--";
    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSeconds = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const formatRequestDateTime = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const actionTitle = getActionTitle;

  const sendToWhatsApp = () => {
    if (!lastResult?.whatsappMessage) return;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      lastResult.whatsappMessage
    )}`;

    const whatsappWindow = window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (!whatsappWindow) {
      window.location.href = whatsappUrl;
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 pb-12 pt-28 text-white">
      <div className="absolute left-0 top-24 h-80 w-80 rounded-full bg-purple-600/20 blur-[130px]" />
      <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-blue-600/20 blur-[130px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-sm text-gray-400">Employee Self Attendance</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            Choose Action
            <span className="block text-gray-500">Scan Admin QR</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-gray-400">
            {employee?.username || "Employee"}, select your attendance action and scan the latest QR displayed by admin.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ACTIONS.map((action) => {
            const selected = scanType === action.type;

            return (
              <button
                key={action.type}
                onClick={() => startScanner(action.type)}
                disabled={isSaving}
                className={`rounded-[26px] border p-4 text-left transition md:p-5 ${
                  selected
                    ? action.selectedClass
                    : "border-white/10 bg-[#111] hover:border-white/30 hover:bg-white/5"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xs font-black ${action.buttonClass}`}>
                  {action.icon}
                </div>
                <h2 className="text-lg font-bold md:text-xl">{action.title}</h2>
                <p className="mt-1 text-xs text-gray-500 md:text-sm">{action.subtitle}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-[32px] border border-white/10 bg-[#050505] p-4 shadow-2xl md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Live Camera</p>
                <h2 className="text-2xl font-bold">
                  {scanType ? `${actionTitle(scanType)} selected` : "Select an action first"}
                </h2>
              </div>

              <div className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                isScanning
                  ? "bg-green-500/10 text-green-300"
                  : "bg-white/10 text-gray-400"
              }`}>
                {isSaving ? "Saving..." : isScanning ? "Camera Active" : "Scanner Ready"}
              </div>
            </div>

            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                processImageFile(event.dataTransfer.files?.[0]);
              }}
              className={`relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[28px] bg-white p-3 transition md:min-h-[500px] ${
                isDragging ? "scale-[1.01] ring-4 ring-purple-500" : ""
              }`}
            >
              <div id="reader" className="w-full max-w-[560px]" />

              {!isScanning && (
                <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[24px] border-2 border-dashed border-black/20">
                  <div className="max-w-sm px-6 text-center text-black/50">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-black/5 text-3xl">▣</div>
                    <p className="font-extrabold">
                      {isDragging
                        ? "Drop the admin QR image here"
                        : "Tap an action above to open the camera"}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      You can also upload a saved QR image below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div id="reader-file" className="hidden" />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={stopScanner}
                disabled={!isScanning}
                className="rounded-2xl bg-white/10 px-5 py-4 font-bold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Stop Camera
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl bg-white px-5 py-4 font-bold text-black transition hover:bg-gray-200"
              >
                Upload Admin QR Image
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  processImageFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-[#111] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600">Scanner message</p>
              <p className="mt-2 font-semibold text-gray-300">{message}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-[#111] p-5">
              <p className="text-sm text-gray-500">Today&apos;s Attendance</p>
              <h2 className="mt-1 text-2xl font-bold">Live Status</h2>

              <div className="mt-5 space-y-3">
                <StatusRow
                  label="Current Status"
                  value={(todayRecord?.currentStatus || "NOT_STARTED").replaceAll(
                    "_",
                    " "
                  )}
                  tone="text-purple-300"
                />
                <StatusRow
                  label="First In"
                  value={formatTime(todayRecord?.entryTime)}
                  tone="text-green-300"
                />
                <StatusRow
                  label="Latest Break Out"
                  value={formatTime(todayRecord?.breakOutTime)}
                  tone="text-yellow-300"
                />
                <StatusRow
                  label="Latest Break In"
                  value={formatTime(todayRecord?.breakInTime)}
                  tone="text-blue-300"
                />
                <StatusRow
                  label="Last Out"
                  value={formatTime(todayRecord?.lastOutTime)}
                  tone="text-red-300"
                />
                <StatusRow
                  label="Total Break"
                  value={formatSeconds(todayRecord?.totalBreakSeconds)}
                  tone="text-yellow-300"
                />
                <StatusRow
                  label="Total Work"
                  value={formatSeconds(todayRecord?.totalWorkSeconds)}
                  tone="text-green-300"
                />
                <StatusRow
                  label="Sessions / Breaks"
                  value={`${todayRecord?.workSessionCount || 0} / ${
                    todayRecord?.breakCount || 0
                  }`}
                  tone="text-cyan-300"
                />
              </div>
            </div>

            {reentryRequest && (
              <div
                className={`rounded-[30px] border p-5 ${
                  reentryRequest.status === "pending"
                    ? "border-yellow-500/20 bg-yellow-500/10"
                    : reentryRequest.status === "approved"
                    ? "border-green-500/20 bg-green-500/10"
                    : "border-red-500/20 bg-red-500/10"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    reentryRequest.status === "pending"
                      ? "text-yellow-300"
                      : reentryRequest.status === "approved"
                      ? "text-green-300"
                      : "text-red-300"
                  }`}
                >
                  Re-entry Request
                </p>

                <h3 className="mt-2 text-2xl font-bold capitalize">
                  {reentryRequest.status}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-300">
                  {reentryRequest.status === "pending"
                    ? "You already signed out. Admin must approve before another In can be added."
                    : reentryRequest.status === "approved"
                    ? "Admin approved the request and your new In was added to the same day's shift."
                    : reentryRequest.decisionNote
                    ? `Admin denied the request: ${reentryRequest.decisionNote}`
                    : "Admin denied the re-entry request."}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  Requested: {formatRequestDateTime(reentryRequest.requestedAt)}
                </p>
              </div>
            )}

            {lastResult && (
              <div className="rounded-[30px] border border-green-500/20 bg-green-500/10 p-5">
                <p className="text-sm font-bold text-green-300">Attendance Saved</p>
                <h3 className="mt-2 text-2xl font-bold">{actionTitle(lastResult.type)}</h3>
                <p className="mt-2 text-sm text-gray-300">{lastResult.message}</p>

                <div className="mt-4 rounded-2xl border border-green-400/20 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                    WhatsApp message
                  </p>
                  <p className="mt-2 break-words font-mono text-sm text-gray-200">
                    {lastResult.whatsappMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={sendToWhatsApp}
                  className="mt-4 w-full rounded-2xl bg-green-500 px-5 py-4 font-extrabold text-black transition hover:bg-green-400 active:scale-[0.99]"
                >
                  Send to WhatsApp
                </button>

                <p className="mt-3 text-xs leading-5 text-gray-400">
                  WhatsApp will open with the message ready. Select your attendance
                  group and tap Send.
                </p>
              </div>
            )}

            <div className="rounded-[30px] border border-purple-500/20 bg-purple-500/10 p-5">
              <p className="text-sm font-bold text-purple-300">Secure QR</p>
              <h3 className="mt-2 text-xl font-bold">Latest admin QR only</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                When admin generates a new QR, every older admin QR stops working automatically.
              </p>
            </div>

            <button
              onClick={() => navigate("/profile")}
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 font-bold text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Open My Attendance Profile
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const StatusRow = ({ label, value, tone }) => (
  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
    <span className="text-sm text-gray-500">{label}</span>
    <span className={`font-mono text-lg font-bold ${tone}`}>{value}</span>
  </div>
);

export default EmployeeScan;
