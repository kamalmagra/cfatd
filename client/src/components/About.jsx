import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

const About = () => {
  const [scanType, setScanType] = useState("");
  const [message, setMessage] = useState("Camera permission checking...");
  const [cameraAllowed, setCameraAllowed] = useState(false);

  const scannerRef = useRef(null);
  const scanLockRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");

    if (!adminToken) {
      alert("Only admin can access scanner page.");
      navigate("/admin-login");
      return;
    }

    askCameraPermission();
  }, [navigate]);

  const askCameraPermission = async () => {
    try {
      setMessage("Please allow camera permission.");

      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });

      setCameraAllowed(true);
      setMessage("Camera allowed. Select scan mode.");
    } catch (error) {
      console.error(error);
      setCameraAllowed(false);
      setMessage("Camera blocked. Tap Allow Camera button.");
      alert("Please allow camera permission from browser settings.");
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch (error) {
      console.log(error);
    }

    scannerRef.current = null;
    setScanType("");
    scanLockRef.current = false;
  };

  const sendToBackend = async (decodedText, type) => {
    try {
      const data = JSON.parse(decodedText);

      const response = await fetch("/api/scan/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          scanType: type,
        }),
      });

      const result = await response.json();

      alert(
        "Employee: " +
          (result.username || data.username) +
          "\n\n" +
          result.message
      );

      setMessage(result.message || "Scan saved successfully.");
    } catch (error) {
      console.error(error);
      alert("Invalid QR Code\n\nQR Content:\n" + decodedText);
      setMessage("Invalid QR code.");
    }
  };

  const startScanner = async (type) => {
    if (!cameraAllowed) {
      await askCameraPermission();
      return;
    }

    if (scanLockRef.current) {
      alert("Scan already detected. Please wait.");
      return;
    }

    try {
      await stopScanner();

      setScanType(type);
      setMessage("Scanner started. Show employee QR.");

      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const cameras = await Html5Qrcode.getCameras();

      if (!cameras || cameras.length === 0) {
        alert("No camera found.");
        setMessage("No camera found.");
        return;
      }

      const backCamera =
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("back")
        ) ||
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("rear")
        ) ||
        cameras[cameras.length - 1];

      await html5QrCode.start(
        backCamera.id,
        {
          fps: 10,
          qrbox: {
            width: 280,
            height: 280,
          },
          disableFlip: false,
        },
        async (decodedText) => {
          if (scanLockRef.current) return;

          scanLockRef.current = true;

          setMessage("QR detected. Saving...");
          await stopScanner();
          await sendToBackend(decodedText, type);
        },
        () => {}
      );
    } catch (error) {
      console.error(error);
      alert("Camera start failed. Please allow camera permission.");
      setMessage("Camera start failed.");
    }
  };

  return (
    <section className="relative min-h-screen bg-black text-white px-4 pt-28 md:pt-32 pb-10 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-20 left-0 md:left-10 w-64 md:w-80 h-64 md:h-80 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-0 md:right-10 w-64 md:w-80 h-64 md:h-80 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-5">
            <span
              className={`w-2 h-2 rounded-full ${
                cameraAllowed ? "bg-green-400" : "bg-red-400"
              }`}
            ></span>
            <span className="text-gray-400 text-sm">
              Admin QR Attendance Scanner
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            QR Attendance
            <span className="block text-gray-500">Scanner System</span>
          </h1>

          <p className="text-gray-400 mt-5 max-w-2xl mx-auto text-sm md:text-lg">
            Admin can scan employee QR for Entry, Last Out, Break Out and Break
            In. Camera permission opens automatically after admin login.
          </p>
        </div>

        {/* Mobile Status */}
        <div className="lg:hidden bg-[#050505] border border-white/10 rounded-[26px] p-5 mb-5">
          <p className="text-gray-500 text-sm mb-2">Status</p>
          <h3 className="text-xl font-bold">
            {scanType ? "Scanner Active" : "Scanner Ready"}
          </h3>
          <p className="text-green-400 mt-2 text-sm">
            {scanType || "Select scan mode"}
          </p>
          <p className="text-gray-500 mt-3 text-sm">{message}</p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left Panel */}
          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-5 md:p-6 shadow-2xl">
            <div className="bg-[#111] border border-white/10 rounded-[26px] p-5 mb-5">
              <p className="text-gray-500 text-sm mb-4">Scanner Mode</p>

              <div className="space-y-3">
                <button
                  onClick={() => startScanner("ENTRY_LASTOUT")}
                  className="w-full flex items-center justify-between bg-white text-black rounded-2xl px-5 py-4 font-bold hover:bg-gray-200 transition"
                >
                  <span>Entry / Last Out</span>
                  <span>↗</span>
                </button>

                <button
                  onClick={() => startScanner("BREAK")}
                  className="w-full flex items-center justify-between bg-white/10 text-white rounded-2xl px-5 py-4 font-bold hover:bg-white/15 transition"
                >
                  <span>Break Out / Break In</span>
                  <span>↗</span>
                </button>

                <button
                  onClick={stopScanner}
                  className="w-full flex items-center justify-between bg-red-500/10 text-red-400 rounded-2xl px-5 py-4 font-bold hover:bg-red-500/20 transition"
                >
                  <span>Stop Scanner</span>
                  <span>×</span>
                </button>

                <button
                  onClick={askCameraPermission}
                  className="w-full flex items-center justify-between bg-blue-500/10 text-blue-400 rounded-2xl px-5 py-4 font-bold hover:bg-blue-500/20 transition"
                >
                  <span>Allow Camera</span>
                  <span>◉</span>
                </button>

                <button
                  onClick={() => navigate("/admin")}
                  className="w-full flex items-center justify-between bg-green-500/10 text-green-400 rounded-2xl px-5 py-4 font-bold hover:bg-green-500/20 transition"
                >
                  <span>Dashboard</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            <div className="hidden lg:block bg-[#111] border border-white/10 rounded-[26px] p-5">
              <p className="text-gray-500 text-sm mb-2">Current Status</p>

              <h3 className="text-xl font-bold">
                {scanType ? "Active Scanner" : "Scanner Idle"}
              </h3>

              <p className="text-green-400 font-semibold mt-2">
                {scanType || "Select a scan mode"}
              </p>

              <p className="text-gray-500 text-sm mt-4">{message}</p>
            </div>
          </div>

          {/* Scanner Panel */}
          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-5 md:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-gray-500 text-sm">Live Camera</p>
                <h2 className="text-2xl md:text-3xl font-bold">
                  Scan Employee QR
                </h2>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
                ▣
              </div>
            </div>

            <div className="bg-white rounded-[26px] p-3 min-h-[330px] md:min-h-[420px] flex items-center justify-center overflow-hidden">
              <div id="reader" className="w-full max-w-[390px]"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-500 text-sm">Step 1</p>
                <h4 className="font-bold mt-1">Allow Camera</h4>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-500 text-sm">Step 2</p>
                <h4 className="font-bold mt-1">Choose Mode</h4>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-500 text-sm">Step 3</p>
                <h4 className="font-bold mt-1">Scan QR</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-6 bg-[#050505] border border-white/10 rounded-[30px] p-5 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
              <h3 className="text-xl md:text-2xl font-bold">Entry</h3>
              <p className="text-gray-500 text-sm">Start shift</p>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
              <h3 className="text-xl md:text-2xl font-bold">Break Out</h3>
              <p className="text-gray-500 text-sm">Start break</p>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
              <h3 className="text-xl md:text-2xl font-bold">Break In</h3>
              <p className="text-gray-500 text-sm">End break</p>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
              <h3 className="text-xl md:text-2xl font-bold">Last Out</h3>
              <p className="text-gray-500 text-sm">End shift</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;