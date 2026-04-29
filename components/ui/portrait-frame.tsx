import { Camera, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type PortraitFrameProps = {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
  placeholderLabel?: string;
};

const sizeClasses = {
  sm: "w-full",
  md: "w-48",
  lg: "w-full max-w-sm",
  full: "w-full",
};

export function PortraitFrame({
  src,
  alt,
  size = "md",
  className,
  placeholderLabel = "Generate Portrait",
}: PortraitFrameProps) {
  const imageSrc = src && !src.startsWith("http") && !src.startsWith("/") ? `/api/storage/view?key=${encodeURIComponent(src)}` : src;

  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-lg border bg-zinc-950",
        sizeClasses[size],
        className
      )}
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)",
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-200 to-zinc-400 text-zinc-700">
          <UserRound className="h-16 w-16 opacity-70" />
          <div className="flex items-center gap-2 rounded-md bg-white/50 px-3 py-1.5 text-xs font-medium text-zinc-800">
            <Camera className="h-3.5 w-3.5" />
            {placeholderLabel}
          </div>
        </div>
      )}
      {size === "sm" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, #000 0 1px, transparent 1px)",
            backgroundSize: "7px 7px, 11px 11px",
          }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)" }}
      />
    </div>
  );
}
