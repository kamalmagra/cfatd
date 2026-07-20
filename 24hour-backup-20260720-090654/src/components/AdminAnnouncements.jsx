import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const initialForm = {
  title: "",
  message: "",
  type: "public",
  sendEmail: false,
  showPopup: true,
};

const AdminAnnouncements = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialForm);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const adminHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
  });

  const showError = (message) => {
    if (window.showError) {
      window.showError(message);
    } else {
      alert(message);
    }
  };

  const showSuccess = (message) => {
    if (window.showSuccess) {
      window.showSuccess(message);
    } else {
      alert(message);
    }
  };

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);

      const response = await axios.get("/api/announcements/admin", {
        headers: adminHeaders(),
      });

      setAnnouncements(response.data.data || []);
    } catch (error) {
      console.error("Announcement fetch error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/admin-login");
        return;
      }

      showError(
        error.response?.data?.message || "Unable to load announcements."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");

    if (!adminToken) {
      navigate("/admin-login");
      return;
    }

    fetchAnnouncements();
  }, [fetchAnnouncements, navigate]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
        "/api/announcements",
        {
          ...formData,
          title,
          message,
        },
        {
          headers: {
            ...adminHeaders(),
            "Content-Type": "application/json",
          },
        }
      );

      showSuccess(
        response.data.message || "Announcement sent successfully."
      );

      setFormData(initialForm);
      await fetchAnnouncements();
    } catch (error) {
      console.error("Announcement send error:", error);
      showError(
        error.response?.data?.message || "Unable to send announcement."
      );
    } finally {
      setSending(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this announcement?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      const response = await axios.delete(`/api/announcements/${id}`, {
        headers: adminHeaders(),
      });

      showSuccess(
        response.data.message || "Announcement deleted successfully."
      );

      setAnnouncements((current) =>
        current.filter((announcement) => announcement._id !== id)
      );
    } catch (error) {
      console.error("Announcement delete error:", error);
      showError(
        error.response?.data?.message || "Unable to delete announcement."
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

  return (
    <section className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">
                Admin Communication Center
              </span>
            </div>

            <h1 className="text-4xl font-extrabold md:text-6xl">
              Company
              <span className="block text-gray-500">Announcements</span>
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
              onClick={() => navigate("/public-announcements")}
              className="rounded-2xl bg-white px-5 py-3 font-bold text-black transition hover:bg-gray-200"
            >
              View Public Page
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[420px_1fr]">
          <form
            onSubmit={handleSubmit}
            className="h-fit rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl"
          >
            <p className="text-sm text-gray-500">New Message</p>
            <h2 className="mb-6 text-2xl font-bold">Create Announcement</h2>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Audience
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      type: "employee",
                    }))
                  }
                  className={`rounded-2xl border px-4 py-3 font-semibold transition ${
                    formData.type === "employee"
                      ? "border-purple-500 bg-purple-500/15 text-purple-300"
                      : "border-white/10 bg-[#111] text-gray-400"
                  }`}
                >
                  Employees
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      type: "public",
                    }))
                  }
                  className={`rounded-2xl border px-4 py-3 font-semibold transition ${
                    formData.type === "public"
                      ? "border-green-500 bg-green-500/15 text-green-300"
                      : "border-white/10 bg-[#111] text-gray-400"
                  }`}
                >
                  Public
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label
                htmlFor="announcement-title"
                className="mb-2 block text-sm font-semibold text-gray-300"
              >
                Title
              </label>

              <input
                id="announcement-title"
                name="title"
                type="text"
                maxLength={100}
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter announcement title"
                className="w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white placeholder:text-gray-600"
              />

              <p className="mt-2 text-right text-xs text-gray-600">
                {formData.title.length}/100
              </p>
            </div>

            <div className="mb-5">
              <label
                htmlFor="announcement-message"
                className="mb-2 block text-sm font-semibold text-gray-300"
              >
                Message
              </label>

              <textarea
                id="announcement-message"
                name="message"
                rows={8}
                maxLength={1500}
                value={formData.message}
                onChange={handleChange}
                placeholder="Write the announcement..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#111] px-5 py-4 text-white placeholder:text-gray-600"
              />

              <p className="mt-2 text-right text-xs text-gray-600">
                {formData.message.length}/1500
              </p>
            </div>

            <div className="mb-6 space-y-3">
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-[#111] p-4">
                <div>
                  <p className="font-semibold">Send Email</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Email all registered employees.
                  </p>
                </div>

                <input
                  name="sendEmail"
                  type="checkbox"
                  checked={formData.sendEmail}
                  onChange={handleChange}
                  className="h-5 w-5 accent-purple-600"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-[#111] p-4">
                <div>
                  <p className="font-semibold">Show Employee Popup</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Display it inside the employee account.
                  </p>
                </div>

                <input
                  name="showPopup"
                  type="checkbox"
                  checked={formData.showPopup}
                  onChange={handleChange}
                  className="h-5 w-5 accent-purple-600"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-2xl bg-purple-600 px-5 py-4 font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Announcement"}
            </button>
          </form>

          <div className="rounded-[30px] border border-white/10 bg-[#050505] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">History</p>
                <h2 className="text-2xl font-bold">Sent Announcements</h2>
              </div>

              <button
                type="button"
                onClick={fetchAnnouncements}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-[#111] px-4 py-2 font-semibold text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-20 text-center text-gray-500">
                Loading announcements...
              </p>
            ) : announcements.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
                <h3 className="text-xl font-bold text-gray-300">
                  No announcements yet
                </h3>
                <p className="mt-2 text-gray-600">
                  New announcements will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <article
                    key={announcement._id}
                    className="rounded-3xl border border-white/10 bg-[#111] p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                              announcement.type === "public"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-purple-500/10 text-purple-400"
                            }`}
                          >
                            {announcement.type === "public"
                              ? "Public"
                              : "Employees"}
                          </span>

                          {announcement.sendEmail && (
                            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
                              Email
                            </span>
                          )}

                          {announcement.showPopup && (
                            <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                              Popup
                            </span>
                          )}
                        </div>

                        <h3 className="break-words text-xl font-bold">
                          {announcement.title}
                        </h3>

                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-400">
                          {announcement.message}
                        </p>

                        <p className="mt-4 text-xs text-gray-600">
                          {formatDate(announcement.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deleteAnnouncement(announcement._id)
                        }
                        disabled={deletingId === announcement._id}
                        className="h-fit shrink-0 rounded-2xl bg-red-500/10 px-4 py-2 font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {deletingId === announcement._id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminAnnouncements;
