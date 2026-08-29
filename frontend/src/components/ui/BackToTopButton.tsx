/**
 * =============================================================================
 * Module: frontend/src/components/ui/BackToTopButton.tsx
 * Purpose: Floating action button that smoothly scrolls the viewport back to the top
 *          when the user has scrolled noticeably down the page (> threshold px).
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react
 * Public Members: BackToTopButton
 * Side Effects: Listens to passive window scroll events; executes window.scrollTo.
 * =============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface BackToTopButtonProps {
  /** Pixel threshold before button becomes visible (defaults to 450px for noticeable scroll) */
  threshold?: number;
}

export const BackToTopButton: React.FC<BackToTopButtonProps> = ({
  threshold = 450,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY =
            window.scrollY ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;
          setIsVisible(scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Initial check in case page starts scrolled
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    document.documentElement.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.7, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-surface-container/90 hover:bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/30 hover:border-primary/50 text-on-surface hover:text-primary shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:shadow-[0_4px_24px_rgba(99,102,241,0.25)] flex items-center justify-center cursor-pointer select-none group transition-colors duration-200"
        >
          <ArrowUp className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-on-surface-variant group-hover:text-primary transition-all duration-200 group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
