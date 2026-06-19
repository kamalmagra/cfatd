import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  const steps = [
    {
      number: "01",
      title: "Employee Login",
      text: "Employee signs in to access their QR identity page.",
    },
    {
      number: "02",
      title: "Generate QR",
      text: "Employee creates and downloads their personal attendance QR code.",
    },
    {
      number: "03",
      title: "Admin Scan",
      text: "Admin scans QR for Entry, Break Out, Break In and Last Out.",
    },
  ];

  return (
    <section className="relative min-h-screen bg-black text-white overflow-hidden pt-28 px-4">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center min-h-[80vh]">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-4 py-2 mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-gray-400 text-sm">
                QR Attendance System
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
              Cargo Force
              <span className="block text-gray-500">Attendance</span>
            </h1>

            <p className="text-gray-400 mt-6 text-lg leading-8 max-w-xl">
              A modern employee attendance management system using QR codes for
              Entry, Last Out, Break Out and Break In tracking.
            </p>

            <div className="flex flex-wrap gap-4 mt-8">
              <Link
                to="/login"
                className="bg-white text-black px-7 py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
              >
                Employee Login
              </Link>

              <Link
                to="/contacts"
                className="bg-[#111] border border-white/10 text-white px-7 py-4 rounded-2xl font-bold hover:bg-white/10 transition"
              >
                Generate QR
              </Link>
            </div>
          </div>

          <div className="bg-[#050505] border border-white/10 rounded-[32px] p-6 shadow-2xl">
            <div className="bg-[#111] border border-white/10 rounded-[28px] p-6 mb-5">
              <p className="text-gray-500 text-sm">System Flow</p>
              <h2 className="text-3xl font-bold mt-2">
                Login → QR → Scan → Dashboard
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="bg-[#111] border border-white/10 rounded-3xl p-5 flex gap-4 hover:bg-white/5 transition"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center font-extrabold">
                    {step.number}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold">{step.title}</h3>
                    <p className="text-gray-500 mt-1">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 pb-12">
          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Feature</p>
            <h3 className="text-2xl font-bold mt-2">QR Scan</h3>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Tracking</p>
            <h3 className="text-2xl font-bold mt-2">Break Time</h3>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Dashboard</p>
            <h3 className="text-2xl font-bold mt-2">Admin Panel</h3>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-[28px] p-6">
            <p className="text-gray-500">Security</p>
            <h3 className="text-2xl font-bold mt-2">Admin Only</h3>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;