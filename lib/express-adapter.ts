import type { Express, Request, Response } from "express";

function toWebRequest(req: Request): globalThis.Request {
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? req.protocol ?? "http";
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.get("host") ?? "localhost";
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return new globalThis.Request(url, init);
}

async function fromWebResponse(res: Response, response: globalThis.Response) {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });

  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (cookies.length > 0) {
    res.setHeader("Set-Cookie", cookies);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 0) {
    res.send(Buffer.from(buffer));
  } else {
    res.end();
  }
}

async function runHandler(
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => Promise<globalThis.Response>,
  hasParams: boolean,
) {
  try {
    const request = toWebRequest(req);
    const params = Object.fromEntries(
      Object.entries(req.params).map(([key, value]) => [key, String(value)]),
    );
    const response = hasParams
      ? await handler(request, { params: Promise.resolve(params) })
      : await handler(request);
    await fromWebResponse(res, response);
  } catch (err) {
    console.error("Route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export function mountRoute(
  app: Express,
  method: "get" | "post" | "patch" | "delete" | "options",
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => Promise<globalThis.Response>,
  hasParams = false,
) {
  app[method](path, (req, res) => runHandler(req, res, handler, hasParams));
}
