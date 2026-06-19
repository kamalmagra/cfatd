import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          mobile,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Signup successful! Please login.");
        navigate("/login");
      } else {
        setMessage(data.error || "Signup failed.");
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
              Employee Registration
            </span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight">
            Create
            <span className="block text-gray-500">Account</span>
          </h1>

          <p className="text-gray-500 mt-4">
            Register to generate your employee QR code.
          </p>
        </div>

        <div className="bg-[#050505] border border-white/10 rounded-[30px] p-7 shadow-2xl">
          {message && (
            <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-center">
              {message}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-gray-500 text-sm mb-2">
                Username
              </label>

              <input
                type="text"
                placeholder="Enter username"
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-white/30 transition"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-gray-500 text-sm mb-2">
                Email Address
              </label>

              <input
                type="email"
                placeholder="Enter email"
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-white/30 transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-gray-500 text-sm mb-2">
                Mobile Number
              </label>

              <input
                type="text"
                placeholder="Enter mobile number"
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-white/30 transition"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-gray-500 text-sm mb-2">
                Password
              </label>

              <input
                type="password"
                placeholder="Enter password"
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-white/30 transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
            >
              Create Account
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500">Already have an account?</p>

            <button
              onClick={() => navigate("/login")}
              className="mt-3 w-full bg-white/10 text-white py-4 rounded-2xl font-semibold hover:bg-white/15 transition"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Signup;