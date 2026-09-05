import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import type { OnboardingStep } from './config';
import { getStepsForRole } from './config';

interface OnboardingContextValue {
  /** Whether the tour is currently showing */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** The ordered list of steps */
  steps: OnboardingStep[];
  /** Total number of steps */
  totalSteps: number;
  /** Advance to the next step, or finish if at the last step */
  next: () => void;
  /** Skip the entire tour */
  skip: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);

  // On login / user change, check the server-side flag
  useEffect(() => {
    if (!user) return;
    // Admins never see the tour
    if (user.role === 'ADMIN') return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/user/onboarding-status');
        const { hasCompletedOnboarding } = res.data.data;
        if (cancelled) return;

        if (!hasCompletedOnboarding) {
          const tourSteps = getStepsForRole(user.role);
          if (tourSteps.length > 0) {
            setSteps(tourSteps);
            setCurrentStep(0);
            // Small delay so the DOM has rendered before we try to find targets
            setTimeout(() => {
              if (!cancelled) setIsActive(true);
            }, 600);
          }
        }
      } catch {
        // Silently fail — don't block the app over onboarding
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const markComplete = useCallback(async () => {
    setIsActive(false);
    try {
      await api.post('/user/onboarding-complete');
    } catch {
      // best-effort
    }
  }, []);

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        markComplete();
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length, markComplete]);

  const skip = useCallback(() => {
    markComplete();
  }, [markComplete]);

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        totalSteps: steps.length,
        next,
        skip,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
