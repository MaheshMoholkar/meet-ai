import type { WebhookEvent } from "livekit-server-sdk";

import { webhookReceiver } from "@/lib/livekit";
import { handleLiveKitEvent } from "@/modules/meetings/server/livekit-events";

export async function POST(request: Request) {
  const body = await request.text();

  let event: WebhookEvent;
  try {
    // Verifies the JWT in the Authorization header, including the body's hash.
    event = await webhookReceiver.receive(body, request.headers.get("Authorization") ?? undefined);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.info(
    `[livekit] ${event.event} room=${event.room?.name ?? event.egressInfo?.roomName ?? "-"}` +
      (event.participant ? ` participant=${event.participant.identity} kind=${event.participant.kind}` : ""),
  );
  await handleLiveKitEvent(event);
  return Response.json({ ok: true });
}
