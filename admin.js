const STORAGE_KEY = 'ai_messenger_state_v2';
const LEGACY_STORAGE_KEY = 'ai_messenger_state_v1';
const ADMIN_GATE_KEY = 'ai_messenger_gate_v1';
const ADMIN_USER_KEY = 'ai_messenger_admin_user_v1';
const ADMIN_SESSION_KEY = 'ai_messenger_admin_session_v1';

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

let activeUserId = null;

function hashPassword(value) {
  return btoa(unescape(encodeURIComponent(value)));
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
    authStatusEl.textContent = 'Увійдіть під даними адміністратора.';
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

  const users = Object.entries(state.users);
  if (!users.length) {
    const li = document.createElement('li');
    li.textContent = 'Користувачів поки немає.';
    userListEl.appendChild(li);
    return;
  }

  users.forEach(([userId, userName]) => {
    const pendingCount = state.pendingForAdmin.filter((item) => item.userId === userId).length;
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

adminRegisterFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const login = document.getElementById('new-admin-login').value.trim();
  const password = document.getElementById('new-admin-password').value;
  if (login.length < 3 || password.length < 6) return;

  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify({ login, passwordHash: hashPassword(password) }));
  sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
  showDashboard();
});

adminLoginFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const login = document.getElementById('admin-login').value.trim();
  const password = document.getElementById('admin-password').value;
  const saved = getAdminRecord();

  if (!saved) return;

  if (saved.login === login && saved.passwordHash === hashPassword(password)) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'ok');
    showDashboard();
  } else {
    authStatusEl.textContent = 'Невірний логін або пароль.';
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
  if (pendingIndex >= 0) {
    state.pendingForAdmin.splice(pendingIndex, 1);
  }
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
