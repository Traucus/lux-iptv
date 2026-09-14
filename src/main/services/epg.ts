export type EpgProgramme = {
  title: string;
  description: string | null;
  startAt: number;
  endAt: number;
};

export type EpgNowNext = {
  now: EpgProgramme | null;
  next: EpgProgramme | null;
};

export function decodeEpgField(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (!/^[A-Za-z0-9+/]+=*$/.test(raw) || raw.length % 4 !== 0) {
    return raw;
  }
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8').trim();
    if (decoded && !decoded.includes('\0')) {
      return decoded;
    }
  } catch {
    // Plain text titles are valid.
  }
  return raw;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber < 1e12 ? asNumber * 1000 : asNumber;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseXtreamShortEpg(payload: unknown): EpgProgramme[] {
  const listings = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { epg_listings?: unknown }).epg_listings)
      ? (payload as { epg_listings: unknown[] }).epg_listings
      : [];

  const programmes: EpgProgramme[] = [];
  for (const raw of listings) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const startAt = toEpochMs(row.start_timestamp ?? row.start);
    const endAt = toEpochMs(row.stop_timestamp ?? row.end_timestamp ?? row.end);
    const title = decodeEpgField(typeof row.title === 'string' ? row.title : '');
    if (!startAt || !endAt || !title || endAt <= startAt) continue;
    programmes.push({
      title,
      description: decodeEpgField(typeof row.description === 'string' ? row.description : '') || null,
      startAt,
      endAt,
    });
  }
  return programmes.sort((a, b) => a.startAt - b.startAt);
}

export function pickNowNext(programmes: EpgProgramme[], now = Date.now()): EpgNowNext {
  const current = programmes.find((item) => item.startAt <= now && now < item.endAt) ?? null;
  const upcoming = programmes
    .filter((item) => item.startAt >= (current?.endAt ?? now))
    .sort((a, b) => a.startAt - b.startAt)[0] ?? null;
  return { now: current, next: upcoming };
}
