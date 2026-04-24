import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  href?: string;
  asChild?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      href,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    // Base styles applied to all buttons
    const baseStyles =
      "text-base rounded-lg transition-all duration-200 font-sans inline-flex items-center justify-center whitespace-nowrap";

    // Variant styles
    const variantStyles = {
      primary: "bg-dark text-light hover:bg-neutral-700 active:bg-neutral-900",
      secondary:
        "bg-primary-500 text-light hover:bg-primary-600 active:bg-primary-700",
      outline:
        "border border-neutral-300 text-neutral-500 hover:bg-light hover:text-light-primary active:bg-neutral-100 hover:bg-light-secondary active:text-light-primary",
    };

    // Size styles
    const sizeStyles = {
      sm: "px-4 py-2 text-xs",
      md: "px-6 py-2 text-sm",
      lg: "px-8 py-4 text-base",
    };

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    // If href is provided, render as a link
    if (href) {
      return (
        <a
          href={href}
          className={combinedClassName}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
        </a>
      );
    }

    // Otherwise render as button
    return (
      <button ref={ref} className={combinedClassName} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
