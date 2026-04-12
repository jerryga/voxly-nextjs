import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { InviteAcceptClient } from "./InviteAcceptClient";

type InviteAcceptPageProps = {
  params: Promise<{ token: string }>;
};

export default async function InviteAcceptPage({ params }: InviteAcceptPageProps) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    const callbackUrl = `/invite/${encodeURIComponent(token)}`;
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}&invite=1`);
  }

  return <InviteAcceptClient token={token} />;
}
