import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface AppConfig {
  credentials?: {
    source: 'xtream' | 'm3u';
    server?: string;
    username?: string;
    password?: string;
    listName?: string;
    url?: string;
  };
}

const CONFIG_FILE = 'config.json';

/**
 * Persists and loads app configuration (credentials, preferences).
 * Config is stored as a JSON file in the Electron userData directory.
 */
export class ConfigService {
  private filePath: string;

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, CONFIG_FILE);
  }

  private read(): AppConfig {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw) as AppConfig;
      }
    } catch {
      // Corrupted config — start fresh
    }
    return {};
  }

  private write(config: AppConfig): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf8');
  }

  /**
   * Save ingest credentials after a successful ingest.
   */
  saveCredentials(credentials: AppConfig['credentials']): void {
    const config = this.read();
    config.credentials = credentials;
    this.write(config);
  }

  /**
   * Load saved credentials, or null if none exist.
   */
  loadCredentials(): AppConfig['credentials'] | null {
    return this.read().credentials ?? null;
  }

  hasSource(): { configured: boolean } {
    return { configured: this.isConfigured(this.loadCredentials()) };
  }

  sourceSummary(): { configured: boolean; listName?: string; source?: 'xtream' | 'm3u' } {
    const credentials = this.loadCredentials();
    if (!this.isConfigured(credentials)) {
      return { configured: false };
    }
    return {
      configured: true,
      listName: credentials!.listName,
      source: this.inferSource(credentials!),
    };
  }

  private isConfigured(credentials: AppConfig['credentials'] | null): credentials is NonNullable<AppConfig['credentials']> {
    if (!credentials) return false;
    return Boolean(
      credentials.source ||
        credentials.server ||
        credentials.username ||
        credentials.password ||
        credentials.url ||
        credentials.listName,
    );
  }

  private inferSource(credentials: NonNullable<AppConfig['credentials']>): 'xtream' | 'm3u' {
    if (credentials.source === 'm3u' || credentials.source === 'xtream') {
      return credentials.source;
    }
    if (credentials.url && !credentials.server) return 'm3u';
    return 'xtream';
  }
}
