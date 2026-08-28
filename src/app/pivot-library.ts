export type PivotKind =
  | "grounding"
  | "breathing-focus"
  | "reaching-out"
  | "basic-needs-reset"
  | "task-first-step";

export type Pivot = {
  id: string;
  kind: PivotKind;
  title: string;
  instruction: string;
};

export const PIVOT_LIBRARY: readonly Pivot[] = [
  {
    id: "grounding-five-things",
    kind: "grounding",
    title: "Notice five things around you",
    instruction: "Name five things you can see, four you can feel, and three you can hear."
  },
  {
    id: "breathing-four-six",
    kind: "breathing-focus",
    title: "Take five slower breaths",
    instruction: "Breathe in for four counts and out for six. Repeat five times without forcing it."
  },
  {
    id: "reaching-out-small-message",
    kind: "reaching-out",
    title: "Send one honest message",
    instruction: "Text someone you trust: “I am having a hard moment. Can you check in with me later?”"
  },
  {
    id: "basic-needs-water",
    kind: "basic-needs-reset",
    title: "Make one basic reset",
    instruction: "Get a glass of water, take a few bites, or move somewhere a little more comfortable."
  },
  {
    id: "task-first-visible-step",
    kind: "task-first-step",
    title: "Make the next step visible",
    instruction: "Write the smallest action that takes less than ten minutes, then do only that action."
  }
];

export function getPivotByKind(kind: string): Pivot | undefined {
  return PIVOT_LIBRARY.find((pivot) => pivot.kind === kind);
}
