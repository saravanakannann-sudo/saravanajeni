// --- API Service ---
const API = {
    async getTasks(userId) {
        const res = await fetch(`/api/tasks?userId=${userId}`);
        return res.json();
    },
    async saveTask(task) {
        await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
    },
    async deleteTask(id) {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    },
    async getSavings(userId) {
        const res = await fetch(`/api/savings?userId=${userId}`);
        return res.json();
    },
    async saveSaving(saving) {
        await fetch('/api/savings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saving)
        });
    },
    async deleteSaving(id) {
        await fetch(`/api/savings/${id}`, { method: 'DELETE' });
    }
};

// --- Constants ---
const DIFFICULTY_ORDER = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
const STORAGE_KEY = 'ourSweetJourneyState';

// --- State ---
let state = {
    currentUser: 'Him',
    users: {
        'Him': { sortPreference: 'asc' },
        'Her': { sortPreference: 'asc' }
    },
    tasks: [],
    savings: []
};

let charts = {
    daily: null,
    monthly: null,
    savings: null
};

// --- Initialization ---
async function init() {
    loadFromLocalStorage();
    updateDateDisplay();
    setupEventListeners();
    
    await syncWithBackend();

    render();
    updateProgressData();
    updateSavingsData();
}

// --- Backend Sync ---
async function syncWithBackend() {
    try {
        state.tasks = await API.getTasks(state.currentUser);
        state.savings = await API.getSavings(state.currentUser);
        saveToLocalStorage();
        render();
        updateProgressData();
        updateSavingsData();
    } catch (e) {
        console.error("Backend sync failed, using local data:", e);
    }
}

// --- Progress Logic ---
async function updateProgressData() {
    const todayStr = getTodayStr();
    const monthStr = todayStr.substring(0, 7);
    const userTasks = state.tasks.filter(t => t.userId === state.currentUser);

    const todayTasks = userTasks.filter(t => t.date === todayStr || (t.completed && t.completedAt === todayStr));
    const todayCompleted = todayTasks.filter(t => t.completed).length;
    const todayPercent = todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;

    const monthTasks = userTasks.filter(t => t.date.startsWith(monthStr));
    const monthCompleted = monthTasks.filter(t => t.completed).length;
    const monthPercent = monthTasks.length > 0 ? Math.round((monthCompleted / monthTasks.length) * 100) : 0;

    document.getElementById('statTodayPercent').textContent = `${todayPercent}%`;
    document.getElementById('statMonthPercent').textContent = `${monthPercent}%`;
    document.getElementById('barToday').style.width = `${todayPercent}%`;
    document.getElementById('barMonth').style.width = `${monthPercent}%`;

    if (document.getElementById('progressView').style.display !== 'none') {
        renderCharts();
    }
}

// --- Savings Logic ---
function updateSavingsData() {
    const userSavings = state.savings.filter(s => s.userId === state.currentUser);
    const total = userSavings.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    document.getElementById('totalSavingsValue').textContent = total.toFixed(2);

    renderSavingsList(userSavings.sort((a, b) => b.date.localeCompare(a.date)));
    
    if (document.getElementById('savingsView').style.display !== 'none') {
        renderSavingsChart();
    }
}

function renderSavingsList(savings) {
    const listEl = document.getElementById('savingsList');
    if (!listEl) return;
    if (savings.length === 0) {
        listEl.innerHTML = '<div class="empty-msg">No savings recorded yet...</div>';
        return;
    }
    listEl.innerHTML = savings.map(s => `
        <div class="task-item" data-id="${s.id}">
            <div class="check-btn checked"></div>
            <div class="task-body">
                <span class="task-name">${escapeHtml(s.description)}</span>
                <div class="task-meta">
                    <span class="badge Medium">₹${parseFloat(s.amount).toFixed(2)}</span>
                    <span>${formatDate(s.date)}</span>
                </div>
            </div>
            <button class="btn-del" onclick="deleteSaving('${s.id}')" title="Delete">&times;</button>
        </div>
    `).join('');
}

// --- Chart Rendering ---
async function renderCharts() {
    const todayStr = getTodayStr();
    
    // Weekly Chart
    const labels = [];
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
        const dayTasks = state.tasks.filter(t => t.userId === state.currentUser && (t.date === dStr || (t.completed && t.completedAt === dStr)));
        const completed = dayTasks.filter(t => t.completed).length;
        data.push(dayTasks.length > 0 ? (completed / dayTasks.length) * 100 : 0);
    }

    if (charts.daily) charts.daily.destroy();
    const ctxDaily = document.getElementById('dailyChart').getContext('2d');
    charts.daily = new Chart(ctxDaily, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Completion %', data: data, backgroundColor: '#ff8fa3', borderRadius: 10 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
            plugins: { legend: { display: false } }
        }
    });

    // Monthly Chart (Simplified to use current state data)
    const monthStr = todayStr.substring(0, 7);
    const mLabels = [];
    const mValues = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        if (dStr.startsWith(monthStr)) {
            mLabels.push(dStr.split('-')[2]);
            const dayTasks = state.tasks.filter(t => t.userId === state.currentUser && (t.date === dStr || (t.completed && t.completedAt === dStr)));
            const completed = dayTasks.filter(t => t.completed).length;
            mValues.push(dayTasks.length > 0 ? (completed / dayTasks.length) * 100 : 0);
        }
    }

    if (charts.monthly) charts.monthly.destroy();
    const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
    charts.monthly = new Chart(ctxMonthly, {
        type: 'line',
        data: {
            labels: mLabels,
            datasets: [{ label: 'Daily Avg', data: mValues, borderColor: '#ff8fa3', tension: 0.4, fill: true, backgroundColor: 'rgba(255, 143, 163, 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });
}

function renderSavingsChart() {
    const userSavings = state.savings.filter(s => s.userId === state.currentUser).sort((a, b) => a.date.localeCompare(b.date));
    const labels = [...new Set(userSavings.map(s => s.date))].sort();
    const data = labels.map(l => userSavings.filter(s => s.date === l).reduce((acc, s) => acc + parseFloat(s.amount), 0));

    if (charts.savings) charts.savings.destroy();
    const ctxSavings = document.getElementById('savingsChart').getContext('2d');
    charts.savings = new Chart(ctxSavings, {
        type: 'line',
        data: {
            labels: labels.map(l => formatDate(l)),
            datasets: [{ label: 'Daily Savings', data: data, borderColor: '#ff8fa3', backgroundColor: 'rgba(255, 143, 163, 0.2)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// --- Storage ---
function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        } catch (e) { console.error(e); }
    }
}

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Helpers ---
function getTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function updateDateDisplay() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString(undefined, options);
    document.getElementById('taskDate').value = getTodayStr();
    document.getElementById('savingDate').value = getTodayStr();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- Event Listeners ---
function setupEventListeners() {
    document.getElementById('tabPlanner').addEventListener('click', () => switchTab('planner'));
    document.getElementById('tabSavings').addEventListener('click', () => switchTab('savings'));
    document.getElementById('tabProgress').addEventListener('click', () => switchTab('progress'));

    document.getElementById('userSelect').addEventListener('change', async (e) => {
        state.currentUser = e.target.value;
        saveToLocalStorage();
        await syncWithBackend();
        render();
        updateProgressData();
        updateSavingsData();
    });

    document.getElementById('sortPreference').addEventListener('change', (e) => {
        state.users[state.currentUser].sortPreference = e.target.value;
        saveToLocalStorage();
        render();
    });

    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addTask();
    });

    document.getElementById('savingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addSaving();
    });

    document.getElementById('taskContainer').addEventListener('click', (e) => {
        const taskId = e.target.closest('.task-item')?.dataset.id;
        if (!taskId) return;
        if (e.target.closest('.check-btn')) toggleTask(taskId);
        else if (e.target.closest('.btn-del')) deleteTask(taskId);
    });

    // Global delete for savings (added via onclick in template)
    window.deleteSaving = deleteSaving;
}

function switchTab(tab) {
    const views = ['plannerView', 'savingsView', 'progressView'];
    const btns = ['tabPlanner', 'tabSavings', 'tabProgress'];
    
    views.forEach(v => document.getElementById(v).style.display = 'none');
    btns.forEach(b => document.getElementById(b).classList.remove('active'));

    document.getElementById(tab + 'View').style.display = 'block';
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');

    if (tab === 'progress') renderCharts();
    if (tab === 'savings') renderSavingsChart();
}

// --- Actions ---
async function addTask() {
    const nameInput = document.getElementById('taskName');
    const diffInput = document.getElementById('taskDifficulty');
    const dateInput = document.getElementById('taskDate');
    const name = nameInput.value.trim();
    if (!name) return;

    const newTask = {
        id: Date.now().toString(),
        userId: state.currentUser,
        name: name,
        difficulty: diffInput.value,
        date: dateInput.value,
        completed: false,
        createdAt: new Date().toISOString()
    };

    state.tasks.push(newTask);
    saveToLocalStorage();
    render();
    updateProgressData();
    
    try {
        await API.saveTask(newTask);
    } catch (e) { console.error(e); }
    
    nameInput.value = '';
}

async function addSaving() {
    const amtInput = document.getElementById('savingAmount');
    const descInput = document.getElementById('savingDesc');
    const dateInput = document.getElementById('savingDate');
    
    const newSaving = {
        id: Date.now().toString(),
        userId: state.currentUser,
        amount: parseFloat(amtInput.value),
        description: descInput.value.trim(),
        date: dateInput.value,
        createdAt: new Date().toISOString()
    };

    state.savings.push(newSaving);
    saveToLocalStorage();
    updateSavingsData();

    try {
        await API.saveSaving(newSaving);
    } catch (e) { console.error(e); }
    
    amtInput.value = '';
    descInput.value = '';
}

async function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        task.completedAt = task.completed ? getTodayStr() : null;
        saveToLocalStorage();
        render();
        updateProgressData();
        
        try {
            await API.saveTask(task);
        } catch (e) { console.error(e); }
    }
}

async function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveToLocalStorage();
    render();
    updateProgressData();
    
    try {
        await API.deleteTask(id);
    } catch (e) { console.error(e); }
}

async function deleteSaving(id) {
    state.savings = state.savings.filter(s => s.id !== id);
    saveToLocalStorage();
    updateSavingsData();
    
    try {
        await API.deleteSaving(id);
    } catch (e) { console.error(e); }
}

// --- Rendering ---
function render() {
    const todayStr = getTodayStr();
    const userTasks = state.tasks.filter(t => t.userId === state.currentUser);
    const sortPref = state.users[state.currentUser].sortPreference;

    const difficultySort = (a, b) => {
        const valA = DIFFICULTY_ORDER[a.difficulty];
        const valB = DIFFICULTY_ORDER[b.difficulty];
        return sortPref === 'asc' ? valA - valB : valB - valA;
    };

    const missed = userTasks.filter(t => t.date < todayStr && !t.completed).sort(difficultySort);
    const today = userTasks.filter(t => (t.date === todayStr) || (t.completed && t.completedAt === todayStr)).sort(difficultySort);
    const upcoming = userTasks.filter(t => t.date > todayStr && !(t.completed && t.completedAt === todayStr)).sort((a,b) => a.date.localeCompare(b.date) || difficultySort(a,b));

    renderList('missedTasksList', missed);
    renderList('todayTasksList', today);
    renderList('upcomingTasksList', upcoming);
}

function renderList(listId, tasks) {
    const listElement = document.getElementById(listId);
    if (!listElement) return;
    if (tasks.length === 0) {
        listElement.innerHTML = '<div class="empty-msg">No tasks here...</div>';
        return;
    }
    listElement.innerHTML = tasks.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
            <div class="check-btn ${task.completed ? 'checked' : ''}"></div>
            <div class="task-body">
                <span class="task-name">${escapeHtml(task.name)}</span>
                <div class="task-meta">
                    <span class="badge ${task.difficulty}">${task.difficulty}</span>
                    <span>${formatDate(task.date)}</span>
                </div>
            </div>
            <button class="btn-del" title="Delete Task">&times;</button>
        </div>
    `).join('');
}

init();
