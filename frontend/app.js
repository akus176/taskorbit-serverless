    /*
      =========================
      CONFIG SECTION
      =========================
    */
    const CONFIG = {
      REGION: "ap-southeast-2",
      USER_POOL_ID: "ap-southeast-2_O42aC7PvV",
      CLIENT_ID: "9m41gfhb7u1lqndpfjf8bjiok",
      COGNITO_DOMAIN: "https://ap-southeast-2o42ac7pvv.auth.ap-southeast-2.amazoncognito.com",
      API_BASE_URL: "https://hhj3g3pc3f.execute-api.ap-southeast-2.amazonaws.com/prod",

      REDIRECT_URI: window.location.origin,
      LOGOUT_URI: window.location.origin
    };

    /*
      =========================
      STATE
      =========================
    */
    const STORAGE_KEYS = {
      TOKENS: "taskorbit_tokens",
      PKCE_VERIFIER: "taskorbit_pkce_verifier",
      OAUTH_STATE: "taskorbit_oauth_state"
    };

    let tasks = [];
    let currentUser = null;

    /*
      =========================
      DOM
      =========================
    */
    const $ = (id) => document.getElementById(id);

    const els = {
      authPillText: $("authPillText"),
      loginTopBtn: $("loginTopBtn"),
      logoutTopBtn: $("logoutTopBtn"),
      loginMainBtn: $("loginMainBtn"),
      guestView: $("guestView"),
      appView: $("appView"),
      profileTitle: $("profileTitle"),
      profileSubtitle: $("profileSubtitle"),
      totalCount: $("totalCount"),
      pendingCount: $("pendingCount"),
      doneCount: $("doneCount"),
      highCount: $("highCount"),
      apiUrlText: $("apiUrlText"),
      taskForm: $("taskForm"),
      titleInput: $("titleInput"),
      descriptionInput: $("descriptionInput"),
      priorityInput: $("priorityInput"),
      dueDateInput: $("dueDateInput"),
      createBtn: $("createBtn"),
      refreshBtn: $("refreshBtn"),
      taskList: $("taskList"),
      toast: $("toast")
    };

    els.apiUrlText.textContent = CONFIG.API_BASE_URL;

    /*
      =========================
      UTILITIES
      =========================
    */
    function showToast(message, type = "success") {
      els.toast.textContent = message;
      els.toast.className = `toast show ${type}`;

      window.clearTimeout(showToast.timer);
      showToast.timer = window.setTimeout(() => {
        els.toast.className = "toast";
      }, 3200);
    }

    function safeJsonParse(value, fallback = null) {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }

    function normalizeApiUrl(path) {
      return `${CONFIG.API_BASE_URL.replace(/\/$/, "")}${path}`;
    }

    function decodeJwt(token) {
      if (!token || !token.includes(".")) return null;

      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(normalized)
          .split("")
          .map((char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      return JSON.parse(json);
    }

    function getStoredTokens() {
      return safeJsonParse(localStorage.getItem(STORAGE_KEYS.TOKENS));
    }

    function saveTokens(tokens) {
      const oldTokens = getStoredTokens();

      const mergedTokens = {
        ...oldTokens,
        ...tokens,
        saved_at: Date.now()
      };

      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(mergedTokens));
      return mergedTokens;
    }

    function clearTokens() {
      localStorage.removeItem(STORAGE_KEYS.TOKENS);
      localStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
      localStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
    }

    function tokenExpiresSoon(token) {
      const payload = decodeJwt(token);
      if (!payload?.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now + 60;
    }

    function setLoading(button, isLoading, textWhenLoading = "Loading...") {
      if (!button) return;

      if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = textWhenLoading;
        button.disabled = true;
      } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
      }
    }

    /*
      =========================
      PKCE AUTH
      =========================
    */
    function randomBase64Url(byteLength = 32) {
      const bytes = new Uint8Array(byteLength);
      crypto.getRandomValues(bytes);

      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    }

    async function sha256Base64Url(value) {
      const encoded = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", encoded);

      return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    }

    async function login() {
      const verifier = randomBase64Url(64);
      const challenge = await sha256Base64Url(verifier);
      const state = randomBase64Url(24);

      localStorage.setItem(STORAGE_KEYS.PKCE_VERIFIER, verifier);
      localStorage.setItem(STORAGE_KEYS.OAUTH_STATE, state);

      const params = new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        response_type: "code",
        scope: "openid email profile",
        redirect_uri: CONFIG.REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge: challenge,
        state
      });

      window.location.href = `${CONFIG.COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
    }

    async function exchangeCodeForTokens(code) {
      const verifier = localStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER);

      if (!verifier) {
        throw new Error("Missing PKCE verifier. Please login again.");
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CONFIG.CLIENT_ID,
        code,
        redirect_uri: CONFIG.REDIRECT_URI,
        code_verifier: verifier
      });

      const response = await fetch(`${CONFIG.COGNITO_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || "Token exchange failed");
      }

      localStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
      localStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);

      return saveTokens(data);
    }

    async function refreshTokensIfNeeded() {
      const tokens = getStoredTokens();

      if (!tokens?.id_token) return null;

      if (!tokenExpiresSoon(tokens.id_token)) {
        return tokens;
      }

      if (!tokens.refresh_token) {
        clearTokens();
        return null;
      }

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CONFIG.CLIENT_ID,
        refresh_token: tokens.refresh_token
      });

      const response = await fetch(`${CONFIG.COGNITO_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      const data = await response.json();

      if (!response.ok) {
        clearTokens();
        return null;
      }

      return saveTokens(data);
    }

    async function handleAuthRedirect() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");

      if (error) {
        showToast(url.searchParams.get("error_description") || error, "error");
        window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
        return;
      }

      if (!code) return;

      const expectedState = localStorage.getItem(STORAGE_KEYS.OAUTH_STATE);

      if (expectedState && state !== expectedState) {
        clearTokens();
        window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
        showToast("Invalid login state. Please try again.", "error");
        return;
      }

      try {
        await exchangeCodeForTokens(code);
        window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
        showToast("Login successful.");
      } catch (err) {
        console.error(err);
        clearTokens();
        window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
        showToast(err.message || "Login failed.", "error");
      }
    }

    function logout() {
      clearTokens();

      const params = new URLSearchParams({
        client_id: CONFIG.CLIENT_ID,
        logout_uri: CONFIG.LOGOUT_URI
      });

      window.location.href = `${CONFIG.COGNITO_DOMAIN}/logout?${params.toString()}`;
    }

    /*
      =========================
      API
      =========================
    */
    async function apiFetch(path, options = {}) {
      const tokens = await refreshTokensIfNeeded();

      if (!tokens?.id_token) {
        throw new Error("You are not signed in.");
      }

      const response = await fetch(normalizeApiUrl(path), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: tokens.id_token,
          ...(options.headers || {})
        }
      });

      const text = await response.text();
      const data = text ? safeJsonParse(text, text) : null;

      if (!response.ok) {
        const message = data?.message || data || `Request failed with ${response.status}`;
        throw new Error(message);
      }

      return data;
    }

    async function loadTasks() {
      els.taskList.innerHTML = `<div class="empty-state">Loading tasks from DynamoDB...</div>`;

      try {
        const data = await apiFetch("/tasks", { method: "GET" });
        tasks = Array.isArray(data) ? data : [];
        renderTasks();
        updateStats();
      } catch (err) {
        console.error(err);
        els.taskList.innerHTML = `<div class="empty-state">Could not load tasks. ${err.message}</div>`;
        showToast(err.message || "Could not load tasks.", "error");
      }
    }

    async function createTask(payload) {
      return apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    async function updateTaskStatus(taskId, status) {
      return apiFetch(`/tasks/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
    }

    async function deleteTask(taskId) {
      return apiFetch(`/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE"
      });
    }

    /*
      =========================
      RENDER
      =========================
    */
    function updateAuthUI() {
      const tokens = getStoredTokens();
      const payload = decodeJwt(tokens?.id_token);

      currentUser = payload;

      const isSignedIn = Boolean(payload?.sub);

      els.guestView.classList.toggle("hidden", isSignedIn);
      els.appView.classList.toggle("hidden", !isSignedIn);
      els.loginTopBtn.classList.toggle("hidden", isSignedIn);
      els.logoutTopBtn.classList.toggle("hidden", !isSignedIn);

      if (isSignedIn) {
        const displayName = payload.email || payload["cognito:username"] || "Signed in user";

        els.authPillText.textContent = "Signed in";
        els.profileTitle.textContent = displayName;
        els.profileSubtitle.textContent = `User ID: ${payload.sub.slice(0, 12)}...`;
      } else {
        els.authPillText.textContent = "Guest mode";
        els.profileTitle.textContent = "Not signed in";
        els.profileSubtitle.textContent = "Login to sync your tasks";
        tasks = [];
        renderTasks();
        updateStats();
      }
    }

    function updateStats() {
      const total = tasks.length;
      const done = tasks.filter((task) => task.status === "completed").length;
      const pending = tasks.filter((task) => task.status !== "completed").length;
      const high = tasks.filter((task) => task.priority === "high").length;

      els.totalCount.textContent = total;
      els.doneCount.textContent = done;
      els.pendingCount.textContent = pending;
      els.highCount.textContent = high;
    }

    function renderTasks() {
      if (!tasks.length) {
        els.taskList.innerHTML = `
          <div class="empty-state">
            No tasks in orbit yet.<br />
            Create your first task above.
          </div>
        `;
        return;
      }

      els.taskList.innerHTML = tasks.map((task) => {
        const isDone = task.status === "completed";
        const priorityClass = task.priority === "high" ? "high" : "";
        const statusClass = isDone ? "done" : "";

        return `
          <article class="task-card" data-task-id="${escapeHtml(task.taskId)}">
            <div>
              <h3 class="task-title">${escapeHtml(task.title || "Untitled task")}</h3>
              <p class="task-description">${escapeHtml(task.description || "No description")}</p>

              <div class="task-meta">
                <span class="meta-pill ${statusClass}">${isDone ? "Completed" : "Pending"}</span>
                <span class="meta-pill ${priorityClass}">Priority: ${escapeHtml(task.priority || "medium")}</span>
                <span class="meta-pill">Due: ${escapeHtml(task.dueDate || "No date")}</span>
              </div>
            </div>

            <div class="task-actions">
              <button class="btn secondary small" data-action="toggle">
                ${isDone ? "Mark pending" : "Mark done"}
              </button>
              <button class="btn danger small" data-action="delete">
                Delete
              </button>
            </div>
          </article>
        `;
      }).join("");
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    /*
      =========================
      EVENTS
      =========================
    */
    els.loginTopBtn.addEventListener("click", login);
    els.loginMainBtn.addEventListener("click", login);
    els.logoutTopBtn.addEventListener("click", logout);

    els.refreshBtn.addEventListener("click", async () => {
      setLoading(els.refreshBtn, true, "Refreshing...");
      await loadTasks();
      setLoading(els.refreshBtn, false);
    });

    els.taskForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const title = els.titleInput.value.trim();

      if (!title) {
        showToast("Task title is required.", "error");
        return;
      }

      const payload = {
        title,
        description: els.descriptionInput.value.trim(),
        priority: els.priorityInput.value,
        dueDate: els.dueDateInput.value
      };

      try {
        setLoading(els.createBtn, true, "Creating...");
        await createTask(payload);

        els.taskForm.reset();
        els.priorityInput.value = "medium";

        showToast("Task created.");
        await loadTasks();
      } catch (err) {
        console.error(err);
        showToast(err.message || "Could not create task.", "error");
      } finally {
        setLoading(els.createBtn, false);
      }
    });

    els.taskList.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const card = event.target.closest(".task-card");
      const taskId = card?.dataset.taskId;
      const action = button.dataset.action;
      const task = tasks.find((item) => item.taskId === taskId);

      if (!taskId || !task) return;

      try {
        setLoading(button, true, action === "delete" ? "Deleting..." : "Updating...");

        if (action === "toggle") {
          const nextStatus = task.status === "completed" ? "pending" : "completed";
          await updateTaskStatus(taskId, nextStatus);
          showToast("Task updated.");
        }

        if (action === "delete") {
          await deleteTask(taskId);
          showToast("Task deleted.");
        }

        await loadTasks();
      } catch (err) {
        console.error(err);
        showToast(err.message || "Action failed.", "error");
      } finally {
        setLoading(button, false);
      }
    });

    /*
      =========================
      BOOT
      =========================
    */
    async function boot() {
      await handleAuthRedirect();
      await refreshTokensIfNeeded();

      updateAuthUI();

      if (getStoredTokens()?.id_token) {
        await loadTasks();
      }
    }

    boot();