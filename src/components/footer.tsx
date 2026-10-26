import React from "react";
import Image from "next/image";

const Footer = () => {
  return (
    <footer className="w-full bg-base-300 shadow-xl p-5 flex flex-col items-center space-y-5">
      <Image src="/icon.png" alt="logo" width="100" height="100" suppressHydrationWarning />
      <p className="text-sm text-gray-300">
        Kura does not store any files on the server, we only link to the
        media which is hosted on 3rd party services.
      </p>
      <p className="text-sm text-gray-300">&copy; Kura</p>
    </footer>
  );
};

export default Footer;
