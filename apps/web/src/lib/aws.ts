import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";

// With AWS_ENDPOINT_URL set (local emulator) use it and static keys; otherwise
// the SDK's default chain (IAM role in AWS).
const common = {
  region: env.AWS_REGION,
  ...(env.AWS_ENDPOINT_URL ? { endpoint: env.AWS_ENDPOINT_URL } : {}),
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
};

export const s3 = new S3Client({ ...common, forcePathStyle: Boolean(env.AWS_ENDPOINT_URL) });
export const sqs = new SQSClient(common);

export async function readObjectText(key: string) {
  const response = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return (await response.Body?.transformToString("utf-8")) ?? "";
}

/** A short-lived GET link for the browser. */
export function presignedGetUrl(key: string, expiresInSeconds = 15 * 60) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}
