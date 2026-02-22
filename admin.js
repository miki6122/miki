const STORAGE_KEY = 'ai_messenger_state_v1';

const defaultState = {
  manualMode: false,
  messages: [],
  pendingForAdmin: [],
};

const toggleEl = document.getElementById('manual-toggle');
const modeLabelEl = document.getElementById('mode-label');
const inboxEl = document.getElementById('inbox');
const selectEl = document.getElementById('target-user');
const formEl = document.getElementById('admin-form');
const messageEl = document.getElementById('admin-message');

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
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

function render(state) {
  toggleEl.checked = state.manualMode;
  modeLabelEl.textContent = state.manualMode
    ? 'Поточний режим: адміністратор відповідає вручну'
    : 'Поточний режим: AI відповідає автоматично';

  inboxEl.innerHTML = '';
  selectEl.innerHTML = '<option value="" disabled selected>Оберіть користувача</option>';

  const pending = state.pendingForAdmin;
  if (!pending.length) {
    const li = document.createElement('li');
    li.textContent = 'Немає нових запитів до адміна.';
    inboxEl.appendChild(li);
    return;
  }

  const uniqueUsers = [...new Set(pending.map((item) => item.userId))];
  uniqueUsers.forEach((userId) => {
    const option = document.createElement('option');
    option.value = userId;
    option.textContent = userId;
    selectEl.appendChild(option);
  });

  pending
    .slice()
    .reverse()
    .forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `[${formatTime(item.createdAt)}] ${item.userId}: ${item.text}`;
      inboxEl.appendChild(li);
    });
}

toggleEl.addEventListener('change', () => {
  const state = loadState();
  state.manualMode = toggleEl.checked;
  saveState(state);
  render(state);
});

formEl.addEventListener('submit', (event) => {
  event.preventDefault();

  const userId = selectEl.value;
  const text = messageEl.value.trim();
  if (!userId || !text) return;

  const state = loadState();

  state.messages.push({
    id: crypto.randomUUID(),
    userId,
    role: 'admin',
    text,
    createdAt: new Date().toISOString(),
  });

  state.pendingForAdmin = state.pendingForAdmin.filter((item) => item.userId !== userId);

  saveState(state);
  render(state);

  messageEl.value = '';
  selectEl.selectedIndex = 0;
});

window.addEventListener('storage', () => render(loadState()));

render(loadState());
