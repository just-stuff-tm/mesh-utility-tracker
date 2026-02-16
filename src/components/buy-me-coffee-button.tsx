import { useEffect, useRef } from "react";

interface BuyMeCoffeeButtonProps {
  className?: string;
  dataTestId?: string;
}

export function BuyMeCoffeeButton({ className, dataTestId }: BuyMeCoffeeButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js";
    script.setAttribute("data-name", "bmc-button");
    script.setAttribute("data-slug", "Just_Stuff_TM");
    script.setAttribute("data-color", "#FFDD00");
    script.setAttribute("data-emoji", "");
    script.setAttribute("data-font", "Cookie");
    script.setAttribute("data-text", "Buy me a coffee");
    script.setAttribute("data-outline-color", "#000000");
    script.setAttribute("data-font-color", "#000000");
    script.setAttribute("data-coffee-color", "#ffffff");

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return <div ref={containerRef} className={className} data-testid={dataTestId} />;
}

