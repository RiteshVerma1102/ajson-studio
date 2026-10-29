import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '../Button/Button';
import { safeStorage } from '../../state/storage';
import styles from './OnboardingTour.module.css';

const TOUR_STORAGE_KEY = 'ajson_onboarding_completed_v1';

export interface TourStep {
  title: string;
  description: string;
  targetHint: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Ajson Studio',
    description: 'An AI-native desktop software development environment uniting high-speed code editing, project understanding, and autonomous coding agents.',
    targetHint: 'Overview',
  },
  {
    title: 'Monaco Editor & Split Panes',
    description: 'Work with full TypeScript, syntax highlighting, diff viewing, and multi-tab layouts. Press Ctrl+S to save and Ctrl+\\ to split.',
    targetHint: 'Editor Stage',
  },
  {
    title: 'Integrated Terminal & Source Control',
    description: 'Access the terminal (Ctrl+`) and manage Git branches, commits, and staged changes directly from the activity bar.',
    targetHint: 'Bottom & Side Panels',
  },
  {
    title: 'Context-Aware AI Assistant',
    description: 'Chat with Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro, or local Ollama. Attach live editor selections and inspect token usage.',
    targetHint: 'Right Panel (Ctrl+Alt+B)',
  },
  {
    title: 'Mission Control & Human-in-the-Loop',
    description: 'Switch to Manager View (Ctrl+Shift+M) to coordinate parallel agents. Every file edit, terminal command, and MCP call requires your explicit approval.',
    targetHint: 'Mission Control',
  },
];

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export const OnboardingTour: React.FC<Props> = ({ isOpen: externalOpen, onClose: externalClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (externalOpen !== undefined) {
      setIsOpen(externalOpen);
      if (externalOpen) setCurrentStep(0);
      return;
    }
    const completed = safeStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      setIsOpen(true);
    }
  }, [externalOpen]);

  const handleClose = () => {
    safeStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsOpen(false);
    if (externalClose) externalClose();
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep]!;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Onboarding Tour">
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <Sparkles size={12} color="var(--accent)" />
            <span>Step {currentStep + 1} of {TOUR_STEPS.length}</span>
          </div>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Skip Tour">
            <X size={14} />
          </button>
        </div>

        <div className={styles.content}>
          <span className={styles.targetHint}>{step.targetHint}</span>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.desc}>{step.description}</p>
        </div>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === currentStep ? styles.activeDot : ''}`}
              />
            ))}
          </div>

          <div className={styles.buttons}>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Skip
            </Button>
            <Button
              variant="primary"
              size="sm"
              rightIcon={
                currentStep === TOUR_STEPS.length - 1 ? (
                  <Check size={13} />
                ) : (
                  <ArrowRight size={13} />
                )
              }
              onClick={handleNext}
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
