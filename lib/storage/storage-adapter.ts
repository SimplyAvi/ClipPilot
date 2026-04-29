export interface StoredFile {
  path: string;
  backend: "local" | "r2";
  url: string;
  sizeBytes: number;
  mimeType: string;
  metadata?: Record<string, string>;
}

export interface StorageAdapter {
  save(
    relativePath: string,
    data: Buffer,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<StoredFile>;

  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  getUrl(relativePath: string): string;
  initProjectFolders(projectSlug: string, projectName?: string): Promise<void>;
  getProjectSize(projectSlug: string): Promise<number>;
}
