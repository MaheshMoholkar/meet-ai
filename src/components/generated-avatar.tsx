import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAvatarUri, type AvatarVariant } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface Props {
  seed: string;
  variant: AvatarVariant;
  imageUrl?: string | null;
  className?: string;
}

export function GeneratedAvatar({ seed, variant, imageUrl, className }: Props) {
  return (
    <Avatar className={cn("border", className)}>
      <AvatarImage src={imageUrl ?? generateAvatarUri({ seed, variant })} alt="" />
      <AvatarFallback>{seed.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
