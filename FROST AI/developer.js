import { getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const auth = getAuth(getApp());
  const list = byId("developerKeyList");
  const status = byId("developerKeyStatus");
  const createButton = byId("createDeveloperKey");
  const keyElement = byId("developerGeneratedKey");
  const copyButton = byId("copyDeveloperKey");
  let latestKey = "";

  async function requestKeys(method = "GET", body) {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in to manage your API keys.");
    const token = await user.getIdToken();
    const response = await fetch("/api/keys", {
      method,
      headers: {
        "Authorization": "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The API key service is unavailable.");
    return data;
  }

  function clearOneTimeKey() {
    latestKey = "";
    keyElement.textContent = "";
    keyElement.hidden = true;
    copyButton.hidden = true;
  }

  function renderKeys(keys) {
    list.replaceChildren();
    if (!keys.length) {
      const empty = document.createElement("p");
      empty.className = "developer-key-status";
      empty.textContent = "You haven't created any API keys yet.";
      list.append(empty);
      return;
    }
    for (const item of keys) {
      const row = document.createElement("article");
      row.className = "developer-key-row";
      const copy = document.createElement("div");
      copy.className = "developer-key-row-copy";
      const name = document.createElement("strong");
      name.textContent = item.name;
      const details = document.createElement("small");
      details.textContent = (item.key_prefix || "frost_sk_…") + " · Created " + new Date(item.created_at + (item.created_at.endsWith("Z") ? "" : "Z")).toLocaleString();
      const state = document.createElement("span");
      state.className = "developer-key-status-pill";
      state.textContent = item.revoked_at ? "REVOKED" : "ACTIVE";
      copy.append(name, details, state);
      row.append(copy);
      if (!item.revoked_at) {
        const revoke = document.createElement("button");
        revoke.className = "developer-revoke-key-button";
        revoke.type = "button";
        revoke.textContent = "Revoke";
        revoke.addEventListener("click", async () => {
          revoke.disabled = true;
          try {
            await requestKeys("DELETE", { id: item.id });
            if (status) status.textContent = "API key revoked. It can no longer authenticate API requests.";
            await loadKeys();
          } catch (error) {
            if (status) status.textContent = error.message;
            revoke.disabled = false;
          }
        });
        row.append(revoke);
      }
      list.append(row);
    }
  }

  async function loadKeys() {
    list.textContent = "Loading API keys…";
    try {
      const data = await requestKeys();
      renderKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch (error) {
      list.textContent = error.message;
    }
  }

  async function createKey() {
    const nameInput = byId("developerKeyName");
    const name = nameInput.value.trim();
    if (!name) {
      status.textContent = "Enter a name for this API key.";
      nameInput.focus();
      return;
    }
    createButton.disabled = true;
    status.textContent = "Creating your API key securely…";
    clearOneTimeKey();
    try {
      const data = await requestKeys("POST", { name });
      latestKey = data.key;
      keyElement.textContent = latestKey;
      keyElement.hidden = false;
      copyButton.hidden = false;
      nameInput.value = "";
      status.textContent = "Key created. Copy it now; the full value will not be shown again.";
      await loadKeys();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      createButton.disabled = false;
    }
  }

  createButton?.addEventListener("click", createKey);
  byId("refreshDeveloperKeys")?.addEventListener("click", loadKeys);
  byId("openDeveloperKeys")?.addEventListener("click", loadKeys);
  byId("copyDeveloperKey")?.addEventListener("click", async () => {
    if (!latestKey) return;
    try {
      await navigator.clipboard.writeText(latestKey);
      status.textContent = "Copied. Store this key somewhere private; it cannot be retrieved later.";
    } catch {
      status.textContent = "Clipboard access was blocked. Select the displayed key and copy it manually.";
    }
  });
  byId("backFromDeveloperKeys")?.addEventListener("click", clearOneTimeKey);
  byId("closeDeveloperPortal")?.addEventListener("click", clearOneTimeKey);
  auth.onAuthStateChanged(user => {
    if (user && !byId("developerKeysPage").hidden) loadKeys();
  });
})();
