import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const Contacts = () => {
  const [user, setUser] = useState(null);
  const [qrValue, setQrValue] = useState("");
  const qrRef = useRef(null);

  const [extraDetails, setExtraDetails] = useState({
    mobile: "",
    employeeId: "",
    department: "",
    jobRole: "",
    shift: "",
    emergencyContact: "",
  });

  useEffect(() => {
    loadUserQR();
  }, []);

  const getToken = () => {
    return localStorage.getItem("userToken") || localStorage.getItem("token");
  };

  const decodeJwtPayload = (token) => {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(padded));
  };

  const getUserIdFromDecodedToken = (decoded) => {
    return (
      decoded.id ||
      decoded._id ||
      decoded.userId ||
      decoded.user?.id ||
      decoded.user?._id ||
      decoded.user?.userId ||
      ""
    );
  };

  const getQrVersionFromDecodedToken = (decoded, userId) => {
    const savedQrVersion = userId
      ? localStorage.getItem(`currentQrVersion_${userId}`)
      : "";

    return (
      savedQrVersion ||
      decoded.currentQrVersion ||
      decoded.qrVersion ||
      decoded.qr ||
      decoded.user?.currentQrVersion ||
      decoded.user?.qrVersion ||
      ""
    );
  };

  const makeTinyQRValue = (employeeData) => {
    return JSON.stringify({
      u: employeeData.userId || "",
      v: employeeData.qrVersion || "",
    });
  };

  const makeDisplayData = (baseUser, details, qrVersion) => {
    return {
      userId: baseUser.userId,
      name: baseUser.name,
      username: baseUser.username,
      email: baseUser.email,

      qrVersion,
      qrGeneratedAt: new Date().toISOString(),

      mobile: details.mobile || "Not Added",
      employeeId: details.employeeId || "Not Added",
      department: details.department || "Not Added",
      jobRole: details.jobRole || "Not Added",
      shift: details.shift || "Not Added",
      emergencyContact: details.emergencyContact || "Not Added",
    };
  };

  const loadUserQR = () => {
    const token = getToken();

    if (!token) {
      alert("No login token found. Please login again.");
      return;
    }

    try {
      const decoded = decodeJwtPayload(token);
      const userId = getUserIdFromDecodedToken(decoded);

      if (!userId) {
        alert("User ID not found. Please login again.");
        return;
      }

      const savedDetails = JSON.parse(
        localStorage.getItem("employeeExtraDetails") || "{}"
      );

      const employeeData = {
        userId,
        name:
          decoded.name ||
          decoded.username ||
          decoded.user?.name ||
          decoded.user?.username ||
          "",
        username: decoded.username || decoded.user?.username || "",
        email: decoded.email || decoded.user?.email || "",

        qrVersion: getQrVersionFromDecodedToken(decoded, userId),
        qrGeneratedAt: new Date().toISOString(),

        mobile:
          savedDetails.mobile || decoded.mobile || decoded.user?.mobile || "",
        employeeId: savedDetails.employeeId || "",
        department: savedDetails.department || "",
        jobRole: savedDetails.jobRole || "",
        shift: savedDetails.shift || "",
        emergencyContact: savedDetails.emergencyContact || "",
      };

      setUser(employeeData);

      setExtraDetails({
        mobile: employeeData.mobile,
        employeeId: employeeData.employeeId,
        department: employeeData.department,
        jobRole: employeeData.jobRole,
        shift: employeeData.shift,
        emergencyContact: employeeData.emergencyContact,
      });

      setQrValue(makeTinyQRValue(employeeData));
    } catch (error) {
      console.error(error);
      alert("Token decode error. Please login again.");
    }
  };

  const updateQRDetails = () => {
    if (!user) return;

    localStorage.setItem("employeeExtraDetails", JSON.stringify(extraDetails));

    const updatedUser = makeDisplayData(user, extraDetails, user.qrVersion);

    setUser(updatedUser);
    setQrValue(makeTinyQRValue(updatedUser));

    alert("Employee details updated successfully.");
  };

  const getNewQrVersionFromResponse = (result) => {
    return (
      result.qrVersion ||
      result.currentQrVersion ||
      result.newQrVersion ||
      result.version ||
      result.user?.currentQrVersion ||
      result.user?.qrVersion ||
      result.data?.qrVersion ||
      result.data?.currentQrVersion ||
      result.updatedUser?.currentQrVersion ||
      result.updatedUser?.qrVersion ||
      ""
    );
  };

  const generateNewQR = async () => {
    if (!user) return;

    try {
      const token = getToken();

      if (!token) {
        alert("No login token found. Please login again.");
        return;
      }

      const response = await fetch("/api/user/generate-qr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      console.log("Generate QR response:", result);

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to generate new QR");
        return;
      }

      const newQrVersion = getNewQrVersionFromResponse(result);

      if (!newQrVersion) {
        alert("New QR version not received from server.");
        return;
      }

      localStorage.setItem("employeeExtraDetails", JSON.stringify(extraDetails));
      localStorage.setItem(`currentQrVersion_${user.userId}`, newQrVersion);

      const newUserData = makeDisplayData(user, extraDetails, newQrVersion);
      const newQrValue = makeTinyQRValue(newUserData);

      setUser(newUserData);
      setQrValue(newQrValue);

      alert("New QR generated successfully. Old QR will not work now.");
    } catch (error) {
      console.error(error);
      alert("Server error while generating new QR.");
    }
  };

  const downloadQR = () => {
    if (!qrRef.current || !user) return;

    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = url;
    link.download = `${user.username || "employee"}-${
      user.qrVersion || "qr"
    }.png`;
    link.click();
  };

  return (
    <section className="relative min-h-screen bg-black text-white px-4 pt-32 pb-10 overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-gray-400 text-sm">
              Employee QR Identity
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Generate
            <span className="block text-gray-500">Employee QR</span>
          </h1>

          <p className="text-gray-400 mt-5 max-w-2xl mx-auto">
            This QR is lightweight and fast to scan. It only stores employee ID
            and QR version.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl">
            <p className="text-gray-500 text-sm mb-3">Employee Details</p>

            {user && qrValue ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-[#111] border border-white/10 rounded-3xl p-5">
                  <div className="w-16 h-16 rounded-full bg-[#333] flex items-center justify-center text-2xl font-bold">
                    {(user.name || user.username || "E")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold">{user.name || "-"}</h2>
                    <p className="text-gray-500">Employee Account</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoCard label="Username" value={user.username || "-"} />
                  <InfoCard label="Email" value={user.email || "-"} />
                  <InfoCard label="Mobile" value={user.mobile || "-"} />
                  <InfoCard label="Employee ID" value={user.employeeId || "-"} />
                  <InfoCard label="Department" value={user.department || "-"} />
                  <InfoCard label="Job Role" value={user.jobRole || "-"} />
                  <InfoCard label="Shift" value={user.shift || "-"} />
                  <InfoCard
                    label="Emergency Contact"
                    value={user.emergencyContact || "-"}
                  />
                  <InfoCard label="QR Version" value={user.qrVersion || "-"} />
                  <InfoCard label="QR Type" value="Small / Fast Scan" />
                </div>

                <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                  <p className="text-gray-500 text-sm mb-4">
                    Add / Update Employee Details
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ["mobile", "Mobile Number"],
                      ["employeeId", "Employee ID"],
                      ["department", "Department"],
                      ["jobRole", "Job Role"],
                      ["shift", "Shift"],
                      ["emergencyContact", "Emergency Contact"],
                    ].map(([key, placeholder]) => (
                      <input
                        key={key}
                        type="text"
                        placeholder={placeholder}
                        value={extraDetails[key]}
                        onChange={(e) =>
                          setExtraDetails({
                            ...extraDetails,
                            [key]: e.target.value,
                          })
                        }
                        className="bg-black border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600"
                      />
                    ))}
                  </div>

                  <button
                    onClick={updateQRDetails}
                    className="mt-5 w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
                  >
                    Update Details
                  </button>

                  <button
                    onClick={generateNewQR}
                    className="mt-3 w-full bg-green-500/10 text-green-400 py-4 rounded-2xl font-bold hover:bg-green-500/20 transition"
                  >
                    Generate New QR For Safety
                  </button>
                </div>

                <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
                  <p className="text-gray-500 text-sm mb-2">
                    How to use this QR
                  </p>

                  <ul className="space-y-2 text-gray-300">
                    <li>1. Login as employee.</li>
                    <li>2. Download this lightweight QR.</li>
                    <li>3. Admin scans Entry → Break Out → Break In → Out.</li>
                    <li>4. New QR makes old QR invalid.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl p-6 text-center font-bold">
                Please login first
              </div>
            )}
          </div>

          <div className="bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl text-center">
            <p className="text-gray-500 text-sm mb-3">Your QR Code</p>

            {user && qrValue ? (
              <>
                <div
                  ref={qrRef}
                  className="inline-block bg-white p-5 rounded-[28px] shadow-2xl"
                >
                  <QRCodeCanvas
                    key={qrValue}
                    value={qrValue}
                    size={300}
                    level="M"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>

                <button
                  onClick={downloadQR}
                  className="mt-6 w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
                >
                  Download QR
                </button>

                <button
                  onClick={generateNewQR}
                  className="mt-3 w-full bg-green-500/10 text-green-400 py-4 rounded-2xl font-bold hover:bg-green-500/20 transition"
                >
                  Generate New QR
                </button>

                <p className="text-gray-500 text-sm mt-4">
                  QR contains only userId and QR version for fast scanning.
                </p>

                <p className="text-gray-700 text-xs mt-2 break-all">
                  QR Data: {qrValue}
                </p>
              </>
            ) : (
              <button
                onClick={() => (window.location.href = "/login")}
                className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
              >
                Go to Login
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const InfoCard = ({ label, value }) => {
  return (
    <div className="bg-[#111] border border-white/10 rounded-3xl p-5">
      <p className="text-gray-500 text-sm">{label}</p>
      <h3 className="text-base font-semibold mt-2 break-all">
        {value || "-"}
      </h3>
    </div>
  );
};

export default Contacts;