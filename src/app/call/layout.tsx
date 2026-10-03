import "@livekit/components-styles";

import { redirect } from "next/navigation";

import { createTRPCContext } from "@/trpc/init";

export default async function CallLayout({ children }: { children: React.ReactNode }) {
  const { session } = await createTRPCContext();

  if (!session) {
    redirect("/sign-in");
  }

  return <div className="h-svh bg-black text-white">{children}</div>;
}
