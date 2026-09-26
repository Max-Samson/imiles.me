export type AdminApiErrorKind =
  | 'session-expired'
  | 'forbidden'
  | 'network'
  | 'invalid-response'
  | 'api';

export class AdminApiError extends Error {
  constructor(
    readonly kind: AdminApiErrorKind,
    message: string,
    readonly requestId?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}
