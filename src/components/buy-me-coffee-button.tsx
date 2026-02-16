import { cn } from "@/lib/utils";

interface BuyMeCoffeeButtonProps {
  className?: string;
  dataTestId?: string;
}

export function BuyMeCoffeeButton({ className, dataTestId }: BuyMeCoffeeButtonProps) {
  return (
    <a
      href="https://www.buymeacoffee.com/Just_Stuff_TM"
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center justify-center", className)}
      data-testid={dataTestId}
      aria-label="Buy Me A Coffee"
    >
      <img
        src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
        alt="Buy Me A Coffee"
        width={217}
        height={60}
        style={{ width: "217px", height: "60px" }}
      />
    </a>
  );
}
