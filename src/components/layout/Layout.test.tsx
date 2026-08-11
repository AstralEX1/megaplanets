// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./BrandMark', () => ({ BrandMark: () => <span>Logo</span> }));
vi.mock('./MobileWalletBar', () => ({ MobileWalletBar: () => null }));
vi.mock('./ProfileCard', () => ({ ProfileCard: () => null }));
vi.mock('./Nav', () => ({
  Nav: () => null,
  MobileBottomNav: () => null,
}));

import { Layout } from './Layout';

describe('Layout', () => {
  it('does not render the global disclaimer footer', () => {
    render(<Layout active="play" onSelect={vi.fn()}><p>Page content</p></Layout>);

    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.queryByText(/Participating assets may be lost/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /full disclaimer/i })).not.toBeInTheDocument();
  });
});
