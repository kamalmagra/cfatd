import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch("/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem("adminToken", data.token);
        alert("Admin login successful!");
        navigate("/admin");
      } else {
        setMessage(data.error || "Invalid Admin Credentials");
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error. Please try again.");
    }
  };

  return (
    <section className="relative min-h-screen bg-black text-white flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-gray-400 text-sm">
              Secure Admin Access
            </span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight">
            Admin
            <span className="block text-gray-500">Login</span>
          </h1>

          <p className="text-gray-500 mt-4">
            Sign in to manage attendance, scanner and reports.
          </p>
        </div>

        <div className="bg-[#050505] border border-white/10 rounded-[30px] p-7 shadow-2xl">
          {message && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl px-4 py-3 text-center font-medium">
              {message}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Username
              </label>

              <input
                type="text"
                placeholder="Enter admin username"
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-white/30"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-2">
                Password
              </label>

              <input
                type="password"
                placeholder="Enter password"
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-white/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
            >
              Login to Dashboard
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full bg-white/10 text-white py-4 rounded-2xl font-semibold hover:bg-white/15 transition"
            >
              Back to Home
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default AdminLogin;