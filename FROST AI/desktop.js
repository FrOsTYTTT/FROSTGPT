import { app, BrowserWindow, ipcMain, shell } from "electron";
import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FROSTGPT_URL = "https://frostgptai.pages.dev/";
const GOOGLE_CLIENT_ID = "650451428263-ga39f7mvs4c1umd822c6sol2f5hh1jpp.apps.googleusercontent.com";
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

function base64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createGoogleOAuthFlow() {
  return new Promise((resolve, reject) => {
    const state = randomBytes(32).toString("hex");
    const codeVerifier = base64Url(randomBytes(32));
    const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());
    let finished = false;
    let redirectUri = "";

    const server = http.createServer(async (request, response) => {
      const callbackUrl = new URL(request.url || "/", "http://127.0.0.1");

      if (request.method !== "GET" || callbackUrl.pathname !== "/oauth2callback") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found.");
        return;
      }

      const receivedState = callbackUrl.searchParams.get("state") || "";
      const expected = Buffer.from(state);
      const received = Buffer.from(receivedState);

      if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Authentication could not be verified. You can close this tab.");
        finish(new Error("Google sign-in state verification failed."));
        return;
      }

      const oauthError = callbackUrl.searchParams.get("error");
      if (oauthError) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<h2>FROSTGPT sign-in was not completed.</h2><p>You can close this tab and return to FROSTGPT.</p>");
        finish(new Error("Google sign-in was not completed: " + oauthError));
        return;
      }

      const code = callbackUrl.searchParams.get("code");
      if (!code) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Google did not return an authorization code.");
        finish(new Error("Google did not return an authorization code."));
        return;
      }

      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
          })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || typeof tokenData.id_token !== "string") {
          throw new Error(tokenData.error_description || tokenData.error || "Google did not return an identity token.");
        }

        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><head><meta charset=\"utf-8\"><title>FROSTGPT</title></head><body style=\"font-family:Arial,sans-serif;text-align:center;padding:48px;background:#10131b;color:#fff\"><h2>Google sign-in complete</h2><p>You can close this browser tab and return to FROSTGPT.</p></body></html>");
        finish(null, { idToken: tokenData.id_token });
      } catch (error) {
        response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<h2>FROSTGPT could not complete sign-in.</h2><p>Close this tab and try again in the app.</p>");
        finish(error);
      }
    });

    const timeout = setTimeout(() => {
      finish(new Error("Google sign-in timed out. Please try again."));
    }, OAUTH_TIMEOUT_MS);

    function finish(error, result) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (server.listening) server.close();
      if (error) reject(error);
      else resolve(result);
    }

    server.on("error", finish);

    server.listen(0, "127.0.0.1", async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        finish(new Error("Could not start the local sign-in listener."));
        return;
      }

      redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account"
      }).toString();

      try {
        await shell.openExternal(authUrl.toString());
      } catch (error) {
        finish(new Error("Could not open your default browser: " + error.message));
      }
    });
  });
}

ipcMain.handle("frostgpt:google-sign-in", async () => {
  return createGoogleOAuthFlow();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "FROSTGPT™",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "desktop-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== "https://frostgptai.pages.dev") {
        event.preventDefault();
        if (url.startsWith("https://") || url.startsWith("http://")) {
          shell.openExternal(url);
        }
      }
    } catch {
      event.preventDefault();
    }
  });

  window.loadURL(FROSTGPT_URL);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.frostgpt.desktop");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
