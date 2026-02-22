const STORAGE_KEY = 'ai_messenger_state_v1';
const CLIENT_ID = 'default-user';

const defaultState = {
  manualMode: false,
  messages: [],
  pendingForAdmin: [],
};

const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('message-input');

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

function now() {
  return new Date().toISOString();
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function renderMessages(state) {
  messagesEl.innerHTML = '';
  const userMessages = state.messages.filter((m) => m.userId === CLIENT_ID);

  if (!userMessages.length) {
    const empty = document.createElement('div');
    empty.className = 'meta';
    empty.textContent = 'Почніть діалог: напишіть перше повідомлення.';
    messagesEl.appendChild(empty);
    return;
  }

  userMessages.forEach((msg) => {
    const wrapper = document.createElement('div');
    const typeClass = msg.role === 'user' ? 'user' : msg.role;
    wrapper.className = `message ${typeClass}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${msg.role === 'user' ? 'Ви' : msg.role === 'admin' ? 'Адмін' : 'AI'} • ${formatTime(msg.createdAt)}`;

    const text = document.createElement('div');
    text.textContent = msg.text;

    wrapper.append(meta, text);
    messagesEl.appendChild(wrapper);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function generateAIReply(text) {
  const prompt = text.toLowerCase();

  if (prompt.includes('привіт')) return 'Привіт! Я AI-асистент. Чим можу допомогти?';
  if (prompt.includes('допомож')) return 'Звісно! Опишіть задачу детальніше, і я запропоную кроки.';
  if (prompt.includes('дякую')) return 'Будь ласка! Якщо треба — я поруч 😊';

  return `Я отримав ваше повідомлення: “${text}”. Можу дати розгорнуту відповідь або підключити адміністратора.`;
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  const state = loadState();

  state.messages.push({
    id: crypto.randomUUID(),
    userId: CLIENT_ID,
    role: 'user',
    text,
    createdAt: now(),
  });

  if (state.manualMode) {
    state.pendingForAdmin.push({
      id: crypto.randomUUID(),
      userId: CLIENT_ID,
      text,
      createdAt: now(),
    });
  } else {
    state.messages.push({
      id: crypto.randomUUID(),
      userId: CLIENT_ID,
      role: 'ai',
      text: generateAIReply(text),
      createdAt: now(),
    });
  }

  saveState(state);
  renderMessages(state);
  inputEl.value = '';
});

window.addEventListener('storage', () => renderMessages(loadState()));

renderMessages(loadState());
