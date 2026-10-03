/**
 * Summarizer worker (spec §6.2): long-polls SQS for finished calls, turns each
 * transcript into a summary, and deletes the message only on success, so SQS
 * redelivers failures (3 receives, then the dead-letter queue).
 */
import "./load-env";

import { DeleteMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { z } from "zod";

import { env } from "@/env";
import { sqs } from "@/lib/aws";
import { processMeeting } from "@/modules/meetings/server/summarize";

const messageSchema = z.object({
  meetingId: z.uuid(),
  transcriptKey: z.string().min(1),
});

const stop = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal}: finishing the current message, then exiting`);
    stop.abort();
  });
}

async function handle(body: string | undefined) {
  const message = messageSchema.parse(JSON.parse(body ?? ""));
  const started = Date.now();
  const result = await processMeeting(message);
  console.log(`[worker] meeting ${message.meetingId}: ${result} in ${Date.now() - started} ms`);
}

console.log(`[worker] polling ${env.SQS_QUEUE_URL}`);

while (!stop.signal.aborted) {
  let messages;
  try {
    ({ Messages: messages } = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
      }),
      { abortSignal: stop.signal },
    ));
  } catch (error) {
    if (stop.signal.aborted) break;
    console.error("[worker] receive failed, retrying in 5 s:", error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    continue;
  }

  for (const message of messages ?? []) {
    try {
      await handle(message.Body);
      await sqs.send(
        new DeleteMessageCommand({ QueueUrl: env.SQS_QUEUE_URL, ReceiptHandle: message.ReceiptHandle }),
      );
    } catch (error) {
      // Left on the queue: SQS makes it visible again after the visibility timeout.
      console.error(`[worker] message ${message.MessageId} failed:`, error);
    }
  }
}

process.exit(0);
