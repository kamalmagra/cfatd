import React from "react";
import { Link, useLocation } from "react-router-dom";

const SUPPORT_EMAIL = "cfatd.notification@gmail.com";

const Footer = () => {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path
      ? "text-white"
      : "text-gray-500 hover:text-white transition";

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-black text-white">
      <div className="absolute left-20 top-0 h-72 w-72 rounded-full bg-purple-600/10 blur-[120px]" />
      <div className="absolute bottom-0 right-20 h-72 w-72 rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {/* Company */}
          <div>
            <h2 className="mb-4 text-3xl font-bold">Cargo Force</h2>

            <p className="leading-7 text-gray-400">
              Employee QR Attendance Management System.
              <br />
              Secure • Fast • Reliable
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-sm text-gray-400">System Online</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-5 text-xl font-semibold">Navigation</h3>

            <ul className="space-y-4">
              <li>
                <Link to="/" className={isActive("/")}>
                  Home
                </Link>
              </li>

              <li>
                <Link to="/contacts" className={isActive("/contacts")}>
                  Generate QR
                </Link>
              </li>

              <li>
                <Link
                  to="/public-announcements"
                  className={isActive("/public-announcements")}
                >
                  Public Announcements
                </Link>
              </li>

              <li>
                <Link to="/login" className={isActive("/login")}>
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-5 text-xl font-semibold">Contact</h3>

            <p className="mb-6 text-gray-400">
              Need help with the attendance system?
            </p>

            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                "Cargo Force Attendance Support"
              )}`}
              className="inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-[#111] px-5 py-4 transition hover:border-blue-500/40 hover:bg-blue-500/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl font-bold text-white">
                @
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-white">Email Support</p>

                <p className="break-all text-sm text-gray-300">
                  {SUPPORT_EMAIL}
                </p>
              </div>
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-white/10 pt-6 md:flex-row">
          <p className="text-center text-sm text-gray-500 md:text-left">
            © {new Date().getFullYear()} Cargo Force. All Rights Reserved.
          </p>

          <p className="mt-3 text-center text-sm text-gray-500 md:mt-0">
            Designed & Developed by{" "}
            <span className="font-semibold text-white">Kamlesh Magra</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;