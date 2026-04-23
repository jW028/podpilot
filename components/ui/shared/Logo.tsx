import Image from "next/image";
import Link from "next/link";
import React from "react";

const Logo = () => {
  return (
    <Link href="/">
      <Image
        src="/podpilot-logo.svg"
        alt="Podpilot Logo"
        width={75}
        height={25}
        priority
      />
    </Link>
  );
};

export default Logo;
