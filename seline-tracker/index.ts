type SelineOptions = {
  token?: string | null;
  apiHost?: string | null;
};

type SelineCustomEvent = {
  name: string;
  data?: Record<string, unknown> | null;
};

type SelinePageViewEvent = {
  pathname: string;
  referrer?: string | null;
};

type SelineUserData = Record<string, unknown>;

export type Seline = {
  track: (name: string, data?: Record<string, unknown> | null) => void;
  page: () => void;
  setUser: (data: SelineUserData) => void;
};

declare global {
  interface Window {
    seline: Seline;
  }
}

export function Seline(options: SelineOptions) {
  const token = options.token;
  const apiHost = options.apiHost ?? "https://api.seline.so";
  let userData: SelineUserData = {};

  function send(url: string, data: Record<string, unknown>): void {
    try {
      const payload = data;
      if (userData.userId) payload.visitorId = userData.userId;

      navigator.sendBeacon(url, JSON.stringify(payload));
    } catch (error) {
      console.error(error);
    }
  }

  function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
    send(`${apiHost}/s/e`, { token, ...event });
  }

  function track(name: string, data?: Record<string, unknown> | null): void {
    createEvent({ name, data });
  }

  function page() {
    let referrer: string | null = document.referrer;

    if (!referrer || referrer.includes(location.hostname)) {
      referrer = null;
    }

    createEvent({
      pathname: window.location.pathname + window.location.search,
      referrer,
    });
  }

  function setUser(data: SelineUserData) {
    userData = { ...userData, ...data };
    send(`${apiHost}/s/su`, { token, ...userData });
  }

  return {
    track,
    page,
    setUser,
  };
}

const token = document.currentScript?.getAttribute("data-seline-token");

const seline = Seline({ token });
window.seline = seline;

const pushState = history.pushState;
history.pushState = function (...args) {
  pushState.apply(this, args);
  seline.page();
};

addEventListener("popstate", seline.page);

seline.page();
