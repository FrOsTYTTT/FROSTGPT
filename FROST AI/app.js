
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

(() => {
  "use strict";

  // ==========================================
  // FIREBASE CONFIGURATION
  // ==========================================

  const firebaseConfig = {
    apiKey: "AIzaSyBfpeqUE8DauZ5VqNszWKoey1Cl4R5ZIQ",
    authDomain: "frostgpt-4e3fa.firebaseapp.com",
    projectId: "frostgpt-4e3fa",
    storageBucket: "frostgpt-4e3fa.firebasestorage.app",
    messagingSenderId: "650451428263",
    appId: "1:650451428263:web:ce4dd9ea1678d2686c0c82",
    measurementId: "G-7EGCH66DG6"
  };

  const $ = id => document.getElementById(id);

  const authScreen = $("authScreen");
  const authStatus = $("authStatus");
  const googleSignInButton = $("googleSignInButton");
  const appElement = $("app");
  const signOutButton = $("signOutButton");
  const accountName = $("accountName");
  const accountPhoto = $("accountPhoto");

  let auth;
  let db;
  let googleProvider;
  let firebaseReady = false;
  let currentUserId = null;
  let currentUser = null;
  let openSettingsAfterSignIn = false;

  // ==========================================
  // PERSONALIZATION
  // ==========================================

  function nicknameStorageKey(userId = currentUserId) {
    return userId ? `frostgpt_nickname_${userId}` : null;
  }

  function getSavedNickname(userId = currentUserId) {
    const key = nicknameStorageKey(userId);
    if (!key) return "";

    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function getAccountName(user = currentUser) {
    if (!user) return "there";

    const nickname = getSavedNickname(user.uid).trim();

    if (nickname) return nickname;

    if (user.displayName && user.displayName.trim()) {
      return user.displayName.trim().split(/\s+/)[0];
    }

    if (user.email) {
      return user.email.split("@")[0] || "there";
    }

    return "there";
  }

  function saveNickname(value) {
    if (!currentUserId) return;

    const nickname = String(value || "").trim();

    if (nickname.length > 30) {
      alert("Your nickname cannot exceed 30 characters.");
      return;
    }

    try {
      const key = nicknameStorageKey();

      if (nickname) {
        localStorage.setItem(key, nickname);
      } else {
        localStorage.removeItem(key);
      }

      updateNicknameSettings();
      updateAccountDisplay();

      if (getConversation()) renderConversation();

      const status = $("nicknameSavedStatus");

      if (status) {
        status.textContent = nickname
          ? "✓ Nickname saved"
          : "✓ Using your Google account name";
      }
    } catch (error) {
      console.error("FROSTGPT: Nickname could not be saved.", error);
      alert("Your nickname could not be saved in this browser.");
    }
  }

  function updateAccountDisplay() {
    if (!accountName || !currentUser) return;
    accountName.textContent = getAccountName(currentUser);
  }

  // ==========================================
  // SETTINGS
  // ==========================================

  const SETTINGS_KEY = "frostgpt_settings_v1";

  const DEFAULT_SETTINGS = {
    theme: "dark",
    accent: "blue",
    customColor: "#3694ff",
    fontSize: "medium",
    enterKey: "send",
    chatHistory: true,
    sounds: false,
    animations: true
  };

  let settings = { ...DEFAULT_SETTINGS };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (saved) {
        settings = {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved)
        };
      }
    } catch (error) {
      console.warn("FROSTGPT: Could not load settings.", error);
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      const status = $("settingsSaved");
      if (status) status.textContent = "✓ Settings saved";
    } catch (error) {
      console.error("FROSTGPT: Could not save settings.", error);

      const status = $("settingsSaved");
      if (status) status.textContent = "Could not save settings.";
    }
  }

  function applySettings() {
    const root = document.documentElement;
    const body = document.body;

    const accentColors = {
      blue: "#3694ff",
      purple: "#a78bfa",
      green: "#35bd83"
    };

    let accent = settings.accent === "custom"
      ? settings.customColor
      : accentColors[settings.accent] || accentColors.blue;

    if (!/^#[0-9a-f]{6}$/i.test(accent)) {
      accent = accentColors.blue;
    }

    root.style.setProperty("--accent", accent);

    const fontSizes = {
      small: "14px",
      medium: "17px",
      large: "20px"
    };

    root.style.setProperty(
      "--chat-font-size",
      fontSizes[settings.fontSize] || fontSizes.medium
    );

    const prefersLight = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;

    const lightTheme = settings.theme === "light" ||
      (settings.theme === "system" && prefersLight);

    body.classList.toggle("light-theme", lightTheme);
    body.classList.toggle("no-animations", !settings.animations);

    const customColorRow = $("customColorRow");

    if (customColorRow) {
      customColorRow.hidden = settings.accent !== "custom";
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');

    if (themeColor) {
      themeColor.content = lightTheme ? "#f4f6f9" : "#212121";
    }
  }

  function syncSettingsControls() {
    const controls = {
      settingTheme: settings.theme,
      settingAccent: settings.accent,
      settingCustomColor: settings.customColor,
      settingFontSize: settings.fontSize,
      settingEnter: settings.enterKey,
      settingHistory: settings.chatHistory,
      settingSounds: settings.sounds,
      settingAnimations: settings.animations
    };

    for (const [id, value] of Object.entries(controls)) {
      const element = $(id);
      if (!element) continue;

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = value;
      }
    }

    const customColorRow = $("customColorRow");

    if (customColorRow) {
      customColorRow.hidden = settings.accent !== "custom";
    }

    updateNicknameSettings();
  }

  let conversations = [];
  let activeConversationId = null;
  let attachments = [];
  let isThinking = false;
  let activeController = null;
  let requestId = 0;

  const deletingChats = new Set();

  function updateSetting(key, value) {
    const previous = settings[key];
    settings[key] = value;

    applySettings();
    saveSettings();
    syncSettingsControls();

    if (key === "chatHistory" && previous !== value && currentUserId) {
      if (value) {
        loadUserConversations(currentUserId);
      } else {
        if (isThinking) stopGenerating();

        const active = getConversation();

        conversations = active ? [active] : [];
        renderHistory();
        setStatus("Chat history saving is off");
      }
    }
  }

  function resetSettings() {
    settings = { ...DEFAULT_SETTINGS };

    applySettings();
    syncSettingsControls();
    saveSettings();

    if (currentUserId) {
      loadUserConversations(currentUserId);
    }
  }

  loadSettings();

  // ==========================================
  // NICKNAME SETTINGS UI
  // ==========================================

  let nicknameSettingsElement = null;

  function createNicknameSettings() {
    if (nicknameSettingsElement) return;

    const panel = $("settingsPanel");
    if (!panel) return;

    const container =
      panel.querySelector(
        ".settings-content, .settings-card, [role='dialog']"
      ) || panel;

    const section = document.createElement("section");
    section.id = "frostgptNicknameSettings";

    section.style.cssText = `
      margin: 18px 0;
      padding: 16px;
      border: 1px solid var(--border-color, rgba(255,255,255,.12));
      border-radius: 14px;
      color: inherit;
    `;

    const heading = document.createElement("h3");
    heading.textContent = "Personalization";
    heading.style.cssText = "margin: 0 0 6px; font-size: 16px;";

    const description = document.createElement("p");
    description.textContent =
      "Choose how FROSTGPT greets you when you sign in.";
    description.style.cssText =
      "margin: 0 0 12px; font-size: 13px; opacity: .7;";

    const label = document.createElement("label");
    label.htmlFor = "frostgptNicknameInput";
    label.textContent = "Your nickname";
    label.style.cssText =
      "display: block; margin-bottom: 7px; font-size: 13px;";

    const input = document.createElement("input");
    input.id = "frostgptNicknameInput";
    input.type = "text";
    input.maxLength = 30;
    input.placeholder = "Enter a nickname";
    input.autocomplete = "nickname";

    input.style.cssText = `
      box-sizing: border-box;
      width: 100%;
      padding: 11px 12px;
      border-radius: 9px;
      border: 1px solid var(--border-color, rgba(255,255,255,.2));
      background: var(--input-background, rgba(128,128,128,.12));
      color: inherit;
      font: inherit;
      outline-color: var(--accent, #3694ff);
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Save nickname";

    button.style.cssText = `
      margin-top: 10px;
      padding: 10px 15px;
      border: 0;
      border-radius: 9px;
      background: var(--accent, #3694ff);
      color: white;
      font-weight: 600;
      cursor: pointer;
    `;

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Use Google name";

    resetButton.style.cssText = `
      margin: 10px 0 0 8px;
      padding: 10px 12px;
      border: 1px solid var(--border-color, rgba(255,255,255,.2));
      border-radius: 9px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    `;

    const status = document.createElement("p");
    status.id = "nicknameSavedStatus";
    status.setAttribute("aria-live", "polite");
    status.style.cssText =
      "font-size: 12px; opacity: .75; margin: 10px 0 0;";

    button.addEventListener("click", () => saveNickname(input.value));

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveNickname(input.value);
      }
    });

    resetButton.addEventListener("click", () => saveNickname(""));

    section.append(
      heading,
      description,
      label,
      input,
      button,
      resetButton,
      status
    );

    container.appendChild(section);
    nicknameSettingsElement = section;

    updateNicknameSettings();
  }

  function updateNicknameSettings() {
    if (!nicknameSettingsElement) return;

    const input = $("frostgptNicknameInput");
    if (!input) return;

    input.value = getSavedNickname();
    input.disabled = !currentUserId;
  }

  // ==========================================
  // SETTINGS EVENTS
  // ==========================================

  const settingsPanel = $("settingsPanel");

  function openSettings() {
    if (!settingsPanel) {
      console.error("FROSTGPT: Settings panel was not found in index.html.");
      return;
    }

    createNicknameSettings();
    syncSettingsControls();

    settingsPanel.hidden = false;
    settingsPanel.setAttribute("aria-hidden", "false");

    $("closeSettings")?.focus();

    console.log("FROSTGPT: Settings opened.");
  }

  function closeSettings() {
    if (!settingsPanel) return;

    settingsPanel.hidden = true;
    settingsPanel.setAttribute("aria-hidden", "true");

    $("openSettings")?.focus();
  }

  $("openSettings")?.addEventListener("click", openSettings);
  $("closeSettings")?.addEventListener("click", closeSettings);
  $("resetSettings")?.addEventListener("click", resetSettings);

  settingsPanel?.addEventListener("click", event => {
    if (event.target === settingsPanel) closeSettings();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && settingsPanel && !settingsPanel.hidden) {
      closeSettings();
    }
  });

  const accountArea = $("accountArea");

  accountArea?.addEventListener("click", openSettings);

  accountArea?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSettings();
    }
  });

  const settingBindings = {
    settingTheme: "theme",
    settingAccent: "accent",
    settingFontSize: "fontSize",
    settingEnter: "enterKey"
  };

  for (const [id, key] of Object.entries(settingBindings)) {
    $(id)?.addEventListener("change", event => {
      updateSetting(key, event.target.value);
    });
  }

  $("settingCustomColor")?.addEventListener("input", event => {
    settings.customColor = event.target.value;
    settings.accent = "custom";

    applySettings();
    saveSettings();
    syncSettingsControls();
  });

  const checkboxBindings = {
    settingHistory: "chatHistory",
    settingSounds: "sounds",
    settingAnimations: "animations"
  };

  for (const [id, key] of Object.entries(checkboxBindings)) {
    $(id)?.addEventListener("change", event => {
      updateSetting(key, event.target.checked);
    });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)")
      .addEventListener?.("change", () => {
        if (settings.theme === "system") applySettings();
      });
  }

  applySettings();
  syncSettingsControls();

  // ==========================================
  // SOUND EFFECTS
  // ==========================================

  function playSound(frequency = 600) {
    if (!settings.sounds) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.045, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + 0.12
      );

      oscillator.connect(gain);
      gain.connect(audio.destination);

      oscillator.start();
      oscillator.stop(audio.currentTime + 0.12);

      oscillator.onended = () => audio.close();
    } catch (error) {
      console.warn("FROSTGPT: Sound effect unavailable.", error);
    }
  }

  // ==========================================
  // PWA INSTALLATION
  // ==========================================

  const installButton = $("installButton");
  const installHelp = $("installHelp");
  const installHelpText = $("installHelpText");
  const closeInstallHelp = $("closeInstallHelp");

  let deferredInstallPrompt = null;

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !window.MSStream;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  function hideInstallButton() {
    if (installButton) installButton.hidden = true;
  }

  function showInstallHelp(message) {
    if (!installHelp || !installHelpText) return;

    installHelpText.textContent = message;
    installHelp.hidden = false;
  }

  closeInstallHelp?.addEventListener("click", () => {
    installHelp.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js");

        console.log(
          "FROSTGPT: Service worker registered.",
          registration.scope
        );
      } catch (error) {
        console.error(
          "FROSTGPT: Service worker registration failed.",
          error
        );
      }
    });
  }

  if (isStandalone) {
    hideInstallButton();
  } else if (isIOS) {
    if (installButton) {
      installButton.hidden = false;

      installButton.addEventListener("click", () => {
        showInstallHelp(
          "To install FROSTGPT™ on your iPhone or iPad:\n\n" +
          "1. Open this website in Safari.\n" +
          "2. Tap the Share button.\n" +
          "3. Scroll down and tap Add to Home Screen.\n" +
          "4. Tap Add."
        );
      });
    }
  } else {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredInstallPrompt = event;

      if (installButton) {
        installButton.hidden = false;
        installButton.textContent = "↓ Install app";
      }
    });

    installButton?.addEventListener("click", async () => {
      if (!deferredInstallPrompt) {
        showInstallHelp(
          "Open your browser menu and look for Install FROSTGPT™."
        );
        return;
      }

      try {
        deferredInstallPrompt.prompt();

        const result = await deferredInstallPrompt.userChoice;

        if (result.outcome === "accepted") hideInstallButton();

        deferredInstallPrompt = null;
      } catch (error) {
        console.error("FROSTGPT: Installation failed.", error);
        showInstallHelp("Installation failed. Try your browser menu.");
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    hideInstallButton();
    deferredInstallPrompt = null;
  });

  // ==========================================
  // FIREBASE INITIALIZATION
  // ==========================================

  try {
    const firebaseApp = initializeApp(firebaseConfig);

    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    googleProvider = new GoogleAuthProvider();

    googleProvider.setCustomParameters({
      prompt: "select_account"
    });

    firebaseReady = true;

    console.log("FROSTGPT: Firebase initialized.");
    console.log("FROSTGPT: Firestore initialized.");
  } catch (error) {
    console.error("FROSTGPT: Firebase initialization failed.", error);

    if (authStatus) {
      authStatus.textContent =
        "Firebase initialization failed: " + error.message;
    }
  }

  // ==========================================
  // CHAT ELEMENTS
  // ==========================================

  const elements = {
    sidebar: $("sidebar"),
    newChat: $("newChat"),
    searchChats: $("searchChats"),
    historyList: $("historyList"),
    collapseSidebar: $("collapseSidebar"),
    openSidebar: $("openSidebar"),
    modeSelect: $("modeSelect"),
    statusText: $("statusText"),
    chat: $("chat"),
    chatInner: $("chatInner"),
    attachmentPreview: $("attachmentPreview"),
    attachButton: $("attachButton"),
    fileInput: $("fileInput"),
    messageInput: $("messageInput"),
    sendButton: $("sendButton"),
    imageButton: $("imageButton")
  };

  const {
    sidebar,
    newChat,
    searchChats,
    historyList,
    collapseSidebar,
    openSidebar,
    modeSelect,
    statusText,
    chat,
    chatInner,
    attachmentPreview,
    attachButton,
    fileInput,
    messageInput,
    sendButton,
    imageButton
  } = elements;

  if (
    !chatInner ||
    !messageInput ||
    !sendButton ||
    !statusText ||
    !modeSelect
  ) {
    console.error("FROSTGPT: Required HTML elements are missing.");
    return;
  }

  const CHAT_API = "/api/chat";
  const IMAGE_API = "/api/image";

  const MAX_IMAGES = 4;
  const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

  // ==========================================
  // GENERAL HELPERS
  // ==========================================

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function currentMode() {
    return modeSelect.value === "classic" ? "classic" : "flash";
  }

  function modeName() {
    return currentMode() === "classic"
      ? "FROSTGPT™ Classic"
      : "FROSTGPT™ Flash 3.0";
  }

  function setStatus(value) {
    statusText.textContent = value;
  }

  function getConversation() {
    return conversations.find(item => item.id === activeConversationId);
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      if (chat) chat.scrollTop = chat.scrollHeight;
    });
  }

  // ==========================================
  // SAFE MARKDOWN RENDERER
  // ==========================================

  function renderInlineMarkdown(container, source) {
    const text = String(source ?? "");

    const tokenPattern =
      /(`[^`\n]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+\*|_[^_\n]+_)/g;

    let lastIndex = 0;
    let match;

    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );
      }

      const token = match[0];
      let element = null;
      let innerText = "";

      if (token.startsWith("`") && token.endsWith("`")) {
        element = document.createElement("code");
        innerText = token.slice(1, -1);
      } else if (
        (token.startsWith("**") && token.endsWith("**")) ||
        (token.startsWith("__") && token.endsWith("__"))
      ) {
        element = document.createElement("strong");
        innerText = token.slice(2, -2);
      } else if (token.startsWith("~~") && token.endsWith("~~")) {
        element = document.createElement("del");
        innerText = token.slice(2, -2);
      } else if (
        (token.startsWith("*") && token.endsWith("*")) ||
        (token.startsWith("_") && token.endsWith("_"))
      ) {
        element = document.createElement("em");
        innerText = token.slice(1, -1);
      }

      if (element) {
        element.textContent = innerText;
        container.appendChild(element);
      } else {
        container.appendChild(document.createTextNode(token));
      }

      lastIndex = tokenPattern.lastIndex;
    }

    if (lastIndex < text.length) {
      container.appendChild(
        document.createTextNode(text.slice(lastIndex))
      );
    }
  }

  function renderMarkdown(container, source) {
    container.replaceChildren();

    const lines = String(source ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n");

    let paragraphLines = [];
    let listElement = null;
    let listType = null;
    let codeLines = [];
    let insideCodeBlock = false;
    let codeLanguage = "";

    function flushParagraph() {
      if (!paragraphLines.length) return;

      const paragraph = document.createElement("p");
      paragraph.className = "markdown-paragraph";

      paragraphLines.forEach((line, index) => {
        if (index > 0) {
          paragraph.appendChild(document.createElement("br"));
        }

        renderInlineMarkdown(paragraph, line);
      });

      container.appendChild(paragraph);
      paragraphLines = [];
    }

    function flushList() {
      if (!listElement) return;

      container.appendChild(listElement);
      listElement = null;
      listType = null;
    }

    function flushCodeBlock() {
      const pre = document.createElement("pre");
      pre.className = "markdown-code-block";

      const code = document.createElement("code");

      if (codeLanguage) {
        const safeLanguage =
          codeLanguage.replace(/[^a-zA-Z0-9_-]/g, "");

        if (safeLanguage) {
          code.className = `language-${safeLanguage}`;
        }
      }

      code.textContent = codeLines.join("\n");
      pre.appendChild(code);
      container.appendChild(pre);

      codeLines = [];
      codeLanguage = "";
    }

    function flushAll() {
      flushParagraph();
      flushList();
    }

    for (const line of lines) {
      const fence = line.match(/^```([\w+-]*)\s*$/);

      if (fence) {
        if (insideCodeBlock) {
          flushCodeBlock();
          insideCodeBlock = false;
        } else {
          flushAll();
          insideCodeBlock = true;
          codeLanguage = fence[1] || "";
        }

        continue;
      }

      if (insideCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushAll();
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);

      if (heading) {
        flushAll();

        const level = heading[1].length;
        const element = document.createElement(`h${level}`);

        renderInlineMarkdown(element, heading[2]);
        container.appendChild(element);
        continue;
      }

      if (/^\s*([-*_]\s*){3,}$/.test(line)) {
        flushAll();
        container.appendChild(document.createElement("hr"));
        continue;
      }

      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

      if (unordered || ordered) {
        flushParagraph();

        const nextType = unordered ? "ul" : "ol";

        if (!listElement || listType !== nextType) {
          flushList();
          listElement = document.createElement(nextType);
          listType = nextType;
        }

        const item = document.createElement("li");

        renderInlineMarkdown(item, (unordered || ordered)[1]);
        listElement.appendChild(item);
        continue;
      }

      const quote = line.match(/^\s*>\s?(.*)$/);

      if (quote) {
        flushAll();

        const blockquote = document.createElement("blockquote");

        renderInlineMarkdown(blockquote, quote[1]);
        container.appendChild(blockquote);
        continue;
      }

      flushList();
      paragraphLines.push(line);
    }

    if (insideCodeBlock) {
      flushCodeBlock();
    }

    flushAll();
  }

  // ==========================================
  // FIRESTORE REFERENCES
  // ==========================================

  function userChatsCollection(userId = currentUserId) {
    if (!userId) throw new Error("No signed-in user.");
    if (!db) throw new Error("Firestore is not initialized.");

    return collection(db, "users", userId, "chats");
  }

  function chatDocument(conversationId, userId = currentUserId) {
    if (!userId) throw new Error("No signed-in user.");

    return doc(db, "users", userId, "chats", conversationId);
  }

  function chatMessagesCollection(conversationId, userId = currentUserId) {
    if (!userId) throw new Error("No signed-in user.");

    return collection(
      db,
      "users",
      userId,
      "chats",
      conversationId,
      "messages"
    );
  }

  // ==========================================
  // FIRESTORE SAVING
  // ==========================================

  function safeContextContent(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return null;

    return content.map(part => {
      if (part && part.type === "image_url") {
        return {
          type: "text",
          text: "[An image was attached earlier. Image files are not stored permanently.]"
        };
      }

      return part;
    });
  }

  function prepareMessageForStorage(message) {
    let storedText = message.text || "";

    if (message.images?.length) {
      storedText += "\n[Attached image was not saved permanently.]";
    }

    if (message.generatedImage) {
      storedText += "\n[Generated image was not saved permanently.]";
    }

    return {
      role: message.role || "assistant",
      text: storedText,
      mode: message.mode || "flash",
      contextContent: safeContextContent(message.contextContent),
      createdAt: Number(message.createdAt) || Date.now()
    };
  }

  function checkStorageReady(userId) {
    if (!firebaseReady || !db) {
      throw new Error("Firebase or Firestore is not initialized.");
    }

    if (!auth?.currentUser) {
      throw new Error("You are not signed in.");
    }

    if (auth.currentUser.uid !== userId || currentUserId !== userId) {
      throw new Error("Your account is still loading. Please try again.");
    }

    if (!settings.chatHistory) {
      throw new Error("Chat history is turned off in Settings.");
    }
  }

  async function saveConversationMetadata(conversation) {
    const userId = currentUserId;

    try {
      checkStorageReady(userId);

      const now = Date.now();
      conversation.updatedAt = now;

      const batch = writeBatch(db);

      batch.set(
        chatDocument(conversation.id, userId),
        {
          title: conversation.title || "New chat",
          createdAt: Number(conversation.createdAt) || now,
          updatedAt: now
        },
        { merge: true }
      );

      await batch.commit();

      console.log("FROSTGPT: Chat metadata saved:", conversation.id);
      return true;
    } catch (error) {
      console.error("FROSTGPT: Metadata save failed.", error);
      setStatus("Chat save failed: " + error.message);
      return false;
    }
  }

  async function saveConversationMessage(conversation, message) {
    const userId = currentUserId;

    try {
      checkStorageReady(userId);

      const now = Date.now();
      conversation.updatedAt = now;

      const batch = writeBatch(db);

      batch.set(
        chatDocument(conversation.id, userId),
        {
          title: conversation.title || "New chat",
          createdAt: Number(conversation.createdAt) || now,
          updatedAt: now
        },
        { merge: true }
      );

      batch.set(
        doc(chatMessagesCollection(conversation.id, userId), message.id),
        prepareMessageForStorage(message)
      );

      await batch.commit();

      console.log("FROSTGPT: Message saved:", message.id);
      setStatus("Chat saved");
      return true;
    } catch (error) {
      console.error("FROSTGPT: Message save failed.", error);
      setStatus("Message save failed: " + error.message);
      return false;
    }
  }

  // ==========================================
  // DELETE CHAT
  // ==========================================

  async function deleteConversation(conversationId) {
    if (deletingChats.has(conversationId)) return;

    const userId = currentUserId;

    try {
      checkStorageReady(userId);
    } catch (error) {
      setStatus("Cannot delete chat: " + error.message);
      return;
    }

    const conversation = conversations.find(
      item => item.id === conversationId
    );

    if (!conversation) return;

    const confirmed = confirm(
      `Delete "${conversation.title}"?\n\nThis permanently deletes this conversation and its saved messages.`
    );

    if (!confirmed) return;

    deletingChats.add(conversationId);

    if (conversationId === activeConversationId && isThinking) {
      stopGenerating();
    }

    renderHistory();
    setStatus("Deleting conversation...");

    try {
      const messagesRef = chatMessagesCollection(conversationId, userId);
      const snapshot = await getDocs(messagesRef);

      if (currentUserId !== userId || auth.currentUser?.uid !== userId) {
        throw new Error("Your account changed during deletion.");
      }

      for (let i = 0; i < snapshot.docs.length; i += 450) {
        const batch = writeBatch(db);

        snapshot.docs.slice(i, i + 450).forEach(message => {
          batch.delete(message.ref);
        });

        await batch.commit();
      }

      if (currentUserId !== userId || auth.currentUser?.uid !== userId) {
        throw new Error("Your account changed during deletion.");
      }

      await deleteDoc(chatDocument(conversationId, userId));

      if (currentUserId !== userId) return;

      conversations = conversations.filter(
        item => item.id !== conversationId
      );

      if (activeConversationId === conversationId) {
        activeConversationId = conversations[0]?.id || null;
        attachments = [];

        updateAttachmentPreview();
        renderConversation();
      }

      renderHistory();
      setStatus("Conversation deleted");

      console.log("FROSTGPT: Conversation deleted:", conversationId);
    } catch (error) {
      console.error("FROSTGPT: Chat deletion failed.", error);

      if (currentUserId === userId) {
        setStatus("Delete failed: " + error.message);

        alert(
          "FROSTGPT couldn't delete this conversation.\n\n" +
          error.message
        );
      }
    } finally {
      deletingChats.delete(conversationId);

      if (currentUserId === userId) {
        renderHistory();
      }
    }
  }

  // ==========================================
  // MESSAGE DISPLAY
  // ==========================================

  function showWelcome() {
    chatInner.replaceChildren();

    const welcome = document.createElement("div");
    welcome.className = "welcome-screen";

    const heading = document.createElement("h1");

    heading.textContent = currentUser
      ? `Hey ${getAccountName()}! 👋`
      : "Welcome to FROSTGPT™";

    const paragraph = document.createElement("p");

    paragraph.textContent = currentUser
      ? "Welcome back to FROSTGPT. What can I help you with today?"
      : "What would you like to work on today?";

    welcome.append(heading, paragraph);
    chatInner.appendChild(welcome);
  }

  async function downloadGeneratedImage(imageData, button) {
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Preparing download...";

    try {
      const response = await fetch(imageData);

      if (!response.ok) {
        throw new Error("Could not retrieve the image.");
      }

      const blob = await response.blob();

      const extension = blob.type.split("/")[1]
        ?.split(";")[0]
        ?.replace("jpeg", "jpg") || "png";

      const objectURL = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectURL;
      link.download = `FROSTGPT-${Date.now()}.${extension}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(objectURL), 2000);

      button.textContent = "✓ Downloaded";
    } catch (error) {
      console.error("FROSTGPT: Image download failed.", error);
      button.textContent = "Could not download";
    } finally {
      button.disabled = false;

      setTimeout(() => {
        if (button.isConnected) {
          button.textContent = originalText;
        }
      }, 2500);
    }
  }

  function renderMessage(message, shouldScroll = true) {
    const row = document.createElement("div");
    row.className = `message-row ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "user" ? "Y" : "❄";

    const content = document.createElement("div");
    content.className = "message-content";

    if (message.typing) {
      const typing = document.createElement("div");
      typing.className = "typing-indicator";
      typing.textContent = "Thinking...";
      content.appendChild(typing);
    } else {
      if (message.text) {
        const text = document.createElement("div");
        text.className = "message-text";

        if (message.role === "assistant") {
          renderMarkdown(text, message.text);
        } else {
          text.textContent = message.text;
        }

        content.appendChild(text);
      }

      if (message.images?.length) {
        const imageList = document.createElement("div");
        imageList.className = "message-images";

        message.images.forEach(source => {
          const image = document.createElement("img");
          image.className = "message-image";
          image.src = source;
          image.alt = "Attached image";
          imageList.appendChild(image);
        });

        content.appendChild(imageList);
      }

      if (message.generatedImage) {
        const image = document.createElement("img");
        image.className = "generated-image";
        image.src = message.generatedImage;
        image.alt = "AI-generated image";
        content.appendChild(image);

        const downloadButton = document.createElement("button");
        downloadButton.className = "download-image-button";
        downloadButton.type = "button";
        downloadButton.textContent = "↓ Download image";

        downloadButton.addEventListener("click", () => {
          downloadGeneratedImage(
            message.generatedImage,
            downloadButton
          );
        });

        content.appendChild(downloadButton);
      }
    }

    row.append(avatar, content);
    chatInner.appendChild(row);

    if (shouldScroll) scrollBottom();

    return row;
  }

  function renderConversation() {
    chatInner.replaceChildren();

    const conversation = getConversation();

    if (!conversation || conversation.display.length === 0) {
      showWelcome();
      return;
    }

    conversation.display.forEach(message => {
      renderMessage(message, false);
    });

    scrollBottom();
  }

  // ==========================================
  // CHAT HISTORY
  // ==========================================

  function renderHistory() {
    if (!historyList) return;

    historyList.replaceChildren();

    const search = searchChats
      ? searchChats.value.toLowerCase()
      : "";

    conversations
      .filter(item => item.title.toLowerCase().includes(search))
      .forEach(item => {
        const row = document.createElement("div");
        row.className = "history-row";

        const button = document.createElement("button");
        button.className = "history-item";
        button.type = "button";
        button.textContent = item.title;

        if (item.id === activeConversationId) {
          button.classList.add("active");
        }

        button.addEventListener("click", () => {
          if (deletingChats.has(item.id)) return;
          if (isThinking) stopGenerating();

          activeConversationId = item.id;
          attachments = [];

          updateAttachmentPreview();
          renderHistory();
          renderConversation();

          if (window.innerWidth <= 700 && sidebar) {
            sidebar.classList.remove("open");
          }
        });

        row.appendChild(button);

        if (settings.chatHistory) {
          const deleteButton = document.createElement("button");
          deleteButton.className = "delete-chat-button";
          deleteButton.type = "button";
          deleteButton.textContent =
            deletingChats.has(item.id) ? "…" : "🗑";
          deleteButton.title = "Delete conversation";
          deleteButton.disabled = deletingChats.has(item.id);

          deleteButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            deleteConversation(item.id);
          });

          row.appendChild(deleteButton);
        }

        historyList.appendChild(row);
      });
  }

  function newConversation() {
    const now = Date.now();

    const conversation = {
      id: createId(),
      title: "New chat",
      createdAt: now,
      updatedAt: now,
      display: [],
      flash: [],
      classic: []
    };

    conversations.unshift(conversation);
    activeConversationId = conversation.id;

    attachments = [];
    updateAttachmentPreview();
    renderHistory();
    renderConversation();

    saveConversationMetadata(conversation);

    return conversation;
  }

  function ensureConversation() {
    return getConversation() || newConversation();
  }

  function updateTitle(conversation, message) {
    if (conversation.title !== "New chat") return;

    conversation.title = String(message || "New chat").slice(0, 35);

    renderHistory();
    saveConversationMetadata(conversation);
  }

  // ==========================================
  // ADD MESSAGE
  // ==========================================

  function addMessage(role, text, options = {}) {
    const conversation = ensureConversation();

    const message = {
      id: createId(),
      role,
      text: String(text || ""),
      images: options.images || [],
      generatedImage: options.generatedImage || null,
      mode: options.mode || currentMode(),
      contextContent: options.contextContent ?? null,
      createdAt: Date.now()
    };

    conversation.display.push(message);
    renderMessage(message);

    if (role === "user") {
      updateTitle(conversation, text);
    }

    saveConversationMessage(conversation, message);

    return message;
  }

  function addTypingIndicator() {
    const conversation = getConversation();

    const indicator = {
      role: "assistant",
      text: "",
      typing: true
    };

    conversation.display.push(indicator);
    const row = renderMessage(indicator);

    return () => {
      row.remove();

      const index = conversation.display.indexOf(indicator);

      if (index !== -1) {
        conversation.display.splice(index, 1);
      }
    };
  }

  // ==========================================
  // LOAD FIRESTORE HISTORY
  // ==========================================

  async function loadUserConversations(userId) {
    if (!userId || !firebaseReady || !db) return;

    currentUserId = userId;
    conversations = [];
    activeConversationId = null;

    renderHistory();
    showWelcome();

    if (!settings.chatHistory) {
      newConversation();
      setStatus("Chat history saving is off");
      return;
    }

    setStatus("Loading your chat history...");

    try {
      const chatsSnapshot = await getDocs(
        userChatsCollection(userId)
      );

      if (currentUserId !== userId) return;

      const loadedConversations = [];

      for (const chatSnapshot of chatsSnapshot.docs) {
        if (currentUserId !== userId) return;

        const chatData = chatSnapshot.data();

        const conversation = {
          id: chatSnapshot.id,
          title: chatData.title || "New chat",
          createdAt: chatData.createdAt || Date.now(),
          updatedAt:
            chatData.updatedAt || chatData.createdAt || Date.now(),
          display: [],
          flash: [],
          classic: []
        };

        const messagesSnapshot = await getDocs(
          query(
            chatMessagesCollection(conversation.id, userId),
            orderBy("createdAt", "asc")
          )
        );

        if (currentUserId !== userId) return;

        messagesSnapshot.forEach(messageSnapshot => {
          const data = messageSnapshot.data();

          const message = {
            id: messageSnapshot.id,
            role: data.role || "assistant",
            text: data.text || "",
            images: [],
            generatedImage: null,
            mode: data.mode || "flash",
            contextContent: data.contextContent ?? null,
            createdAt: data.createdAt || Date.now()
          };

          conversation.display.push(message);

          if (message.contextContent !== null) {
            const contextMessage = {
              role: message.role,
              content: message.contextContent
            };

            if (message.mode === "classic") {
              conversation.classic.push(contextMessage);
            } else {
              conversation.flash.push(contextMessage);
            }
          }
        });

        loadedConversations.push(conversation);
      }

      if (currentUserId !== userId) return;

      loadedConversations.sort(
        (a, b) =>
          (b.updatedAt || b.createdAt) -
          (a.updatedAt || a.createdAt)
      );

      conversations = loadedConversations;

      if (conversations.length > 0) {
        activeConversationId = conversations[0].id;

        renderHistory();
        renderConversation();
      } else {
        newConversation();
      }

      setStatus(modeName());

      console.log(
        "FROSTGPT: Loaded conversations:",
        conversations.length
      );
    } catch (error) {
      console.error("FROSTGPT: History loading failed.", error);

      if (currentUserId !== userId) return;

      setStatus("History loading failed: " + error.message);

      if (conversations.length === 0) {
        showWelcome();
      }
    }
  }

  // ==========================================
  // GOOGLE SIGN-IN
  // ==========================================

  async function googleSignIn() {
    if (!firebaseReady) {
      if (authStatus) {
        authStatus.textContent =
          "Firebase could not initialize. Check your configuration.";
      }

      return;
    }

    if (!googleSignInButton) return;

    googleSignInButton.disabled = true;
    googleSignInButton.style.opacity = ".6";

    if (authStatus) {
      authStatus.textContent = "Opening Google sign-in...";
    }

    try {
      await setPersistence(auth, browserLocalPersistence);

      openSettingsAfterSignIn = true;

      await signInWithPopup(auth, googleProvider);

      if (authStatus) {
        authStatus.textContent = "";
      }
    } catch (error) {
      openSettingsAfterSignIn = false;

      console.error("FROSTGPT: Google sign-in error.", error);

      if (authStatus) {
        if (error.code === "auth/popup-closed-by-user") {
          authStatus.textContent = "Sign-in window was closed.";
        } else if (error.code === "auth/unauthorized-domain") {
          authStatus.textContent =
            "This website domain is not authorized in Firebase.";
        } else {
          authStatus.textContent =
            error.message || "Google sign-in failed.";
        }
      }
    } finally {
      googleSignInButton.disabled = false;
      googleSignInButton.style.opacity = "1";
    }
  }

  googleSignInButton?.addEventListener("click", googleSignIn);

  // ==========================================
  // AUTHENTICATION DISPLAY
  // ==========================================

  function showLogin() {
    currentUser = null;
    currentUserId = null;

    if (appElement) appElement.classList.remove("visible");
    if (authScreen) authScreen.style.display = "flex";

    if (accountName) accountName.textContent = "";

    if (accountPhoto) {
      accountPhoto.removeAttribute("src");
      accountPhoto.style.display = "none";
    }

    conversations = [];
    activeConversationId = null;
    attachments = [];

    renderHistory();
    updateAttachmentPreview();
    showWelcome();
    updateNicknameSettings();
  }

  function showApp(user) {
    currentUser = user;
    currentUserId = user.uid;

    if (authScreen) authScreen.style.display = "none";
    if (appElement) appElement.classList.add("visible");

    updateAccountDisplay();

    if (accountPhoto) {
      if (user.photoURL) {
        accountPhoto.src = user.photoURL;
        accountPhoto.style.display = "block";
      } else {
        accountPhoto.style.display = "none";
      }
    }

    createNicknameSettings();
    updateNicknameSettings();

    showWelcome();
  }

  // ==========================================
  // THINKING AND STOP
  // ==========================================

  function setThinking(value) {
    isThinking = value;

    if (value) {
      sendButton.textContent = "■";
      sendButton.title = "Stop generating";
      sendButton.setAttribute("aria-label", "Stop generating");
      sendButton.classList.add("stop");

      messageInput.disabled = true;
      messageInput.placeholder = "FROSTGPT™ is thinking...";
      modeSelect.disabled = true;

      if (attachButton) attachButton.disabled = true;
      if (imageButton) imageButton.disabled = true;

      setStatus("Thinking...");
    } else {
      sendButton.textContent = "↑";
      sendButton.title = "Send message";
      sendButton.setAttribute("aria-label", "Send message");
      sendButton.classList.remove("stop");

      messageInput.disabled = false;
      messageInput.placeholder = "Message FROSTGPT™...";
      modeSelect.disabled = false;

      if (attachButton) attachButton.disabled = false;
      if (imageButton) imageButton.disabled = false;

      setStatus(modeName());
    }
  }

  function stopGenerating() {
    if (!isThinking) return;

    requestId++;

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    setThinking(false);
    setStatus("Generation stopped");
  }

  // ==========================================
  // API RESPONSE PARSING
  // ==========================================

  async function parseResponse(response) {
    const text = await response.text();

    if (!text.trim()) {
      throw new Error(
        `The server returned an empty response (HTTP ${response.status}).`
      );
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.error("FROSTGPT: Invalid server response.", text);

      throw new Error(
        `The server returned invalid JSON (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.details ||
        `Request failed (HTTP ${response.status}).`
      );
    }

    return data;
  }

  // ==========================================
  // FLASH AI
  // ==========================================

  async function callFlashAI(conversation, signal) {
    const response = await fetch(CHAT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      signal,
      body: JSON.stringify({
        messages: conversation.flash
      })
    });

    const data = await parseResponse(response);

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("Cloudflare returned no AI reply.");
    }

    return data.reply;
  }

  // ==========================================
  // CLASSIC AI
  // ==========================================

  async function callClassicAI(conversation, message) {
    if (!window.FROSTGPTClassic) {
      throw new Error(
        "classic.js was not loaded. Check the script order in index.html."
      );
    }

    return await window.FROSTGPTClassic.reply(
      message,
      conversation.classic
    );
  }

  // ==========================================
  // IMAGE ATTACHMENTS
  // ==========================================

  function updateAttachmentPreview() {
    if (!attachmentPreview) return;

    attachmentPreview.replaceChildren();

    attachments.forEach((attachment, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "attachment-item";

      const image = document.createElement("img");
      image.src = attachment.data;
      image.alt = attachment.name;

      const remove = document.createElement("button");
      remove.className = "remove-attachment";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Remove image";

      remove.addEventListener("click", () => {
        attachments.splice(index, 1);
        updateAttachmentPreview();
      });

      wrapper.append(image, remove);
      attachmentPreview.appendChild(wrapper);
    });
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error(`Could not read ${file.name}.`));

      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList)) {
      if (attachments.length >= MAX_IMAGES) {
        addMessage(
          "assistant",
          `You can attach up to ${MAX_IMAGES} images at a time.`
        );
        break;
      }

      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        addMessage("assistant", "Use a PNG, JPG, or WEBP image.");
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        addMessage(
          "assistant",
          `${file.name} is too large. The maximum is 4 MB per image.`
        );
        continue;
      }

      try {
        const data = await readImage(file);
        attachments.push({ name: file.name, data });
      } catch (error) {
        addMessage("assistant", error.message);
      }
    }

    updateAttachmentPreview();
  }

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  async function sendMessage() {
    if (isThinking) {
      stopGenerating();
      return;
    }

    const message = messageInput.value.trim();

    if (!message && attachments.length === 0) return;

    const conversation = ensureConversation();
    const mode = currentMode();
    const imageData = attachments.map(item => item.data);

    let apiContent = message;

    if (mode === "flash") {
      const parts = [];

      if (message) {
        parts.push({ type: "text", text: message });
      }

      imageData.forEach(url => {
        parts.push({
          type: "image_url",
          image_url: { url }
        });
      });

      apiContent =
        parts.length === 1 && parts[0].type === "text"
          ? message
          : parts;

      conversation.flash.push({
        role: "user",
        content: apiContent
      });
    } else {
      apiContent = message || "What is in this image?";

      conversation.classic.push({
        role: "user",
        content: apiContent
      });
    }

    addMessage("user", message, {
      images: imageData,
      mode,
      contextContent: apiContent
    });

    playSound(520);

    messageInput.value = "";
    attachments = [];
    updateAttachmentPreview();

    setThinking(true);

    const currentRequest = ++requestId;
    const controller = new AbortController();

    activeController = controller;

    const removeTyping = addTypingIndicator();

    try {
      let reply;

      if (mode === "classic") {
        if (imageData.length) {
          reply =
            "FROSTGPT™ Classic is offline and cannot inspect images. Switch to Flash to ask questions about your image.";
        } else {
          reply = await callClassicAI(conversation, message);
        }
      } else {
        reply = await callFlashAI(conversation, controller.signal);
      }

      if (currentRequest !== requestId) return;

      removeTyping();

      if (mode === "flash") {
        conversation.flash.push({
          role: "assistant",
          content: reply
        });
      } else {
        conversation.classic.push({
          role: "assistant",
          content: reply
        });
      }

      addMessage("assistant", reply, {
        mode,
        contextContent: reply
      });

      playSound(760);
    } catch (error) {
      if (error.name === "AbortError") {
        removeTyping();
        return;
      }

      if (currentRequest !== requestId) return;

      console.error("FROSTGPT: Request failed.", error);
      removeTyping();

      addMessage(
        "assistant",
        `⚠️ ${error.message || "Something went wrong. Please try again."}`,
        { mode }
      );
    } finally {
      if (currentRequest === requestId) {
        activeController = null;
        setThinking(false);
      }
    }
  }

  // ==========================================
  // IMAGE GENERATION
  // ==========================================

  async function generateImage() {
    if (isThinking) {
      stopGenerating();
      return;
    }

    const prompt = messageInput.value.trim();

    if (!prompt) {
      addMessage(
        "assistant",
        "Describe the image you want me to generate first."
      );
      return;
    }

    const mode = currentMode();

    addMessage("user", `Generate an image: ${prompt}`, { mode });
    messageInput.value = "";

    setThinking(true);

    const currentRequest = ++requestId;
    const controller = new AbortController();

    activeController = controller;

    const removeTyping = addTypingIndicator();

    try {
      const response = await fetch(IMAGE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({ prompt })
      });

      const data = await parseResponse(response);

      if (currentRequest !== requestId) return;

      if (
        typeof data.image !== "string" ||
        !data.image.startsWith("data:image/")
      ) {
        throw new Error("The image endpoint returned an invalid image.");
      }

      removeTyping();

      addMessage("assistant", "Here's your generated image!", {
        generatedImage: data.image,
        mode
      });

      playSound(760);
    } catch (error) {
      if (error.name === "AbortError") {
        removeTyping();
        return;
      }

      if (currentRequest !== requestId) return;

      console.error("FROSTGPT: Image generation failed.", error);
      removeTyping();

      addMessage(
        "assistant",
        `⚠️ Image generation failed: ${error.message}`,
        { mode }
      );
    } finally {
      if (currentRequest === requestId) {
        activeController = null;
        setThinking(false);
      }
    }
  }

  // ==========================================
  // SIGN OUT
  // ==========================================

  signOutButton?.addEventListener("click", async () => {
    if (isThinking) stopGenerating();

    try {
      await signOut(auth);
    } catch (error) {
      console.error("FROSTGPT: Sign-out failed.", error);
      setStatus("Could not sign out.");
    }
  });

  // ==========================================
  // EVENTS
  // ==========================================

  sendButton.addEventListener("click", sendMessage);

  messageInput.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey) return;

    if (settings.enterKey === "send") {
      event.preventDefault();

      if (!isThinking) sendMessage();
    }
  });

  newChat?.addEventListener("click", () => {
    if (isThinking) stopGenerating();

    newConversation();

    if (window.innerWidth <= 700 && sidebar) {
      sidebar.classList.remove("open");
    }
  });

  if (attachButton && fileInput) {
    attachButton.addEventListener("click", () => {
      if (!isThinking) fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      await handleFiles(fileInput.files);
      fileInput.value = "";
    });
  }

  imageButton?.addEventListener("click", generateImage);

  modeSelect.addEventListener("change", () => {
    setStatus(modeName());
  });

  searchChats?.addEventListener("input", renderHistory);

  collapseSidebar?.addEventListener("click", () => {
    sidebar?.classList.toggle("collapsed");
  });

  openSidebar?.addEventListener("click", () => {
    if (!sidebar) return;

    if (window.innerWidth <= 700) {
      sidebar.classList.toggle("open");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });

  // ==========================================
  // START FROSTGPT™
  // ==========================================

  showWelcome();
  setStatus("Waiting for sign-in...");

  if (firebaseReady) {
    onAuthStateChanged(auth, async user => {
      if (user) {
        showApp(user);

        if (openSettingsAfterSignIn) {
          openSettingsAfterSignIn = false;
          openSettings();
        }

        await loadUserConversations(user.uid);
      } else {
        openSettingsAfterSignIn = false;
        showLogin();
      }
    });
  }

  console.log("❄ FROSTGPT™ is ready.");
  console.log("Firebase ready:", firebaseReady);
  console.log("Firestore ready:", !!db);
  console.log("Classic loaded:", !!window.FROSTGPTClassic);
  console.log("Settings loaded:", true);
  console.log("Personalized greetings:", true);
  console.log("Markdown renderer loaded:", true);

})();
