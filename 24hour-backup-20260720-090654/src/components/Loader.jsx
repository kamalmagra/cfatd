import React from "react";
import Logo from "../assets/Copilot_20260610_092835.png";

const Loader = () => {
  return (
    <div className="relative h-screen w-full bg-black flex items-center justify-center overflow-hidden">
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-600/20 blur-[120px] rounded-full"></div>

      <h1 className="absolute text-[70px] md:text-[150px] font-extrabold text-white/5 tracking-tight">
        CARGO FORCE
      </h1>

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-40 h-40 md:w-52 md:h-52 rounded-[36px] bg-[#111] border border-white/10 flex items-center justify-center shadow-2xl animate-pulse">
          <img
            src={Logo}
            alt="Loading..."
            className="h-28 md:h-36 w-auto object-contain"
          />
        </div>

        <p className="mt-6 text-gray-400 font-medium tracking-wide">
          Loading Attendance System...
        </p>
      </div>
    </div>
  );
};

export default Loader;