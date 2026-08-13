export type VoucherErrorStage =
  | 'request'
  | 'configuration'
  | 'receipt'
  | 'authority'
  | 'artifact'
  | 'storage'
  | 'rate_limit';

export type VoucherErrorCode =
  | 'invalid_request'
  | 'service_not_configured'
  | 'rate_limited'
  | 'receipt_not_eligible'
  | 'ticket_not_authorized'
  | 'artifact_unavailable'
  | 'storage_unavailable';

export type VoucherErrorResponse = {
  /** Compatibility field retained for existing frontend callers. */
  error: string;
  stage: VoucherErrorStage;
  code: VoucherErrorCode;
  message: string;
  requestId: string;
};

export class VoucherServiceError extends Error {
  public readonly stage: VoucherErrorStage;
  public readonly code: VoucherErrorCode;
  public readonly status: 400 | 422 | 429 | 503;

  public constructor(
    stage: VoucherErrorStage,
    code: VoucherErrorCode,
    message: string,
    status: 400 | 422 | 429 | 503,
  ) {
    super(message);
    this.name = 'VoucherServiceError';
    this.stage = stage;
    this.code = code;
    this.status = status;
  }
}

export function voucherErrorResponse(
  error: VoucherServiceError,
  requestId: string,
): VoucherErrorResponse {
  return {
    error: error.message,
    stage: error.stage,
    code: error.code,
    message: error.message,
    requestId,
  };
}
