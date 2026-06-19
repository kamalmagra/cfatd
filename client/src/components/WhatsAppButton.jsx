import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

const WhatsAppButton = () => {
  return (
    <a
      href="https://wa.me/+919909362813"
      target="_blank"
      rel="noopener noreferrer"
      className="z-[10] fixed bottom-6 right-6 bg-green-500 rounded-full p-4 text-white text-3xl shadow-lg 
      hover:bg-green-400 flex justify-center items-center" //animate-bounce
      style={{ width: "80px", height: "80px"}}

    >
      <FontAwesomeIcon
        icon={faWhatsapp}
        size="xl"
        style={{ transform: "scale(1.2)" }}
      />
    </a>
  );
};

export default WhatsAppButton;
