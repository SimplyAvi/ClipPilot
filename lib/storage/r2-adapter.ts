import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, StoredFile } from "./storage-adapter";

export class R2StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error("Cloudflare R2 is not fully configured");
    }

    this.bucket = bucket;
    this.publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async save(
    relativePath: string,
    data: Buffer,
    mimeType: string,
    metadata: Record<string, string> = {}
  ): Promise<StoredFile> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: relativePath,
        Body: data,
        ContentType: mimeType,
        Metadata: metadata,
      })
    );
    return {
      path: relativePath,
      backend: "r2",
      url: this.getUrl(relativePath),
      sizeBytes: data.byteLength,
      mimeType,
      metadata,
    };
  }

  async read(relativePath: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: relativePath })
    );
    if (!response.Body) throw new Error(`R2 object not found: ${relativePath}`);

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(relativePath: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: relativePath }));
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: relativePath }));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      keys.push(...(response.Contents ?? []).flatMap((item) => (item.Key ? [item.Key] : [])));
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return keys;
  }

  getUrl(relativePath: string): string {
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${relativePath}`;
    return `/api/storage/view?key=${encodeURIComponent(relativePath)}`;
  }

  async initProjectFolders(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async getProjectSize(projectSlug: string): Promise<number> {
    let total = 0;
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${projectSlug}/`,
          ContinuationToken: continuationToken,
        })
      );
      total += (response.Contents ?? []).reduce((sum, item) => sum + (item.Size ?? 0), 0);
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return total;
  }

  async getSignedUrl(relativePath: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: relativePath }),
      { expiresIn: expiresInSeconds }
    );
  }
}
