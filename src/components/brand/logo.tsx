import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

const sizeMap = {
  sm: "h-6 w-6",
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
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg bg-primary",
          sizeMap[size]
        )}
      >
        {/* Stylized "F" mark */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[60%] w-[60%]"
        >
          <path
            d="M8 6h16v4H12v4h10v4H12v10H8V6z"
            fill="currentColor"
            className="text-primary-foreground"
          />
          <path
            d="M20 18l6 10h-5l-4-7"
            fill="currentColor"
            className="text-primary-foreground opacity-70"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-bold tracking-tight text-foreground",
              textSizeMap[size]
            )}
          >
            Fini<span className="text-primary">Tax</span>
          </span>
          {size === "xl" && (
            <span className="mt-0.5 text-xs text-muted-foreground tracking-wide">
              Contabilidad Inteligente
            </span>
          )}
        </div>
      )}
    </div>
  );
}
