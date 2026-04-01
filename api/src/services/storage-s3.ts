import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { Storage } from "./storage.js";

export class S3Storage implements Storage {
  private client: S3Client;

  constructor(private bucket: string, region?: string) {
    this.client = new S3Client({ region });
  }

  async readJson<T>(key: string): Promise<T | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const body = await res.Body?.transformToString("utf-8");
      return body ? (JSON.parse(body) as T) : null;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async writeJson(key: string, data: unknown): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: "application/json",
      })
    );
  }

  async readText(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return (await res.Body?.transformToString("utf-8")) || null;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async writeText(key: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: key.endsWith(".xml")
          ? "application/rss+xml"
          : "text/plain",
      })
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async list(prefix: string): Promise<string[]> {
    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
      })
    );
    return (res.Contents || [])
      .map((obj) => obj.Key!)
      .filter(Boolean);
  }
}
