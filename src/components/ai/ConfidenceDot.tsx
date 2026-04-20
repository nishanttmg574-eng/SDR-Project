import type { Confidence } from "@/lib/types";

const COLORS: Record<Confidence, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

const LABELS: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function ConfidenceDot({
  confidence,
  size = "md",
}: {
  confidence: Confidence | null;
  size?: "sm" | "md";
}) {
  if (!confidence) return null;
  const dim = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <span
      className={`inline-block rounded-full ${dim} ${COLORS[confidence]}`}
      title={LABELS[confidence]}
      aria-label={LABELS[confidence]}
    />
  );
}
