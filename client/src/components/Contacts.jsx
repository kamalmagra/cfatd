import { useEffect, useState, useRef } from "react";
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

  const loadUserQR = () => {
    const token =
      localStorage.getItem("userToken") || localStorage.getItem("token");

    if (!token) {
      alert("No login token found. Please login again.");
      return;
    }

    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));

      const savedDetails = JSON.parse(
        localStorage.getItem("employeeExtraDetails") || "{}"
      );

      const employeeData = {
        qrVersion: decoded.currentQrVersion || "",
        qrGeneratedAt: new Date().toISOString(),

        userId: decoded.id || decoded._id || decoded.userId || "",
        name: decoded.name || decoded.username || "",
        username: decoded.username || "",
        email: decoded.email || "",

        mobile: savedDetails.mobile || decoded.mobile || "",
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

      setQrValue(JSON.stringify(employeeData));
    } catch (error) {
      console.log(error);
      alert("Token decode error. Please login again.");
    }
  };

  const makeQRData = (details, qrVersion) => {
    return {
      qrVersion,
      qrGeneratedAt: new Date().toISOString(),

      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,

      mobile: details.mobile || "Not Added",
      employeeId: details.employeeId || "Not Added",
      department: details.department || "Not Added",
      jobRole: details.jobRole || "Not Added",
      shift: details.shift || "Not Added",
      emergencyContact: details.emergencyContact || "Not Added",
    };
  };

  const updateQRDetails = () => {
    if (!user) return;

    localStorage.setItem("employeeExtraDetails", JSON.stringify(extraDetails));

    const updatedUser = makeQRData(extraDetails, user.qrVersion);

    setUser(updatedUser);
    setQrValue(JSON.stringify(updatedUser));

    alert("Employee details updated successfully.");
  };

  const generateNewQR = async () => {
    if (!user) return;

    try {
      const token =
        localStorage.getItem("userToken") || localStorage.getItem("token");

      const response = await fetch("/api/user/generate-qr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to generate new QR");
        return;
      }

      localStorage.setItem("employeeExtraDetails", JSON.stringify(extraDetails));

      const newUserData = makeQRData(extraDetails, result.qrVersion);

      setUser(newUserData);
      setQrValue(JSON.stringify(newUserData));

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
    link.download = `${user.username || "employee"}-${user.qrVersion}.png`;
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
            Generate a new QR anytime for safety. After new QR is generated,
            old QR will not work.
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
                    <h2 className="text-2xl font-bold">
                      {user.name || "-"}
                    </h2>
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
                  <InfoCard
                    label="QR Generated"
                    value={
                      user.qrGeneratedAt
                        ? new Date(user.qrGeneratedAt).toLocaleString()
                        : "-"
                    }
                  />
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
                    <li>1. Add/update details first.</li>
                    <li>2. Generate new QR if you want safety refresh.</li>
                    <li>3. Old QR will stop working after new QR.</li>
                    <li>4. Admin scans Entry → Break Out → Break In → Out.</li>
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
                  <QRCodeCanvas value={qrValue} size={320} level="H" />
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
                  QR contains identity only. Attendance time is saved when admin
                  scans it.
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