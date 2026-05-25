import { auth, db } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ---- State ----
let uid = null;
let exercises = [];
let todayLogs = {};
let editingExerciseId = null;
let historyDate = new Date();

// ---- Date helpers ----
function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLong(date) {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function formatDateShort(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (toDateStr(date) === toDateStr(today)) return 'Hoy';
  if (toDateStr(date) === toDateStr(yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---- Views ----
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${id}`).classList.add('active');
}

// ---- Auth ----
async function handleLogin() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showToast('Error al iniciar sesión');
    }
  }
}

// ---- Firestore refs ----
function exercisesRef() {
  return collection(db, 'users', uid, 'exercises');
}

function logRef(dateStr, exerciseId) {
  return doc(db, 'users', uid, 'logs', `${dateStr}_${exerciseId}`);
}

// ---- Data ----
async function loadExercises() {
  showLoading(true);
  try {
    const q = query(exercisesRef(), orderBy('order'));
    const snap = await getDocs(q);
    exercises = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (exercises.length === 0) {
      await seedDefaultExercises();
    }

    await loadTodayLogs();
    renderMain();
  } finally {
    showLoading(false);
  }
}

async function seedDefaultExercises() {
  const defaults = [
    { name: 'Caminata', icon: '🚶', order: 0 },
    { name: 'Flexiones', icon: '💪', order: 1 },
    { name: 'Sentadillas', icon: '🏋️', order: 2 },
  ];
  for (const ex of defaults) {
    const ref = doc(exercisesRef());
    await setDoc(ref, ex);
    exercises.push({ id: ref.id, ...ex });
  }
}

async function loadTodayLogs() {
  todayLogs = {};
  const dateStr = toDateStr(new Date());
  await Promise.all(exercises.map(async ex => {
    const snap = await getDoc(logRef(dateStr, ex.id));
    todayLogs[ex.id] = snap.exists() ? snap.data().reps : 0;
  }));
}

async function loadLogsForDate(date) {
  const dateStr = toDateStr(date);
  const logs = {};
  await Promise.all(exercises.map(async ex => {
    const snap = await getDoc(logRef(dateStr, ex.id));
    logs[ex.id] = snap.exists() ? snap.data().reps : 0;
  }));
  return logs;
}

async function setReps(exerciseId, reps) {
  const dateStr = toDateStr(new Date());
  await setDoc(logRef(dateStr, exerciseId), { exerciseId, date: dateStr, reps }, { merge: true });
  todayLogs[exerciseId] = reps;
}

function makeCountEditable(spanEl, exerciseId) {
  const current = todayLogs[exerciseId] || 0;
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = '0';
  input.value = current;
  input.className = 'rep-input';
  input.setAttribute('aria-label', 'Repeticiones');
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  async function save() {
    if (saved) return;
    saved = true;
    const val = Math.max(0, parseInt(input.value) || 0);
    await setReps(exerciseId, val);
    const span = document.createElement('span');
    span.className = 'rep-count';
    span.textContent = val;
    input.replaceWith(span);
    span.addEventListener('click', () => makeCountEditable(span, exerciseId));
    if (val !== current) {
      span.classList.add('bump');
      setTimeout(() => span.classList.remove('bump'), 300);
    }
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = current; input.blur(); }
  });
}

async function saveExercise(name, icon) {
  if (editingExerciseId) {
    await updateDoc(doc(exercisesRef(), editingExerciseId), { name, icon });
    const idx = exercises.findIndex(e => e.id === editingExerciseId);
    if (idx !== -1) Object.assign(exercises[idx], { name, icon });
  } else {
    const ref = doc(exercisesRef());
    const order = exercises.length;
    await setDoc(ref, { name, icon, order });
    exercises.push({ id: ref.id, name, icon, order });
    todayLogs[ref.id] = 0;
  }
  closeModal();
  renderMain();
}

async function deleteExercise(exerciseId) {
  if (!confirm('¿Eliminar este ejercicio? Se perderá su historial.')) return;
  await deleteDoc(doc(exercisesRef(), exerciseId));
  exercises = exercises.filter(e => e.id !== exerciseId);
  delete todayLogs[exerciseId];
  closeModal();
  renderMain();
}

// ---- Render main ----
function renderMain() {
  document.getElementById('header-date').textContent = formatDateLong(new Date());
  const grid = document.getElementById('exercises-grid');

  if (exercises.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No hay ejercicios aún</p><p>Tocá <strong>+</strong> para agregar uno</p></div>`;
    return;
  }

  grid.innerHTML = exercises.map(ex => `
    <div class="exercise-card" data-id="${ex.id}">
      <button class="card-edit-btn" data-id="${ex.id}" aria-label="Editar">✏️</button>
      <div class="card-icon">${ex.icon || '🏃'}</div>
      <div class="card-name">${ex.name}</div>
      <span class="rep-count">${todayLogs[ex.id] || 0}</span>
      <span class="rep-hint">tocá para editar</span>
    </div>
  `).join('');

  grid.querySelectorAll('.rep-count').forEach(span =>
    span.addEventListener('click', () => makeCountEditable(span, span.closest('[data-id]').dataset.id))
  );
  grid.querySelectorAll('.card-edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  );
}

// ---- Render history ----
async function renderHistory() {
  document.getElementById('history-date-label').textContent = formatDateShort(historyDate);
  document.getElementById('btn-next-day').disabled = toDateStr(historyDate) >= toDateStr(new Date());

  const list = document.getElementById('history-list');
  list.innerHTML = `<div class="loading">Cargando...</div>`;

  const logs = await loadLogsForDate(historyDate);
  const total = Object.values(logs).reduce((a, b) => a + b, 0);

  list.innerHTML = `
    <div class="history-total">Total del día: <strong>${total}</strong> reps</div>
    ${exercises.map(ex => `
      <div class="history-item">
        <span class="history-icon">${ex.icon || '🏃'}</span>
        <span class="history-name">${ex.name}</span>
        <span class="history-count ${logs[ex.id] ? 'has-reps' : ''}">${logs[ex.id] || 0}</span>
      </div>
    `).join('')}
  `;
}

// ---- Modal ----
function openAddModal() {
  editingExerciseId = null;
  document.getElementById('modal-title').textContent = 'Nuevo ejercicio';
  document.getElementById('input-icon').value = '';
  document.getElementById('input-name').value = '';
  document.getElementById('btn-delete-exercise').classList.add('hidden');
  document.getElementById('modal-exercise').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-name').focus(), 100);
}

function openEditModal(exerciseId) {
  const ex = exercises.find(e => e.id === exerciseId);
  if (!ex) return;
  editingExerciseId = exerciseId;
  document.getElementById('modal-title').textContent = 'Editar ejercicio';
  document.getElementById('input-icon').value = ex.icon || '';
  document.getElementById('input-name').value = ex.name;
  document.getElementById('btn-delete-exercise').classList.remove('hidden');
  document.getElementById('modal-exercise').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-exercise').classList.add('hidden');
  editingExerciseId = null;
}

// ---- UI helpers ----
function showLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ---- Event listeners ----
document.getElementById('btn-google-login').addEventListener('click', handleLogin);

document.getElementById('btn-logout').addEventListener('click', async () => {
  if (confirm('¿Cerrar sesión?')) await signOut(auth);
});

document.getElementById('btn-add-exercise').addEventListener('click', openAddModal);

document.getElementById('btn-history').addEventListener('click', () => {
  historyDate = new Date();
  renderHistory();
  showView('history');
});

document.getElementById('btn-back-history').addEventListener('click', () => showView('main'));

document.getElementById('btn-prev-day').addEventListener('click', () => {
  historyDate = new Date(historyDate);
  historyDate.setDate(historyDate.getDate() - 1);
  renderHistory();
});

document.getElementById('btn-next-day').addEventListener('click', () => {
  if (toDateStr(historyDate) < toDateStr(new Date())) {
    historyDate = new Date(historyDate);
    historyDate.setDate(historyDate.getDate() + 1);
    renderHistory();
  }
});

document.getElementById('btn-save-exercise').addEventListener('click', () => {
  const name = document.getElementById('input-name').value.trim();
  const icon = document.getElementById('input-icon').value.trim() || '🏃';
  if (!name) { showToast('Ingresá un nombre'); return; }
  saveExercise(name, icon);
});

document.getElementById('btn-cancel-exercise').addEventListener('click', closeModal);

document.getElementById('modal-exercise').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.getElementById('btn-delete-exercise').addEventListener('click', () => {
  if (editingExerciseId) deleteExercise(editingExerciseId);
});

// ---- Auth state ----
onAuthStateChanged(auth, async user => {
  if (user) {
    uid = user.uid;
    showView('main');
    await loadExercises();
  } else {
    uid = null;
    exercises = [];
    todayLogs = {};
    showView('login');
  }
});

// ---- Service Worker ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
