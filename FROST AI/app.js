
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
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
    apiKey: "AIzaSyBfpeqUE8Dau5ZV5qNszWKoey1Cl4R5zIQ",
    authDomain: "frostgpt-4e3fa.firebaseapp.com",
    databaseURL: "https://frostgpt-4e3fa-default-rtdb.firebaseio.com",
    projectId: "frostgpt-4e3fa",
    storageBucket: "frostgpt-4e3fa.firebasestorage.app",
    messagingSenderId: "650451428263",
    appId: "1:650451428263:web:ce4dd9ea1678d2686c0c82",
    measurementId: "G-7EGCH66DG6"
  };

  const $ = id => document.getElementById(id);

  const gifButton = $("gifButton");
  const gifPicker = $("gifPicker");
  const gifSearchInput = $("gifSearchInput");
  const gifSearchButton = $("gifSearchButton");
  const gifResults = $("gifResults");
  const gifPickerStatus = $("gifPickerStatus");
  const closeGifPicker = $("closeGifPicker");

  const authScreen = $("authScreen");
  const authStatus = $("authStatus");
  const googleSignInButton = $("googleSignInButton");
  const appleSignInButton = $("appleSignInButton");
  const githubSignInButton = $("githubSignInButton");
  const appElement = $("app");
  const signOutButton = $("signOutButton");
  const accountName = $("accountName");
  const accountPhoto = $("accountPhoto");

  let auth;
  let db;
  let googleProvider;
  let appleProvider;
  let githubProvider;
  let firebaseReady = false;
  let currentUserId = null;
  let currentUser = null;
  // Declared with the other auth state to avoid temporal-dead-zone errors.
  let handledAuthUid = null;

  let openSettingsAfterSignIn = false;

  // ==========================================
  // PERSONALIZATION / NICKNAME
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

      if (getConversation()) {
        renderConversation();
      }

      const status = $("nicknameSavedStatus");

      if (status) {
        status.textContent = nickname
          ? "✓ Nickname saved"
          : "✓ Using your account name";
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
    animations: true,
    preferredBackupModel: "auto"
  };

  let settings = { ...DEFAULT_SETTINGS };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          preferredBackupModel: ["auto", "@cf/zai-org/glm-4.7-flash", "@cf/google/gemma-7b-it-lora"].includes(parsed.preferredBackupModel)
            ? parsed.preferredBackupModel
            : "auto"
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
      settingAnimations: settings.animations,
      settingBackupModel: settings.preferredBackupModel
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

    const settingsPanel = $("settingsPanel");
    if (!settingsPanel) return;

    const container =
      settingsPanel.querySelector(
        ".settings-content, .settings-card, [role='dialog']"
      ) || settingsPanel;

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
    resetButton.textContent = "Use account name";

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

    button.addEventListener("click", () => {
      saveNickname(input.value);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveNickname(input.value);
      }
    });

    resetButton.addEventListener("click", () => {
      saveNickname("");
    });

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
    $("closeSettings")?.focus();

    console.log("FROSTGPT: Settings opened.");
  }

  function closeSettings() {
    if (settingsPanel) settingsPanel.hidden = true;
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

  // ==========================================
  // ACCOUNT PROFILE → SETTINGS
  // ==========================================

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
    settingEnter: "enterKey",
    settingBackupModel: "preferredBackupModel"
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

        console.log("FROSTGPT: Service worker registered.", registration.scope);
      } catch (error) {
        console.error("FROSTGPT: Service worker registration failed.", error);
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

    appleProvider = new OAuthProvider("apple.com");
    appleProvider.addScope("email");
    appleProvider.addScope("name");

    githubProvider = new GithubAuthProvider();
    githubProvider.addScope("user:email");

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

  if (!chatInner || !messageInput || !sendButton || !statusText || !modeSelect) {
    console.error("FROSTGPT: Required HTML elements are missing.");
    return;
  }

  const CHAT_API = "/api/chat";
  const IMAGE_API = "/api/image";

  const MAX_IMAGES = 4;
  const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
  const MAX_FILES = 3;
  const MAX_FILE_SIZE = 100 * 1024;
  const MAX_GENERATED_IMAGES_PER_DAY = 5;

  function getImageUsageKey() {
    return `frostgpt_image_usage_${currentUserId || "guest"}`;
  }

  function getImageUsage() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const saved = JSON.parse(localStorage.getItem(getImageUsageKey()) || "{}");
      return saved.date === today && Number.isFinite(saved.count) ? saved.count : 0;
    } catch {
      return 0;
    }
  }

  function updateImageGenerationLimitUI() {
    const imageButton = $("imageButton");
    if (!imageButton) return;

    const remaining = Math.max(0, MAX_GENERATED_IMAGES_PER_DAY - getImageUsage());
    imageButton.title = remaining > 0
      ? `Generate image (${remaining} of ${MAX_GENERATED_IMAGES_PER_DAY} left today)`
      : "Daily image generation limit reached";
    imageButton.setAttribute("aria-label", imageButton.title);
    imageButton.disabled = remaining <= 0;
  }

  function recordGeneratedImage() {
    const today = new Date().toISOString().slice(0, 10);
    const count = getImageUsage() + 1;
    try {
      localStorage.setItem(getImageUsageKey(), JSON.stringify({ date: today, count }));
    } catch (error) {
      console.warn("FROSTGPT: Could not save image generation usage.", error);
    }
    updateImageGenerationLimitUI();
  }

  // ==========================================
  // FROSTGPT CUSTOM VOICE SYSTEM
  // ==========================================

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  let voiceRecognition = null;
  let voiceListening = false;
  let voiceReplyEnabled = false;
  let voiceSessionActive = false;
  let voiceFinalTranscript = "";

  let voiceMicButton = null;
  let voiceToggleButton = null;
  let voiceStopButton = null;
  let voiceOptionsButton = null;
  let voiceOptionsPanel = null;

  let voiceSelector = null;
  let voiceRateSlider = null;
  let voicePitchSlider = null;
  let voiceVolumeSlider = null;

  let voiceRateLabel = null;
  let voicePitchLabel = null;
  let voiceVolumeLabel = null;

  const DEFAULT_VOICE_PREFERENCES = {
    voiceURI: "",
    rate: 1,
    pitch: 1,
    volume: 1
  };

  let voicePreferences = { ...DEFAULT_VOICE_PREFERENCES };

  // Each Firebase account has its own voice settings.
  // Guest preferences are stored separately.

  function getVoiceStorageKey() {
    return `frostgpt_voice_${currentUserId || "guest"}`;
  }

  function getAvailableVoices() {
    if (!("speechSynthesis" in window)) return [];

    return window.speechSynthesis.getVoices();
  }

  function saveVoicePreferences() {
    try {
      localStorage.setItem(
        getVoiceStorageKey(),
        JSON.stringify(voicePreferences)
      );
    } catch (error) {
      console.warn(
        "FROSTGPT: Could not save voice preferences.",
        error
      );
    }
  }

  function loadVoicePreferences() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(getVoiceStorageKey()) || "{}"
      );

      voicePreferences = {
        voiceURI:
          typeof saved.voiceURI === "string"
            ? saved.voiceURI
            : "",

        rate:
          Number.isFinite(Number(saved.rate))
            ? Math.min(1.5, Math.max(0.7, Number(saved.rate)))
            : 1,

        pitch:
          Number.isFinite(Number(saved.pitch))
            ? Math.min(2, Math.max(0.5, Number(saved.pitch)))
            : 1,

        volume:
          Number.isFinite(Number(saved.volume))
            ? Math.min(1, Math.max(0, Number(saved.volume)))
            : 1
      };
    } catch {
      voicePreferences = { ...DEFAULT_VOICE_PREFERENCES };
    }

    updateVoiceSettingsUI();
    populateVoiceSelector();
  }

  function updateVoicePreferenceLabels() {
    if (voiceRateLabel) {
      voiceRateLabel.textContent =
        `${Number(voicePreferences.rate).toFixed(1)}×`;
    }

    if (voicePitchLabel) {
      voicePitchLabel.textContent =
        Number(voicePreferences.pitch).toFixed(1);
    }

    if (voiceVolumeLabel) {
      voiceVolumeLabel.textContent =
        `${Math.round(voicePreferences.volume * 100)}%`;
    }
  }

  function updateVoiceSettingsUI() {
    if (voiceRateSlider) {
      voiceRateSlider.value = voicePreferences.rate;
    }

    if (voicePitchSlider) {
      voicePitchSlider.value = voicePreferences.pitch;
    }

    if (voiceVolumeSlider) {
      voiceVolumeSlider.value = voicePreferences.volume;
    }

    if (voiceSelector) {
      voiceSelector.value = voicePreferences.voiceURI;
    }

    updateVoicePreferenceLabels();
  }

  function populateVoiceSelector() {
    if (!voiceSelector) return;

    const voices = getAvailableVoices();
    const selectedURI = voicePreferences.voiceURI;

    voiceSelector.replaceChildren();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Default browser voice";
    voiceSelector.appendChild(defaultOption);

    if (voices.length === 0) {
      const waitingOption = document.createElement("option");
      waitingOption.value = "";
      waitingOption.textContent = "Loading available voices...";
      voiceSelector.appendChild(waitingOption);
    } else {
      voices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})`;

        voiceSelector.appendChild(option);
      });
    }

    const selectedVoiceExists = voices.some(
      voice => voice.voiceURI === selectedURI
    );

    if (selectedURI && !selectedVoiceExists) {
      voicePreferences.voiceURI = "";
      saveVoicePreferences();
    }

    voiceSelector.value = voicePreferences.voiceURI;
  }

  function getSelectedVoice() {
    const voices = getAvailableVoices();

    return voices.find(
      voice => voice.voiceURI === voicePreferences.voiceURI
    ) || null;
  }

  function cleanTextForSpeech(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " Code block omitted. ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_~]/g, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*[-+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    updateVoiceButtons();
  }

  function updateVoiceButtons() {
    if (voiceMicButton) {
      voiceMicButton.textContent = voiceListening
        ? "⏹ Stop listening"
        : "🎙️ Voice input";

      voiceMicButton.setAttribute(
        "aria-label",
        voiceListening ? "Stop voice input" : "Start voice input"
      );

      voiceMicButton.disabled = isThinking;
      voiceMicButton.style.opacity = isThinking ? ".5" : "1";
    }

    if (voiceToggleButton) {
      voiceToggleButton.textContent = voiceReplyEnabled
        ? "🔊 Voice replies ON"
        : "🔇 Voice replies OFF";

      voiceToggleButton.setAttribute(
        "aria-pressed",
        String(voiceReplyEnabled)
      );
    }

    if (voiceStopButton) {
      voiceStopButton.disabled =
        !voiceListening &&
        !window.speechSynthesis?.speaking;

      voiceStopButton.style.opacity =
        voiceStopButton.disabled ? ".5" : "1";
    }
  }

  function createVoiceOptionsPanel() {
    if (voiceOptionsPanel) return voiceOptionsPanel;

    voiceOptionsPanel = document.createElement("section");
    voiceOptionsPanel.id = "frostgptVoiceOptions";
    voiceOptionsPanel.hidden = true;

    voiceOptionsPanel.style.cssText = `
      box-sizing: border-box;
      display: none;
      width: 100%;
      max-width: 460px;
      margin-top: 10px;
      padding: 17px;
      border: 1px solid var(--border-color, rgba(255,255,255,.16));
      border-radius: 14px;
      background: var(--panel-background, #20232b);
      color: var(--text-color, inherit);
      font: inherit;
    `;

    const heading = document.createElement("h3");
    heading.textContent = "🎚️ FROSTGPT Voice Options";

    heading.style.cssText = `
      margin: 0 0 5px;
      font-size: 16px;
    `;

    const description = document.createElement("p");
    description.textContent =
      "Customize how FROSTGPT sounds when reading replies aloud.";

    description.style.cssText = `
      margin: 0 0 14px;
      font-size: 12px;
      opacity: .7;
    `;

    voiceOptionsPanel.append(heading, description);

    function createLabel(text) {
      const label = document.createElement("label");

      label.textContent = text;

      label.style.cssText = `
        display: block;
        margin: 13px 0 7px;
        font-size: 13px;
        font-weight: 600;
      `;

      voiceOptionsPanel.appendChild(label);

      return label;
    }

    createLabel("Voice");

    voiceSelector = document.createElement("select");
    voiceSelector.id = "frostgptVoiceSelector";

    voiceSelector.style.cssText = `
      box-sizing: border-box;
      width: 100%;
      padding: 10px;
      border-radius: 9px;
      border: 1px solid var(--border-color, #555);
      background: var(--input-background, #171a21);
      color: inherit;
      font: inherit;
    `;

    voiceSelector.addEventListener("change", () => {
      voicePreferences.voiceURI = voiceSelector.value;
      saveVoicePreferences();
    });

    voiceOptionsPanel.appendChild(voiceSelector);

    function createSlider(labelText, min, max, step, initialValue, onChange) {
      createLabel(labelText);

      const row = document.createElement("div");

      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      `;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(min);
      slider.max = String(max);
      slider.step = String(step);
      slider.value = String(initialValue);

      slider.style.cssText = `
        flex: 1;
        min-width: 0;
        accent-color: var(--accent, #3694ff);
        cursor: pointer;
      `;

      const valueLabel = document.createElement("span");

      valueLabel.style.cssText = `
        min-width: 45px;
        text-align: right;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      `;

      slider.addEventListener("input", () => {
        onChange(Number(slider.value));
        updateVoicePreferenceLabels();
        saveVoicePreferences();
      });

      row.append(slider, valueLabel);
      voiceOptionsPanel.appendChild(row);

      return {
        slider,
        valueLabel
      };
    }

    const rate = createSlider(
      "Speech speed",
      0.7,
      1.5,
      0.1,
      voicePreferences.rate,
      value => {
        voicePreferences.rate = value;
      }
    );

    voiceRateSlider = rate.slider;
    voiceRateLabel = rate.valueLabel;

    const pitch = createSlider(
      "Voice pitch",
      0.5,
      2,
      0.1,
      voicePreferences.pitch,
      value => {
        voicePreferences.pitch = value;
      }
    );

    voicePitchSlider = pitch.slider;
    voicePitchLabel = pitch.valueLabel;

    const volume = createSlider(
      "Volume",
      0,
      1,
      0.05,
      voicePreferences.volume,
      value => {
        voicePreferences.volume = value;
      }
    );

    voiceVolumeSlider = volume.slider;
    voiceVolumeLabel = volume.valueLabel;

    const buttonRow = document.createElement("div");

    buttonRow.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 17px;
    `;

    function createActionButton(text, callback) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = text;

      button.style.cssText = `
        padding: 10px 13px;
        border-radius: 9px;
        border: 1px solid var(--border-color, #555);
        background: var(--accent, #3694ff);
        color: white;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      `;

      button.addEventListener("click", callback);

      return button;
    }

    const previewButton = createActionButton(
      "▶ Preview voice",
      previewVoice
    );

    const resetButton = createActionButton(
      "↺ Reset voice",
      () => {
        stopSpeaking();

        voicePreferences = {
          ...DEFAULT_VOICE_PREFERENCES
        };

        saveVoicePreferences();
        updateVoiceSettingsUI();
        populateVoiceSelector();
      }
    );

    buttonRow.append(previewButton, resetButton);
    voiceOptionsPanel.appendChild(buttonRow);

    const availabilityNote = document.createElement("p");

    availabilityNote.textContent =
      "Available voices depend on your browser and device.";

    availabilityNote.style.cssText = `
      margin: 13px 0 0;
      font-size: 11px;
      opacity: .65;
    `;

    voiceOptionsPanel.appendChild(availabilityNote);

    populateVoiceSelector();
    updateVoiceSettingsUI();

    return voiceOptionsPanel;
  }

  function previewVoice() {
    if (!("speechSynthesis" in window)) {
      alert("Your browser does not support voice playback.");
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(
      "Hello! This is how FROSTGPT will sound with your selected voice."
    );

    const selectedVoice = getSelectedVoice();

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = voicePreferences.rate;
    utterance.pitch = voicePreferences.pitch;
    utterance.volume = voicePreferences.volume;

    utterance.onstart = updateVoiceButtons;
    utterance.onend = updateVoiceButtons;
    utterance.onerror = updateVoiceButtons;

    window.speechSynthesis.speak(utterance);
    updateVoiceButtons();
  }

  function speakReply(text) {
    if (!voiceReplyEnabled) return;

    if (!("speechSynthesis" in window)) {
      console.warn("FROSTGPT: Speech synthesis is unavailable.");
      return;
    }

    const spokenText = cleanTextForSpeech(text);

    if (!spokenText) return;

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const selectedVoice = getSelectedVoice();

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = voicePreferences.rate;
    utterance.pitch = voicePreferences.pitch;
    utterance.volume = voicePreferences.volume;

    utterance.onstart = updateVoiceButtons;
    utterance.onend = updateVoiceButtons;

    utterance.onerror = event => {
      console.warn(
        "FROSTGPT: Speech playback error.",
        event.error
      );

      updateVoiceButtons();
    };

    window.speechSynthesis.speak(utterance);
    updateVoiceButtons();
  }

  function stopVoiceInput() {
    voiceSessionActive = false;
    voiceListening = false;

    if (voiceRecognition) {
      try {
        voiceRecognition.stop();
      } catch {
        // Recognition may already have stopped.
      }
    }

    updateVoiceButtons();
  }

  function startVoiceInput() {
    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported by this browser. Try a recent version of Chrome or Edge."
      );

      return;
    }

    if (isThinking) {
      setStatus("Wait until FROSTGPT finishes responding.");
      return;
    }

    if (voiceListening) return;

    stopSpeaking();

    voiceFinalTranscript = "";
    voiceSessionActive = true;
    voiceListening = true;

    voiceRecognition = new SpeechRecognition();

    voiceRecognition.lang = "en-US";
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = true;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onstart = () => {
      voiceListening = true;
      updateVoiceButtons();
      setStatus("🎙️ Listening...");
    };

    voiceRecognition.onresult = event => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";

        if (result.isFinal) {
          voiceFinalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript =
        (voiceFinalTranscript + interimTranscript).trim();

      if (currentTranscript) {
        messageInput.value = currentTranscript;
        messageInput.dispatchEvent(
          new Event("input", { bubbles: true })
        );
      }
    };

    voiceRecognition.onerror = event => {
      console.warn(
        "FROSTGPT: Voice recognition error.",
        event.error
      );

      voiceListening = false;
      voiceSessionActive = false;

      updateVoiceButtons();

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setStatus("Microphone permission was denied.");
      } else if (event.error === "no-speech") {
        setStatus("No speech detected. Try again.");
      } else if (event.error !== "aborted") {
        setStatus("Voice input encountered an error.");
      }
    };

    voiceRecognition.onend = () => {
      voiceListening = false;
      updateVoiceButtons();

      if (!voiceSessionActive) return;

      voiceSessionActive = false;

      const transcript = voiceFinalTranscript.trim();

      if (transcript) {
        messageInput.value = transcript;
        setStatus("Sending voice message...");
        sendMessage();
      } else {
        setStatus(modeName());
      }
    };

    updateVoiceButtons();

    try {
      voiceRecognition.start();
    } catch (error) {
      console.error(
        "FROSTGPT: Could not start voice input.",
        error
      );

      voiceListening = false;
      voiceSessionActive = false;

      updateVoiceButtons();
      setStatus("Could not start microphone.");
    }
  }

  function createVoiceControls() {
    if ($("frostgptVoiceControls")) return;

    const inputArea = messageInput.parentElement;
    if (!inputArea) return;

    const controls = document.createElement("div");
    controls.id = "frostgptVoiceControls";

    controls.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 9px;
      width: 100%;
    `;

    function styleButton(button) {
      button.type = "button";

      button.style.cssText = `
        padding: 9px 13px;
        border-radius: 10px;
        border: 1px solid var(--border-color, rgba(255,255,255,.16));
        background: var(--input-background, rgba(128,128,128,.12));
        color: inherit;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        transition: opacity .2s, background .2s;
      `;
    }

    voiceMicButton = document.createElement("button");
    voiceMicButton.id = "frostgptMicButton";
    styleButton(voiceMicButton);

    voiceToggleButton = document.createElement("button");
    voiceToggleButton.id = "frostgptVoiceToggle";
    styleButton(voiceToggleButton);

    voiceStopButton = document.createElement("button");
    voiceStopButton.id = "frostgptVoiceStop";
    voiceStopButton.textContent = "⏹ Stop audio";
    styleButton(voiceStopButton);

    voiceOptionsButton = document.createElement("button");
    voiceOptionsButton.id = "frostgptVoiceOptionsButton";
    voiceOptionsButton.textContent = "🎚️ Voice options";
    styleButton(voiceOptionsButton);

    voiceMicButton.addEventListener("click", () => {
      if (voiceListening) {
        stopVoiceInput();
      } else {
        startVoiceInput();
      }
    });

    voiceToggleButton.addEventListener("click", () => {
      voiceReplyEnabled = !voiceReplyEnabled;

      if (!voiceReplyEnabled) {
        stopSpeaking();
      }

      updateVoiceButtons();
    });

    voiceStopButton.addEventListener("click", () => {
      stopVoiceInput();
      stopSpeaking();
      updateVoiceButtons();
    });

    voiceOptionsButton.addEventListener("click", () => {
      const panel = createVoiceOptionsPanel();

      const willOpen = panel.hidden;

      panel.hidden = !willOpen;
      panel.style.display = willOpen ? "block" : "none";

      voiceOptionsButton.setAttribute(
        "aria-expanded",
        String(willOpen)
      );
    });

    controls.append(
      voiceMicButton,
      voiceToggleButton,
      voiceStopButton,
      voiceOptionsButton
    );

    inputArea.appendChild(controls);
    inputArea.appendChild(createVoiceOptionsPanel());

    updateVoiceButtons();

    console.log("FROSTGPT: Voice controls created.");
  }

  // Load guest preferences first.
  loadVoicePreferences();

  // Build the controls.
  createVoiceControls();

  // Browsers may load voice lists asynchronously.
  if ("speechSynthesis" in window) {
    if ("onvoiceschanged" in window.speechSynthesis) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        populateVoiceSelector
      );
    }

    // Try immediately as well.
    populateVoiceSelector();
  }

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
  // FIRESTORE REFERENCES
  // ==========================================

  function userChatsCollection() {
    if (!currentUserId) throw new Error("No signed-in user.");

    return collection(db, "users", currentUserId, "chats");
  }

  function chatDocument(conversationId) {
    return doc(db, "users", currentUserId, "chats", conversationId);
  }

  function chatMessagesCollection(conversationId) {
    return collection(
      db,
      "users",
      currentUserId,
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
      role: message.role,
      text: storedText,
      mode: message.mode || "flash",
      contextContent: safeContextContent(message.contextContent),
      createdAt: message.createdAt || Date.now()
    };
  }

  async function saveConversationMetadata(conversation) {
    if (!currentUserId || !firebaseReady || !settings.chatHistory) return;

    try {
      const now = Date.now();
      conversation.updatedAt = now;

      await setDoc(
        chatDocument(conversation.id),
        {
          title: conversation.title,
          createdAt: conversation.createdAt || now,
          updatedAt: now
        },
        { merge: true }
      );
    } catch (error) {
      console.error("FROSTGPT: Metadata save failed.", error);
      setStatus("Chat saving failed");
    }
  }

  async function saveConversationMessage(conversation, message) {
    if (!currentUserId || !firebaseReady || !settings.chatHistory) return;

    try {
      const now = Date.now();
      conversation.updatedAt = now;

      await setDoc(
        chatDocument(conversation.id),
        {
          title: conversation.title,
          createdAt: conversation.createdAt || now,
          updatedAt: now
        },
        { merge: true }
      );

      const messageRef = doc(
        chatMessagesCollection(conversation.id),
        message.id
      );

      await setDoc(messageRef, prepareMessageForStorage(message));
    } catch (error) {
      console.error("FROSTGPT: Message save failed.", error);
      setStatus("Message saving failed");
    }
  }

  // ==========================================
  // DELETE CHAT
  // ==========================================

  async function deleteConversation(conversationId) {
    if (!currentUserId || !firebaseReady || !settings.chatHistory) return;
    if (deletingChats.has(conversationId)) return;

    const conversation = conversations.find(item => item.id === conversationId);
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

    const userId = currentUserId;

    try {
      const messagesRef = collection(
        db,
        "users",
        userId,
        "chats",
        conversationId,
        "messages"
      );

      const snapshot = await getDocs(messagesRef);

      for (let i = 0; i < snapshot.docs.length; i += 450) {
        if (currentUserId !== userId) {
          throw new Error("Account changed during deletion.");
        }

        const batch = writeBatch(db);

        snapshot.docs.slice(i, i + 450).forEach(message => {
          batch.delete(message.ref);
        });

        await batch.commit();
      }

      if (currentUserId !== userId) {
        throw new Error("Account changed during deletion.");
      }

      await deleteDoc(doc(db, "users", userId, "chats", conversationId));

      if (currentUserId !== userId) return;

      conversations = conversations.filter(item => item.id !== conversationId);

      if (activeConversationId === conversationId) {
        activeConversationId = conversations[0]?.id || null;
        attachments = [];
        updateAttachmentPreview();
        renderConversation();
      }

      renderHistory();
      setStatus("Conversation deleted");
    } catch (error) {
      console.error("FROSTGPT: Chat deletion failed.", error);

      if (currentUserId === userId) {
        setStatus("Could not delete conversation");
        alert("The conversation could not be deleted. Please try again.");
      }
    } finally {
      deletingChats.delete(conversationId);

      if (currentUserId === userId) renderHistory();
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

    if (currentUser) {
      heading.textContent = `Hey ${getAccountName()}! 👋`;
    } else {
      heading.textContent = "Welcome to FROSTGPT™";
    }

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
      if (!response.ok) throw new Error("Could not retrieve the image.");

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
        if (button.isConnected) button.textContent = originalText;
      }, 2500);
    }
  }

  // ==========================================
  // SAFE MARKDOWN RENDERING
  // ==========================================

  function renderMarkdown(value, container) {
    const source = String(value ?? "");
    const fragment = document.createDocumentFragment();

    const lines = source.split("\n");
    let index = 0;

    function appendInline(text, parent) {
      const pattern =
        /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;

      let lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        parent.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );

        if (match[2] && match[3]) {
          try {
            const url = new URL(match[3]);
            if (url.protocol === "https:" || url.protocol === "http:") {
              const link = document.createElement("a");
              link.textContent = match[2];
              link.href = url.href;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              parent.appendChild(link);
            } else {
              parent.appendChild(document.createTextNode(match[0]));
            }
          } catch {
            parent.appendChild(document.createTextNode(match[0]));
          }
        } else if (match[5] || match[6]) {
          const strong = document.createElement("strong");
          strong.textContent = match[5] || match[6];
          parent.appendChild(strong);
        } else if (match[7] || match[8]) {
          const italic = document.createElement("em");
          italic.textContent = match[7] || match[8];
          parent.appendChild(italic);
        } else if (match[9]) {
          const code = document.createElement("code");
          code.textContent = match[9];
          parent.appendChild(code);
        }

        lastIndex = pattern.lastIndex;
      }

      parent.appendChild(
        document.createTextNode(text.slice(lastIndex))
      );
    }

    function addParagraph(text) {
      const paragraph = document.createElement("p");
      appendInline(text, paragraph);
      fragment.appendChild(paragraph);
    }

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index++;
        continue;
      }

      if (line.trim().startsWith("```")) {
        index++;

        const codeLines = [];

        while (
          index < lines.length &&
          !lines[index].trim().startsWith("```")
        ) {
          codeLines.push(lines[index]);
          index++;
        }

        if (index < lines.length) index++;

        const pre = document.createElement("pre");
        const code = document.createElement("code");

        code.textContent = codeLines.join("\n");

        pre.appendChild(code);
        fragment.appendChild(pre);
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const heading = document.createElement(
          `h${headingMatch[1].length}`
        );

        appendInline(headingMatch[2], heading);
        fragment.appendChild(heading);

        index++;
        continue;
      }

      if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line.trim())) {
        fragment.appendChild(document.createElement("hr"));
        index++;
        continue;
      }

      if (line.trim().startsWith(">")) {
        const quote = document.createElement("blockquote");

        while (
          index < lines.length &&
          lines[index].trim().startsWith(">")
        ) {
          const quoteLine = lines[index]
            .trim()
            .replace(/^>\s?/, "");

          const paragraph = document.createElement("p");
          appendInline(quoteLine, paragraph);
          quote.appendChild(paragraph);

          index++;
        }

        fragment.appendChild(quote);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const list = document.createElement("ul");

        while (
          index < lines.length &&
          /^\s*[-*+]\s+/.test(lines[index])
        ) {
          const item = document.createElement("li");
          appendInline(
            lines[index].replace(/^\s*[-*+]\s+/, ""),
            item
          );

          list.appendChild(item);
          index++;
        }

        fragment.appendChild(list);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const list = document.createElement("ol");

        while (
          index < lines.length &&
          /^\s*\d+\.\s+/.test(lines[index])
        ) {
          const item = document.createElement("li");

          appendInline(
            lines[index].replace(/^\s*\d+\.\s+/, ""),
            item
          );

          list.appendChild(item);
          index++;
        }

        fragment.appendChild(list);
        continue;
      }

      const paragraphLines = [line];
      index++;

      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^#{1,6}\s+/.test(lines[index]) &&
        !lines[index].trim().startsWith("```") &&
        !lines[index].trim().startsWith(">") &&
        !/^\s*[-*+]\s+/.test(lines[index]) &&
        !/^\s*\d+\.\s+/.test(lines[index])
      ) {
        paragraphLines.push(lines[index]);
        index++;
      }

      addParagraph(paragraphLines.join("\n"));
    }

    container.appendChild(fragment);
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

        renderMarkdown(message.text, text);

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
          downloadGeneratedImage(message.generatedImage, downloadButton);
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

    conversation.display.forEach(message => renderMessage(message, false));
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
          deleteButton.textContent = deletingChats.has(item.id) ? "…" : "🗑";
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

    if (role === "user") updateTitle(conversation, text);

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
    if (!userId || !firebaseReady) return;

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
      const chatsSnapshot = await getDocs(userChatsCollection());

      if (currentUserId !== userId) return;

      const loadedConversations = [];

      for (const chatSnapshot of chatsSnapshot.docs) {
        const chatData = chatSnapshot.data();

        const conversation = {
          id: chatSnapshot.id,
          title: chatData.title || "New chat",
          createdAt: chatData.createdAt || Date.now(),
          updatedAt: chatData.updatedAt || chatData.createdAt || Date.now(),
          display: [],
          flash: [],
          classic: []
        };

        const messagesQuery = query(
          chatMessagesCollection(conversation.id),
          orderBy("createdAt", "asc")
        );

        const messagesSnapshot = await getDocs(messagesQuery);

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
        (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
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
    } catch (error) {
      console.error("FROSTGPT: History loading failed.", error);

      if (currentUserId !== userId) return;

      setStatus("Could not load chat history");

      if (conversations.length === 0) showWelcome();
    }
  }

  // ==========================================
  // GOOGLE / APPLE / GITHUB SIGN-IN
  // ==========================================

  async function signInWithProvider(provider, button, providerName) {
    if (!firebaseReady) {
      if (authStatus) {
        authStatus.textContent =
          "Firebase could not initialize. Check your configuration.";
      }
      return;
    }

    if (!button || button.disabled) return;

    button.disabled = true;
    button.style.opacity = ".6";

    if (authStatus) {
      authStatus.textContent = `Opening ${providerName} sign-in...`;
    }

    try {
      // Start the popup directly inside the user's click gesture.
      // Awaiting setPersistence() here can consume the browser's transient
      // user activation and cause the Google popup to be blocked.
      // Keep the app unobstructed after sign-in; settings should open only
      // when the user chooses the Settings button.

      const signInResult = await signInWithPopup(auth, provider);

      // Wait until Firebase has finished updating its local auth state.
      // This prevents the UI from appearing stuck after the provider popup
      // successfully returns the selected account.
      await auth.authStateReady();

      if (!signInResult?.user || !auth.currentUser) {
        throw new Error(
          `${providerName} returned an account, but Firebase did not establish a signed-in session. Please try again.`
        );
      }

      console.log(`FROSTGPT: ${providerName} sign-in completed.`, {
        uid: auth.currentUser.uid,
        emailVerified: auth.currentUser.emailVerified
      });

      // Do not rely solely on the auth-state listener to switch the UI.
      // Handle the returned user immediately, then let the listener safely
      // ignore the duplicate event for this same session.
      await handleSignedInUser(signInResult.user);

      if (authStatus) authStatus.textContent = "";
    } catch (error) {
      openSettingsAfterSignIn = false;
      console.error(`FROSTGPT: ${providerName} sign-in error.`, error);

      if (authStatus) {
        if (error.code === "auth/popup-closed-by-user") {
          authStatus.textContent = "Sign-in window was closed.";
        } else if (error.code === "auth/unauthorized-domain") {
          authStatus.textContent =
            "This website domain is not authorized in Firebase.";
        } else if (error.code === "auth/popup-blocked") {
          authStatus.textContent =
            "Your browser blocked the sign-in popup. Allow popups for this FROSTGPT website and try again.";
        } else if (error.code === "auth/network-request-failed") {
          authStatus.textContent =
            "A network error interrupted sign-in. Check your connection and try again.";
        } else if (error.code === "auth/operation-not-allowed") {
          authStatus.textContent =
            `${providerName} sign-in is not enabled in Firebase Authentication yet.`;
        } else if (error.code === "auth/account-exists-with-different-credential") {
          authStatus.textContent =
            "An account already exists with this email using another sign-in method.";
        } else {
          authStatus.textContent =
            error.message || `${providerName} sign-in failed.`;
        }
      }
    } finally {
      button.disabled = false;
      button.style.opacity = "1";
    }
  }

  googleSignInButton?.addEventListener("click", () => {
    signInWithProvider(googleProvider, googleSignInButton, "Google");
  });

  appleSignInButton?.addEventListener("click", () => {
    signInWithProvider(appleProvider, appleSignInButton, "Apple");
  });

  githubSignInButton?.addEventListener("click", () => {
    signInWithProvider(githubProvider, githubSignInButton, "GitHub");
  });

  // ==========================================
  // AUTHENTICATION DISPLAY
  // ==========================================

  function showLogin() {
    stopVoiceInput();
    stopSpeaking();

    currentUser = null;
    currentUserId = null;

    // Restore guest voice preferences after signing out.
    loadVoicePreferences();

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
    updateImageGenerationLimitUI();

    // Load this account's saved voice preferences.
    loadVoicePreferences();

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
    } else {
      sendButton.textContent = "↑";
      sendButton.title = "Send message";
      sendButton.setAttribute("aria-label", "Send message");
      sendButton.classList.remove("stop");

      messageInput.disabled = false;
      messageInput.placeholder = "Message FROSTGPT™...";
      modeSelect.disabled = false;

      if (attachButton) attachButton.disabled = false;
      updateImageGenerationLimitUI();
    }

    updateVoiceButtons();

    if (!voiceListening) {
      setStatus(value ? "Thinking..." : modeName());
    }
  }

  function stopGenerating() {
    if (!isThinking) return;

    requestId++;

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    stopSpeaking();
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
        data.error || data.details || `Request failed (HTTP ${response.status}).`
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
        // The API accepts at most 80 messages per request. Keep the newest
        // context without deleting the full conversation from local history.
        messages: conversation.flash.slice(-80),
        preferredBackupModel: settings.preferredBackupModel
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

      if (attachment.kind === "file") {
        const fileLabel = document.createElement("span");
        fileLabel.className = "attachment-file-label";
        fileLabel.textContent = `📄 ${attachment.name}`;
        wrapper.appendChild(fileLabel);
      } else {
        const image = document.createElement("img");
        image.src = attachment.data;
        image.alt = attachment.name;
        wrapper.appendChild(image);
      }

      const remove = document.createElement("button");
      remove.className = "remove-attachment";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Remove attachment";
      remove.addEventListener("click", () => {
        attachments.splice(index, 1);
        updateAttachmentPreview();
      });

      wrapper.appendChild(remove);
      attachmentPreview.appendChild(wrapper);
    });
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  // Sample an animated GIF into chronological still frames for the vision model.
  // Keep the original GIF separately so it remains animated in the chat UI.
  async function extractGifFrames(file, requestedFrames = 6) {
    const objectURL = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.alt = "";
    image.style.cssText =
      "position:fixed;left:-10000px;top:0;width:auto;height:auto;opacity:0;pointer-events:none;";
    document.body.appendChild(image);

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("This GIF could not be decoded."));
        image.src = objectURL;
      });

      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      if (!sourceWidth || !sourceHeight) {
        throw new Error("This GIF has invalid dimensions.");
      }

      const scale = Math.min(1, 768 / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("GIF frame processing is unavailable.");

      const frames = [];
      for (let index = 0; index < requestedFrames; index++) {
        if (index > 0) await new Promise(resolve => setTimeout(resolve, 180));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.72));
      }
      return frames;
    } finally {
      image.remove();
      URL.revokeObjectURL(objectURL);
    }
  }

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList)) {
      const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
      const supportedImageTypes = ["image/png", "image/jpeg", "image/webp"];
      const extension = file.name.split(".").pop().toLowerCase();
      const supportedTextFiles = ["txt", "md", "csv", "json"];
      const isImage = isGif || supportedImageTypes.includes(file.type);
      const isTextFile = supportedTextFiles.includes(extension) ||
        ["text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);

      if (!isImage && !isTextFile) {
        addMessage("assistant", "Supported uploads: PNG, JPG, WEBP, GIF, TXT, MD, CSV, and JSON. PDF and other document formats aren't supported yet.");
        continue;
      }

      if (isImage) {
        const imageCount = attachments.filter(item => item.kind !== "file").length;
        if (imageCount >= MAX_IMAGES) {
          addMessage("assistant", `You can attach up to ${MAX_IMAGES} images per message.`);
          break;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          addMessage("assistant", `${file.name} is too large. The image limit is 4 MB each.`);
          continue;
        }

        const usedVisionSlots = attachments
          .filter(item => item.kind !== "file")
          .reduce((total, item) => total + (item.visionImages?.length || 1), 0);
        const remainingVisionSlots = 8 - usedVisionSlots;
        if (remainingVisionSlots < 1) {
          addMessage("assistant", "This message can contain up to 8 images or sampled GIF frames for AI analysis.");
          break;
        }

        try {
          const data = await readImage(file);
          const visionImages = isGif
            ? await extractGifFrames(file, Math.min(6, remainingVisionSlots))
            : [data];
          attachments.push({ kind: "image", name: file.name, data, isGif, visionImages });
        } catch (error) {
          addMessage("assistant", error.message);
        }
        continue;
      }

      const fileCount = attachments.filter(item => item.kind === "file").length;
      if (fileCount >= MAX_FILES) {
        addMessage("assistant", `You can attach up to ${MAX_FILES} documents per message.`);
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        addMessage("assistant", `${file.name} is too large. The document limit is 100 KB each.`);
        continue;
      }

      try {
        const text = await file.text();
        if (text.length > MAX_FILE_SIZE) {
          addMessage("assistant", `${file.name} contains too much text. The limit is 100 KB per document.`);
          continue;
        }
        attachments.push({ kind: "file", name: file.name, text });
      } catch {
        addMessage("assistant", `Could not read ${file.name}.`);
      }
    }
    updateAttachmentPreview();
  }

  async function sendMessage() {
    if (isThinking) {
      stopGenerating();
      return;
    }

    const message = messageInput.value.trim();

    if (!message && attachments.length === 0) return;

    const conversation = ensureConversation();
    const mode = currentMode();
    const imageAttachments = attachments.filter(item => item.kind !== "file");
    const fileAttachments = attachments.filter(item => item.kind === "file");
    const imageData = imageAttachments.map(item => item.data);
    const visionImageData = imageAttachments.flatMap(item =>
      item.visionImages?.length ? item.visionImages : [item.data]
    );
    const hasGif = imageAttachments.some(item => item.isGif);

    let apiContent = message;

    if (mode === "flash") {
      const parts = [];

      if (hasGif) {
        parts.push({
          type: "text",
          text: "The user attached an animated GIF. The following image inputs are sampled frames in chronological order. Compare the frames to understand the motion and sequence."
        });
      }

      if (message) {
        parts.push({ type: "text", text: message });
      }

      visionImageData.forEach(url => {
        parts.push({
          type: "image_url",
          image_url: { url }
        });
      });

      fileAttachments.forEach(file => {
        parts.push({
          type: "text",
          text: `Attached document: ${file.name}\n\n${file.text}`
        });
      });

      apiContent = parts.length === 1 && parts[0].type === "text"
        ? message
        : parts;

      conversation.flash.push({
        role: "user",
        content: apiContent
      });
    } else {
      const fileText = fileAttachments.map(file =>
        `Attached document: ${file.name}\n\n${file.text}`
      ).join("\n\n");
      apiContent = [message || "Please review the attached content.", fileText]
        .filter(Boolean).join("\n\n");

      conversation.classic.push({
        role: "user",
        content: apiContent
      });
    }

    const attachmentNames = fileAttachments.map(file => `📄 ${file.name}`);
    const displayText = [message, ...attachmentNames].filter(Boolean).join("\n");

    addMessage("user", displayText, {
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

      // Use the currently selected voice and saved settings.
      speakReply(reply);

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
  // GIF PICKER
  // ==========================================

  function openGifPicker() {
    if (!gifPicker) return;

    gifPicker.hidden = false;
    gifPickerStatus && (gifPickerStatus.textContent = "Loading trending GIFs...");
    loadGifs("");
    gifSearchInput?.focus();
  }

  function closeGifPickerWindow() {
    if (!gifPicker) return;

    gifPicker.hidden = true;
    gifButton?.focus();
  }

  async function loadGifs(searchTerm = "") {
    if (!gifResults || !gifPickerStatus) return;
    gifResults.replaceChildren();
    gifPickerStatus.textContent = "Loading GIFs...";

    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm.trim().slice(0, 50));

      const response = await fetch(`/api/gifs?${params.toString()}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("GIF search isn't configured yet. The site owner needs to add the GIPHY_API_KEY secret in Cloudflare.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("GIPHY rejected the API key. Check the GIPHY_API_KEY secret in Cloudflare.");
        }
        if (response.status === 429) {
          throw new Error("GIPHY is temporarily rate-limiting searches. Please try again shortly.");
        }
        throw new Error(data.error || "GIF service is temporarily unavailable.");
      }

      const items = Array.isArray(data.data) ? data.data : [];
      if (!items.length) {
        gifPickerStatus.textContent = "No GIFs found. Try another search.";
        return;
      }

      items.forEach(item => {
        const previewURL = item.images?.fixed_width?.url || item.images?.downsized?.url;
        // Prefer GIPHY's smaller animated rendition to avoid rejecting
        // otherwise valid GIFs just because the original file exceeds 4 MB.
        const originalURL =
          item.images?.downsized?.url ||
          item.images?.downsized_large?.url ||
          item.images?.original?.url;
        if (!previewURL || !originalURL) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "gif-result";
        button.title = item.title || "Select GIF";

        const image = document.createElement("img");
        image.src = previewURL;
        image.alt = item.title || "GIF preview";
        image.loading = "lazy";
        button.appendChild(image);

        button.addEventListener("click", async () => {
          button.disabled = true;
          gifPickerStatus.textContent = "Adding GIF to your message...";
          try {
            const gifResponse = await fetch(originalURL);
            if (!gifResponse.ok) throw new Error("Could not download that GIF.");
            const blob = await gifResponse.blob();
            const file = new File([blob], `FROSTGPT-GIF-${item.id || Date.now()}.gif`, { type: "image/gif" });
            const previousCount = attachments.length;
            await handleFiles([file]);
            if (attachments.length > previousCount) {
              closeGifPickerWindow();
            } else {
              gifPickerStatus.textContent = "That GIF couldn't be attached. Check the existing image attachment limit and try another.";
              button.disabled = false;
            }
          } catch (error) {
            gifPickerStatus.textContent = error.message || "Could not add that GIF.";
            button.disabled = false;
          }
        });

        gifResults.appendChild(button);
      });

      gifPickerStatus.textContent = "Choose a GIF to attach it. No separate GIF-generation or GIF-use quota is applied. Powered by GIPHY.";
    } catch (error) {
      gifPickerStatus.textContent = error.message || "Could not load GIFs.";
    }
  }

  gifButton?.addEventListener("click", openGifPicker);
  closeGifPicker?.addEventListener("click", closeGifPickerWindow);
  gifPicker?.addEventListener("click", event => {
    if (event.target === gifPicker) closeGifPickerWindow();
  });
  gifSearchButton?.addEventListener("click", () => loadGifs(gifSearchInput?.value || ""));
  gifSearchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") loadGifs(gifSearchInput.value);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && gifPicker && !gifPicker.hidden) closeGifPickerWindow();
  });

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

    const remainingImageGenerations =
      MAX_GENERATED_IMAGES_PER_DAY - getImageUsage();

    if (remainingImageGenerations <= 0) {
      addMessage("assistant", `You've reached today's image generation limit (${MAX_GENERATED_IMAGES_PER_DAY}). Your limit resets tomorrow.`);
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

      recordGeneratedImage();
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

    stopVoiceInput();
    stopSpeaking();

    try {
      await signOut(auth);
    } catch (error) {
      console.error("FROSTGPT: Sign-out failed.", error);
      setStatus("Could not sign out.");
    }
  });

  updateImageGenerationLimitUI();

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

    stopSpeaking();
    stopVoiceInput();

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

  async function handleSignedInUser(user) {
    if (!user) return;

    // Set this before awaiting anything so the popup result and Firebase's
    // auth-state event cannot start two competing history loads.
    if (handledAuthUid === user.uid) return;
    handledAuthUid = user.uid;

    try {
      showApp(user);

      await loadUserConversations(user.uid);

      console.log("FROSTGPT: Account interface is ready.", user.uid);
    } catch (error) {
      console.error("FROSTGPT: Account loading failed.", error);
      setStatus("Signed in, but account loading failed. Check the console.");
    }
  }

  if (firebaseReady) {
    onAuthStateChanged(auth, async user => {
      if (user) {
        await handleSignedInUser(user);
      } else {
        handledAuthUid = null;
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
  console.log("Voice input supported:", !!SpeechRecognition);
  console.log("Voice replies supported:", "speechSynthesis" in window);
  console.log("Custom voice settings:", true);

})();
