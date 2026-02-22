const STORAGE_KEY = 'ai_messenger_state_v2';
const LEGACY_STORAGE_KEY = 'ai_messenger_state_v1';
const USER_KEY = 'ai_messenger_user_v1';
const ADMIN_GATE_KEY = 'ai_messenger_gate_v1';

const defaultState = {
  manualMode: false,
  messages: [],
  pendingForAdmin: [],
  users: {},
};

const registrationEl = document.getElementById('registration');
const chatSectionEl = document.getElementById('chat-section');
const registerFormEl = document.getElementById('register-form');
const nameInputEl = document.getElementById('name-input');
const userBadgeEl = document.getElementById('user-badge');
const logoutBtnEl = document.getElementById('logout-user');
const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('message-input');
const secretTriggerEl = document.getElementById('secret-admin-trigger');

let currentUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');

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

function now() {
  return new Date().toISOString();
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function ensureUser(state) {
  if (!currentUser) return;
  state.users[currentUser.id] = currentUser.name;
}

function findExistingUserIdByName(state, name) {
  return Object.entries(state.users).find(([, userName]) => userName === name)?.[0] || null;
}

function humanAIReply(text, name) {
  const low = text.toLowerCase();
  const starters = [
    `${name}, дякую за повідомлення.`,
    `Розумію тебе, ${name}.`,
    `${name}, хороше питання.`,
  ];
  const start = starters[Math.floor(Math.random() * starters.length)];

  if (low.includes('привіт')) return `${start} Привіт 👋 Як настрій сьогодні?`;
  if (low.includes('допом') || low.includes('підкаж'))
    return `${start} Давай зробимо так: опиши, що саме не виходить, і я підкажу крок за кроком.`;
  if (low.includes('дякую')) return `${start} Завжди радий допомогти. Якщо треба — я тут.`;
  if (low.includes('?'))
    return `${start} Я б на твоєму місці почав з малого плану: 1) ціль, 2) перший крок, 3) перевірка результату. Хочеш, розпишу під твою ситуацію?`;

  return `${start} Почув тебе. Якщо хочеш, можу відповісти більш коротко або детально — як тобі зручніше.`;
}

function renderMessages(state) {
  messagesEl.innerHTML = '';

  if (!currentUser) {
    registrationEl.classList.remove('hidden');
    chatSectionEl.classList.add('hidden');
    return;
  }

  registrationEl.classList.add('hidden');
  chatSectionEl.classList.remove('hidden');
  userBadgeEl.textContent = `Користувач: ${currentUser.name}`;

  const userMessages = state.messages.filter((m) => m.userId === currentUser.id);

  if (!userMessages.length) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'Почніть діалог: напишіть перше повідомлення.';
    messagesEl.appendChild(empty);
    return;
  }

  userMessages.forEach((msg) => {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${msg.role === 'user' ? 'user' : msg.role}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const who = msg.role === 'user' ? currentUser.name : msg.role === 'admin' ? 'Оператор' : 'AI';
    meta.textContent = `${who} • ${formatTime(msg.createdAt)}`;

    const text = document.createElement('div');
    text.textContent = msg.text;

    wrapper.append(meta, text);
    messagesEl.appendChild(wrapper);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

registerFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInputEl.value.trim();
  if (name.length < 2) return;

  const state = loadState();
  const existingId = findExistingUserIdByName(state, name);
  currentUser = { id: existingId || `u_${crypto.randomUUID()}`, name };
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  ensureUser(state);
  saveState(state);
  renderMessages(state);
  nameInputEl.value = '';
});

logoutBtnEl.addEventListener('click', () => {
  localStorage.removeItem(USER_KEY);
  currentUser = null;
  renderMessages(loadState());
});

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const text = inputEl.value.trim();
  if (!text) return;

  const state = loadState();
  ensureUser(state);

  state.messages.push({
    id: crypto.randomUUID(),
    userId: currentUser.id,
    role: 'user',
    text,
    createdAt: now(),
  });

  if (state.manualMode) {
    state.pendingForAdmin.push({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      text,
      createdAt: now(),
    });
  } else {
    state.messages.push({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      role: 'ai',
      text: humanAIReply(text, currentUser.name),
      createdAt: now(),
    });
  }

  saveState(state);
  renderMessages(state);
  inputEl.value = '';
});

function openAdminGate() {
  const passphrase = prompt('Секретний код доступу:');
  if (!passphrase) return;

  if (passphrase === 'shadow-entry-2049') {
    sessionStorage.setItem(ADMIN_GATE_KEY, 'open');
    window.location.href = 'admin.html';
  } else {
    alert('Невірний код.');
  }
}

secretTriggerEl.addEventListener('click', openAdminGate);
window.addEventListener('keydown', (event) => {
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    openAdminGate();
  }
});

window.addEventListener('storage', () => renderMessages(loadState()));

renderMessages(loadState());
