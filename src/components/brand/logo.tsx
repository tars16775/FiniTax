import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

const sizeMap = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

const textSizeMap = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Logo Mark */}
      <div className={cn("relative flex items-center justify-center", sizeMap[size])}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          {/* Background shape — rounded square with gradient */}
          <defs>
            <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--info)" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill="url(#logo-gradient)" />
          {/* Stylized "F" lettermark */}
          <path
            d="M12 9h17v4.5H17v4h10v4.5H17v9H12V9z"
            fill="white"
            fillOpacity="0.95"
          />
          {/* Accent slash for "Tax" */}
          <path
            d="M22 22l7 9h-5.5l-5-6.5L22 22z"
            fill="white"
            fillOpacity="0.55"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-bold tracking-tight text-foreground", textSizeMap[size])}>
            Fini<span className="text-primary">Tax</span>
          </span>
          {(size === "xl" || size === "lg") && (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Contabilidad Inteligente
            </span>
          )}
        </div>
      )}
    </div>
  );
}
