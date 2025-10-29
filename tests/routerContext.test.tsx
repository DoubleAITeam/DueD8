import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { createPortal } from 'react-dom';
import {
  RouterProvider,
  RouterView,
  useNavigate,
  useNavigateOptional,
  type Route
} from '../src/renderer/routes/router';

function resetLocation() {
  window.location.hash = '#/';
}

describe('router context hooks', () => {
  beforeEach(() => {
    resetLocation();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    resetLocation();
  });

  it('throws when useNavigate is called outside RouterProvider', () => {
    expect(() => renderHook(() => useNavigate())).toThrowError(/RouterProvider/);
  });

  it('returns null from useNavigateOptional outside RouterProvider', () => {
    const { result } = renderHook(() => useNavigateOptional());
    expect(result.current).toBeNull();
  });

  it('provides navigate when wrapped in RouterProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RouterProvider>{children}</RouterProvider>
    );

    const { result } = renderHook(() => useNavigate(), { wrapper });
    expect(typeof result.current).toBe('function');
  });

  it('preserves router context when rendering through a portal', async () => {
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);

    const routes: Route[] = [
      { path: '/', element: <div>Home</div> },
      { path: '/pricing', element: <div>Pricing</div> }
    ];

    function PortalConsumer() {
      const navigate = useNavigate();
      React.useEffect(() => {
        navigate('/pricing');
      }, [navigate]);

      return createPortal(<div>Modal</div>, modalRoot);
    }

    render(
      <RouterProvider>
        <RouterView routes={routes} />
        <PortalConsumer />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(window.location.hash).toBe('#/pricing');
    });
  });
});
