import { botttsNeutral } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

export type AvatarVariant = "botttsNeutral" | "initials";

// Agents are kin: every generated face sits on a blue from the agent family.
const AGENT_GROUNDS = ["3162ec", "5b84f5", "8bb4ff", "b9d0ff"];

/** Deterministic robot face for an agent, as a data URI. */
export function generateAgentAvatarUri(seed: string) {
  return createAvatar(botttsNeutral, { seed, backgroundColor: AGENT_GROUNDS }).toDataUri();
}

/** "Ada Lovelace" → "AL", "ada" → "A". */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}
