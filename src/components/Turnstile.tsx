"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string }) => string;
      remove: (id: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile widget. On render it injects a hidden
 * `cf-turnstile-response` input into the surrounding <form>, which the server
 * verifies. Place inside the form you want to protect.
 */
export default function Turnstile({ siteKey }: { siteKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, { sitekey: siteKey });
    };

    if (window.turnstile) {
      render();
    } else {
      if (!document.querySelector("script[data-turnstile]")) {
        const s = document.createElement("script");
        s.src = SRC;
        s.async = true;
        s.defer = true;
        s.setAttribute("data-turnstile", "1");
        document.head.appendChild(s);
      }
      poll = setInterval(() => {
        if (window.turnstile) {
          if (poll) clearInterval(poll);
          render();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  return <div ref={ref} className="cf-turnstile" />;
}
