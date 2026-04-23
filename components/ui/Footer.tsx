import Image from "next/image";
import React from "react";

// Styling configuration for Footer
const footerStyles = {
  container: "border-t border-neutral-300 bg-light mt-auto",
  wrapper: "max-w-7xl mx-auto px-10 py-12",
  topSection:
    "flex justify-between items-center mb-8 pb-8 border-b border-neutral-200",
  socialLink: "text-dark/50 hover:text-dark transition text-xs",
  divider: "border-neutral-200",
  section: "font-serif font-bold text-light-primary mb-4",
  link: "text-dark/50 hover:text-dark transition text-xs",
  copyright: "text-light-muted text-xs",
};

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={footerStyles.container}>
      <div className={footerStyles.wrapper}>
        {/* logo & social links */}
        <div className={footerStyles.topSection}>
          <Image
            src="/podpilot-logo.svg"
            alt="Podpilot Logo"
            width={75}
            height={25}
          />
          <div className="flex gap-6">
            <a href="#" className={footerStyles.socialLink}>
              Twitter
            </a>
            <a href="#" className={footerStyles.socialLink}>
              GitHub
            </a>
            <a href="#" className={footerStyles.socialLink}>
              LinkedIn
            </a>
          </div>
        </div>

        {/* links */}
        <div className="grid grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className={footerStyles.section}>Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className={footerStyles.link}>
                  Features
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Security
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={footerStyles.section}>Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className={footerStyles.link}>
                  About
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Careers
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={footerStyles.section}>Resources</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className={footerStyles.link}>
                  Docs
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  API
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Support
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={footerStyles.section}>Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className={footerStyles.link}>
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className={footerStyles.link}>
                  Cookies
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* copyright */}
        <div className={`pt-8 border-t ${footerStyles.divider} text-center`}>
          <p className={footerStyles.copyright}>
            &copy; {currentYear} Podpilot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
