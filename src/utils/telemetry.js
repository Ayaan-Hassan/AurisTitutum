import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

export const initTelemetry = () => {
    // Sentry
    if (import.meta.env.VITE_SENTRY_DSN) {
        Sentry.init({
            dsn: import.meta.env.VITE_SENTRY_DSN,
            environment: import.meta.env.MODE || 'production'
        });
    }

    // PostHog
    if (import.meta.env.VITE_POSTHOG_KEY) {
        posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
            api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'
        });
    }

    // Google Analytics 4
    if (import.meta.env.VITE_GA_ID) {
        const gaId = import.meta.env.VITE_GA_ID;
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', gaId);
    }

    // Microsoft Clarity
    if (import.meta.env.VITE_CLARITY_ID) {
        const clarityId = import.meta.env.VITE_CLARITY_ID;
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", clarityId);
    }
};

export const identifyUser = (uid, email, name) => {
    try {
        if (import.meta.env.VITE_POSTHOG_KEY) {
            posthog.identify(uid, { email, name });
        }
        if (window.gtag && import.meta.env.VITE_GA_ID) {
            window.gtag('set', 'user_properties', { user_id: uid });
        }
        if (window.clarity) {
            window.clarity("set", "user_id", uid);
            window.clarity("set", "user_email", email);
        }
        if (import.meta.env.VITE_SENTRY_DSN) {
            Sentry.setUser({ id: uid, email, username: name });
        }
    } catch (err) {
        // silent fail for telemetry
    }
};

export const trackEvent = (eventName, properties = {}) => {
    try {
        if (import.meta.env.VITE_POSTHOG_KEY) {
            posthog.capture(eventName, properties);
        }
        if (window.gtag && import.meta.env.VITE_GA_ID) {
            window.gtag('event', eventName, properties);
        }
    } catch (err) {
        // silent fail for telemetry
    }
};
