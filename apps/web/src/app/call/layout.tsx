import { redirect } from "next/navigation";

import { createTRPCContext } from "@/trpc/init";

export default async function CallLayout({ children }: { children: React.ReactNode }) {
  const { session } = await createTRPCContext();

  if (!session) {
    redirect("/sign-in");
  }

  // Sound is shown on Night: the call screen is dark whatever the app's theme.
  return <div className="dark h-svh bg-background text-foreground">{children}</div>;
}
