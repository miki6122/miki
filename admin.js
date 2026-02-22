const STORAGE_KEY = 'ai_messenger_state_v2';
const LEGACY_STORAGE_KEY = 'ai_messenger_state_v1';
const ADMIN_GATE_KEY = 'ai_messenger_gate_v1';
const ADMIN_USER_KEY = 'ai_messenger_admin_user_v1';
const ADMIN_SESSION_KEY = 'ai_messenger_admin_session_v1';
const ADMIN_ATTEMPTS_KEY = 'ai_messenger_admin_attempts_v1';
const ADMIN_LOCK_UNTIL_KEY = 'ai_messenger_admin_lock_until_v1';

const defaultState = {
  manualMode: false,
  messages: [],
  pendingForAdmin: [],
  users: {},
};

const authSectionEl = document.getElementById('auth-section');
const registerWrapEl = document.getElementById('register-admin-wrap');
const loginWrapEl = document.getElementById('login-admin-wrap');
const authStatusEl = document.getElementById('auth-status');
const adminRegisterFormEl = document.getElementById('admin-register-form');
const adminLoginFormEl = document.getElementById('admin-login-form');
const dashboardEl = document.getElementById('dashboard');

const manualToggleEl = document.getElementById('manual-toggle');
const modeLabelEl = document.getElementById('mode-label');
const userListEl = document.getElementById('user-list');
const activeUserLabelEl = document.getElementById('active-user-label');
const conversationEl = document.getElementById('admin-conversation');
const adminFormEl = document.getElementById('admin-form');
const adminMessageEl = document.getElementById('admin-message');
const logoutAdminEl = document.getElementById('logout-admin');
const userSearchEl = document.getElementById('user-search');
const onlyPendingEl = document.getElementById('only-pending');

let activeUserId = null;

function getAttempts() {
  return Number(sessionStorage.getItem(ADMIN_ATTEMPTS_KEY) || '0');
}

function setAttempts(value) {
  sessionStorage.setItem(ADMIN_ATTEMPTS_KEY, String(value));
}

function getLockRemainingMs() {
  const lockUntil = Number(sessionStorage.getItem(ADMIN_LOCK_UNTIL_KEY) || '0');
  return Math.max(0, lockUntil - Date.now());
}

function lockLogin() {
  sessionStorage.setItem(ADMIN_LOCK_UNTIL_KEY, String(Date.now() + 60_000));
  setAttempts(0);
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(value) {
  const safeValue = `miki::admin::${value}`;
  return sha256(safeValue);
}

function loadState() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (current) return { ...defaultState, ...current };

    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    if (legacy) return { ...defaultState, ...legacy, users: legacy.users || {} };

    return { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function adminExists() {
  return Boolean(localStorage.getItem(ADMIN_USER_KEY));
}

function getAdminRecord() {
  return JSON.parse(localStorage.getItem(ADMIN_USER_KEY) || 'null');
}

function isAllowedBySecretGate() {
  return sessionStorage.getItem(ADMIN_GATE_KEY) === 'open';
}

function isLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'ok';
}

function showAuth() {
  authSectionEl.classList.remove('hidden');
  dashboardEl.classList.add('hidden');

  if (!adminExists()) {
    registerWrapEl.classList.remove('hidden');
    loginWrapEl.classList.add('hidden');
    authStatusEl.textContent = 'Перший запуск: створіть прихований адмін-акаунт.';
  } else {
    registerWrapEl.classList.add('hidden');
    loginWrapEl.classList.remove('hidden');

    const lockMs = getLockRemainingMs();
    if (lockMs > 0) {
      authStatusEl.textContent = `Забагато невдалих спроб. Повторіть через ${Math.ceil(lockMs / 1000)} сек.`;
    } else {
      authStatusEl.textContent = 'Увійдіть під даними адміністратора.';
    }
  }
}

function showDashboard() {
  authSectionEl.classList.add('hidden');
  dashboardEl.classList.remove('hidden');
  render(loadState());
}

function guardAccess() {
  if (!isAllowedBySecretGate()) {
    const shell = document.createElement('div');
    shell.className = 'app-shell';
    const card = document.createElement('main');
    card.className = 'chat-card';
    const title = document.createElement('h2');
    title.textContent = '403';
    const message = document.createElement('p');
    message.textContent = 'Сторінка недоступна.';
    card.append(title, message);
    shell.appendChild(card);
    document.body.replaceChildren(shell);
    return;
  }

  if (!isLoggedIn()) {
    showAuth();
  } else {
    showDashboard();
  }
}

function renderUsers(state) {
  userListEl.innerHTML = '';

  const query = userSearchEl.value.trim().toLowerCase();
  const onlyPending = onlyPendingEl.checked;

  const users = Object.entries(state.users)
    .map(([userId, userName]) => {
      const pendingCount = state.pendingForAdmin.filter((item) => item.userId === userId).length;
      return { userId, userName, pendingCount };
    })
    .filter((user) => (!query ? true : user.userName.toLowerCase().includes(query)))
    .filter((user) => (!onlyPending ? true : user.pendingCount > 0));

  if (!users.length) {
    const li = document.createElement('li');
    li.textContent = 'Немає користувачів за поточним фільтром.';
    userListEl.appendChild(li);
    return;
  }

  users.forEach(({ userId, userName, pendingCount }) => {
    const li = document.createElement('li');
    li.className = `user-row ${activeUserId === userId ? 'active' : ''}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.userId = userId;
    button.className = 'user-nav-btn';

    const strong = document.createElement('strong');
    strong.textContent = userName;

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `id: ${userId.slice(0, 8)}...`;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `Нові: ${pendingCount}`;

    button.append(strong, meta, badge);
    li.appendChild(button);
    userListEl.appendChild(li);
  });
}

function renderConversation(state) {
  conversationEl.innerHTML = '';

  if (!activeUserId) {
    activeUserLabelEl.textContent = 'Оберіть користувача у вкладці Inbox.';
    return;
  }

  const userName = state.users[activeUserId] || activeUserId;
  activeUserLabelEl.textContent = `Активний діалог: ${userName}`;

  const messages = state.messages.filter((m) => m.userId === activeUserId);
  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'Повідомлень ще немає.';
    conversationEl.appendChild(empty);
    return;
  }

  messages.forEach((msg) => {
    const box = document.createElement('div');
    box.className = `message ${msg.role === 'user' ? 'user' : msg.role}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${msg.role.toUpperCase()} • ${formatTime(msg.createdAt)}`;

    const text = document.createElement('div');
    text.textContent = msg.text;

    box.append(meta, text);
    conversationEl.appendChild(box);
  });

  conversationEl.scrollTop = conversationEl.scrollHeight;
}

function render(state) {
  manualToggleEl.checked = state.manualMode;
  modeLabelEl.textContent = state.manualMode
    ? 'Поточний режим: адміністратор відповідає вручну'
    : 'Поточний режим: AI відповідає автоматично';

  renderUsers(state);
  renderConversation(state);
}

adminRegisterFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const login = document.getElementById('new-admin-login').value.trim();
  const password = document.getElementById('new-admin-password').value;
  if (login.length < 3 || password.length < 8) return;

  const passwordHash = await hashPassword(password);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify({ login, passwordHash, hashVersion: 'sha256-v1' }));
  sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
  setAttempts(0);
  sessionStorage.removeItem(ADMIN_LOCK_UNTIL_KEY);
  showDashboard();
});

adminLoginFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();

  const lockMs = getLockRemainingMs();
  if (lockMs > 0) {
    authStatusEl.textContent = `Забагато невдалих спроб. Повторіть через ${Math.ceil(lockMs / 1000)} сек.`;
    return;
  }

  const login = document.getElementById('admin-login').value.trim();
  const password = document.getElementById('admin-password').value;
  const saved = getAdminRecord();
  if (!saved) return;

  const passwordHash = await hashPassword(password);
  const valid = saved.login === login && saved.passwordHash === passwordHash;

  if (valid) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
    setAttempts(0);
    sessionStorage.removeItem(ADMIN_LOCK_UNTIL_KEY);
    showDashboard();
    return;
  }

  const nextAttempts = getAttempts() + 1;
  setAttempts(nextAttempts);

  if (nextAttempts >= 5) {
    lockLogin();
    authStatusEl.textContent = 'Забагато невдалих спроб. Вхід заблоковано на 60 секунд.';
  } else {
    authStatusEl.textContent = `Невірний логін або пароль. Спроба ${nextAttempts}/5.`;
  }
});

logoutAdminEl.addEventListener('click', () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  activeUserId = null;
  showAuth();
});

manualToggleEl.addEventListener('change', () => {
  const state = loadState();
  state.manualMode = manualToggleEl.checked;
  saveState(state);
  render(state);
});

userSearchEl.addEventListener('input', () => render(loadState()));
onlyPendingEl.addEventListener('change', () => render(loadState()));

userListEl.addEventListener('click', (event) => {
  const target = event.target.closest('[data-user-id]');
  if (!target) return;

  activeUserId = target.getAttribute('data-user-id');
  render(loadState());

  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  document.querySelector('[data-tab="conversation"]').classList.add('active');
  document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('active'));
  document.querySelector('[data-panel="conversation"]').classList.add('active');
});

adminFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = adminMessageEl.value.trim();
  if (!activeUserId || !text) return;

  const state = loadState();
  state.messages.push({
    id: crypto.randomUUID(),
    userId: activeUserId,
    role: 'admin',
    text,
    createdAt: new Date().toISOString(),
  });

  const pendingIndex = state.pendingForAdmin.findIndex((item) => item.userId === activeUserId);
  if (pendingIndex >= 0) state.pendingForAdmin.splice(pendingIndex, 1);

  saveState(state);
  render(state);
  adminMessageEl.value = '';
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((node) => node.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.remove('active'));
    document.querySelector(`[data-panel="${tab}"]`).classList.add('active');
  });
});

window.addEventListener('storage', () => {
  if (isLoggedIn()) render(loadState());
});

guardAccess();
