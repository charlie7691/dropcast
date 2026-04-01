import { handle } from "hono/aws-lambda";
import app from "./handler.js";
import { setStorage } from "./services/storage.js";
import { S3Storage } from "./services/storage-s3.js";

const bucket = process.env.DATA_BUCKET!;
const region = process.env.AWS_REGION || "eu-west-1";

setStorage(new S3Storage(bucket, region));

export const handler = handle(app);
