import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const initialForm = {
  title: "",
  message: "",
  priority: "normal",
  sendEmail: true,
  showPopup: true,
};

const AdminPersonalNotifications = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState(initialForm);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const adminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const showSuccess = (message) => {
    if (window.showSuccess) {
      window.showSuccess(message);
    } else {
      alert(message);
    }
  };

  const showError = (message) => {
    if (window.showError) {
      window.showError(message);
    } else {
      alert(message);
    }
  };

  const handleAuthError = (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem("adminToken");
      navigate("/admin-login");
      return true;
    }

    return false;
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);

      const response = await axios.get("/api/users", {
        headers: adminHeaders(),
      });

      setEmployees(response.data.data || []);
    } catch (error) {
      console.error("Employee fetch error:", error);

      if (!handleAuthError(error)) {
        showError(
          error.response?.data?.message || "Unable to load employees."
        );
      }
    } finally {
      setLoadingEmployees(false);
    }
  }, [navigate]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);

      const response = await axios.get(
        "/api/personal-notifications/admin",
        {
          headers: adminHeaders(),
        }
      );

      setNotifications(response.data.data || []);
    } catch (error) {
      console.error("Notification fetch error:", error);

      if (!handleAuthError(error)) {
        showError(
          error.response?.data?.message ||
            "Unable to load personal notifications."
        );
      }
    } finally {
      setLoadingNotifications(false);
    }
  }, [navigate]);

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");

    if (!adminToken) {
      navigate("/admin-login");
      return;
    }

    fetchEmployees();
    fetchNotifications();
  }, [fetchEmployees, fetchNotifications, navigate]);

  const filteredEmployees = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return employees;

    return employees.filter((employee) => {
      const username = String(employee.username || "").toLowerCase();
      const email = String(employee.email || "").toLowerCase();
      const mobile = String(employee.mobile || "").toLowerCase();

      return (
        username.includes(value) ||
        email.includes(value) ||
        mobile.includes(value)
      );
    });
  }, [employees, search]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedEmployee) {
      if (window.showWarning) {
        window.showWarning("Please select an employee.");
      } else {
        alert("Please select an employee.");
      }
      return;
    }

    const title = formData.title.trim();
    const message = formData.message.trim();

    if (!title || !message) {
      if (window.showWarning) {
        window.showWarning("Please enter both title and message.");
      } else {
        alert("Please enter both title and message.");
      }
      return;
    }

    try {
      setSending(true);

      const response = await axios.post(
        "/api/personal-notifications",
        {
          employeeId: selectedEmployee._id,
          title,
          message,
          priority: formData.priority,
          sendEmail: formData.sendEmail,
          showPopup: formData.showPopup,
        },
        {
          headers: {
            ...adminHeaders(),
            "Content-Type": "application/json",
          },
        }
      );

      showSuccess(
        response.data.message || "Personal notification sent successfully."
      );

      setFormData(initialForm);
      await fetchNotifications();
    } catch (error) {
      console.error("Notification send error:", error);
      showError(
        error.response?.data?.message ||
          "Unable to send personal notification."
      );
    } finally {
      setSending(false);
    }
  };

  const deleteNotification = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this notification?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      const response = await axios.delete(
        `/api/personal-notifications/${id}`,
        {
          headers: adminHeaders(),
        }
      );

      showSuccess(
        response.data.message || "Notification deleted successfully."
      );

      setNotifications((current) =>
        current.filter((notification) => notification._id !== id)
      );
    } catch (error) {
      console.error("Notification delete error:", error);
      showError(
        error.response?.data?.message || "Unable to delete notification."
      );
    } finally {
      setDeletingId("");
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });
  };

  const getInitial = (employee) =>
    String(employee?.username || "E").charAt(0).toUpperCase();

  const priorityClass = (priority) => {
    if (priority === "urgent") return "bg-red-500/10 text-red-400";
    if (priority === "important") {
      return "bg-yellow-500/10 text-yellow-400";
    }
    return "bg-blue-500/10 text-blue-400";
  };

  return (
    <section className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-sm text-gray-400">
                Private Employee Communication
              </span>
            </div>

            <h1 className="text-4xl font-extrabold md:text-6xl">
              Personal
              <span className="block text-gray-500">Notifications</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-2xl border border-white/10 bg-[#111] px-5 py-3 font-semibold text-gray-300 transition hover:bg-white/10"
            >
              Back to Dashboard
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin-announcements")}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              Company Announcements
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit rounded-[30px] border border-white/10 bg-[#050505] p-5 shadow-2xl">
            <p className="text-sm text-gray-500">Recipient</p>
            <h2 className="mb-5 text-2xl font-bold">Select Employee</h2>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or mobile"
              className="mb-5 w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-white placeholder:text-gray-600"
            />

            <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
              {loadingEmployees ? (
                <p className="py-12 text-center text-gray-500">
                  Loading employees...
                </p>
              ) : filteredEmployees.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 px-4 py-12 text-center text-gray-500">
                  No employees found.
                </div>
              ) : (
                filteredEmployees.map((employee) => {
                  const selected =
                    selectedEmployee?._id === employee._id;

                  return (
                    <button
                      key={employee._id}
                      type="button"
                      onClick={() => setSelectedEmployee(employee)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-500/15"
                          : "border-white/10 bg-[#111] hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold ${
                            selected
                              ? "bg-blue-500 text-white"
                              : "bg-white/10 text-gray-300"
                          }`}
                        >
                          {getInitial(employee)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-bold">
                            {employee.username || "Employee"}
                          </p>
                          <p className="truncate text-sm text-gray-500">
                            {employee.email || "No email"}
                          </p>
                          <p className="truncate text-xs text-gray-600">
                            {employee.mobile || "No mobile"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <main className="space-y-7">
            <form
              onSubmit={handleSubmit}
              className="rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl"
            >
              <p className="text-sm text-gray-500">Private Message</p>
              <h2 className="mb-6 text-2xl font-bold">
                Create Notification
              </h2>

              {selectedEmployee ? (
                <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold">
                      {getInitial(selectedEmployee)}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-blue-400">
                        Sending To
                      </p>
                      <p className="truncate text-lg font-bold">
                        {selectedEmployee.username}
                      </p>
                      <p className="truncate text-sm text-gray-400">
                        {selectedEmployee.email || "No email registered"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEmployee(null)}
                    className="rounded-2xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="mb-6 rounded-3xl border border-dashed border-white/10 p-6 text-center text-gray-500">
                  Select an employee from the list.
                </div>
              )}

              <div className="mb-5">
                <label
                  htmlFor="personal-title"
                  className="mb-2 block text-sm font-semibold text-gray-300"
                >
                  Title
                </label>

                <input
                  id="personal-title"
                  name="title"
                  type="text"
                  maxLength={100}
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Example: Shift correction completed"
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white placeholder:text-gray-600"
                />

                <p className="mt-2 text-right text-xs text-gray-600">
                  {formData.title.length}/100
                </p>
              </div>

              <div className="mb-5">
                <label
                  htmlFor="personal-message"
                  className="mb-2 block text-sm font-semibold text-gray-300"
                >
                  Message
                </label>

                <textarea
                  id="personal-message"
                  name="message"
                  rows={7}
                  maxLength={1500}
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Write a private message..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white placeholder:text-gray-600"
                />

                <p className="mt-2 text-right text-xs text-gray-600">
                  {formData.message.length}/1500
                </p>
              </div>

              <div className="mb-5">
                <label
                  htmlFor="priority"
                  className="mb-2 block text-sm font-semibold text-gray-300"
                >
                  Priority
                </label>

                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-[#111] p-4">
                  <div>
                    <p className="font-semibold">Send Email</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Also send it to employee email.
                    </p>
                  </div>

                  <input
                    name="sendEmail"
                    type="checkbox"
                    checked={formData.sendEmail}
                    onChange={handleChange}
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-[#111] p-4">
                  <div>
                    <p className="font-semibold">Show Popup</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Show it in the employee account.
                    </p>
                  </div>

                  <input
                    name="showPopup"
                    type="checkbox"
                    checked={formData.showPopup}
                    onChange={handleChange}
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={sending || !selectedEmployee}
                className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send Personal Notification"}
              </button>
            </form>

            <section className="rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">History</p>
                  <h2 className="text-2xl font-bold">
                    Sent Personal Notifications
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={fetchNotifications}
                  disabled={loadingNotifications}
                  className="rounded-2xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {loadingNotifications ? (
                <p className="py-16 text-center text-gray-500">
                  Loading notifications...
                </p>
              ) : notifications.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center">
                  <h3 className="text-xl font-bold text-gray-300">
                    No personal notifications
                  </h3>
                  <p className="mt-2 text-gray-600">
                    Sent notifications will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <article
                      key={notification._id}
                      className="rounded-3xl border border-white/10 bg-[#111] p-5"
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row">
                        <div className="min-w-0">
                          <div className="mb-3 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${priorityClass(
                                notification.priority
                              )}`}
                            >
                              {notification.priority || "normal"}
                            </span>

                            {notification.sendEmail && (
                              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                                Email
                              </span>
                            )}

                            {notification.showPopup && (
                              <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
                                Popup
                              </span>
                            )}

                            {notification.isRead && (
                              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300">
                                Read
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-blue-400">
                            To:{" "}
                            {notification.employeeUsername ||
                              notification.employeeName ||
                              "Employee"}
                          </p>

                          <h3 className="mt-1 break-words text-xl font-bold">
                            {notification.title}
                          </h3>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-400">
                            {notification.message}
                          </p>

                          <p className="mt-4 text-xs text-gray-600">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            deleteNotification(notification._id)
                          }
                          disabled={deletingId === notification._id}
                          className="h-fit shrink-0 rounded-2xl bg-red-500/10 px-4 py-2 font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {deletingId === notification._id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </section>
  );
};

export default AdminPersonalNotifications;
