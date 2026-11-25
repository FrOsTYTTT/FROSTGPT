const MAX_PAGE_LENGTH = 8_000_000;
const MAX_TRANSCRIPT_LENGTH = 18_000;
const MAX_THUMBNAIL_BYTES = 2_000_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return "";
  }
}

function getVideoTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || "";
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    const canonical = `https://www.youtube.com/watch?v=${id}`;
    return { provider: "YouTube", id, canonical, oembed: `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json` };
  }

  if (["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(host) || host.endsWith(".tiktok.com")) {
    if (!/(?:\/video\/\d+|\/t\/)/.test(url.pathname) && !["vm.tiktok.com", "vt.tiktok.com"].includes(host)) return null;
    return { provider: "TikTok", id: url.pathname.match(/\/video\/(\d+)/)?.[1] || "", canonical: url.href, oembed: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.href)}` };
  }

  if (["vimeo.com", "player.vimeo.com"].includes(host)) {
    const id = url.pathname.match(/(?:video\/)?(\d+)/)?.[1] || "";
    if (!id) return null;
    const canonical = `https://vimeo.com/${id}`;
    return { provider: "Vimeo", id, canonical, oembed: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonical)}` };
  }

  return null;
}

async function fetchYouTubeTranscript(videoId) {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FROSTGPT/1.0)",
        "Accept": "text/html"
      },
      redirect: "follow"
    });
    if (!page.ok) return "";
    const html = await page.text();
    if (html.length > MAX_PAGE_LENGTH) return "";

    const marker = html.indexOf('"playerCaptionsTracklistRenderer"');
    if (marker < 0) return "";
    const section = html.slice(marker, marker + 250_000);
    const tracksMatch = section.match(/"captionTracks"\s*:\s*\[([\s\S]{0,100000}?)\]/);
    if (!tracksMatch) return "";
    const trackMatch = tracksMatch[1].match(/"baseUrl"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (!trackMatch) return "";

    const baseUrl = decodeJsonString(trackMatch[1]);
    const captionsUrl = new URL(baseUrl);
    if (!["youtube.com", "www.youtube.com"].includes(captionsUrl.hostname)) return "";
    captionsUrl.searchParams.set("fmt", "json3");

    const captionsResponse = await fetch(captionsUrl.toString(), {
      headers: { "Accept": "application/json,text/plain,*/*" },
      redirect: "follow"
    });
    if (!captionsResponse.ok) return "";
    const raw = await captionsResponse.text();
    if (raw.length > 2_000_000) return "";
    const data = JSON.parse(raw);
    const text = (data.events || [])
      .flatMap(event => event.segs || [])
      .map(segment => segment.utf8 || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, MAX_TRANSCRIPT_LENGTH);
  } catch (error) {
    console.warn("FROSTGPT video-link: YouTube captions unavailable.", error);
    return "";
  }
}

function thumbnailHostAllowed(value, provider) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (provider === "YouTube") return host === "i.ytimg.com";
    if (provider === "TikTok") return host === "tiktokcdn.com" || host.endsWith(".tiktokcdn.com") || host === "tiktokcdn-us.com" || host.endsWith(".tiktokcdn-us.com");
    if (provider === "Vimeo") return host === "i.vimeocdn.com";
  } catch {
    return false;
  }
  return false;
}

async function getThumbnailData(thumbnailUrl, provider) {
  if (!thumbnailUrl || !thumbnailHostAllowed(thumbnailUrl, provider)) return null;
  try {
    const response = await fetch(thumbnailUrl, { redirect: "follow" });
    if (!response.ok || !thumbnailHostAllowed(response.url || thumbnailUrl, provider)) return null;
    const type = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_THUMBNAIL_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_THUMBNAIL_BYTES) return null;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}


export async function analyzeVideoUrl(raw) {
  const target = getVideoTarget(String(raw || "").trim());
  if (!target) {
    return { error: "That link is not a supported public YouTube, TikTok, or Vimeo video URL." };
  }

  try {
    const metadataResponse = await fetch(target.oembed, {
      headers: { "Accept": "application/json" },
      redirect: "follow"
    });
    if (!metadataResponse.ok) {
      return {
        error: `${target.provider} did not provide public video information. The video may be private, removed, restricted, or temporarily unavailable.`
      };
    }

    const metadataText = await metadataResponse.text();
    if (metadataText.length > 500_000) return { error: "The video provider returned too much metadata." };
    const metadata = JSON.parse(metadataText);
    const transcript = target.provider === "YouTube" ? await fetchYouTubeTranscript(target.id) : "";
    const thumbnailData = await getThumbnailData(metadata.thumbnail_url, target.provider);

    const transcriptStatus = transcript
      ? "A transcript was retrieved. It may be incomplete or auto-generated."
      : target.provider === "YouTube"
        ? "No accessible caption transcript was found. Do not guess what is said or shown; ask the user to upload the video if detailed visual analysis is needed."
        : "This provider's public embed metadata does not include a transcript. Only the title, creator, and thumbnail may be available; ask the user to upload the video for detailed analysis.";

    return {
      provider: target.provider,
      url: target.canonical,
      title: String(metadata.title || "").slice(0, 500),
      author: String(metadata.author_name || "").slice(0, 200),
      thumbnailData,
      transcript: transcript || "",
      transcriptAvailable: Boolean(transcript),
      transcriptStatus,
      analysisLevel: transcript ? "caption transcript and thumbnail" : "public metadata and thumbnail only"
    };
  } catch (error) {
    console.error("FROSTGPT video-link analysis failed.", error);
    return { error: "FROSTGPT could not retrieve public information for that video link right now." };
  }
}
