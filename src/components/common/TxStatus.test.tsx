// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanetVoucherServiceError } from '@/lib/planetVoucher';
import { TxStatus } from './TxStatus';

describe('TxStatus', () => {
  afterEach(cleanup);

  it('renders the safe voucher preflight message and request reference', () => {
    const error = new PlanetVoucherServiceError(
      'receipt',
      'receipt_not_eligible',
      'Ticket is not eligible for a Planet voucher.',
      'reveal-218-5',
    );

    render(<TxStatus hash={undefined} isPending={false} isSuccess={false} error={error} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Ticket is not eligible for a Planet voucher.');
    expect(status).toHaveTextContent('Reference reveal-218-5');
    expect(status).toHaveAttribute('data-error-stage', 'receipt');
    expect(status).toHaveAttribute('data-error-code', 'receipt_not_eligible');
    expect(status).toHaveAttribute('data-request-id', 'reveal-218-5');
    expect(status).not.toHaveTextContent('Transaction failed');
  });

  it('keeps generic copy for write and receipt errors', () => {
    const error = new Error('execution reverted: raw provider details');

    render(<TxStatus hash={undefined} isPending={false} isSuccess={false} error={error} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Transaction failed — please try again.');
    expect(status).not.toHaveTextContent('raw provider details');
  });
});
