import type { AuthUser } from '../../lib/auth';

export interface OnboardingStep {
  /** Must match a data-onboarding-id="..." attribute in the DOM */
  target: string;
  /** Speech-bubble text shown to the user */
  text: string;
  /** Optional title for the step */
  title?: string;
}

/**
 * Return the tour steps appropriate for a given role.
 * Each `target` value corresponds to a `data-onboarding-id` on an element.
 */
export function getStepsForRole(role: AuthUser['role']): OnboardingStep[] {
  switch (role) {
    case 'SALES_REPRESENTATIVE':
      return [
        {
          target: 'sidebar-nav',
          title: 'Navigation',
          text: 'This is your sidebar — it gives you quick access to all the workspaces available for your role.',
        },
        {
          target: 'app-logo',
          title: 'Welcome to DealFlow360!',
          text: "You're looking at the B2B Sales Platform. Let me show you around!",
        },
        {
          target: 'user-info',
          title: 'Your Profile',
          text: 'Here you can see your name, role, and sign out when you need to.',
        },
      ];

    case 'SALES_MANAGER':
      return [
        {
          target: 'sidebar-nav',
          title: 'Navigation',
          text: 'Welcome, Manager! Use the sidebar to navigate to your Approvals dashboard.',
        },
        {
          target: 'app-logo',
          title: 'Welcome to DealFlow360!',
          text: 'As a Sales Manager, you review and approve quotations submitted by your team.',
        },
        {
          target: 'user-info',
          title: 'Your Profile',
          text: 'Your role badge and sign-out option are here.',
        },
      ];

    case 'FINANCE_OPERATIONS':
      return [
        {
          target: 'sidebar-nav',
          title: 'Navigation',
          text: 'Welcome! You have access to Finance and Fulfillment workspaces from the sidebar.',
        },
        {
          target: 'app-logo',
          title: 'Welcome to DealFlow360!',
          text: 'As Finance / Ops, you handle final approvals, fulfillment planning, and billing.',
        },
        {
          target: 'user-info',
          title: 'Your Profile',
          text: 'Your account info and sign-out are at the bottom of the sidebar.',
        },
      ];

    case 'CUSTOMER':
      return [
        {
          target: 'sidebar-nav',
          title: 'Navigation',
          text: 'Welcome to your Customer Portal! Use the sidebar to navigate.',
        },
        {
          target: 'app-logo',
          title: 'Welcome to DealFlow360!',
          text: 'Here you can view your quotations, negotiate pricing, and confirm orders.',
        },
        {
          target: 'user-info',
          title: 'Your Profile',
          text: 'You can see your account details and sign out here.',
        },
      ];

    default:
      return [];
  }
}
