export type SelineOptions = {
  token: string;
  apiHost?: string | null;
};

type SelineCustomEvent = {
  userId: string;
  name: string;
  data?: Record<string, unknown> | null;
};

type SelineUserData = {
  userId: string;
  fields: Record<string, unknown>;
};

export function Seline(options: SelineOptions) {
  const token = options.token;
  const apiHost = options.apiHost ?? "https://api.seline.so";

  function track(data: SelineCustomEvent): void {
    send(`${apiHost}/s/e`, { token, ...data });
  }

  function setUser(data: SelineUserData) {
    send(`${apiHost}/s/su`, { token, ...data });
  }

  function send(url: string, data: Record<string, unknown>): void {
    try {
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error(error);
    }
  }

  return {
    track,
    setUser,
  };
}
