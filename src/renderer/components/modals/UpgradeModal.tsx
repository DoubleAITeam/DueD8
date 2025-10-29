import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBudgetStore } from '../../state/budget';
import { useNavigateOptional } from '../../routes/router';
import { logEvent } from '../../../lib/analytics';
import { FALLBACK_PRO_FEATURES, getProFeatures } from '../../../shared/pro/getProFeatures';

export function UpgradeModal(): JSX.Element | null {
  const upgradeModalOpen = useBudgetStore((state) => state.upgradeModalOpen);
  const closeUpgradeModal = useBudgetStore((state) => state.closeUpgradeModal);
  const setBudget = useBudgetStore((state) => state.setBudget);
  const plan = useBudgetStore((state) => state.plan);
  const used = useBudgetStore((state) => state.used);
  const cap = useBudgetStore((state) => state.cap);
  const isOverCap = useBudgetStore((state) => state.isOverCap);
  const modalSource = useBudgetStore((state) => state.upgradeModalSource);
  const modalUsage = useBudgetStore((state) => state.upgradeModalUsage);
  const modalLimit = useBudgetStore((state) => state.upgradeModalLimit);
  const [features, setFeatures] = useState<string[]>(FALLBACK_PRO_FEATURES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasTrackedViewRef = useRef(false);
  const navigate = useNavigateOptional();
  const routerReady = Boolean(navigate);

  const usage = typeof modalUsage === 'number' ? modalUsage : used;
  const limit = typeof modalLimit === 'number' ? modalLimit : cap;
  const source = modalSource ?? 'unknown';

  useEffect(() => {
    if (!upgradeModalOpen) {
      hasTrackedViewRef.current = false;
      return;
    }
    if (!hasTrackedViewRef.current) {
      logEvent('token_budget.modal_view', {
        source,
        usage,
        limit,
        plan
      });
      hasTrackedViewRef.current = true;
    }
    let cancelled = false;
    getProFeatures()
      .then((items) => {
        if (!cancelled && items.length > 0) {
          setFeatures(items);
        }
      })
      .catch((error) => {
        console.error('[budget] Failed to load PRO feature copy', error);
        setFeatures(FALLBACK_PRO_FEATURES);
      });

    return () => {
      cancelled = true;
    };
  }, [upgradeModalOpen, plan, source, usage, limit]);

  const usageCopy = useMemo(() => {
    const formattedCap = Number.isFinite(limit) && limit > 0 ? limit.toLocaleString() : '—';
    const formattedUsed = usage.toLocaleString();
    return `You\'ve used ${formattedUsed} of ${formattedCap} tokens on the ${plan} plan.`;
  }, [limit, plan, usage]);

  const formattedSource = useMemo(() => {
    if (!source || source === 'unknown') {
      return null;
    }
    return source.replace(/\./g, ' › ');
  }, [source]);

  if (!upgradeModalOpen || !routerReady) {
    return null;
  }

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[upgrade-modal] Missing #modal-root element for portal rendering');
    }
    return null;
  }

  const emitClick = (cta: 'upgrade' | 'close') => {
    logEvent('token_budget.modal_click', {
      cta,
      source,
      usage,
      limit,
      plan
    });
  };

  const handleUpgrade = () => {
    emitClick('upgrade');
    navigate?.('/pro');
    closeUpgradeModal();
  };

  const handleAlreadyUpgraded = async () => {
    emitClick('upgrade');
    setIsRefreshing(true);
    try {
      const next = await window.dued8.budget.refreshPlan();
      setBudget(next);
      if (!next.isOverCap) {
        closeUpgradeModal();
      }
    } catch (error) {
      console.error('[budget] Failed to refresh plan state', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClose = () => {
    emitClick('close');
    closeUpgradeModal();
  };

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content upgrade-modal">
        <div className="upgrade-modal__header">
          <div>
            <h2 className="upgrade-modal__title">Upgrade for more tokens</h2>
            <p className="upgrade-modal__subtitle">{usageCopy}</p>
            {isOverCap ? (
              <p className="upgrade-modal__subtitle" style={{ marginTop: 8 }}>
                You&apos;ve hit your limit. Upgrade to keep generating without interruption.
              </p>
            ) : null}
            {formattedSource ? (
              <p className="upgrade-modal__subtitle" style={{ marginTop: 8 }}>
                Triggered by: {formattedSource}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="upgrade-modal__close"
            aria-label="Close upgrade modal"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <ul className="upgrade-modal__features">
          {features.map((feature) => (
            <li key={feature} className="upgrade-modal__feature">
              <span className="upgrade-modal__feature-icon">★</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="upgrade-modal__actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Maybe later
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleUpgrade}
          >
            Upgrade to PRO
          </button>
          <button
            type="button"
            className="btn btn-link"
            onClick={handleAlreadyUpgraded}
            disabled={isRefreshing}
            style={{ marginLeft: 'auto' }}
          >
            {isRefreshing ? 'Checking…' : 'I already upgraded'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, modalRoot);
}

export default UpgradeModal;
