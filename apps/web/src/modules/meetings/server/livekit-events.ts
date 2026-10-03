import { EgressStatus, type WebhookEvent } from "livekit-server-sdk";
import { z } from "zod";

import { recordingKeyFor } from "../recording";
import { markActive, markProcessing, setRecordingKey } from "./lifecycle";

// ParticipantInfo.Kind.STANDARD in LiveKit's protocol: a person. The agent (4)
// and the Egress recorder (2) join the room too and must not start the meeting.
const STANDARD_PARTICIPANT_KIND = 0;

// Rooms are named after meeting ids; anything else isn't ours.
const meetingId = z.uuid();

/** Applies a verified LiveKit webhook event to the meeting it belongs to (spec §5.2). */
export async function handleLiveKitEvent(event: WebhookEvent) {
  switch (event.event) {
    case "participant_joined": {
      const room = meetingId.safeParse(event.room?.name);
      if (room.success && event.participant?.kind === STANDARD_PARTICIPANT_KIND) {
        await markActive(room.data);
      }
      return;
    }
    case "room_finished": {
      const room = meetingId.safeParse(event.room?.name);
      if (room.success) await markProcessing(room.data);
      return;
    }
    case "egress_ended": {
      const room = meetingId.safeParse(event.egressInfo?.roomName);
      if (room.success && event.egressInfo?.status === EgressStatus.EGRESS_COMPLETE) {
        await setRecordingKey(room.data, recordingKeyFor(room.data));
      }
      return;
    }
  }
}
