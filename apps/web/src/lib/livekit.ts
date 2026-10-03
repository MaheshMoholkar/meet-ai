import "server-only";

import {
  AccessToken,
  EncodedFileOutput,
  EncodedFileType,
  RoomAgentDispatch,
  RoomCompositeEgressRequest,
  RoomEgress,
  RoomServiceClient,
  S3Upload,
  WebhookReceiver,
} from "livekit-server-sdk";

import { env } from "@/env";
import { recordingKeyFor } from "@/modules/meetings/recording";

export const roomService = new RoomServiceClient(
  env.LIVEKIT_URL,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

export const webhookReceiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

/** What the voice agent receives as dispatch metadata (spec §4.1). */
export interface AgentJobMetadata {
  meetingId: string;
  agentName: string;
  instructions: string;
  maxDurationSec: number;
}

function recordingEgress(meetingId: string) {
  return new RoomEgress({
    room: new RoomCompositeEgressRequest({
      audioOnly: true,
      fileOutputs: [
        new EncodedFileOutput({
          fileType: EncodedFileType.MP4,
          filepath: recordingKeyFor(meetingId),
          output: {
            case: "s3",
            value: new S3Upload({
              bucket: env.S3_BUCKET,
              region: env.AWS_REGION,
              // Local emulator only. In AWS the keys are empty and Egress is expected to
              // fall back to the EC2 instance role (unverified until the first deploy).
              endpoint: env.EGRESS_S3_ENDPOINT ?? "",
              forcePathStyle: Boolean(env.EGRESS_S3_ENDPOINT),
              accessKey: env.AWS_ACCESS_KEY_ID ?? "",
              secret: env.AWS_SECRET_ACCESS_KEY ?? "",
            }),
          },
        }),
      ],
    }),
  });
}

/**
 * Creates the meeting's room with the voice agent dispatched into it and audio
 * recording started. Creating a room that already exists returns it unchanged,
 * so rejoining an active meeting doesn't dispatch a second agent.
 */
export async function createMeetingRoom(metadata: AgentJobMetadata) {
  return roomService.createRoom({
    name: metadata.meetingId,
    emptyTimeout: 60,
    departureTimeout: 20,
    maxParticipants: 4,
    agents: [
      new RoomAgentDispatch({
        agentName: env.LIVEKIT_AGENT_NAME,
        metadata: JSON.stringify(metadata),
      }),
    ],
    egress: env.RECORDING_ENABLED ? recordingEgress(metadata.meetingId) : undefined,
  });
}

/** A one-hour token that lets one user join one room. */
export async function createParticipantToken({
  identity,
  name,
  room,
}: {
  identity: string;
  name: string;
  room: string;
}) {
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "1h",
  });
  token.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  return token.toJwt();
}
