import Image from "next/image";
import React from "react";
import Button from "./ui/Button";

const Header = () => {
  return (
    <div className="border-b bg-light border-neutral-300 pt-8 px-10 flex justify-between items-center">
      <Image src="/logo.svg" alt="logo" width={75} height={25} />
      <div className="flex justify-center items-center gap-2">
        <Button variant="outline" size="sm" href="/login">
          Log in
        </Button>

        <Button variant="primary" size="sm" href="/register">
          Get started
        </Button>
      </div>
    </div>
  );
};

export default Header;
