import { redirect } from "next/navigation";

import { createTRPCContext } from "@/trpc/init";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { session } = await createTRPCContext();

  if (session) {
    redirect("/meetings");
  }

  return children;
}
