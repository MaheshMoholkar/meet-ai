import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAgentAvatarUri, initialsOf, type AvatarVariant } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface Props {
  /** The name the face or the initials come from. */
  seed: string;
  /** `botttsNeutral`: a robot on agent blue. `initials`: a person, on `you`. */
  variant: AvatarVariant;
  imageUrl?: string | null;
  className?: string;
}

/** A face for every voice: agents are robots on blue, people are initials on yellow. */
export function GeneratedAvatar({ seed, variant, imageUrl, className }: Props) {
  const isPerson = variant === "initials";
  const src = imageUrl ?? (isPerson ? null : generateAgentAvatarUri(seed));

  return (
    <Avatar className={cn("@container", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className={cn(
          "text-[length:38cqi] leading-none font-semibold",
          isPerson && "bg-you text-you-foreground",
        )}
      >
        {initialsOf(seed)}
      </AvatarFallback>
    </Avatar>
  );
}
