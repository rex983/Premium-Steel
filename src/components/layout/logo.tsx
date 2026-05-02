import Image from "next/image";

export function Logo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const heightPx = size === "small" ? 32 : size === "large" ? 80 : 40;
  const widthPx = Math.round(heightPx * (580 / 250));

  return (
    <Image
      src="/logo.png"
      alt="Premium Steel Buildings"
      width={widthPx}
      height={heightPx}
      priority={size === "large"}
      style={{ height: heightPx, width: "auto" }}
    />
  );
}

export function LogoIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Premium Steel Buildings"
      width={24}
      height={24}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
