import tls from "tls";
import net from "net";

export interface ImapConnectionOptions {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
}

export interface FetchedImapMessage {
  messageId: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml?: string;
  date: string;
  inReplyTo?: string;
}

/**
 * Decodes RFC 2047 MIME encoded-words (=?charset?encoding?encoded_text?=).
 * Handles both Q-encoding (quoted-printable) and B-encoding (base64),
 * multiline header unfolding, and adjacent encoded-word whitespace removal.
 */
export function decodeMimeHeader(raw: string): string {
  if (!raw) return "";

  // 1. Unfold multiline headers (CRLF or LF followed by whitespace is a continuation line)
  let text = raw.replace(/\r?\n[ \t]+/g, " ").trim();

  // 2. RFC 2047: whitespace between adjacent encoded-words MUST be ignored
  text = text.replace(
    /(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?[^?]*\?=)/g,
    "$1"
  );

  // 3. Decode encoded-words: =?charset?encoding?encoded_text?=
  // Also tolerate loose trailing '=' or missing closing '?=' in malformed headers
  const encodedWordRegex = /=\?([^?]+)\?([BbQq])\?([^?]*?)(?:\?=|\?|$)/g;

  let decoded = text.replace(encodedWordRegex, (fullMatch, charset, encoding, payload) => {
    try {
      const enc = encoding.toUpperCase();
      if (enc === "B") {
        return Buffer.from(payload, "base64").toString("utf8");
      } else if (enc === "Q") {
        // In Q encoding: '_' represents space (0x20), '=XX' is a hex byte
        const normalized = payload.replace(/_/g, " ");
        const bytes: number[] = [];
        for (let i = 0; i < normalized.length; i++) {
          if (normalized[i] === "=" && i + 2 < normalized.length) {
            const hex = normalized.slice(i + 1, i + 3);
            if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
              bytes.push(parseInt(hex, 16));
              i += 2;
              continue;
            }
          }
          bytes.push(normalized.charCodeAt(i));
        }
        return Buffer.from(bytes).toString("utf8");
      }
    } catch {
      return fullMatch;
    }
    return fullMatch;
  });

  // Clean any leftover orphan delimiters like trailing '=' or '?='
  decoded = decoded.replace(/\s*=\s*$/, "").trim();

  return decoded;
}

/**
 * Decodes quoted-printable string into clean UTF-8 text.
 */
export function decodeQuotedPrintable(input: string): string {
  if (!input) return "";

  // 1. Remove soft line breaks: '=' followed by optional '\r' and '\n'
  const withoutSoftBreaks = input.replace(/=\r?\n/g, "");

  // 2. Decode =XX hex byte sequences into proper UTF-8 string
  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    if (withoutSoftBreaks[i] === "=" && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i));
  }

  return Buffer.from(bytes).toString("utf8");
}

/**
 * Cleans raw MIME bodies by stripping boundary markers, MIME subheaders,
 * and decoding quoted-printable or base64 payloads to plain text.
 */
export function cleanMimeBody(raw: string): { cleanText: string; cleanHtml?: string } {
  if (!raw) return { cleanText: "" };

  let text = raw.trim();

  // Check for multipart boundary pattern, e.g. --0000000000009d53d3065cc458b1
  const boundaryMatch = text.match(/^--([a-zA-Z0-9_\-=.]+)/m);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    // Split on boundary delimiter
    const parts = text.split(new RegExp(`--${boundary}(?:--)?`));

    let extractedPlain = "";
    let extractedHtml = "";

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      // Separate headers from payload at first blank line
      const headerBodySplit = trimmedPart.split(/\r?\n\r?\n/);
      const partHeaders = headerBodySplit[0] || "";
      const partBody = headerBodySplit.slice(1).join("\n\n").trim();

      const isHtml = /Content-Type:\s*text\/html/i.test(partHeaders);
      const isPlain = /Content-Type:\s*text\/plain/i.test(partHeaders) || (!isHtml && partBody.length > 0);
      const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(partHeaders);
      const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(partHeaders);

      let decodedPayload = partBody;
      if (isBase64) {
        try {
          decodedPayload = Buffer.from(partBody.replace(/\s+/g, ""), "base64").toString("utf8");
        } catch {
          decodedPayload = partBody;
        }
      } else if (isQP || decodedPayload.includes("=")) {
        decodedPayload = decodeQuotedPrintable(decodedPayload);
      }

      if (isPlain && !extractedPlain) {
        extractedPlain = decodedPayload;
      } else if (isHtml && !extractedHtml) {
        extractedHtml = decodedPayload;
      }
    }

    if (extractedPlain) {
      return {
        cleanText: extractedPlain.trim(),
        cleanHtml: extractedHtml.trim() || undefined,
      };
    } else if (extractedHtml) {
      // Fallback: convert HTML to text
      const stripped = extractedHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n\s+\n/g, "\n\n")
        .trim();
      return {
        cleanText: stripped,
        cleanHtml: extractedHtml.trim(),
      };
    }
  }

  // If not multipart or fallback:
  // 1. Strip boundary lines if any
  text = text.replace(/^--[a-zA-Z0-9_\-=.]+(?:--)?\s*$/gm, "");

  // 2. Strip inline MIME header blocks (Content-Type:, Content-Transfer-Encoding:, etc.)
  text = text.replace(/^(?:Content-Type|Content-Transfer-Encoding|Content-Disposition|charset):[^\n]*\n?/gim, "");

  // 3. Decode quoted-printable if present
  if (text.includes("=") && (/=[0-9A-Fa-f]{2}/.test(text) || /=\r?\n/.test(text))) {
    text = decodeQuotedPrintable(text);
  }

  // 4. Strip any leading blank lines or residual boundary artifacts
  text = text.replace(/^--[a-zA-Z0-9_\-=.]+\s*/g, "").trim();

  return { cleanText: text };
}

/**
 * Cleanly parse an email header line (e.g. From: "John Doe" <john@example.com>)
 * and decodes any RFC 2047 encoded names.
 */
export function parseEmailAddress(raw: string): { name: string; email: string } {
  if (!raw) return { name: "", email: "" };
  const decodedRaw = decodeMimeHeader(raw.trim());
  const match = decodedRaw.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/);
  if (match) {
    return {
      name: (match[1] || "").trim() || match[2].trim(),
      email: match[2].trim().toLowerCase(),
    };
  }
  return {
    name: decodedRaw.split("@")[0] || decodedRaw,
    email: decodedRaw.toLowerCase(),
  };
}

/**
 * Verify IMAP connection and credentials via RFC 3501 handshake
 */
export async function verifyImap(
  options: ImapConnectionOptions
): Promise<{ success: boolean; error?: string }> {
  // If host is demo/localhost/empty and no password, handle test or mock
  if (!options.host || !options.username || !options.password) {
    return {
      success: false,
      error: "Host, username, and password are required for IMAP verification.",
    };
  }

  // Handle local/mock mode without stalling
  if (
    options.host === "localhost" ||
    options.host === "127.0.0.1" ||
    options.host === "mock" ||
    options.host.endsWith(".local")
  ) {
    return { success: true };
  }

  return new Promise((resolve) => {
    let resolved = false;
    let buffer = "";
    let step: "GREETING" | "LOGIN" | "LOGOUT" | "DONE" = "GREETING";

    const done = (result: { success: boolean; error?: string }) => {
      if (!resolved) {
        resolved = true;
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        resolve(result);
      }
    };

    const timeout = setTimeout(() => {
      done({
        success: false,
        error: `IMAP connection to ${options.host}:${options.port} timed out after 8 seconds.`,
      });
    }, 8000);

    const socketOptions = {
      host: options.host,
      port: options.port || 993,
      rejectUnauthorized: false,
    };

    let socket: net.Socket;

    try {
      if (options.secure !== false) {
        socket = tls.connect(socketOptions, () => {
          // Connected securely
        });
      } else {
        socket = net.connect(socketOptions, () => {
          // Connected unencrypted
        });
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      return done({
        success: false,
        error: `Could not initiate connection to ${options.host}: ${(err as Error).message}`,
      });
    }

    socket.setEncoding("utf8");

    socket.on("error", (err) => {
      clearTimeout(timeout);
      done({
        success: false,
        error: `IMAP socket error: ${err.message}`,
      });
    });

    socket.on("data", (data: string) => {
      buffer += data;

      if (step === "GREETING") {
        if (buffer.includes("* OK") || buffer.includes("* PREAUTH")) {
          step = "LOGIN";
          buffer = "";
          const safeUser = options.username.replace(/"/g, '\\"');
          const safePass = (options.password || "").replace(/"/g, '\\"');
          socket.write(`A001 LOGIN "${safeUser}" "${safePass}"\r\n`);
        } else if (buffer.includes("* NO") || buffer.includes("* BYE")) {
          clearTimeout(timeout);
          done({
            success: false,
            error: "IMAP server rejected connection greeting: " + buffer.trim(),
          });
        }
      } else if (step === "LOGIN") {
        if (buffer.includes("A001 OK")) {
          step = "LOGOUT";
          buffer = "";
          socket.write("A002 LOGOUT\r\n");
          clearTimeout(timeout);
          done({ success: true });
        } else if (buffer.includes("A001 NO") || buffer.includes("A001 BAD")) {
          clearTimeout(timeout);
          const errorMsg = buffer
            .split("\n")
            .filter((l) => l.startsWith("A001"))
            .join(" ")
            .trim();
          done({
            success: false,
            error: errorMsg || "Invalid IMAP username or password.",
          });
        }
      }
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      if (!resolved) {
        done({
          success: false,
          error: "Connection closed unexpectedly by IMAP server.",
        });
      }
    });
  });
}

/**
 * Fetch recent incoming messages from an IMAP mailbox.
 * Returns an array of parsed messages with clean headers and bodies.
 */
export async function fetchImapInbox(
  options: ImapConnectionOptions,
  limit: number = 20
): Promise<{ success: boolean; messages: FetchedImapMessage[]; error?: string }> {
  if (!options.host || !options.username || !options.password) {
    return {
      success: false,
      messages: [],
      error: "IMAP credentials not configured.",
    };
  }

  // Handle local/mock host
  if (
    options.host === "localhost" ||
    options.host === "127.0.0.1" ||
    options.host === "mock" ||
    options.host.endsWith(".local")
  ) {
    return {
      success: true,
      messages: [],
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    let buffer = "";
    let step: "GREETING" | "LOGIN" | "SELECT" | "FETCH" | "LOGOUT" = "GREETING";
    const messages: FetchedImapMessage[] = [];

    const done = (result: { success: boolean; messages: FetchedImapMessage[]; error?: string }) => {
      if (!resolved) {
        resolved = true;
        try {
          socket.destroy();
        } catch {
          // ignore
        }
        resolve(result);
      }
    };

    const timeout = setTimeout(() => {
      done({
        success: false,
        messages: [],
        error: `IMAP fetch from ${options.host} timed out after 10 seconds.`,
      });
    }, 10000);

    const socketOptions = {
      host: options.host,
      port: options.port || 993,
      rejectUnauthorized: false,
    };

    let socket: net.Socket;
    try {
      if (options.secure !== false) {
        socket = tls.connect(socketOptions);
      } else {
        socket = net.connect(socketOptions);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      return done({
        success: false,
        messages: [],
        error: (err as Error).message,
      });
    }

    socket.setEncoding("utf8");

    socket.on("error", (err) => {
      clearTimeout(timeout);
      done({
        success: false,
        messages: [],
        error: `IMAP connection error: ${err.message}`,
      });
    });

    socket.on("data", (data: string) => {
      buffer += data;

      if (step === "GREETING") {
        if (buffer.includes("* OK") || buffer.includes("* PREAUTH")) {
          step = "LOGIN";
          buffer = "";
          const safeUser = options.username.replace(/"/g, '\\"');
          const safePass = (options.password || "").replace(/"/g, '\\"');
          socket.write(`A001 LOGIN "${safeUser}" "${safePass}"\r\n`);
        }
      } else if (step === "LOGIN") {
        if (buffer.includes("A001 OK")) {
          step = "SELECT";
          buffer = "";
          socket.write(`A002 SELECT INBOX\r\n`);
        } else if (buffer.includes("A001 NO") || buffer.includes("A001 BAD")) {
          clearTimeout(timeout);
          done({
            success: false,
            messages: [],
            error: "Authentication failed with IMAP server.",
          });
        }
      } else if (step === "SELECT") {
        if (buffer.includes("A002 OK")) {
          // Extract EXISTS count: * 45 EXISTS
          const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
          const count = existsMatch ? parseInt(existsMatch[1], 10) : 0;

          if (count === 0) {
            step = "LOGOUT";
            socket.write("A004 LOGOUT\r\n");
            clearTimeout(timeout);
            return done({ success: true, messages: [] });
          }

          step = "FETCH";
          buffer = "";
          const start = Math.max(1, count - limit + 1);
          // Fetch headers and body text
          socket.write(`A003 FETCH ${start}:${count} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)] BODY.PEEK[TEXT]<0.4000>)\r\n`);
        } else if (buffer.includes("A002 NO") || buffer.includes("A002 BAD")) {
          clearTimeout(timeout);
          done({
            success: false,
            messages: [],
            error: "Failed to open INBOX folder on IMAP server.",
          });
        }
      } else if (step === "FETCH") {
        if (buffer.includes("A003 OK") || buffer.includes("A003 NO")) {
          const parsed = parseImapFetchResponse(buffer);
          messages.push(...parsed);
          step = "LOGOUT";
          socket.write("A004 LOGOUT\r\n");
          clearTimeout(timeout);
          done({ success: true, messages });
        }
      }
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      if (!resolved) {
        done({ success: true, messages });
      }
    });
  });
}

/**
 * Parser for IMAP fetch response text with RFC 2047 header decoding
 * and clean MIME body extraction.
 */
function parseImapFetchResponse(raw: string): FetchedImapMessage[] {
  const results: FetchedImapMessage[] = [];
  const chunks = raw.split(/\*\s+\d+\s+FETCH\s+/i).filter(Boolean);

  for (const chunk of chunks) {
    const getHeader = (name: string): string => {
      const regex = new RegExp(`^${name}:[ \t]*([\\s\\S]*?)(?=\\r?\\n[a-zA-Z0-9_-]+:|$|\\r?\\n\\r?\\n)`, "mi");
      const match = chunk.match(regex);
      return match ? decodeMimeHeader(match[1]) : "";
    };

    const fromRaw = getHeader("From");
    const toRaw = getHeader("To");
    const subject = getHeader("Subject") || "No Subject";
    const dateRaw = getHeader("Date");
    const parsedFrom = parseEmailAddress(fromRaw);
    const parsedTo = parseEmailAddress(toRaw);

    const rawMsgId = getHeader("Message-ID");
    let messageId = rawMsgId ? rawMsgId.trim() : "";
    if (!messageId) {
      const normalizedSender = (parsedFrom.email || "").toLowerCase().trim();
      const normalizedSubject = (subject || "").trim().toLowerCase();
      const normalizedDate = dateRaw ? dateRaw.trim() : "";
      const rawSeed = `${normalizedSender}|${normalizedSubject}|${normalizedDate}`;
      let hash = 0;
      for (let i = 0; i < rawSeed.length; i++) {
        hash = (hash << 5) - hash + rawSeed.charCodeAt(i);
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).padStart(8, "0");
      messageId = `<msg-${hexHash}-${Buffer.from(rawSeed).toString("hex").slice(0, 16)}@imap>`;
    }
    const inReplyTo = getHeader("In-Reply-To");

    if (!parsedFrom.email) continue;

    // Extract raw body chunk
    let rawBody = "";
    const bodyMatch = chunk.match(/BODY\[TEXT\](?:<\d+>)?\s+\{\d+\}\r?\n([\s\S]*?)(?=\r?\n\s*\)|$)/i);
    if (bodyMatch) {
      rawBody = bodyMatch[1].trim();
    } else {
      // Fallback: lines after headers
      const lines = chunk.split("\n");
      const textLines = lines.filter((l) => !l.includes(":") && l.length > 0);
      rawBody = textLines.slice(0, 10).join("\n").trim();
    }

    // Clean body and strip multipart boundaries
    const { cleanText, cleanHtml } = cleanMimeBody(rawBody);

    const snippet = cleanText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    let parsedDate = new Date().toISOString();
    if (dateRaw) {
      const d = new Date(dateRaw);
      if (!isNaN(d.getTime())) {
        parsedDate = d.toISOString();
      }
    }

    results.push({
      messageId,
      fromEmail: parsedFrom.email,
      fromName: parsedFrom.name || parsedFrom.email,
      toEmail: parsedTo.email || "infotflux@gmail.com",
      subject: decodeMimeHeader(subject),
      snippet: snippet || "(No preview available)",
      bodyText: cleanText || snippet,
      bodyHtml: cleanHtml,
      date: parsedDate,
      inReplyTo: inReplyTo || undefined,
    });
  }

  return results;
}
