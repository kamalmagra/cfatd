import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const WHATSAPP_NUMBER = "447438525575";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const navigate = useNavigate();

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

      fetch("/api/scan/attendance")
        .then((res) => res.json())
        .then((data) => {
          const allRecords = data.data || [];

          const myRecords = allRecords.filter(
            (item) =>
              item.userId === currentUser.id ||
              item.username === currentUser.username ||
              item.email === currentUser.email
          );

          setAttendance(myRecords);
        })
        .catch((err) => console.error("Attendance Error:", err));
    } catch (error) {
      console.error("Invalid token");
      localStorage.removeItem("userToken");
      navigate("/login");
    }
  }, [navigate]);

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

  const raiseQuery = (item) => {
    const message = `Hello,

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

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`;

    window.open(whatsappUrl, "_blank");
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
                            Raise Query
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
              Employees can only view records. For corrections, use Raise Query
              to send details on WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Profile;