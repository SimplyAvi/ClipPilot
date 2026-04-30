"use client";

import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VariantComparisonProps {
  variants: string[];
  approvedIndex: number;
  onApprove: (index: number) => void;
  onRegenerate: () => void;
  label: string;
}

export function VariantComparison({
  variants,
  approvedIndex,
  onApprove,
  onRegenerate,
  label,
}: VariantComparisonProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{label}</h2>
          <p className="text-sm text-muted-foreground">
            Compare generated variants side by side and choose the version used downstream.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRegenerate}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Generate New Variants
        </Button>
      </div>

      <div
        className={cn(
          "grid gap-4",
          variants.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {variants.map((url, index) => {
          const approved = index === approvedIndex;
          const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
          return (
            <article
              key={`${url}-${index}`}
              className={cn(
                "overflow-hidden rounded-lg border bg-card",
                approved && "border-green-500 ring-2 ring-green-500/30"
              )}
            >
              <div className="aspect-video bg-black">
                {isVideo ? (
                  <video src={url} controls className="h-full w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`${label} variant ${index + 1}`} className="h-full w-full object-contain" />
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm font-medium">Variant {index + 1}</span>
                <Button
                  type="button"
                  size="sm"
                  variant={approved ? "secondary" : "default"}
                  onClick={() => onApprove(index)}
                  disabled={approved}
                >
                  {approved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Currently In Use
                    </>
                  ) : (
                    "Use This"
                  )}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
