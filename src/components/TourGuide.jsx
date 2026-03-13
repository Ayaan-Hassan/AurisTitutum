import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import Icon from './Icon';
import { useLocation } from 'react-router-dom';

const DESKTOP_STEPS = [
    {
        targetId: 'tour-add-habit',
        title: 'New Habit Button',
        text: 'Click here to create a new habit. You can set up counters, timers, or simple check-offs.',
        position: 'bottom'
    },
    {
        targetId: 'tour-nav-habits',
        title: 'Habit Management',
        text: 'Click here to find a list of all your active habits. You can edit or delete them at any time.',
        position: 'right'
    },
    {
        targetId: 'tour-nav-bell',
        title: 'System Alerts',
        text: 'Check this bell for reminders and check-ins if you haven\'t recorded anything lately.',
        position: 'bottom'
    },
    {
        targetId: 'tour-nav-ai-desktop-sidebar',
        title: 'Auris AI Assistant',
        text: 'Tap the brain icon to speak directly to the AI about your habits and progress.',
        position: 'right'
    }
];

const MOBILE_STEPS = [
    {
        targetId: 'tour-nav-mobile-menu',
        title: 'Menu Button',
        text: 'Tap this icon to open the sidebar. You can see your analytics, notes, and settings here.',
        position: 'bottom'
    },
    {
        targetId: 'tour-nav-bell',
        title: 'System Alerts',
        text: 'Check this bell for reminders and check-ins if you haven\'t recorded anything lately.',
        position: 'bottom'
    },
    {
        targetId: 'tour-add-habit-mobile',
        title: 'New Habit Button',
        text: 'Tap the floating + button here to create a new habit. You can set up counters or timers.',
        position: 'top'
    }
];

const TourGuide = () => {
    const [activeStepIndex, setActiveStepIndex] = useState(-1);
    const [targetRect, setTargetRect] = useState(null);
    const [hasSeenTour, setHasSeenTour] = useState(false);
    const location = useLocation();
    const isMobile = window.innerWidth <= 768;

    useEffect(() => {
        // Only start tour if on /app dashboard
        if (location.pathname !== '/app' && location.pathname !== '/app/') return;

        const seen = localStorage.getItem('auris_tour_complete');
        // Need both user configuration ready AND haven't seen tour
        if (seen !== 'true') {
            const timer = setTimeout(() => {
                setActiveStepIndex(0);
                localStorage.setItem('auris_tour_complete', 'true'); // Flag it as seen immediately
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setHasSeenTour(true);
        }
    }, [location.pathname]);

    const completeTour = () => {
        setActiveStepIndex(-1);
        setHasSeenTour(true);
        localStorage.setItem('auris_tour_complete', 'true');
    };

    useEffect(() => {
        if (activeStepIndex === -1) return;

        let checkTimeoutId;
        const findAndSetTarget = () => {
            const activeSteps = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
            let step = activeSteps[activeStepIndex];
            if (!step) {
                completeTour();
                return;
            }

            let retries = 0;
            const attemptFind = () => {
                const el = document.getElementById(step.targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    setTimeout(() => {
                        const currentEl = document.getElementById(step.targetId);
                        if (currentEl) {
                            setTargetRect(currentEl.getBoundingClientRect());
                        }
                    }, 300); // give time for scroll
                } else {
                    retries++;
                    if (retries < 15) { // Try for 1.5s
                        checkTimeoutId = setTimeout(attemptFind, 100);
                    } else {
                        // Element not found on this screen after 1.5s, skip to next
                        setActiveStepIndex(prev => prev + 1);
                    }
                }
            };
            attemptFind();
        };

        findAndSetTarget();
        window.addEventListener('resize', findAndSetTarget);
        return () => {
            window.removeEventListener('resize', findAndSetTarget);
            if (checkTimeoutId) clearTimeout(checkTimeoutId);
        };
    }, [activeStepIndex, isMobile]);

    const advanceTour = () => {
        setTargetRect(null); // Force animated jump
        setActiveStepIndex(prev => prev + 1);
    };

    if (activeStepIndex === -1 || hasSeenTour || !targetRect) return null;

    const activeSteps = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
    const currentStep = activeSteps[activeStepIndex];

    // Calculate tooltip placement
    const padding = 16;
    let tooltipTop = 0;
    let tooltipLeft = 0;

    // Safe defaults, we position the tooltip relative to the target rect dynamically
    const TOOLTIP_WIDTH = 280;

    if (currentStep.position === 'bottom') {
        tooltipTop = targetRect.bottom + padding;
        tooltipLeft = targetRect.left + (targetRect.width / 2);
    } else if (currentStep.position === 'top') {
        tooltipTop = targetRect.top - padding;
        tooltipLeft = targetRect.left + (targetRect.width / 2);
    } else if (currentStep.position === 'right') {
        tooltipTop = targetRect.top + (targetRect.height / 2);
        tooltipLeft = targetRect.right + padding;
    } else {
        tooltipTop = targetRect.top + (targetRect.height / 2);
        tooltipLeft = targetRect.left - padding;
    }

    // Clamp horizontally to save it from going offscreen
    let finalLeft = tooltipLeft;
    let translateXName = '-50%';
    let isCentered = false;

    if (currentStep.position === 'bottom' || currentStep.position === 'top') {
        const minLeft = TOOLTIP_WIDTH / 2 + 10;
        const maxLeft = window.innerWidth - (TOOLTIP_WIDTH / 2) - 10;
        if (tooltipLeft < minLeft) {
            finalLeft = 10;
            translateXName = '0'; // align left edge
        } else if (tooltipLeft > maxLeft) {
            finalLeft = window.innerWidth - TOOLTIP_WIDTH - 10;
            translateXName = '0'; // align right edge (since we set left exactly)
        } else {
            isCentered = true;
        }
    }

    // Generate bouncy arrow logic
    let arrowDirectionClass = {
        'bottom': 'bottom-full',
        'top': 'top-full',
        'right': 'right-full top-1/2 -translate-y-1/2 rotate-90 mr-2',
        'left': 'left-full top-1/2 -translate-y-1/2 -rotate-90 ml-2'
    }[currentStep.position];

    if (currentStep.position === 'bottom' || currentStep.position === 'top') {
        if (!isCentered && tooltipLeft > window.innerWidth / 2) {
            // align arrow near the right
            arrowDirectionClass += ' right-6';
        } else if (!isCentered && tooltipLeft <= window.innerWidth / 2) {
            // align arrow near the left
            arrowDirectionClass += ' left-6';
        } else {
            arrowDirectionClass += ' left-1/2 -translate-x-1/2';
        }
        if (currentStep.position === 'bottom') arrowDirectionClass += ' rotate-180 mb-2';
        if (currentStep.position === 'top') arrowDirectionClass += ' mt-2';
    }

    return (
        <>
            {/* Dim Overlay - Closes or Advances when clicked everywhere */}
            <div
                className="fixed inset-0 z-[9990] bg-black/40 transition-all duration-500 cursor-none"
                onClick={advanceTour}
            >
                <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none">
                    <p className="text-white/50 text-xs font-mono tracking-widest uppercase animate-pulse">
                        Click anywhere to continue
                    </p>
                </div>
            </div>

            {/* Target Cutout (Highlights the actual element) */}
            <div
                className="fixed z-[9991] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] border-[3px] border-accent rounded-xl"
                style={{
                    top: targetRect.top - 2,
                    left: targetRect.left - 2,
                    width: targetRect.width + 4,
                    height: targetRect.height + 4,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.7), 0 0 30px rgba(255,255,255,0.1)'
                }}
            />

            {/* Tooltip Card */}
            <div
                className="fixed z-[9992] pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                    top: tooltipTop,
                    left: finalLeft,
                    transform: currentStep.position === 'bottom' || currentStep.position === 'top'
                        ? `translate(${translateXName}, ${currentStep.position === 'bottom' ? '0' : '-100%'})`
                        : `translate(${currentStep.position === 'right' ? '0' : '-100%'}, -50%)`,
                    width: 'max-content',
                    maxWidth: `${TOOLTIP_WIDTH}px`
                }}
            >
                <div className="relative bg-bg-main border border-accent rounded-2xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                    {/* Animated pointer arrow */}
                    <div className={`absolute w-8 h-8 flex items-center justify-center animate-bounce ${arrowDirectionClass}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg scale-y-[-1]">
                            <path d="M12 2v20M12 2l7 7M12 2L5 9" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                            <Icon name="sparkles" size={12} />
                            {currentStep.title}
                        </h4>
                        <span className="text-accent font-mono text-[9px] tracking-widest font-bold">
                            {activeStepIndex + 1}/{isMobile ? MOBILE_STEPS.length : DESKTOP_STEPS.length}
                        </span>
                    </div>
                    <p className="text-xs text-text-primary leading-relaxed font-medium">
                        {currentStep.text}
                    </p>
                    <div className="mt-4 flex justify-between items-center border-t border-border-color/50 pt-3">
                        <button
                            onClick={completeTour}
                            className="text-[10px] text-text-secondary hover:text-text-primary transition-colors tracking-widest uppercase font-bold"
                        >
                            Skip Tour
                        </button>
                        <Button size="sm" variant="primary" onClick={advanceTour} className="px-5 py-1.5 min-h-0 h-8 rounded-lg text-[10px]">
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TourGuide;
