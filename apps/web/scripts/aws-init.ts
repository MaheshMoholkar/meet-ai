/**
 * Creates the S3 bucket and SQS queues in the local AWS emulator (idempotent).
 * In AWS these are created by infrastructure code instead (sub-project 4).
 */
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SQSClient,
  SetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

// The whole stack (web, worker, agent, speech) shares one .env at the repository
// root; every tool here runs from apps/web. Existing variables are never overridden.
try {
  process.loadEnvFile("../../.env");
} catch {
  // No .env file: rely on the process environment (CI, containers).
}

const endpoint = process.env.AWS_ENDPOINT_URL;
const bucket = process.env.S3_BUCKET ?? "meetai";
const queueName = (process.env.SQS_QUEUE_URL ?? "meetai-summarize").split("/").pop()!;

if (!endpoint) {
  console.error("AWS_ENDPOINT_URL is not set; this script only targets the local emulator.");
  process.exit(1);
}

const common = {
  endpoint,
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
};

const s3 = new S3Client({ ...common, forcePathStyle: true });
const sqs = new SQSClient(common);

try {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
} catch (error) {
  const name = (error as { name?: string }).name;
  if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") throw error;
}

const { QueueUrl: dlqUrl } = await sqs.send(new CreateQueueCommand({ QueueName: `${queueName}-dlq` }));
const { Attributes } = await sqs.send(
  new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ["QueueArn"] }),
);
const { QueueUrl } = await sqs.send(
  new CreateQueueCommand({ QueueName: queueName, Attributes: { VisibilityTimeout: "180" } }),
);
await sqs.send(
  new SetQueueAttributesCommand({
    QueueUrl,
    Attributes: {
      RedrivePolicy: JSON.stringify({ deadLetterTargetArn: Attributes!.QueueArn, maxReceiveCount: "3" }),
    },
  }),
);

console.log(`S3 bucket "${bucket}" and SQS queue ${QueueUrl} (DLQ after 3 receives) are ready.`);
