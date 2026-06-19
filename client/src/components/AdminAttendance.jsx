import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [search, setSearch] = useState("");
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    entryTime: "",
    breakOutTime: "",
    breakInTime: "",
    lastOutTime: "",
  });

  const fetchAttendance = async () => {
    try {
      const res = await fetch("/api/scan/attendance");
      const data = await res.json();

      if (data.success) {
        setAttendance(data.data || []);
        setFilteredData(data.data || []);
      } else {
        alert(data.message || "Failed to fetch attendance");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while fetching attendance");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      navigate("/admin-login");
      return;
    }

    fetchAttendance();

    const interval = setInterval(fetchAttendance, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    const value = search.toLowerCase();

    setFilteredData(
      attendance.filter(
        (item) =>
          item.name?.toLowerCase().includes(value) ||
          item.username?.toLowerCase().includes(value) ||
          item.mobile?.includes(value) ||
          item.email?.toLowerCase().includes(value)
      )
    );
  }, [search, attendance]);

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
        alert(result.message || result.error || "Update failed");
        setSaving(false);
        return;
      }

      alert("Attendance updated successfully");

      setEditRecord(null);
      setSaving(false);
      await fetchAttendance();
    } catch (error) {
      console.error(error);
      setSaving(false);
      alert("Server error while updating attendance");
    }
  };

  return (
    <section className="relative min-h-screen bg-black text-white pt-32 px-4 pb-10 overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-5 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-5">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-gray-400 text-sm">Admin Attendance</span>
            </div>

            <h1 className="text-5xl font-extrabold">
              Attendance
              <span className="block text-gray-500 text-3xl mt-2">
                Employee Records
              </span>
            </h1>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search Employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-2xl px-5 py-3 outline-none w-72 text-white focus:border-white/30"
            />

            <button
              onClick={fetchAttendance}
              className="bg-white text-black rounded-2xl px-6 py-3 font-semibold hover:bg-gray-200 transition"
            >
              Refresh
            </button>

            <button
              onClick={() => navigate("/admin")}
              className="bg-white/10 text-white rounded-2xl px-6 py-3 font-semibold hover:bg-white/20 transition"
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-[#111] rounded-3xl border border-white/10 p-6">
            <p className="text-gray-500">Total Records</p>
            <h2 className="text-4xl font-bold mt-2">{attendance.length}</h2>
          </div>

          <div className="bg-[#111] rounded-3xl border border-white/10 p-6">
            <p className="text-gray-500">Today's Records</p>
            <h2 className="text-4xl font-bold mt-2">
              {
                attendance.filter(
                  (item) =>
                    new Date(item.createdAt).toDateString() ===
                    new Date().toDateString()
                ).length
              }
            </h2>
          </div>

          <div className="bg-[#111] rounded-3xl border border-white/10 p-6">
            <p className="text-gray-500">Employees</p>
            <h2 className="text-4xl font-bold mt-2">
              {[...new Set(attendance.map((a) => a.username))].length}
            </h2>
          </div>

          <div className="bg-[#111] rounded-3xl border border-white/10 p-6">
            <p className="text-gray-500">Status</p>
            <h2 className="text-green-400 text-3xl font-bold mt-2">Online</h2>
          </div>
        </div>

        <div className="bg-[#050505] rounded-[30px] border border-white/10 overflow-hidden shadow-2xl">
          <div className="overflow-auto max-h-[650px]">
            <table className="w-full min-w-[1200px]">
              <thead className="sticky top-0 bg-[#111]">
                <tr>
                  <th className="text-left p-5">#</th>
                  <th className="text-left p-5">Employee</th>
                  <th className="text-left p-5">Username</th>
                  <th className="text-left p-5">Mobile</th>
                  <th className="text-left p-5">Date</th>
                  <th className="text-left p-5">Entry</th>
                  <th className="text-left p-5">Break Out</th>
                  <th className="text-left p-5">Break In</th>
                  <th className="text-left p-5">Last Out</th>
                  <th className="text-left p-5">Break</th>
                  <th className="text-left p-5">Work</th>
                  <th className="text-left p-5">Edit</th>
                </tr>
              </thead>

              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <tr
                      key={item._id}
                      className="border-t border-white/10 hover:bg-white/5 transition"
                    >
                      <td className="p-5">{index + 1}</td>

                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-[#333] flex items-center justify-center font-bold">
                            {(item.name || item.username || "E")
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

                      <td className="p-5">{item.username || "-"}</td>
                      <td className="p-5">{item.mobile || "-"}</td>
                      <td className="p-5">
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

                      <td className="p-5 text-yellow-400">
                        {formatSeconds(item.totalBreakSeconds)}
                      </td>

                      <td className="p-5 text-green-400">
                        {formatSeconds(item.totalWorkSeconds)}
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
                {editRecord.name || editRecord.username} - {editRecord.date}
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
                After saving, employee profile will show the updated shift after refresh.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminAttendance;