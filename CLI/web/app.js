const statusEl = document.getElementById("status");
const sessionPill = document.getElementById("sessionPill");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const providerInput = document.getElementById("providerInput");
const agentInput = document.getElementById("agentInput");
const modelInput = document.getElementById("modelInput");
const threadIdInput = document.getElementById("threadIdInput");
const systemInput = document.getElementById("systemInput");
const temperatureInput = document.getElementById("temperatureInput");
const temperatureValue = document.getElementById("temperatureValue");
const historyToggle = document.getElementById("historyToggle");
const historyDepth = document.getElementById("historyDepth");
const clearChatButton = document.getElementById("clearChat");
const sendButton = document.getElementById("sendButton");

const state = {
  messages: [],
  maxHistory: 12,
  threadId: ""
};

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", Boolean(isError));
}

function setSessionOnline(online) {
  sessionPill.textContent = online ? "online" : "offline";
  sessionPill.classList.toggle("is-online", online);
}

function addMessage(role, text) {
  const li = document.createElement("li");
  li.className = "message";
  li.dataset.role = role;
  li.textContent = text;
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  state.messages.push({ role, content: text });
  return li;
}

function clearChat() {
  state.messages = [];
  messagesEl.innerHTML = "";
  addMessage("assistant", "Apex online. Pick auto or force provider and agent from the control deck.");
}

function clampHistoryDepth() {
  const depth = Number.parseInt(historyDepth.value, 10);
  if (!Number.isFinite(depth)) {
    historyDepth.value = "0";
    return 0;
  }
  const max = Math.max(0, Math.min(depth, state.maxHistory));
  historyDepth.value = String(max);
  return max;
}

function buildHistory(limit) {
  const trimmed = state.messages.filter((entry) => entry.role === "user" || entry.role === "assistant");
  if (limit <= 0) {
    return [];
  }
  return trimmed.slice(-limit);
}

function getTemperature() {
  const value = Number.parseFloat(temperatureInput.value);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function currentProvider() {
  const value = providerInput.value.trim();
  return value.length ? value : "auto";
}

function currentAgent() {
  const value = agentInput.value.trim();
  return value.length ? value : "auto";
}

function currentThreadId() {
  const value = threadIdInput.value.trim();
  return value.length ? value : undefined;
}

function setThreadId(value) {
  state.threadId = value || "";
  threadIdInput.value = state.threadId;
}

function populateSelect(select, values) {
  const previous = select.value;
  select.innerHTML = "";

  const items = Array.from(new Set(["auto", ...values]));
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  }

  if (items.includes(previous)) {
    select.value = previous;
  }
}

function setBusy(isBusy) {
  sendButton.disabled = isBusy;
  messageInput.disabled = isBusy;
  providerInput.disabled = isBusy;
  agentInput.disabled = isBusy;
  modelInput.disabled = isBusy;
  threadIdInput.disabled = isBusy;
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("health check failed");
    }

    const data = await response.json();

    if (Array.isArray(data.providers)) {
      populateSelect(providerInput, data.providers);
    }

    if (Array.isArray(data.agents)) {
      populateSelect(agentInput, data.agents);
    }

    if (data.defaultModel) {
      modelInput.value = data.defaultModel;
    }

    if (Array.isArray(data.recentThreads) && data.recentThreads.length > 0 && !threadIdInput.value.trim()) {
      const latest = data.recentThreads[0];
      if (latest && typeof latest.threadId === "string") {
        setThreadId(latest.threadId);
      }
    }

    const maxHistory = Number.parseInt(data.maxHistory, 10);
    if (Number.isFinite(maxHistory)) {
      state.maxHistory = maxHistory;
      historyDepth.max = String(maxHistory);
      if (Number.parseInt(historyDepth.value, 10) > maxHistory) {
        historyDepth.value = String(maxHistory);
      }
    }

    setStatus("Connected to Apex Core.");
    setSessionOnline(true);
  } catch (error) {
    setStatus("Server offline. Check if Apex Core is running.", true);
    setSessionOnline(false);
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) {
    return;
  }

  addMessage("user", message);
  messageInput.value = "";

  const pending = addMessage("assistant", "Working...");
  pending.classList.add("is-pending");

  const system = systemInput.value.trim();
  const model = modelInput.value.trim();
  const temperature = getTemperature();
  const depth = clampHistoryDepth();

  const payload = {
    message,
    system: system.length ? system : undefined,
    provider: currentProvider(),
    agent: currentAgent(),
    model: model.length ? model : undefined,
    temperature: typeof temperature === "number" ? temperature : undefined,
    threadId: currentThreadId(),
    history: historyToggle.checked ? buildHistory(depth) : []
  };

  try {
    setBusy(true);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Request failed");
    }

    const data = await response.json();
    pending.remove();

    if (typeof data.threadId === "string") {
      setThreadId(data.threadId);
    }

    const routeLabel = [data.agent, data.provider, data.model].filter(Boolean).join(" / ");
    if (routeLabel.length > 0) {
      addMessage("system", `Route: ${routeLabel}`);
    }

    if (Array.isArray(data.tools) && data.tools.length > 0) {
      addMessage("system", `Tools: ${data.tools.map((tool) => tool.name).join(", ")}`);
    }

    addMessage("assistant", data.reply || "No reply from model.");
  } catch (error) {
    pending.remove();
    const messageText =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Unknown error";
    addMessage("assistant", `Error: ${messageText}`);
  } finally {
    setBusy(false);
    messageInput.focus();
  }
});

clearChatButton.addEventListener("click", () => {
  clearChat();
});

temperatureInput.addEventListener("input", () => {
  const temp = getTemperature();
  if (typeof temp === "number") {
    temperatureValue.textContent = temp.toFixed(2);
  }
});

historyDepth.addEventListener("change", () => {
  clampHistoryDepth();
});

window.addEventListener("load", () => {
  const temp = getTemperature();
  temperatureValue.textContent = typeof temp === "number" ? temp.toFixed(2) : "n/a";
  clearChat();
  loadHealth();
});

