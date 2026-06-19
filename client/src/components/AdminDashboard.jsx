import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function AdminDashboard() {
  const [attendance, setAttendance] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    entryTime: "",
    breakOutTime: "",
    breakInTime: "",
    lastOutTime: "",
  });

  const navigate = useNavigate();

  const fetchAttendance = async () => {
    try {
      const response = await axios.get("/api/scan/attendance");
      setAttendance(response.data.data || []);
    } catch (error) {
      console.error("Attendance Error:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      navigate("/admin-login");
      return;
    }

    fetchAttendance();

    const interval = setInterval(fetchAttendance, 3000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin-login");
  };

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

  const toDateTimeLocal = (date) => {
    if (!date) return "";

    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());

    return d.toISOString().slice(0, 16);
  };

  const openEdit = (item) => {
    setEditRecord(item);

    setFormData({
      entryTime: toDateTimeLocal(item.entryTime),
      breakOutTime: toDateTimeLocal(item.breakOutTime),
      breakInTime: toDateTimeLocal(item.breakInTime),
      lastOutTime: toDateTimeLocal(item.lastOutTime),
    });
  };

  const updateAttendance = async () => {
    if (!editRecord) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/scan/attendance/${editRecord._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Update failed");
        setSaving(false);
        return;
      }

      alert("Attendance updated successfully");
      setEditRecord(null);
      setSaving(false);
      fetchAttendance();
    } catch (error) {
      console.error(error);
      setSaving(false);
      alert("Server error while updating attendance");
    }
  };

  const users = attendance.reduce((acc, item) => {
    const key = item.userId || item.username;

    if (!acc[key]) {
      acc[key] = {
        userId: key,
        name: item.name || item.username || "-",
        username: item.username || "-",
        mobile: item.mobile || "-",
        records: [],
      };
    }

    acc[key].records.push(item);
    return acc;
  }, {});

  const userList = Object.values(users).filter((user) => {
    const value = search.toLowerCase();

    return (
      user.name.toLowerCase().includes(value) ||
      user.username.toLowerCase().includes(value) ||
      user.mobile.toLowerCase().includes(value)
    );
  });

  const selectedRecords = selectedUser ? selectedUser.records : attendance;

  const todayRecords = attendance.filter(
    (item) =>
      new Date(item.createdAt).toDateString() === new Date().toDateString()
  );

  const downloadUserPDF = () => {
    if (!selectedUser) return;

    const doc = new jsPDF("landscape", "mm", "a4");

    doc.setFontSize(18);
    doc.text("Employee Attendance Report", 14, 15);

    doc.setFontSize(11);
    doc.text(`Employee Name: ${selectedUser.name}`, 14, 25);
    doc.text(`Username: ${selectedUser.username}`, 14, 32);
    doc.text(`Mobile: ${selectedUser.mobile}`, 14, 39);

    autoTable(doc, {
      startY: 48,
      head: [
        [
          "No",
          "Date",
          "Entry Time",
          "Break Out",
          "Break In",
          "Last Out",
          "Total Break",
          "Working Hours",
        ],
      ],
      body: selectedUser.records.map((item, index) => [
        index + 1,
        item.date || formatDate(item.createdAt),
        formatTime(item.entryTime),
        formatTime(item.breakOutTime),
        formatTime(item.breakInTime),
        formatTime(item.lastOutTime),
        formatSeconds(item.totalBreakSeconds),
        formatSeconds(item.totalWorkSeconds),
      ]),
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [17, 17, 17],
      },
    });

    doc.save(`${selectedUser.username}-attendance-report.pdf`);
  };

  return (
    <section className="relative min-h-screen bg-black text-white px-4 py-6 overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-4">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-gray-400 text-sm">
                Admin Dashboard Online
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              Attendance
              <span className="block text-gray-500">Dashboard</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/")}
              className="px-5 py-3 rounded-2xl bg-[#111] border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition"
            >
              Home
            </button>

            <button
              onClick={() => navigate("/services")}
              className="px-5 py-3 rounded-2xl bg-white text-black font-bold hover:bg-gray-200 transition"
            >
              Open Scanner
            </button>

            <button
              onClick={fetchAttendance}
              className="px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="px-5 py-3 rounded-2xl bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Total Records</p>
            <h2 className="text-4xl font-bold mt-2">{attendance.length}</h2>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Today Records</p>
            <h2 className="text-4xl font-bold mt-2">{todayRecords.length}</h2>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Employees</p>
            <h2 className="text-4xl font-bold mt-2">
              {Object.values(users).length}
            </h2>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">System Status</p>
            <h2 className="text-3xl font-bold mt-2 text-green-400">Live</h2>
          </div>
        </div>

        <div className="bg-[#050505] border border-white/10 rounded-[30px] p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-6">
            <div>
              <p className="text-gray-500 text-sm">Employees</p>
              <h2 className="text-2xl font-bold">Employee Records</h2>
            </div>

            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-2xl px-5 py-3 outline-none text-white w-full md:w-80 focus:border-white/30"
            />
          </div>

          {userList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {userList.map((user) => (
                <div
                  key={user.userId}
                  onClick={() => setSelectedUser(user)}
                  className={`p-5 rounded-[24px] cursor-pointer border transition ${
                    selectedUser?.userId === user.userId
                      ? "bg-white text-black border-white"
                      : "bg-[#111] text-white border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                        selectedUser?.userId === user.userId
                          ? "bg-black text-white"
                          : "bg-[#333] text-white"
                      }`}
                    >
                      {user.name?.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold">{user.name}</h3>
                      <p
                        className={`text-sm ${
                          selectedUser?.userId === user.userId
                            ? "text-gray-700"
                            : "text-gray-500"
                        }`}
                      >
                        {user.username}
                      </p>
                    </div>
                  </div>

                  <p
                    className={`text-sm ${
                      selectedUser?.userId === user.userId
                        ? "text-gray-700"
                        : "text-gray-500"
                    }`}
                  >
                    Mobile: {user.mobile}
                  </p>

                  <p className="mt-3 font-semibold">
                    Total Records: {user.records.length}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-10">
              No employees found
            </p>
          )}
        </div>

        {selectedUser && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 bg-[#111] border border-white/10 rounded-[24px] p-5">
            <div>
              <p className="text-gray-500 text-sm">Showing Records</p>
              <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={downloadUserPDF}
                className="px-5 py-3 bg-green-500/10 text-green-400 rounded-2xl font-semibold hover:bg-green-500/20 transition"
              >
                Download PDF
              </button>

              <button
                onClick={() => setSelectedUser(null)}
                className="px-5 py-3 bg-white/10 text-white rounded-2xl font-semibold hover:bg-white/20 transition"
              >
                Show All Employees
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#050505] border border-white/10 rounded-[30px] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px]">
              <thead className="bg-[#111] text-white">
                <tr>
                  <th className="p-5 text-left">No</th>
                  <th className="p-5 text-left">Employee</th>
                  <th className="p-5 text-left">Username</th>
                  <th className="p-5 text-left">Mobile</th>
                  <th className="p-5 text-left">Date</th>
                  <th className="p-5 text-left">Entry</th>
                  <th className="p-5 text-left">Break Out</th>
                  <th className="p-5 text-left">Break In</th>
                  <th className="p-5 text-left">Last Out</th>
                  <th className="p-5 text-left">Total Break</th>
                  <th className="p-5 text-left">Work Hours</th>
                  <th className="p-5 text-left">Edit</th>
                </tr>
              </thead>

              <tbody>
                {selectedRecords.length > 0 ? (
                  selectedRecords.map((item, index) => (
                    <tr
                      key={item._id}
                      className="border-t border-white/10 hover:bg-white/5 transition"
                    >
                      <td className="p-5 text-gray-400">{index + 1}</td>

                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center font-bold">
                            {(item.name || item.username || "-")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold">
                              {item.name || item.username || "-"}
                            </p>
                            <p className="text-gray-500 text-sm">Employee</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-5 text-gray-300">
                        {item.username || "-"}
                      </td>

                      <td className="p-5 text-gray-300">
                        {item.mobile || "-"}
                      </td>

                      <td className="p-5 text-gray-300">
                        {item.date || formatDate(item.createdAt)}
                      </td>

                      <td className="p-5 text-green-400 font-semibold">
                        {formatTime(item.entryTime)}
                      </td>

                      <td className="p-5 text-yellow-400 font-semibold">
                        {formatTime(item.breakOutTime)}
                      </td>

                      <td className="p-5 text-blue-400 font-semibold">
                        {formatTime(item.breakInTime)}
                      </td>

                      <td className="p-5 text-red-400 font-semibold">
                        {formatTime(item.lastOutTime)}
                      </td>

                      <td className="p-5">
                        <span className="bg-yellow-500/10 text-yellow-400 px-3 py-2 rounded-full font-semibold">
                          {formatSeconds(item.totalBreakSeconds)}
                        </span>
                      </td>

                      <td className="p-5">
                        <span className="bg-green-500/10 text-green-400 px-3 py-2 rounded-full font-semibold">
                          {formatSeconds(item.totalWorkSeconds)}
                        </span>
                      </td>

                      <td className="p-5">
                        <button
                          onClick={() => openEdit(item)}
                          className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-2xl font-semibold hover:bg-blue-500/20 transition"
                        >
                          Edit Shift
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="12"
                      className="text-center py-16 text-gray-500 text-xl"
                    >
                      No Attendance Records Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editRecord && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center px-4">
            <div className="w-full max-w-2xl bg-[#050505] border border-white/10 rounded-[30px] p-6 shadow-2xl">
              <h2 className="text-3xl font-bold mb-2">Edit Shift</h2>
              <p className="text-gray-500 mb-6">
                {editRecord.name || editRecord.username} -{" "}
                {editRecord.date || formatDate(editRecord.createdAt)}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-500 text-sm">Entry Time</label>
                  <input
                    type="datetime-local"
                    value={formData.entryTime}
                    onChange={(e) =>
                      setFormData({ ...formData, entryTime: e.target.value })
                    }
                    className="w-full mt-2 bg-[#111] border border-white/10 rounded-2xl px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-sm">Break Out</label>
                  <input
                    type="datetime-local"
                    value={formData.breakOutTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        breakOutTime: e.target.value,
                      })
                    }
                    className="w-full mt-2 bg-[#111] border border-white/10 rounded-2xl px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-sm">Break In</label>
                  <input
                    type="datetime-local"
                    value={formData.breakInTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        breakInTime: e.target.value,
                      })
                    }
                    className="w-full mt-2 bg-[#111] border border-white/10 rounded-2xl px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-gray-500 text-sm">Last Out</label>
                  <input
                    type="datetime-local"
                    value={formData.lastOutTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lastOutTime: e.target.value,
                      })
                    }
                    className="w-full mt-2 bg-[#111] border border-white/10 rounded-2xl px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={updateAttendance}
                  disabled={saving}
                  className="flex-1 bg-white text-black py-3 rounded-2xl font-bold hover:bg-gray-200 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Update"}
                </button>

                <button
                  onClick={() => setEditRecord(null)}
                  disabled={saving}
                  className="flex-1 bg-red-500/10 text-red-400 py-3 rounded-2xl font-bold hover:bg-red-500/20 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              <p className="text-gray-500 text-sm mt-4">
                After saving, employee profile will show updated shift after refresh.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminDashboard;