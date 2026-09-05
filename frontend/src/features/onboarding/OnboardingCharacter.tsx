import { motion } from 'framer-motion';

/**
 * Renders the cartoon mascot character from the cartoonPicture assets.
 * Uses framer-motion for a subtle idle bounce animation.
 */
export function OnboardingCharacter() {
  return (
    <motion.div
      className="onboarding-character"
      animate={{ y: [0, -6, 0] }}
      transition={{
        duration: 2.4,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'loop',
      }}
      style={{
        width: 160,
        height: 160,
        flexShrink: 0,
      }}
    >
      <img
        src="/src/cartoonPicture/compressed/erasebg-transformed.svg"
        alt="DealFlow guide"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
        }}
      />
    </motion.div>
  );
}
