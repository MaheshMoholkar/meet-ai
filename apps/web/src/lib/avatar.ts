import { botttsNeutral, initials } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

export type AvatarVariant = "botttsNeutral" | "initials";

/** Deterministic avatar data URI: robots for agents, initials for people. */
export function generateAvatarUri({ seed, variant }: { seed: string; variant: AvatarVariant }) {
  const avatar =
    variant === "botttsNeutral"
      ? createAvatar(botttsNeutral, { seed })
      : createAvatar(initials, { seed, fontWeight: 500, fontSize: 42 });

  return avatar.toDataUri();
}
