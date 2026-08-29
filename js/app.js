import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  deleteField,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ===================== FIREBASE INIT ===================== */
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ===================== STATE ===================== */
let habits = []; // [{id, name, color, createdAt, checkins: {"YYYY-MM-DD": true}}]
let currentUser = null;
let unsubscribeHabits = null;
let activeHabitId = null;
let calendarCursor = new Date(); // month currently shown in modal
let consistencyChart = null;
let trendChart = null;

const HABIT_COLORS_FALLBACK = ["#6c5ce7", "#00b894", "#e17055", "#0984e3", "#fd79a8", "#fdcb6e"];

/* ===================== UTIL ===================== */
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isFutureDate(date) {
  return startOfDay(date) > startOfDay(new Date());
}

function isChecked(habit, dateKey) {
  return !!(habit.checkins && habit.checkins[dateKey]);
}

function currentStreak(habit) {
  let streak = 0;
  let cursor = startOfDay(new Date());
  while (isChecked(habit, toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function completionRate(habit, days) {
  let completed = 0;
  const today = startOfDay(new Date());
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (isChecked(habit, toDateKey(d))) completed++;
  }
  return Math.round((completed / days) * 100);
}

async function setChecked(habit, dateKey, value) {
  const habitRef = doc(db, "users", currentUser.uid, "habits", habit.id);
  await updateDoc(habitRef, {
    [`checkins.${dateKey}`]: value ? true : deleteField(),
  });
}

/* ===================== VIEW SWITCHING ===================== */
function showView(view) {
  document.getElementById("loading-view").classList.toggle("hidden", view !== "loading");
  document.getElementById("login-view").classList.toggle("hidden", view !== "login");
  document.getElementById("app-view").classList.toggle("hidden", view !== "app");
}

/* ===================== RENDER: HABIT LIST ===================== */
function renderHabitList() {
  const list = document.getElementById("habit-list");
  const empty = document.getElementById("empty-state");
  const statsSection = document.getElementById("stats-section");

  list.innerHTML = "";

  if (habits.length === 0) {
    empty.classList.remove("hidden");
    statsSection.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  statsSection.classList.remove("hidden");

  const todayKey = toDateKey(new Date());

  habits.forEach((habit) => {
    const card = document.createElement("div");
    card.className = "habit-card";
    card.style.setProperty("--habit-color", habit.color);

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = habit.color;

    const info = document.createElement("div");
    info.className = "habit-card-info";
    const name = document.createElement("div");
    name.className = "habit-card-name";
    name.textContent = habit.name;
    const meta = document.createElement("div");
    meta.className = "habit-card-meta";
    const streak = currentStreak(habit);
    meta.textContent = streak > 0 ? `🔥 ${streak} day streak` : "No streak yet";
    info.appendChild(name);
    info.appendChild(meta);

    const toggle = document.createElement("button");
    toggle.className = "today-toggle" + (isChecked(habit, todayKey) ? " checked" : "");
    toggle.textContent = "✓";
    toggle.title = "Mark today done";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setChecked(habit, todayKey, !isChecked(habit, todayKey));
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "habit-delete-btn";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "Delete habit";
    deleteBtn.setAttribute("aria-label", `Delete ${habit.name}`);
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHabit(habit.id, habit.name);
    });

    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.textContent = "›";

    card.appendChild(dot);
    card.appendChild(info);
    card.appendChild(toggle);
    card.appendChild(deleteBtn);
    card.appendChild(chevron);

    card.addEventListener("click", () => openCalendar(habit.id));

    list.appendChild(card);
  });
}

/* ===================== ADD HABIT ===================== */
document.getElementById("add-habit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const nameInput = document.getElementById("habit-name-input");
  const colorInput = document.getElementById("habit-color-input");
  const name = nameInput.value.trim();
  if (!name) return;

  const habitsRef = collection(db, "users", currentUser.uid, "habits");
  await addDoc(habitsRef, {
    name,
    color: colorInput.value || HABIT_COLORS_FALLBACK[habits.length % HABIT_COLORS_FALLBACK.length],
    createdAt: serverTimestamp(),
    checkins: {},
  });

  nameInput.value = "";
  colorInput.value = HABIT_COLORS_FALLBACK[habits.length % HABIT_COLORS_FALLBACK.length];
});

/* ===================== CALENDAR MODAL ===================== */
function openCalendar(habitId) {
  activeHabitId = habitId;
  calendarCursor = new Date();
  document.getElementById("calendar-modal").classList.remove("hidden");
  renderCalendar();
}

function closeCalendar() {
  document.getElementById("calendar-modal").classList.add("hidden");
  activeHabitId = null;
}

document.getElementById("modal-close-btn").addEventListener("click", closeCalendar);
document.getElementById("calendar-modal").addEventListener("click", (e) => {
  if (e.target.id === "calendar-modal") closeCalendar();
});

document.getElementById("prev-month-btn").addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar();
});
document.getElementById("next-month-btn").addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar();
});

async function deleteHabit(habitId, habitName) {
  if (!currentUser) return;
  const ok = confirm(`Delete "${habitName}"? This will remove all its check-in history.`);
  if (!ok) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "habits", habitId));
  if (activeHabitId === habitId) closeCalendar();
}

document.getElementById("delete-habit-btn").addEventListener("click", () => {
  if (!activeHabitId) return;
  const habit = habits.find((h) => h.id === activeHabitId);
  if (!habit) return;
  deleteHabit(habit.id, habit.name);
});

function renderCalendar() {
  const habit = habits.find((h) => h.id === activeHabitId);
  if (!habit) return closeCalendar();

  document.getElementById("modal-habit-name").textContent = habit.name;
  document.getElementById("modal-habit-dot").style.background = habit.color;
  document.querySelector(".modal").style.setProperty("--habit-color", habit.color);

  const monthLabel = calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  document.getElementById("calendar-month-label").textContent = monthLabel;

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  for (let i = 0; i < startWeekday; i++) {
    const filler = document.createElement("div");
    filler.className = "cal-day empty";
    grid.appendChild(filler);
  }

  let completedCount = 0;
  const todayKey = toDateKey(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = String(day);

    const future = isFutureDate(date);
    const checked = isChecked(habit, key);
    if (checked) {
      completedCount++;
      cell.classList.add("checked");
      cell.style.background = habit.color;
    }
    if (key === todayKey) cell.classList.add("today");
    if (future) cell.classList.add("future");

    if (!future) {
      cell.addEventListener("click", () => {
        setChecked(habit, key, !isChecked(habit, key));
      });
    }

    grid.appendChild(cell);
  }

  const percent = Math.round((completedCount / daysInMonth) * 100);
  document.getElementById("calendar-completed").textContent = completedCount;
  document.getElementById("calendar-percent").textContent = percent + "%";
  document.getElementById("calendar-streak").textContent = currentStreak(habit);
}

/* ===================== CHARTS ===================== */
function renderCharts() {
  if (habits.length === 0) {
    if (consistencyChart) { consistencyChart.destroy(); consistencyChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    return;
  }

  const labels = habits.map((h) => h.name);
  const data = habits.map((h) => completionRate(h, 30));
  const colors = habits.map((h) => h.color);

  const consistencyCtx = document.getElementById("consistency-chart").getContext("2d");
  if (consistencyChart) consistencyChart.destroy();
  consistencyChart = new Chart(consistencyCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Completion % (last 30 days)",
        data,
        backgroundColor: colors,
        borderRadius: 6,
        maxBarThickness: 40,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } },
      },
    },
  });

  const days = [];
  const today = startOfDay(new Date());
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const dayLabels = days.map((d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  const dayTotals = days.map((d) => {
    const key = toDateKey(d);
    return habits.reduce((sum, h) => sum + (isChecked(h, key) ? 1 : 0), 0);
  });

  const trendCtx = document.getElementById("trend-chart").getContext("2d");
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendCtx, {
    type: "line",
    data: {
      labels: dayLabels,
      datasets: [{
        label: "Habits completed",
        data: dayTotals,
        borderColor: "#6c5ce7",
        backgroundColor: "rgba(108,92,231,0.15)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, suggestedMax: habits.length, ticks: { stepSize: 1 } },
      },
    },
  });
}

/* ===================== FIRESTORE SYNC ===================== */
function subscribeHabits() {
  const habitsRef = collection(db, "users", currentUser.uid, "habits");
  const q = query(habitsRef, orderBy("createdAt", "asc"));
  unsubscribeHabits = onSnapshot(q, (snapshot) => {
    habits = snapshot.docs.map((d) => ({ id: d.id, ...d.data(), checkins: d.data().checkins || {} }));
    renderHabitList();
    renderCharts();
    if (activeHabitId) {
      if (habits.some((h) => h.id === activeHabitId)) {
        renderCalendar();
      } else {
        closeCalendar();
      }
    }
  }, (error) => {
    console.error("Firestore sync error:", error);
  });
}

/* ===================== AUTH ===================== */
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit-btn");

  submitBtn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    errorEl.classList.add("hidden");
    document.getElementById("login-form").reset();
  } catch (err) {
    errorEl.textContent = "Invalid email or password";
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

document.getElementById("toggle-password-btn").addEventListener("click", () => {
  const passwordInput = document.getElementById("login-password");
  const btn = document.getElementById("toggle-password-btn");
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  btn.textContent = showing ? "👁" : "🙈";
  btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

onAuthStateChanged(auth, (user) => {
  if (unsubscribeHabits) {
    unsubscribeHabits();
    unsubscribeHabits = null;
  }

  if (user) {
    currentUser = user;
    habits = [];
    showView("app");
    subscribeHabits();
  } else {
    currentUser = null;
    habits = [];
    activeHabitId = null;
    document.getElementById("calendar-modal").classList.add("hidden");
    showView("login");
  }
});
