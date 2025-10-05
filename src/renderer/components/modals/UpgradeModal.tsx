import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBudgetStore } from '../../state/budget';
import { trackTokenBudgetModalClick, trackTokenBudgetModalView } from '../../../lib/analytics';

const FALLBACK_FEATURES = [
  'Longer token limits',
  'Priority queue',
  'Multi-file renders',
  'Export to PDF/Docx',
  'Audit history'
];

export function UpgradeModal(): JSX.Element | null {
  const upgradeModalOpen = useBudgetStore((state) => state.upgradeModalOpen);
  const closeUpgradeModal = useBudgetStore((state) => state.closeUpgradeModal);
  const setBudget = useBudgetStore((state) => state.setBudget);
  const plan = useBudgetStore((state) => state.plan);
  const used = useBudgetStore((state) => state.used);
  const cap = useBudgetStore((state) => state.cap);
  const isOverCap = useBudgetStore((state) => state.isOverCap);
  const [features, setFeatures] = useState<string[]>(FALLBACK_FEATURES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    if (!upgradeModalOpen) {
      hasTrackedViewRef.current = false;
      return;
    }
    if (!hasTrackedViewRef.current) {
      trackTokenBudgetModalView({ used, cap, plan });
      hasTrackedViewRef.current = true;
    }
    let cancelled = false;
    window.dued8.budget
      .getProBullets()
      .then((items) => {
        if (!cancelled && Array.isArray(items) && items.length > 0) {
          setFeatures(items.slice(0, 5));
        }
      })
      .catch((error) => {
        console.error('[budget] Failed to load PRO feature copy', error);
        setFeatures(FALLBACK_FEATURES);
      });

    return () => {
      cancelled = true;
    };
  }, [upgradeModalOpen]);

  const usageCopy = useMemo(() => {
    const formattedCap = cap ? cap.toLocaleString() : '—';
    const formattedUsed = used.toLocaleString();
    return `You\'ve used ${formattedUsed} of ${formattedCap} tokens on the ${plan} plan.`;
  }, [cap, plan, used]);

  if (!upgradeModalOpen) {
    return null;
  }

  const handleSeePlans = () => {
    trackTokenBudgetModalClick({ used, cap, plan }, 'see_plans');
    window.open('https://dued8.com/pricing', '_blank', 'noopener');
  };

  const handleAlreadyUpgraded = async () => {
    trackTokenBudgetModalClick({ used, cap, plan }, 'already_upgraded');
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

  return (
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
          </div>
          <button
            type="button"
            className="upgrade-modal__close"
            aria-label="Close upgrade modal"
            onClick={closeUpgradeModal}
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
          <button type="button" className="btn btn-secondary" onClick={handleSeePlans}>
            See plans
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAlreadyUpgraded}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Checking…' : 'I already upgraded'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
