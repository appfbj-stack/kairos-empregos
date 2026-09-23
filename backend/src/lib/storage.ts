/**
 * Storage abstrato para currículos PDF.
 * Fase 1: driver local (volume Docker).
 * Fase futura: trocar para S3-compatible sem mudar API.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';

export interface StorageDriver {
  save(key: string, data: Buffer): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  stream(key: string): NodeJS.ReadableStream;
}

class LocalStorage implements StorageDriver {
  constructor(private basePath: string) {
    fs.mkdir(this.basePath, { recursive: true }).catch(() => {});
  }

  private resolve(key: string): string {
    // Bloqueia path traversal
    const safe = key.replace(/[\\]/g, '/').replace(/\.\.+/g, '');
    const full = path.join(this.basePath, safe);
    const base = path.resolve(this.basePath);
    const fullNormalized = process.platform === 'win32' ? full.toLowerCase() : full;
    const baseNormalized = process.platform === 'win32' ? base.toLowerCase() : base;
    if (!fullNormalized.startsWith(baseNormalized)) {
      throw new Error('Path inválido');
    }
    return full;
  }

  async save(key: string, data: Buffer): Promise<string> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  stream(key: string): NodeJS.ReadableStream {
    return createReadStream(this.resolve(key));
  }
}

// Stub S3 para fase futura (não implementado ainda, mas a interface existe)
class S3Stub implements StorageDriver {
  save(): Promise<string> {
    throw new Error('S3 driver não implementado ainda (Fase futura)');
  }
  read(): Promise<Buffer> {
    throw new Error('S3 driver não implementado ainda');
  }
  delete(): Promise<void> {
    throw new Error('S3 driver não implementado ainda');
  }
  exists(): Promise<boolean> {
    throw new Error('S3 driver não implementado ainda');
  }
  stream(): NodeJS.ReadableStream {
    throw new Error('S3 driver não implementado ainda');
  }
}

const driver = process.env.STORAGE_DRIVER || 'local';

// Resolve path absoluto: env > ./storage relativo à raiz do backend
function resolveLocalBasePath(): string {
  if (process.env.STORAGE_LOCAL_PATH) return path.resolve(process.env.STORAGE_LOCAL_PATH);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../storage');
}

export const storage: StorageDriver =
  driver === 's3'
    ? new S3Stub()
    : new LocalStorage(resolveLocalBasePath());

export const STORAGE_DRIVER_NAME = driver;