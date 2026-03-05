import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import Icon from './Icon';

const STEPS = [
    {
        targetId: 'tour-add-habit',
        title: 'Initialize Node',
        text: 'Tap here to construct a new behavioral node. Features range from counters to camera logs.',
        position: 'bottom' // Tooltip position relative to target
    },
    {
        targetId: 'tour-nav-mobile-menu',
        title: 'Command Console',
        text: 'Access your full analytics, matrix notes, and settings from the sidebar menu.',
        position: 'right',
        mobileOnly: true
    },
    {
        targetId: 'tour-nav-habits',
        title: 'Habit Registry',
        text: 'Manage all your active routines here. Monitor progress and calibrate specific behaviors.',
        position: 'right',
        desktopOnly: true
    },
    {
        targetId: 'tour-camera-upload',
        title: 'Photo Uploads',
        text: 'Log behaviors instantly by capturing physical evidence securely via your camera.',
        position: 'top',
        wait: 200 // Allows UI to render if needed
    },
    {
        targetId: 'tour-nav-bell',
        title: 'System Alerts',
        text: 'Smart check-ins will ping you here if you drift or stay inactive too long.',
        position: 'bottom'
    },
    {
        targetId: 'tour-nav-ai',
        title: 'Auris AI Lens',
        text: 'Tap the brain icon to speak directly to your intelligence layer regarding your data.',
        position: 'bottom'
    }
];

const TourGuide = () => {
    const [activeStepIndex, setActiveStepIndex] = useState(-1);
    const [targetRect, setTargetRect] = useState(null);
    const [hasSeenTour, setHasSeenTour] = useState(false);
    const isMobile = window.innerWidth <= 768;

    useEffect(() => {
        const seen = localStorage.getItem('auris_tour_complete');
        if (seen !== 'true') {
            setTimeout(() => setActiveStepIndex(0), 1000);
        } else {
            setHasSeenTour(true);
        }
    }, []);

    const completeTour = () => {
        setActiveStepIndex(-1);
        setHasSeenTour(true);
        localStorage.setItem('auris_tour_complete', 'true');
    };

    useEffect(() => {
        if (activeStepIndex === -1) return;

        const findAndSetTarget = () => {
            // Find current step skipping platform-specific ones if necessary
            let step = STEPS[activeStepIndex];
            if (!step) {
                completeTour();
                return;
            }

            if ((step.mobileOnly && !isMobile) || (step.desktopOnly && isMobile)) {
                setActiveStepIndex(prev => prev + 1);
                return;
            }

            const el = document.getElementById(step.targetId);
            if (el) {
                // Scroll element into view smoothly if needed (mostly for habits down the page)
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                setTimeout(() => {
                    const rect = el.getBoundingClientRect();
                    setTargetRect(rect);
                }, 300); // give time for scroll
            } else {
                // Element not found on this screen, skip to next
                setActiveStepIndex(prev => prev + 1);
            }
        };

        findAndSetTarget();
        window.addEventListener('resize', findAndSetTarget);
        return () => window.removeEventListener('resize', findAndSetTarget);
    }, [activeStepIndex, isMobile]);

    const advanceTour = () => {
        setTargetRect(null); // Force animated jump
        setActiveStepIndex(prev => prev + 1);
    };

    if (activeStepIndex === -1 || hasSeenTour || !targetRect) return null;

    const currentStep = STEPS[activeStepIndex];

    // Calculate tooltip placement
    const padding = 16;
    let tooltipTop = 0;
    let tooltipLeft = 0;

    // Safe defaults, we position the tooltip relative to the target rect dynamically
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
        // left
        tooltipTop = targetRect.top + (targetRect.height / 2);
        tooltipLeft = targetRect.left - padding;
    }

    // Generate bouncy arrow logic
    const arrowDirectionClass = {
        'bottom': 'bottom-full left-1/2 -translate-x-1/2 rotate-180 mb-2',
        'top': 'top-full left-1/2 -translate-x-1/2 mt-2',
        'right': 'right-full top-1/2 -translate-y-1/2 rotate-90 mr-2',
        'left': 'left-full top-1/2 -translate-y-1/2 -rotate-90 ml-2'
    }[currentStep.position];

    return (
        <>
            {/* Dim Overlay - Closes or Advances when clicked everywhere */}
            <div
                className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm transition-all duration-500 cursor-none"
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
                className="fixed z-[9991] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] border-2 border-accent rounded-xl"
                style={{
                    top: targetRect.top - 6,
                    left: targetRect.left - 6,
                    width: targetRect.width + 12,
                    height: targetRect.height + 12,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px rgba(var(--accent-rgb), 0.5)'
                }}
            />

            {/* Tooltip Card */}
            <div
                className="fixed z-[9992] pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                    top: tooltipTop,
                    left: tooltipLeft,
                    transform: currentStep.position === 'bottom' || currentStep.position === 'top'
                        ? `translate(-50%, ${currentStep.position === 'bottom' ? '0' : '-100%'})`
                        : `translate(${currentStep.position === 'right' ? '0' : '-100%'}, -50%)`,
                    width: 'max-content',
                    maxWidth: '280px'
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
                        <span className="text-[9px] text-text-secondary font-mono bg-bg-sidebar px-1.5 py-0.5 rounded">
                            {activeStepIndex + 1}/{STEPS.length}
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
