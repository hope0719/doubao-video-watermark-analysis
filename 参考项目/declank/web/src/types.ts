export type Mode = "all" | "visible" | "metadata" | "invisible";

export type RunState = "empty" | "ready" | "processing" | "complete" | "error";

export type CompareView = "compare" | "before" | "after";

export interface AdvancedValues {
  mark: string;
  strength: string;
  steps: string;
  maxResolution: string;
  humanize: string;
  pipeline: string;
  device: string;
}

export const EMPTY_ADVANCED: AdvancedValues = {
  mark: "auto",
  strength: "",
  steps: "",
  maxResolution: "",
  humanize: "",
  pipeline: "",
  device: "",
};

export const MODES: { id: Mode; label: string }[] = [
  {
    id: "all",
    label: "All",
  },
  {
    id: "visible",
    label: "Visible",
  },
  {
    id: "metadata",
    label: "Metadata",
  },
  {
    id: "invisible",
    label: "Invisible",
  },
];

export const MARKS = ["auto", "gemini", "doubao", "jimeng", "samsung"];
