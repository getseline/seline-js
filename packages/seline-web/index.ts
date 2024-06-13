type SelineOptions = {
  token?: string | null;
  apiHost?: string | null;
  autoPageView?: boolean | null;
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

const isBrowser = typeof window !== "undefined";

let userData: SelineUserData = {};

const options: SelineOptions = {};

type QueueEvent =
  | { name: "event"; args: SelineCustomEvent | SelinePageViewEvent }
  | { name: "user"; args: SelineUserData };

let inited = false;

const beforeInitQueue: QueueEvent[] = [];

export function init(initOptions: SelineOptions = {}) {
  if (!isBrowser || inited) return;

  options.token = initOptions.token;
  options.apiHost = initOptions.apiHost ?? "https://api.seline.so";
  options.autoPageView = initOptions.autoPageView ?? true;

  if (options.autoPageView) {
    const pushState = history.pushState;
    history.pushState = function (...args) {
      pushState.apply(this, args);
      page();
    };

    addEventListener("popstate", page);

    page();
  }

  inited = true;

  if (beforeInitQueue.length > 0) {
    for (const { name, args } of beforeInitQueue) {
      if (name === "event") {
        createEvent(args);
      } else if (name === "user") {
        setUser(args);
      }
    }
  }
}

function send(url: string, data: Record<string, unknown>): void {
  try {
    navigator.sendBeacon(url, JSON.stringify(data));
  } catch (error) {
    console.error(error);
  }
}

function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
  send(`${options.apiHost}/s/e`, { token: options.token, ...event });
}

export function track(
  name: string,
  data?: Record<string, unknown> | null,
): void {
  if (!inited) {
    beforeInitQueue.push({ name: "event", args: { name, data } });
    return;
  }
  createEvent({ name, data });
}

export function page() {
  let referrer: string | null = document.referrer;

  if (!referrer || referrer.includes(location.hostname)) {
    referrer = null;
  }

  const args = {
    pathname: window.location.pathname + window.location.search,
    referrer,
  };

  if (!inited) {
    beforeInitQueue.push({ name: "event", args });
    return;
  }

  createEvent(args);
}

export function setUser(data: SelineUserData) {
  userData = { ...userData, ...data };

  if (!inited) {
    beforeInitQueue.push({ name: "user", args: userData });
    return;
  }

  send(`${options.apiHost}/s/su`, { token: options.token, fields: userData });
}
