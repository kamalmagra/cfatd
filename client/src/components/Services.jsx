import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const Services = () => {
  const [scanType, setScanType] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState("Select scan mode to start camera.");
  const [countdown, setCountdown] = useState(0);
  const [cameraAllowed, setCameraAllowed] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanLockRef = useRef(false);

  useEffect(() => {
    checkCameraPermission();

    return () => {
      stopScanner();
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMessage("Camera not supported. Use HTTPS/ngrok or upload QR image.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });

      stream.getTracks().forEach((track) => track.stop());

      setCameraAllowed(true);
      setMessage("Camera ready. Select scan mode.");
    } catch (error) {
      console.error(error);
      setCameraAllowed(false);
      setMessage("Camera permission needed. Tap Allow Camera.");
    }
  };

  const sendToBackend = async (decodedText, type) => {
    try {
      const data = JSON.parse(decodedText);

      if (!data.userId || !data.qrVersion) {
        alert("Invalid QR. Please scan latest employee QR.");
        setMessage("Invalid QR. Missing user ID or QR version.");
        return false;
      }

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

      if (!response.ok || !result.success) {
        alert(result.message || "Attendance scan failed.");
        setMessage(result.message || "Attendance scan failed.");
        return false;
      }

      alert(
        "Employee: " +
          (result.username || data.username) +
          "\n\n" +
          result.message
      );

      setMessage(result.message || "Scan saved successfully.");
      return true;
    } catch (error) {
      console.error(error);
      alert("Invalid QR Code\n\nQR Content:\n" + decodedText);
      setMessage("Invalid QR code. Please scan employee QR only.");
      return false;
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (error) {}

        try {
          await scannerRef.current.clear();
        } catch (error) {}
      }
    } catch (error) {
      console.log(error);
    }

    scannerRef.current = null;
    setIsScanning(false);
    setScanType("");
  };

  const handleDetectedQR = async (decodedText, type) => {
    if (scanLockRef.current) return;

    scanLockRef.current = true;

    await stopScanner();

    setMessage("QR detected. Saving in 3 seconds...");
    setCountdown(3);

    setTimeout(() => setCountdown(2), 1000);
    setTimeout(() => setCountdown(1), 2000);

    setTimeout(async () => {
      await sendToBackend(decodedText, type);

      setCountdown(0);
      scanLockRef.current = false;
    }, 3000);
  };

  const startScanner = async (type) => {
    if (scanLockRef.current) {
      alert("Scan already detected. Please wait.");
      return;
    }

    try {
      await stopScanner();

      setMessage("Starting mobile camera...");
      setCountdown(0);
      setScanType(type);

      if (!cameraAllowed) {
        await checkCameraPermission();
      }

      const html5QrCode = new Html5Qrcode("reader", {
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const cameras = await Html5Qrcode.getCameras();

      if (!cameras || cameras.length === 0) {
        alert("No camera found. Please upload QR image.");
        setMessage("No camera found. Upload QR image.");
        return;
      }

      const backCamera =
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("back")
        ) ||
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("rear")
        ) ||
        cameras.find((camera) =>
          camera.label.toLowerCase().includes("environment")
        ) ||
        cameras[cameras.length - 1];

      setIsScanning(true);
      setMessage("Camera active. Focus QR inside the box.");

      await html5QrCode.start(
        { deviceId: { exact: backCamera.id } },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrSize = Math.floor(minEdge * 0.75);
            return { width: qrSize, height: qrSize };
          },
          aspectRatio: 1.777778,
          disableFlip: false,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        async (decodedText) => {
          await handleDetectedQR(decodedText, type);
        },
        () => {}
      );
    } catch (error) {
      console.error(error);
      setIsScanning(false);
      setMessage("Camera failed. Use HTTPS/ngrok or upload QR image.");
      alert(
        "Camera start failed. Use HTTPS/ngrok on mobile and allow camera permission."
      );
    }
  };

  const scanImageFile = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!scanType) {
      alert("First select scan mode: Entry / Break Out / Break In / Out");
      event.target.value = "";
      return;
    }

    if (scanLockRef.current) {
      alert("Scan already detected. Please wait.");
      event.target.value = "";
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode("reader-file");
      const decodedText = await html5QrCode.scanFile(file, true);

      await handleDetectedQR(decodedText, scanType);

      event.target.value = "";
    } catch (error) {
      console.error(error);
      alert("QR not detected from image. Please upload a clear QR image.");
      event.target.value = "";
    }
  };

  return (
    <section className="relative min-h-screen bg-black text-white px-4 pt-28 pb-10 overflow-hidden">
      <div className="absolute top-20 left-0 md:left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-0 md:right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-5">
            <span
              className={`w-2 h-2 rounded-full ${
                cameraAllowed ? "bg-green-400" : "bg-red-400"
              }`}
            ></span>
            <span className="text-gray-400 text-sm">
              Mobile Focus QR Scanner
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            QR Attendance
            <span className="block text-gray-500">Scan System</span>
          </h1>

          <p className="text-gray-400 mt-5 max-w-2xl mx-auto">
            Sequence: Entry → Break Out → Break In → Out
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-5 md:p-6 shadow-2xl">
            <div className="bg-[#111] border border-white/10 rounded-[26px] p-5 mb-5">
              <p className="text-gray-500 text-sm mb-4">Scan Sequence</p>

              <div className="space-y-3">
                <button
                  onClick={() => startScanner("ENTRY")}
                  className="w-full flex items-center justify-between bg-white text-black rounded-2xl px-5 py-4 font-bold hover:bg-gray-200 transition"
                >
                  <span>1. Entry</span>
                  <span>→</span>
                </button>

                <button
                  onClick={() => startScanner("BREAK_OUT")}
                  className="w-full flex items-center justify-between bg-yellow-500/10 text-yellow-400 rounded-2xl px-5 py-4 font-bold hover:bg-yellow-500/20 transition"
                >
                  <span>2. Break Out</span>
                  <span>→</span>
                </button>

                <button
                  onClick={() => startScanner("BREAK_IN")}
                  className="w-full flex items-center justify-between bg-blue-500/10 text-blue-400 rounded-2xl px-5 py-4 font-bold hover:bg-blue-500/20 transition"
                >
                  <span>3. Break In</span>
                  <span>→</span>
                </button>

                <button
                  onClick={() => startScanner("OUT")}
                  className="w-full flex items-center justify-between bg-red-500/10 text-red-400 rounded-2xl px-5 py-4 font-bold hover:bg-red-500/20 transition"
                >
                  <span>4. Out</span>
                  <span>→</span>
                </button>

                <button
                  onClick={stopScanner}
                  className="w-full flex items-center justify-between bg-white/10 text-white rounded-2xl px-5 py-4 font-bold hover:bg-white/15 transition"
                >
                  <span>Stop Scanner</span>
                  <span>×</span>
                </button>

                <button
                  onClick={checkCameraPermission}
                  className="w-full flex items-center justify-between bg-green-500/10 text-green-400 rounded-2xl px-5 py-4 font-bold hover:bg-green-500/20 transition"
                >
                  <span>Allow Camera</span>
                  <span>◉</span>
                </button>
              </div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-[26px] p-5">
              <p className="text-gray-500 text-sm mb-2">Current Status</p>

              <h3 className="text-xl font-bold">
                {isScanning ? "Scanning Active" : "Scanner Ready"}
              </h3>

              <p className="text-green-400 font-semibold mt-2">
                {scanType || "No mode selected"}
              </p>

              {message && (
                <p className="text-gray-400 text-sm mt-4">{message}</p>
              )}

              {countdown > 0 && (
                <div className="mt-5 text-6xl font-extrabold text-white">
                  {countdown}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-5 md:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-gray-500 text-sm">Live Camera</p>
                <h2 className="text-2xl md:text-3xl font-bold">
                  Focus Employee QR
                </h2>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
                ▣
              </div>
            </div>

            <div className="relative bg-white rounded-[28px] p-3 min-h-[360px] md:min-h-[500px] flex items-center justify-center overflow-hidden">
              <div id="reader" className="w-full max-w-[520px]"></div>

              {!isScanning && (
                <div className="absolute inset-3 rounded-[24px] border-2 border-dashed border-black/20 flex items-center justify-center pointer-events-none">
                  <p className="text-black/50 font-bold text-center px-6">
                    Select scan mode to start camera
                  </p>
                </div>
              )}
            </div>

            <div id="reader-file" style={{ display: "none" }}></div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-500 text-sm">Mobile Tip</p>
                <h4 className="font-bold mt-1">Use back camera</h4>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-500 text-sm">Focus Tip</p>
                <h4 className="font-bold mt-1">Keep QR steady</h4>
              </div>

              <div className="bg-[#111] border border-white/10 rounded-2xl p-4">
                <p className="text-gray-500 text-sm">Light Tip</p>
                <h4 className="font-bold mt-1">Full brightness</h4>
              </div>
            </div>

            <div className="mt-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={scanImageFile}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current.click()}
                className="w-full bg-white/10 text-white py-4 rounded-2xl font-bold hover:bg-white/15 transition"
              >
                Upload QR Image
              </button>
            </div>
          </div>
        </div>

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
              <h3 className="text-xl md:text-2xl font-bold">Out</h3>
              <p className="text-gray-500 text-sm">End shift</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;