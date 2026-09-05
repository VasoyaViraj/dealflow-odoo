import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from './OnboardingContext';
import { OnboardingCharacter } from './OnboardingCharacter';

/* ─── Spotlight ─────────────────────────────────────────────────────────────── */

/**
 * The spotlight is a zero-content div whose `box-shadow` is a massive
 * semi-transparent overlay. By sizing + positioning the div to match the
 * highlighted element, the box-shadow acts as a full-screen dim that
 * *excludes* the target rect — creating the classic "spotlight" effect
 * without ever touching the target element's own styles or z-index.
 */
function Spotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null;

  const padding = 8;
  const radius = 8;

  return (
    <div
      style={{
        position: 'fixed',
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: radius,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
        zIndex: 99998,
        pointerEvents: 'none',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    />
  );
}

/* ─── Progress Dots ─────────────────────────────────────────────────────────── */

function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 18 : 8,
            height: 8,
            borderRadius: 4,
            background:
              i === current
                ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                : 'rgba(255,255,255,0.2)',
            transition: 'all 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Overlay ──────────────────────────────────────────────────────────── */

export function OnboardingOverlay() {
  const { isActive, currentStep, steps, totalSteps, next, skip } =
    useOnboarding();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Virtual reference element for @floating-ui/react
  const virtualRef = useRef<{
    getBoundingClientRect: () => DOMRect;
  }>({
    getBoundingClientRect: () =>
      new DOMRect(0, 0, 0, 0),
  });

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    middleware: [offset(16), flip({ padding: 20 }), shift({ padding: 20 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: virtualRef.current },
  });

  // Measure the target element whenever the step changes
  const measureTarget = useCallback(() => {
    if (!isActive || steps.length === 0) return;
    const step = steps[currentStep];
    if (!step) return;

    const el = document.querySelector(
      `[data-onboarding-id="${step.target}"]`
    );
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    // Update the virtual reference for floating-ui
    virtualRef.current = {
      getBoundingClientRect: () => el.getBoundingClientRect(),
    };

    // Force floating-ui to recalculate
    refs.setReference(virtualRef.current as never);
  }, [isActive, steps, currentStep, refs]);

  useEffect(() => {
    measureTarget();
    // Also re-measure on resize/scroll
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [measureTarget]);

  if (!isActive || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === totalSteps - 1;

  const overlay = (
    <AnimatePresence mode="wait">
      <div
        key="onboarding-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99997,
          pointerEvents: 'none',
        }}
      >
        {/* Click-blocker backdrop (pointer-events: all so it catches stray clicks) */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99997,
            pointerEvents: 'all',
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Spotlight */}
        <Spotlight rect={targetRect} />

        {/* Floating callout */}
        <motion.div
          key={`step-${currentStep}`}
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            zIndex: 99999,
            pointerEvents: 'all',
            maxWidth: 360,
          }}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            {/* Character */}
            <OnboardingCharacter />

            {/* Speech bubble */}
            <div
              style={{
                flex: 1,
                background:
                  'linear-gradient(135deg, rgba(30, 27, 50, 0.95), rgba(24, 20, 42, 0.97))',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: 14,
                padding: '16px 18px',
                color: '#e4e4e7',
                boxShadow:
                  '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(139, 92, 246, 0.15) inset',
              }}
            >
              {step.title && (
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#c4b5fd',
                    marginBottom: 4,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.title}
                </div>
              )}
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  margin: 0,
                  color: '#d4d4d8',
                }}
              >
                {step.text}
              </p>

              {/* Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  gap: 8,
                }}
              >
                <ProgressDots total={totalSteps} current={currentStep} />

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={skip}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent',
                      color: '#a1a1aa',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.background =
                        'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.background =
                        'transparent';
                    }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={next}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background:
                        'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 2px 8px rgba(109, 40, 217, 0.4)',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLButtonElement).style.transform =
                        'scale(1.04)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLButtonElement).style.transform =
                        'scale(1)';
                    }}
                  >
                    {isLast ? 'Done ✓' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  // Render into a portal so we stay outside all existing stacking contexts
  return createPortal(overlay, document.body);
}
