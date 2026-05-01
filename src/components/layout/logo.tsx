/**
 * Premium Steel Buildings logo + brand text.
 * Generic placeholder until brand assets are provided.
 */
export function Logo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const boxSize = size === "small" ? "h-8 w-8" : size === "large" ? "h-14 w-14" : "h-10 w-10";
  const textSize = size === "small" ? "text-sm" : size === "large" ? "text-2xl" : "text-lg";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${boxSize} flex items-center justify-center rounded bg-foreground text-background font-bold`}
      >
        PSB
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`${textSize} font-bold tracking-tight`}>
          Premium Steel Buildings
        </span>
      </div>
    </div>
  );
}

export function LogoIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <div
      className={`${className} flex items-center justify-center rounded bg-foreground text-[10px] font-bold text-background`}
    >
      PSB
    </div>
  );
}
