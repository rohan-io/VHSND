import type { Theme } from "@/src/constants/theme";

// Alert / severity ramp. HIGH is a vivid alarm orange, deliberately hotter and
// redder than the muted terracotta brand so severity never reads as chrome.
export const priorityColor = (t: Theme): Record<string, string> => ({
  CRITICAL: t.colors.error,
  HIGH: t.name === "dark" ? "#FB923C" : "#EA580C",
  MEDIUM: t.colors.warning,
  LOW: t.colors.info,
});
