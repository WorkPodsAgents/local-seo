// The seams between the checks and the world. The extension implements them with the service
// worker's fetch and DOMParser; the CLI and tests with Node's fetch and linkedom.

export interface FetchRequest {
  readonly url: string
  /** Defaults to text/html. */
  readonly accept?: string
  /** Sent as User-Agent where the runtime allows it; used to test AI crawler access. */
  readonly userAgent?: string
}

/** One HTTP response, never following redirects: the caller follows `location` itself. */
export interface FetchResponse {
  readonly url: string
  readonly status: number
  /** Keys lower-cased. */
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export interface Fetcher {
  fetch(request: FetchRequest): Promise<FetchResponse>
}

/** Parses HTML into a Document whose relative URLs resolve against `url`. */
export type HtmlParser = (html: string, url: string) => Document

/** Waits between requests, so a crawl stays polite; injected so tests do not sleep. */
export type Sleep = (ms: number) => Promise<void>
