import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const emptyForm = {
  username: "",
  email: "",
  mobile: "",
  password: "",
};

function AdminEmployees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [formMode, setFormMode] = useState("create");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [stats, setStats] = useState({
    totalEmployees: 0,
    filteredEmployees: 0,
  });

  const getAdminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const showSuccess = (message) => {
    if (window.showSuccess) window.showSuccess(message);
    else alert(message);
  };

  const showError = (message) => {
    if (window.showError) window.showError(message);
    else alert(message);
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

  const fetchEmployees = async (page = pagination.page, silent = false) => {
    try {
      if (!silent) setLoading(true);

      const response = await axios.get("/api/admin/employees", {
        headers: getAdminHeaders(),
        params: {
          page,
          limit: pagination.limit,
          search: appliedSearch.trim() || undefined,
        },
      });

      setEmployees(response.data.data || []);
      setStats(response.data.stats || { totalEmployees: 0, filteredEmployees: 0 });
      setPagination(
        response.data.pagination || {
          page,
          limit: 10,
          totalRecords: 0,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        }
      );
    } catch (error) {
      console.error("Employees Error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
        return;
      }

      showError(error.response?.data?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      navigate("/admin-login");
      return;
    }

    fetchEmployees(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, navigate]);

  const openCreateForm = () => {
    setFormMode("create");
    setSelectedEmployee(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (employee) => {
    setFormMode("edit");
    setSelectedEmployee(employee);
    setFormData({
      username: employee.username === "-" ? "" : employee.username || "",
      email: employee.email === "-" ? "" : employee.email || "",
      mobile: employee.mobile === "-" ? "" : employee.mobile || "",
      password: "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setSelectedEmployee(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (formMode === "create") {
        const response = await axios.post("/api/admin/employees", formData, {
          headers: getAdminHeaders(),
        });

        showSuccess(response.data.message || "Employee created successfully.");
      } else if (selectedEmployee) {
        const payload = {
          username: formData.username,
          email: formData.email,
          mobile: formData.mobile,
          password: formData.password.trim() ? formData.password : "",
        };

        const response = await axios.put(
          `/api/admin/employees/${selectedEmployee._id}`,
          payload,
          { headers: getAdminHeaders() }
        );

        showSuccess(response.data.message || "Employee updated successfully.");
      }

      setShowForm(false);
      setSelectedEmployee(null);
      setFormData(emptyForm);
      await fetchEmployees(pagination.page, true);
    } catch (error) {
      console.error("Save Employee Error:", error);
      showError(error.response?.data?.message || "Failed to save employee.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (employee) => {
    const deleteData = window.confirm(
      `Delete ${employee.username}?\n\nOK = Delete employee AND related attendance/shift/notification data.\nCancel = Next confirmation will keep old records.`
    );

    let keepRecords = false;

    if (!deleteData) {
      keepRecords = window.confirm(
        `Do you want to delete only ${employee.username}'s login account and keep old attendance records?`
      );
    }

    if (!deleteData && !keepRecords) return;

    setSaving(true);

    try {
      const response = await axios.delete(`/api/admin/employees/${employee._id}`, {
        headers: getAdminHeaders(),
        params: { deleteData },
      });

      showSuccess(response.data.message || "Employee deleted successfully.");
      await fetchEmployees(1, true);
    } catch (error) {
      console.error("Delete Employee Error:", error);
      showError(error.response?.data?.message || "Failed to delete employee.");
    } finally {
      setSaving(false);
    }
  };

  const regenerateQR = async (employee) => {
    const confirmRegenerate = window.confirm(
      `Regenerate QR for ${employee.username}? Old QR will stop working.`
    );

    if (!confirmRegenerate) return;

    setSaving(true);

    try {
      const response = await axios.patch(
        `/api/admin/employees/${employee._id}/regenerate-qr`,
        {},
        { headers: getAdminHeaders() }
      );

      showSuccess(response.data.message || "QR regenerated successfully.");
      await fetchEmployees(pagination.page, true);
    } catch (error) {
      console.error("Regenerate QR Error:", error);
      showError(error.response?.data?.message || "Failed to regenerate QR.");
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setAppliedSearch(search);
  };

  const clearSearch = () => {
    setSearch("");
    setAppliedSearch("");
  };

  const changePage = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchEmployees(newPage);
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-black px-4 py-6 text-white">
      <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]"></div>
      <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-blue-600/20 blur-[120px]"></div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400"></span>
              <span className="text-sm text-gray-400">Admin Employees</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
              Employee
              <span className="block text-gray-500">Management</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Dashboard
            </button>

            <button
              onClick={openCreateForm}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Add Employee
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Total Employees</p>
            <h2 className="mt-2 text-4xl font-bold">{stats.totalEmployees}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Filtered Employees</p>
            <h2 className="mt-2 text-4xl font-bold">{stats.filteredEmployees}</h2>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111] p-6">
            <p className="text-gray-500">Current Page</p>
            <h2 className="mt-2 text-4xl font-bold">{employees.length}</h2>
          </div>

          <div className="rounded-[28px] border border-green-500/20 bg-green-500/10 p-6">
            <p className="text-gray-400">Status</p>
            <h2 className="mt-2 text-3xl font-bold text-green-400">Active</h2>
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="mb-8 rounded-[30px] border border-white/10 bg-[#050505] p-6"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">Search</p>
              <h2 className="text-2xl font-bold">Find Employee</h2>
            </div>

            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or mobile..."
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-3 text-white outline-none focus:border-white/30"
            />

            <button
              type="submit"
              className="rounded-2xl bg-white px-6 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearSearch}
              className="rounded-2xl border border-white/10 bg-[#111] px-6 py-3 font-semibold text-gray-300 transition hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#050505] shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px]">
              <thead className="bg-[#111] text-white">
                <tr>
                  <th className="p-5 text-left">No</th>
                  <th className="p-5 text-left">Employee</th>
                  <th className="p-5 text-left">Email</th>
                  <th className="p-5 text-left">Mobile</th>
                  <th className="p-5 text-left">Joined</th>
                  <th className="p-5 text-left">Attendance</th>
                  <th className="p-5 text-left">Work</th>
                  <th className="p-5 text-left">Shifts</th>
                  <th className="p-5 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-16 text-center text-xl text-gray-500">
                      Loading employees...
                    </td>
                  </tr>
                ) : employees.length > 0 ? (
                  employees.map((employee, index) => (
                    <tr
                      key={employee._id}
                      className="border-t border-white/10 transition hover:bg-white/5"
                    >
                      <td className="p-5 text-gray-400">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>

                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#333] font-bold">
                            {String(employee.username || "E").charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold">{employee.username}</p>
                            <p className="text-sm text-gray-500">
                              QR: {employee.currentQrVersion ? "Active" : "Not generated"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-5 text-gray-300">{employee.email}</td>
                      <td className="p-5 text-gray-300">{employee.mobile}</td>
                      <td className="p-5 text-gray-300">{formatDate(employee.createdAt)}</td>
                      <td className="p-5">
                        <span className="rounded-full bg-blue-500/10 px-3 py-2 font-semibold text-blue-400">
                          {employee.attendanceRecords || 0} records
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="rounded-full bg-green-500/10 px-3 py-2 font-semibold text-green-400">
                          {formatSeconds(employee.totalWorkSeconds)}
                        </span>
                      </td>
                      <td className="p-5 text-gray-300">
                        {employee.plannedShifts || 0}
                      </td>
                      <td className="p-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openEditForm(employee)}
                            className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-400 transition hover:bg-blue-500/20"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => regenerateQR(employee)}
                            disabled={saving}
                            className="rounded-xl bg-purple-500/10 px-3 py-2 text-sm font-semibold text-purple-400 transition hover:bg-purple-500/20 disabled:opacity-50"
                          >
                            New QR
                          </button>

                          <button
                            onClick={() => deleteEmployee(employee)}
                            disabled={saving}
                            className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-16 text-center text-xl text-gray-500">
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 bg-[#080808] p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalRecords} matching employees
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => changePage(1)}
                disabled={!pagination.hasPrevPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>

              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={!pagination.hasPrevPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={!pagination.hasNextPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

              <button
                onClick={() => changePage(pagination.totalPages)}
                disabled={!pagination.hasNextPage || loading}
                className="rounded-xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl"
            >
              <h2 className="mb-2 text-3xl font-bold">
                {formMode === "create" ? "Add Employee" : "Edit Employee"}
              </h2>
              <p className="mb-6 text-gray-500">
                {formMode === "create"
                  ? "Create login account and QR version for a new employee."
                  : "Update employee details. Password is optional."}
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-gray-500">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-white/30"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-white/30"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">Mobile</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500">
                    {formMode === "create" ? "Password" : "New Password Optional"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white outline-none focus:border-white/30"
                    required={formMode === "create"}
                    minLength={formData.password ? 6 : undefined}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-white py-3 font-bold text-black transition hover:bg-gray-200 disabled:opacity-50"
                >
                  {saving ? "Saving..." : formMode === "create" ? "Create Employee" : "Save Update"}
                </button>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-red-500/10 py-3 font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminEmployees;
