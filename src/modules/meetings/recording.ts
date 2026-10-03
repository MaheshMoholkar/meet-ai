/** S3 key of a meeting's audio recording, written by LiveKit Egress. */
export const recordingKeyFor = (meetingId: string) => `recordings/${meetingId}.mp4`;
