export const DEFAULT_MODEL = "claude-sonnet-4-6";

export const STAGES = ["new", "working", "followup", "meeting", "dead"] as const;
export type Stage = (typeof STAGES)[number];

export const TIERS = ["1", "2", "3", "4"] as const;
export type Tier = (typeof TIERS)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  working: "Working",
  followup: "Follow-up",
  meeting: "Meeting",
  dead: "Dead",
};
