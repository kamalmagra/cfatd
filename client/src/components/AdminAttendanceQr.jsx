import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useNavigate } from "react-router-dom";

const AdminAttendanceQr = () => {
  const navigate = useNavigate();
  const qrRef = useRef(null);

  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showGeneratePopup, setShowGeneratePopup] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const handleAuthError = (response) => {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("adminToken");
      navigate("/admin-login");
      return true;
    }

    return false;
  };

  const loadQr = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/attendance-qr", {
        headers: getHeaders(),
      });

      if (handleAuthError(response)) return;

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load admin QR.");
      }

      setQrData(result.data);
    } catch (error) {
      console.error("Load admin QR error:", error);
      if (window.showError) {
        window.showError(error.message || "Unable to load admin QR.");
      } else {
        alert(error.message || "Unable to load admin QR.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      navigate("/admin-login");
      return;
    }

    loadQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const openGeneratePopup = () => {
    if (regenerating || loading) return;
    setCountdown(5);
    setShowGeneratePopup(true);
  };

  const cancelGeneratePopup = () => {
    if (regenerating) return;
    setShowGeneratePopup(false);
    setCountdown(5);
  };

  useEffect(() => {
    if (!showGeneratePopup || regenerating || countdown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [showGeneratePopup, regenerating, countdown]);

  const regenerateQr = async () => {
    if (countdown > 0 || regenerating) return;

    try {
      setRegenerating(true);
      const response = await fetch("/api/admin/attendance-qr/regenerate", {
        method: "POST",
        headers: getHeaders(),
      });

      if (handleAuthError(response)) return;

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to generate a new admin QR.");
      }

      setQrData(result.data);
      setShowGeneratePopup(false);
      setCountdown(5);
      if (window.showSuccess) window.showSuccess(result.message);
      else alert(result.message);
    } catch (error) {
      console.error("Regenerate admin QR error:", error);
      if (window.showError) {
        window.showError(error.message || "Unable to generate a new admin QR.");
      } else {
        alert(error.message || "Unable to generate a new admin QR.");
      }
    } finally {
      setRegenerating(false);
    }
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `cargo-force-admin-attendance-${Date.now()}.png`;
    link.click();
  };

  const printQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank", "width=720,height=900");

    if (!printWindow) {
      if (window.showWarning) window.showWarning("Allow popups to print the QR.");
      else alert("Allow popups to print the QR.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Cargo Force Admin Attendance QR</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
            img { width: 520px; max-width: 90vw; }
            h1 { margin-bottom: 8px; }
            p { color: #555; }
          </style>
        </head>
        <body>
          <h1>Cargo Force Attendance</h1>
          <p>Employees: choose an action, then scan this QR.</p>
          <img src="${dataUrl}" alt="Admin attendance QR" />
          <p>Only the latest QR is valid.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white">
      <div className="absolute left-0 top-20 h-80 w-80 rounded-full bg-purple-600/20 blur-[130px]" />
      <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-blue-600/20 blur-[130px]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">Employee Self Scan Access</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Admin Attendance
              <span className="block text-gray-500">QR Generator</span>
            </h1>

            <p className="mt-4 max-w-2xl text-gray-400">
              Display this QR at the workplace. Employees choose In, Take Break,
              End Break or Sign Out on their phone, then scan this code.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-bold text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Dashboard
            </button>

            <button
              onClick={openGeneratePopup}
              disabled={regenerating || loading}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regenerating ? "Generating..." : "Generate New QR"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-[34px] border border-white/10 bg-[#050505] p-6 text-center shadow-2xl">
            <p className="mb-4 text-sm text-gray-500">Latest Active Admin QR</p>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[28px] bg-[#111] text-gray-500">
                Loading secure QR...
              </div>
            ) : qrData?.qrPayload ? (
              <>
                <div
                  ref={qrRef}
                  className="inline-block rounded-[30px] bg-white p-4 shadow-2xl"
                >
                  <QRCodeCanvas
                    key={qrData.qrPayload}
                    value={qrData.qrPayload}
                    size={360}
                    level="L"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={downloadQr}
                    className="rounded-2xl bg-white px-4 py-4 font-bold text-black transition hover:bg-gray-200"
                  >
                    Download QR
                  </button>
                  <button
                    onClick={printQr}
                    className="rounded-2xl bg-white/10 px-4 py-4 font-bold text-white transition hover:bg-white/15"
                  >
                    Print QR
                  </button>
                </div>
              </>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 font-bold text-red-300">
                QR could not be loaded.
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-[30px] border border-white/10 bg-[#111] p-6">
              <p className="text-sm text-gray-500">Security</p>
              <h2 className="mt-1 text-3xl font-bold">Old QR automatically disabled</h2>
              <p className="mt-3 leading-7 text-gray-400">
                Whenever you press Generate New QR, the previous code becomes invalid immediately.
                Employees must scan the newest code shown on this page.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                label="Generated By"
                value={qrData?.generatedBy || "-"}
              />
              <InfoCard
                label="Generated At"
                value={formatDate(qrData?.generatedAt)}
              />
              <InfoCard
                label="QR Type"
                value="Compact / Fast Scan"
              />
              <InfoCard
                label="WhatsApp Status"
                value={
                  qrData?.whatsappEnabled
                    ? "Backend integration active"
                    : "Environment setup required"
                }
                tone={qrData?.whatsappEnabled ? "text-green-300" : "text-yellow-300"}
              />
            </div>

            <div className="rounded-[30px] border border-purple-500/20 bg-purple-500/10 p-6">
              <p className="text-sm font-bold text-purple-300">How employees use it</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["1", "Open Employee Scan page"],
                  ["2", "Choose attendance action"],
                  ["3", "Scan this admin QR"],
                  ["4", "Attendance saves instantly"],
                ].map(([number, text]) => (
                  <div
                    key={number}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white font-black text-black">
                      {number}
                    </div>
                    <p className="font-semibold text-gray-200">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-green-500/20 bg-green-500/10 p-6">
              <p className="text-sm font-bold text-green-300">WhatsApp notification</p>
              <p className="mt-2 leading-7 text-gray-300">
                Employee self scans are saved first. The backend then sends a formatted attendance
                message through the configured WhatsApp webhook or Cloud API integration.
              </p>
            </div>

            {qrData?.qrVersion && (
              <details className="rounded-[24px] border border-white/10 bg-[#111] p-5">
                <summary className="cursor-pointer font-bold text-gray-300">
                  Technical QR details
                </summary>
                <p className="mt-4 break-all font-mono text-xs text-gray-600">
                  {qrData.qrVersion}
                </p>
              </details>
            )}
          </div>
        </div>
      </div>

      {showGeneratePopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="generate-admin-qr-title"
        >
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#111] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-3xl font-black text-yellow-300">
              {countdown}
            </div>

            <h2 id="generate-admin-qr-title" className="mt-5 text-3xl font-extrabold">
              Generate a new QR?
            </h2>
            <p className="mt-3 leading-7 text-gray-400">
              The current QR will keep working until you confirm. After generation, the old QR will stop working immediately.
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white transition-all duration-1000"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {countdown > 0
                ? `Please wait ${countdown} second${countdown === 1 ? "" : "s"} before confirming.`
                : "You can now generate the new QR."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={cancelGeneratePopup}
                disabled={regenerating}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={regenerateQr}
                disabled={countdown > 0 || regenerating}
                className="rounded-2xl bg-white px-4 py-4 font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {regenerating ? "Generating..." : "Generate New QR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const InfoCard = ({ label, value, tone = "text-white" }) => (
  <div className="rounded-[26px] border border-white/10 bg-[#111] p-5">
    <p className="text-sm text-gray-500">{label}</p>
    <p className={`mt-2 font-bold ${tone}`}>{value}</p>
  </div>
);

export default AdminAttendanceQr;
