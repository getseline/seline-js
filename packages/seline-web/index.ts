type SelineOptions = {
	token?: string | null;
	apiHost?: string | null;
	autoPageView?: boolean | null;
	skipPatterns?: string[];
	maskPatterns?: string[];
	cookieOnIdentify?: boolean | null;
};

type SelineCustomEvent = {
	name: string;
	pathname?: string;
	data?: Record<string, unknown> | null;
};

type SelinePageViewEvent = {
	pathname: string;
	referrer?: string | null;
};

const STORAGE_KEY = 'seline_vid';

type SelineUserData = Record<string, unknown>;

const isBrowser = typeof window !== "undefined";

let userData: SelineUserData = {};
let referrer: string | null = null;
let visitorId: string | null = null;
const options: SelineOptions = {};

type QueueEvent =
	| { name: "event"; args: SelineCustomEvent | SelinePageViewEvent }
	| { name: "user"; args: SelineUserData };

let inited = false;
let lastPage: string | null = null;

const beforeInitQueue: QueueEvent[] = [];

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2] ?? "") : null;
}

function setCookie(name: string, value: string, days = 365): void {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const domain = location.hostname.split('.').slice(-2).join('.');
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;domain=.${domain};SameSite=Lax`;
}

function processPathname(
	pathname: string,
	maskPatterns: string[],
	skipPatterns: string[],
): string | null | undefined {
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
		if (regexMaskPatterns[i]?.test(pathname)) {
			return maskPatterns[i];
		}
	}
	return pathname;
}

export function init(initOptions: SelineOptions = {}) {
	if (!isBrowser || inited) return;

	options.token = initOptions.token;
	options.apiHost = initOptions.apiHost ?? "https://api.seline.so";
	options.autoPageView = initOptions.autoPageView ?? true;
	options.skipPatterns = initOptions.skipPatterns ?? [];
	options.maskPatterns = initOptions.maskPatterns ?? [];
	options.cookieOnIdentify = initOptions.cookieOnIdentify ?? false;

	inited = true;
  visitorId = getCookie(STORAGE_KEY);

	const referrerSent = sessionStorage.getItem("seline:referrer");
	referrer = referrerSent ? "" : document.referrer;

	if (beforeInitQueue.length > 0) {
		for (const { name, args } of beforeInitQueue) {
			if (name === "event") {
				createEvent(args);
			} else if (name === "user") {
				setUser(args);
			}
		}
	}

	if (options.autoPageView) {
		enableAutoPageView(true);
	}
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

		while (targetElement && !targetElement?.hasAttribute("data-sln-event")) {
			targetElement = targetElement.parentElement;
		}

		if (!targetElement) return;

		const eventName = targetElement.getAttribute("data-sln-event");
		if (!eventName) return;

		const eventData: Record<string, string> = {};

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

function registerListeners() {
	if (!isBrowser) return;

	const pushState = history.pushState;
	history.pushState = function (...args) {
		pushState.apply(this, args);
		page();
	};

	addEventListener("popstate", page);

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

export function enableAutoPageView(_initial = false) {
	if (options.autoPageView && !_initial) return;
	options.autoPageView = true;

	registerListeners();
}

// biome-ignore lint/suspicious/noConfusingVoidType: intentional
function send(url: string, data: Record<string, unknown>, useBeacon = true): Promise<Response | void> {
	try {
		const payload = data;
    if (userData.userId) payload.visitorId = userData.userId;
    if (visitorId) payload.visitorId = visitorId;

		if (useBeacon && navigator?.sendBeacon(url, JSON.stringify(payload))) {
			return Promise.resolve();
		}

		return fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			keepalive: true,
		});
	} catch (error) {
		console.error(error);
		return Promise.reject(error);
	}
}

function createEvent(event: SelineCustomEvent | SelinePageViewEvent): void {
	send(`${options.apiHost}/s/e`, { token: options.token, ...event });
}

export function track(
	name: string,
	data?: Record<string, unknown> | null,
): void {
	let pathname: string | null | undefined = "";
	if (window?.location?.pathname) {
		pathname = processPathname(
			window.location.pathname,
			options.maskPatterns ?? [],
			options.skipPatterns ?? [],
		);
	}

	const args: SelineCustomEvent = {
		name,
		data,
	};

	if (pathname) args.pathname = pathname;

	if (!inited) {
		beforeInitQueue.push({ name: "event", args });
		return;
	}
	createEvent(args);
}

export function page() {
	if (lastPage === window.location.pathname) return;
	lastPage = window.location.pathname;

	const pathname = processPathname(
		window.location.pathname,
		options.maskPatterns ?? [],
		options.skipPatterns ?? [],
	);
	if (!pathname) return;

	if (!referrer || referrer.includes(location.hostname)) {
		referrer = null;
	}

	const args = {
		pathname: pathname + window.location.search,
		referrer,
	};

	if (!inited) {
		beforeInitQueue.push({ name: "event", args });
		return;
	}

	createEvent(args);

	if (referrer) {
		referrer = null;
		sessionStorage.setItem("seline:referrer", "set");
	}
}

export function setUser(data: SelineUserData) {
	userData = { ...userData, ...data };

	if (!inited) {
		beforeInitQueue.push({ name: "user", args: userData });
		return;
	}

	send(`${options.apiHost}/s/su`, { token: options.token, fields: userData }, false)
		.then(async (response) => {
			if (response) {
				const json = await response.json();
				if (json?.visitorId) {
					visitorId = json.visitorId as string;
					if (options.cookieOnIdentify) {
						setCookie(STORAGE_KEY, visitorId as string);
					}
				}
			}
		})
		.catch(console.error);
}
