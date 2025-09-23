type SelineOptions = {
	token?: string | null;
	apiHost?: string | null;
	autoPageView?: boolean | null;
	maskPatterns?: string[] | null;
	skipPatterns?: string[] | null;
	cookieOnIdentify?: boolean | null;
	cookie?: boolean | null;
	outbound?: boolean | null;
};

type SelineCustomEvent = {
	name: string;
	pathname: string;
	data?: Record<string, unknown> | null;
};

type SelinePageViewEvent = {
	pathname: string;
	referrer?: string | null;
};

type SelineUserData = Record<string, unknown>;

export type Seline = {
	track: (name: string, data?: Record<string, unknown> | null) => void;
	page: (customPathname?: string) => void;
	setUser: (data: SelineUserData) => void;
	enableAutoPageView: () => void;
	doNotTrack: () => void;
	enableCookieMode: () => void;
};

declare global {
	interface Window {
		seline: Seline;
	}
}

export function Seline(options: SelineOptions) {
	const STORAGE_KEY = 'seline_vid';
	const DNT_KEY = 'seline-do-not-track';

	const token = options.token;
	const apiHost = options.apiHost ?? "https://api.seline.com";
	const maskPatterns = options.maskPatterns ?? [];
	const skipPatterns = options.skipPatterns ?? [];
  const cookieOnIdentify = options.cookieOnIdentify ?? false;
  let cookieMode = options.cookie ?? false;
  const outbound = options.outbound ?? false;

  let visitorId = getCookie(STORAGE_KEY);
	let userData: SelineUserData = {};
	let lastPage: string | null = null;
	const referrerSent = sessionStorage.getItem("seline:referrer");
	let referrer: string | null = referrerSent ? "" : document.referrer;

  function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name: string, value: string, days = 365): void {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const domain = location.hostname.split('.').slice(-2).join('.');
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;domain=.${domain};SameSite=Lax`;
  }

	function isTrackingDisabled(): boolean {
		return localStorage.getItem(DNT_KEY) === "1";
	}

	function doNotTrack(): void {
		localStorage.setItem(DNT_KEY, "1");
	}

	function registerListeners() {
		const pushState = history.pushState;
		history.pushState = function (...args) {
			pushState.apply(this, args);
			page();
		};

		addEventListener("popstate", () => page());

		function onVisibilityChange() {
			if (!lastPage && document.visibilityState === "visible") {
				page();
			}
		}

		if (document.visibilityState !== "visible") {
			document.addEventListener("visibilitychange", onVisibilityChange);
		} else {
			page();
		}

		registerCustomEventListeners();
	}

	function enableAutoPageView(_initial = false) {
		if (options.autoPageView && !_initial) return;
		options.autoPageView = true;

		registerListeners();
	}

	function processPathname(pathname: string): string | null {
		const regexSkipPatterns = skipPatterns.map(
			(pattern) => new RegExp(`^${pattern.replace(/\*/g, "[^/]+")}$`),
		);
		const regexMaskPatterns = maskPatterns.map(
			(pattern) => new RegExp(`^${pattern.replace(/\*/g, "[^/]+")}$`),
		);

		if (regexSkipPatterns.some((regex) => regex.test(pathname))) {
			return null;
		}

		for (let i = 0; i < maskPatterns.length; i++) {
			if (regexMaskPatterns[i].test(pathname)) {
				return maskPatterns[i];
			}
		}
		return pathname;
	}

  // biome-ignore lint/suspicious/noConfusingVoidType: intentional
	function send(url: string, data: Record<string, unknown>, useBeacon = true): Promise<Response | void> {
		if (isTrackingDisabled()) return Promise.resolve();

		const payload = { ...data };
		if (userData.userId) payload.visitorId = userData.userId;
    if (visitorId) payload.visitorId = visitorId;

		const shouldUseFetch = !visitorId && cookieMode;

		if (useBeacon && !shouldUseFetch && navigator?.sendBeacon) {
			navigator.sendBeacon(url, JSON.stringify(payload));
			return Promise.resolve();
		}

		return fetch(url, {
			method: "POST",
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true,
		}).then(async (response) => {
			if (cookieMode && !visitorId && response.ok) {
        const json = await response.json();
        if (json?.visitorId) {
          visitorId = json.visitorId as string;
          setCookie(STORAGE_KEY, visitorId);
        }
			}
		});
	}

	function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
		send(`${apiHost}/s/e`, { token, ...event }, true);
	}

	function track(name: string, data?: Record<string, unknown> | null): void {
		const pathname = processPathname(window.location.pathname);
		if (!pathname) return;

		createEvent({ pathname: pathname + window.location.search, name, data });
	}

	function page(customPathname?: string) {
    const currentPathname = customPathname ?? window.location.pathname;
		if (lastPage === currentPathname) return;
		lastPage = currentPathname;

		const pathname = processPathname(currentPathname);
		if (!pathname) return;

		if (!referrer || referrer.includes(window.location.hostname)) {
			referrer = null;
		}

		createEvent({
			pathname: customPathname ? pathname : pathname + window.location.search,
			referrer,
		});

		if (referrer) {
			referrer = null;
			sessionStorage.setItem("seline:referrer", "set");
		}
	}

	function setUser(data: SelineUserData) {
		userData = { ...userData, ...data };
		send(`${apiHost}/s/su`, { token, fields: userData }, false)
			.then(async (response) => {
				if (response) {
					const json = await response.json();
					if (json?.visitorId) {
						visitorId = json.visitorId as string;
						if (cookieOnIdentify || cookieMode) {
              setCookie(STORAGE_KEY, visitorId);
            }
					}
				}
			});
	}

	function registerCustomEventListeners() {
		document.addEventListener("click", (event) => {
			let targetElement = event.target as HTMLElement | null;

			if (
				!targetElement ||
				((targetElement.tagName === "INPUT" ||
					targetElement.tagName === "SELECT" ||
					targetElement.tagName === "TEXTAREA") &&
					// @ts-ignore
					targetElement.type !== "submit")
			) {
				return;
			}

			if (outbound) {
				let linkElement: HTMLElement | null = targetElement;
				while (linkElement && linkElement.tagName !== "A") {
					linkElement = linkElement.parentElement;
				}

				if (linkElement && linkElement.tagName === "A") {
					const anchor = linkElement as HTMLAnchorElement;
					const href = anchor.href;

					if (href && anchor.hostname && anchor.hostname !== window.location.hostname) {
						track("outbound link: clicked", {
							url: href,
							text: anchor.textContent?.trim() || "",
							hostname: anchor.hostname
						});
					}
				}
			}

			while (targetElement && !targetElement?.hasAttribute("data-sln-event")) {
				targetElement = targetElement.parentElement;
			}

			if (!targetElement) return;

			const eventName = targetElement.getAttribute("data-sln-event");
			if (!eventName) return;

			const eventData = {};

			for (const attr of Array.from(targetElement.attributes)) {
				if (attr.name.startsWith("data-sln-event-") && attr.value) {
					eventData[attr.name.slice("data-sln-event-".length)] = attr.value;
				}
			}

			if (targetElement.tagName === "FORM") {
				const form = targetElement as HTMLFormElement;
				const inputs = Array.from(form.elements) as HTMLInputElement[];
				for (const input of inputs) {
					if (input.type !== "password" && input.name && input.value) {
						eventData[input.name] = input.value;
					}
				}
			}

			track(eventName, eventData);
		});
	}

	function enableCookieMode(): void {
		cookieMode = true;
		if (visitorId) {
			setCookie(STORAGE_KEY, visitorId);
		}
	}

	return {
		track,
		page,
		setUser,
		enableAutoPageView,
		doNotTrack,
		enableCookieMode,
	};
}

if (!window.seline) {
  const token = document.currentScript?.getAttribute("data-token");

  function parsePatterns(attrValue: string | null | undefined): string[] {
    if (!attrValue) return [];
    return attrValue
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(p => p.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }

  const skipPatterns = parsePatterns(document.currentScript?.getAttribute("data-skip-patterns"));
  const maskPatterns = parsePatterns(document.currentScript?.getAttribute("data-mask-patterns"));

  const autoPageView =
    document.currentScript?.getAttribute("data-auto-page-view") !== "false";
  const apiHost = document.currentScript?.getAttribute("data-api-host");
  const cookieOnIdentify =
    document.currentScript?.getAttribute("data-cookie-on-identify") === "true";
  const cookie =
    document.currentScript?.getAttribute("data-cookie") === "true";
  const outbound =
    document.currentScript?.getAttribute("data-outbound") === "true";

  const seline = Seline({
    token,
    skipPatterns,
    maskPatterns,
    autoPageView,
    apiHost,
    cookieOnIdentify,
    cookie,
    outbound,
  });
  window.seline = seline;

  if (autoPageView) seline.enableAutoPageView(true);
}
