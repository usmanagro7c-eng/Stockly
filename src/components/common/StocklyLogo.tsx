import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface StocklyLogoProps {
  className?: string;
  alt?: string;
}

export function StocklyLogo({ className, alt = "Stockly Logo" }: StocklyLogoProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const logoSrc = isLight ? "/Stockly-Logo-light.png" : "/Stockly-Logo-dark.png";

  return (
    <img
      src={logoSrc}
      alt={alt}
      className={cn(
        "object-contain transition-all duration-200 select-none",
        isLight ? "filter drop-shadow-xs" : "filter drop-shadow-md",
        className,
      )}
    />
  );
}
