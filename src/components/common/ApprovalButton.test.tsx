// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { maxUint256 } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalButton } from './ApprovalButton';

const state = vi.hoisted(() => ({
  allowance: 0n as bigint | undefined,
  isLoading: false,
  error: undefined as Error | undefined,
  writeContract: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x0000000000000000000000000000000000000001' }),
  useWriteContract: () => ({
    writeContract: state.writeContract,
    data: undefined,
    isPending: false,
    error: undefined,
    reset: vi.fn(),
  }),
  useWaitForTransactionReceipt: () => ({ isSuccess: false, isLoading: false }),
}));

vi.mock('@/hooks/useUsdcAllowance', () => ({
  useUsdcAllowance: () => ({
    allowance: state.allowance,
    error: state.error,
    isLoading: state.isLoading,
    refetch: state.refetch,
  }),
}));

describe('ApprovalButton', () => {
  const spender = '0x0000000000000000000000000000000000000002' as const;

  beforeEach(() => {
    state.allowance = 0n;
    state.isLoading = false;
    state.error = undefined;
    state.writeContract.mockReset();
    state.refetch.mockReset();
  });

  afterEach(cleanup);

  it('renders the downstream action when the current allowance covers the purchase', () => {
    state.allowance = 2_000_000n;
    render(
      <ApprovalButton spender={spender} amount={1_000_000n}>
        <button type="button">Explore</button>
      </ApprovalButton>,
    );

    expect(screen.getByRole('button', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('approves the route-specific spender once when allowance is insufficient', async () => {
    const user = userEvent.setup();
    render(
      <ApprovalButton spender={spender} amount={1_000_000n}>
        <button type="button">Explore</button>
      </ApprovalButton>,
    );

    await user.click(screen.getByRole('button', { name: 'Approve USDC' }));

    expect(state.writeContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'approve',
      args: [spender, maxUint256],
    }));
  });
});
