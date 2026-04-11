import { InviteAcceptClient } from "./InviteAcceptClient";

type InviteAcceptPageProps = {
  params: Promise<{ token: string }>;
};

export default async function InviteAcceptPage({ params }: InviteAcceptPageProps) {
  const { token } = await params;
  return <InviteAcceptClient token={token} />;
}
