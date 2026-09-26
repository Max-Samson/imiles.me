import { useEffect, useRef } from 'react';
import { appConfig } from '@/config/app';

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'));
      script.onerror = () => reject(new Error('Turnstile unavailable'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      scriptPromise = undefined;
      throw error;
    });
  }
  return scriptPromise;
}

export default function TurnstileWidget({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let disposed = false;
    void loadTurnstile()
      .then((api) => {
        if (disposed || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          action: appConfig.turnstile.actions.friendLinkSubmit,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      })
      .catch(() => onTokenRef.current(''));
    return () => {
      disposed = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      onTokenRef.current('');
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  return <div ref={container} />;
}
