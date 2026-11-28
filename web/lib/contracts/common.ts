/**
 * Shared list / audit / notification view-models.
 * STATUS: PROPOSED v0 (frontend). Physical schemas are agreed with Codex after the Phase 0 audit.
 */
export interface Paged<T> {
  items: T[];
  page: number; // 1-based
  pageSize: number;
  /** Total rows when the server can count cheaply; null = unknown (use hasMore). */
  total: number | null;
  hasMore?: boolean;
}

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

/** Common fields every business entity should expose (Master Spec). */
export interface EntityBase {
  id: string; // internal UUID
  publicId: string; // e.g. THH-TSK-000001
  status: string;
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
  version: number; // positive integer
}

export interface AuditEvent {
  schemaVersion: 1;
  id: string;
  at: string; // ISO UTC
  actor: { publicId: string; name: string };
  action: string;
  resource: { kind: string; id: string; label?: string };
  /** Redacted by the server. Never contains passwords, OTPs or tokens. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  requestId?: string;
}

export interface Notification {
  schemaVersion: 1;
  id: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
  createdAt: string;
  readAt?: string | null;
}
