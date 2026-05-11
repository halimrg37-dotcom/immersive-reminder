// ========== AUTHENTICATION SYSTEM ==========
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.init();
    }

    init() {
        this.loadUsers();
        this.checkCurrentUser();
        this.setupEventListeners();
    }

    loadUsers() {
        const saved = localStorage.getItem('users');
        this.users = saved ? JSON.parse(saved) : [];
    }

    saveUsers() {
        localStorage.setItem('users', JSON.stringify(this.users));
    }

    checkCurrentUser() {
        const saved = localStorage.getItem('currentUser');
        this.currentUser = saved ? JSON.parse(saved) : null;
    }

    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(tabName + 'Form').classList.add('active');
            });
        });

        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
    }

    register() {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerConfirm').value;

        // Validation
        if (!name || !email || !password || !confirm) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        if (password !== confirm) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        if (this.users.some(u => u.email === email)) {
            this.showNotification('Email already registered', 'error');
            return;
        }

        // Create user
        const user = {
            id: Date.now(),
            name: name,
            email: email,
            password: password, // In production, use hashing!
            createdAt: new Date().toISOString()
        };

        this.users.push(user);
        this.saveUsers();
        this.showNotification('Registration successful! Please login.', 'success');

        // Clear form and switch to login
        document.getElementById('registerForm').reset();
        document.querySelector('[data-tab="login"]').click();
    }

    login() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        const user = this.users.find(u => u.email === email && u.password === password);

        if (!user) {
            this.showNotification('Invalid email or password', 'error');
            return;
        }

        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.showNotification(`Welcome back, ${user.name}!`, 'success');
        document.getElementById('loginForm').reset();

        // Show main app
        this.showApp();
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            document.getElementById('authScreen').style.display = 'flex';
            document.getElementById('appScreen').style.display = 'none';
            document.getElementById('loginForm').reset();
            document.getElementById('registerForm').reset();
            this.showNotification('Logged out successfully', 'success');
        }
    }

    showApp() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'block';
        document.getElementById('currentUser').textContent = `👤 ${this.currentUser.name}`;
        
        // Initialize room and reminder managers on login
        if (!window.roomManager) {
            window.roomManager = new RoomManager(this.currentUser.id);
            window.app = new ReminderApp(this.currentUser.id, window.roomManager);
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// ========== ROOM MANAGEMENT SYSTEM ==========
class RoomManager {
    constructor(userId) {
        this.userId = userId;
        this.rooms = [];
        this.currentRoom = null;
        this.init();
    }

    init() {
        this.loadRooms();
        this.setupEventListeners();
        this.renderRooms();
    }

    loadRooms() {
        const saved = localStorage.getItem(`rooms_${this.userId}`);
        this.rooms = saved ? JSON.parse(saved) : [];
        
        // If no rooms, create default personal room
        if (this.rooms.length === 0) {
            this.createRoom('Personal Tasks', 'My personal reminders', 'personal', true);
        }
    }

    saveRooms() {
        localStorage.setItem(`rooms_${this.userId}`, JSON.stringify(this.rooms));
    }

    setupEventListeners() {
        document.getElementById('roomSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectRoom(parseInt(e.target.value));
            }
        });

        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.showCreateRoomModal();
        });

        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoomFromForm();
        });
    }

    createRoom(name, description, type, isDefault = false) {
        const room = {
            id: Date.now(),
            name: name,
            description: description,
            type: type,
            isDefault: isDefault,
            createdAt: new Date().toISOString(),
            members: [this.userId]
        };

        this.rooms.push(room);
        this.saveRooms();

        // Auto-select first room or this room
        if (this.rooms.length === 1 || isDefault) {
            this.selectRoom(room.id);
        }

        return room;
    }

    createRoomFromForm() {
        const name = document.getElementById('roomName').value.trim();
        const description = document.getElementById('roomDescription').value.trim();
        const type = document.getElementById('roomType').value;

        if (!name) {
            authManager.showNotification('Room name is required', 'error');
            return;
        }

        this.createRoom(name, description, type);
        authManager.showNotification('Room created successfully!', 'success');
        document.getElementById('createRoomForm').reset();
        closeCreateRoomModal();
        this.renderRooms();
    }

    selectRoom(roomId) {
        this.currentRoom = this.rooms.find(r => r.id === roomId);
        if (this.currentRoom) {
            document.getElementById('roomSelect').value = roomId;
            document.getElementById('currentRoom').textContent = `📁 ${this.currentRoom.name}`;
            
            // Reload reminders for this room
            if (window.app) {
                window.app.loadReminders();
                window.app.render();
            }
        }
    }

    renderRooms() {
        const select = document.getElementById('roomSelect');
        select.innerHTML = '<option value="">Select or Create Room</option>';
        
        this.rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = `${room.type === 'personal' ? '👤' : '👥'} ${room.name}`;
            select.appendChild(option);
        });

        // Select first room if none selected
        if (!this.currentRoom && this.rooms.length > 0) {
            this.selectRoom(this.rooms[0].id);
        }
    }

    showCreateRoomModal() {
        document.getElementById('createRoomModal').classList.add('show');
    }

    getCurrentRoomId() {
        return this.currentRoom ? this.currentRoom.id : null;
    }
}

// ========== REMINDER MANAGEMENT SYSTEM ==========
class ReminderApp {
    constructor(userId, roomManager) {
        this.userId = userId;
        this.roomManager = roomManager;
        this.reminders = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.loadReminders();
        this.setupEventListeners();
        this.render();
        this.startNotificationSystem();
    }

    // Load reminders for current room
    loadReminders() {
        const roomId = this.roomManager.getCurrentRoomId();
        if (!roomId) return;
        
        const key = `reminders_${this.userId}_${roomId}`;
        const saved = localStorage.getItem(key);
        this.reminders = saved ? JSON.parse(saved) : [];
    }

    // Save reminders for current room
    saveReminders() {
        const roomId = this.roomManager.getCurrentRoomId();
        if (!roomId) return;
        
        const key = `reminders_${this.userId}_${roomId}`;
        localStorage.setItem(key, JSON.stringify(this.reminders));
    }

    // Setup event listeners
    setupEventListeners() {
        // Form submission
        document.getElementById('reminderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createReminder();
        });

        // Recurring checkbox toggle
        document.getElementById('recurring').addEventListener('change', (e) => {
            const recurrenceSelect = document.getElementById('recurrenceType');
            recurrenceSelect.style.display = e.target.checked ? 'block' : 'none';
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.render();
            });
        });

        // Edit form submission
        document.getElementById('editForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateReminder();
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', closeEditModal);
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('editModal');
            if (e.target === modal) closeEditModal();
        });
    }

    // Create new reminder following flowchart logic
    createReminder() {
        // FLOWCHART: START -> Validate Input
        const taskName = document.getElementById('taskName').value.trim();
        const dueDate = document.getElementById('dueDate').value;
        
        if (!taskName || !dueDate) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // FLOWCHART: Check if task already exists
        const isDuplicate = this.reminders.some(r => 
            r.name.toLowerCase() === taskName.toLowerCase() && !r.completed
        );
        
        if (isDuplicate) {
            this.showNotification('A similar reminder already exists', 'warning');
            return;
        }

        // FLOWCHART: Process and create reminder
        const reminder = {
            id: Date.now(),
            name: taskName,
            description: document.getElementById('description').value,
            dueDate: dueDate,
            priority: document.getElementById('priority').value,
            category: document.getElementById('category').value,
            recurring: document.getElementById('recurring').checked,
            recurrenceType: document.getElementById('recurrenceType').value,
            completed: false,
            createdAt: new Date().toISOString(),
            notifications: []
        };

        // FLOWCHART: Save reminder
        this.reminders.push(reminder);
        this.saveReminders();

        // FLOWCHART: Clear form and show success
        document.getElementById('reminderForm').reset();
        this.render();
        this.showNotification('Reminder created successfully!', 'success');
    }

    // Update reminder
    updateReminder() {
        const id = parseInt(document.getElementById('editId').value);
        const reminder = this.reminders.find(r => r.id === id);

        if (reminder) {
            reminder.name = document.getElementById('editTaskName').value;
            reminder.description = document.getElementById('editDescription').value;
            reminder.dueDate = document.getElementById('editDueDate').value;
            reminder.priority = document.getElementById('editPriority').value;
            
            this.saveReminders();
            this.render();
            closeEditModal();
            this.showNotification('Reminder updated successfully!', 'success');
        }
    }

    // Open edit modal
    openEditModal(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            document.getElementById('editId').value = reminder.id;
            document.getElementById('editTaskName').value = reminder.name;
            document.getElementById('editDescription').value = reminder.description;
            document.getElementById('editDueDate').value = reminder.dueDate;
            document.getElementById('editPriority').value = reminder.priority;
            
            document.getElementById('editModal').classList.add('show');
        }
    }

    // Delete reminder
    deleteReminder(id) {
        if (confirm('Are you sure you want to delete this reminder?')) {
            this.reminders = this.reminders.filter(r => r.id !== id);
            this.saveReminders();
            this.render();
            this.showNotification('Reminder deleted', 'success');
        }
    }

    // Toggle reminder completion
    toggleComplete(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (reminder) {
            reminder.completed = !reminder.completed;
            
            // FLOWCHART: If recurring, create next instance
            if (reminder.recurring && !reminder.completed) {
                this.createRecurringReminder(reminder);
            }
            
            this.saveReminders();
            this.render();
            this.showNotification(
                reminder.completed ? 'Reminder completed!' : 'Reminder marked as pending',
                'success'
            );
        }
    }

    // Create next recurring reminder
    createRecurringReminder(parentReminder) {
        const currentDate = new Date(parentReminder.dueDate);
        let nextDate = new Date(currentDate);

        switch (parentReminder.recurrenceType) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }

        // Create new reminder for next occurrence
        const newReminder = {
            ...parentReminder,
            id: Date.now() + Math.random(),
            dueDate: nextDate.toISOString().slice(0, 16),
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.reminders.push(newReminder);
    }

    // Filter reminders based on current filter
    getFilteredReminders() {
        switch (this.currentFilter) {
            case 'active':
                return this.reminders.filter(r => !r.completed);
            case 'completed':
                return this.reminders.filter(r => r.completed);
            case 'high':
                return this.reminders.filter(r => r.priority === 'high' && !r.completed);
            default:
                return this.reminders;
        }
    }

    // Calculate statistics
    calculateStats() {
        const total = this.reminders.length;
        const active = this.reminders.filter(r => !r.completed).length;
        const completed = this.reminders.filter(r => r.completed).length;

        document.getElementById('totalReminders').textContent = total;
        document.getElementById('activeReminders').textContent = active;
        document.getElementById('completedReminders').textContent = completed;
    }

    // Check if reminder is overdue
    isOverdue(dueDate) {
        return new Date(dueDate) < new Date() && !this.reminders.find(r => r.dueDate === dueDate)?.completed;
    }

    // Format date and time
    formatDateTime(dateString) {
        const date = new Date(dateString);
        const options = {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    // Get time until reminder
    getTimeUntil(dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        const diff = due - now;

        if (diff < 0) {
            const minutes = Math.floor(Math.abs(diff) / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days}d overdue`;
            if (hours > 0) return `${hours}h overdue`;
            return `${minutes}m overdue`;
        }

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `in ${days}d`;
        if (hours > 0) return `in ${hours}h`;
        return `in ${minutes}m`;
    }

    // Render reminders to DOM
    render() {
        const remindersList = document.getElementById('remindersList');
        const filtered = this.getFilteredReminders();

        if (filtered.length === 0) {
            remindersList.innerHTML = '<div class="empty-state">📝 No reminders found. Create your first reminder above!</div>';
        } else {
            remindersList.innerHTML = filtered.map(reminder => this.createCardHTML(reminder)).join('');
            this.attachCardEventListeners();
        }

        this.calculateStats();
    }

    // Create card HTML
    createCardHTML(reminder) {
        const isOverdue = this.isOverdue(reminder.dueDate);
        const timeUntil = this.getTimeUntil(reminder.dueDate);

        return `
            <div class="reminder-card ${reminder.completed ? 'completed' : ''} ${reminder.priority}-priority">
                <div class="card-header">
                    <div>
                        <span class="category-badge">${reminder.category}</span>
                        <div class="card-title ${reminder.completed ? 'card-completed' : ''}">
                            ${reminder.name}
                            ${reminder.recurring ? '🔄' : ''}
                        </div>
                    </div>
                    <span class="priority-badge ${reminder.priority}">${reminder.priority}</span>
                </div>

                ${reminder.description ? `<p class="card-description">${reminder.description}</p>` : ''}

                <div class="card-due-date ${isOverdue ? 'overdue' : ''}">
                    ⏰ ${this.formatDateTime(reminder.dueDate)}
                    <span style="margin-left: auto;">${timeUntil}</span>
                </div>

                <div class="card-actions">
                    <button class="btn btn-sm btn-success" onclick="app.toggleComplete(${reminder.id})">
                        ${reminder.completed ? '↩️ Undo' : '✓ Complete'}
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="app.openEditModal(${reminder.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteReminder(${reminder.id})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    // Attach event listeners to cards
    attachCardEventListeners() {
        // Event listeners are handled via onclick attributes in HTML
    }

    // Show notification
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Start notification system
    startNotificationSystem() {
        // Check for reminders that need notification every minute
        setInterval(() => {
            const now = new Date();
            this.reminders.forEach(reminder => {
                if (!reminder.completed) {
                    const reminderTime = new Date(reminder.dueDate);
                    const timeDiff = reminderTime - now;

                    // Notify 5 minutes before
                    if (timeDiff > 0 && timeDiff <= 5 * 60000) {
                        if (!reminder.notifications.includes('5min')) {
                            reminder.notifications.push('5min');
                            if (Notification.permission === 'granted') {
                                new Notification('Reminder Alert! 🔔', {
                                    body: `${reminder.name} is due in 5 minutes`,
                                    icon: '⏰'
                                });
                            }
                        }
                    }

                    // Notify at due time
                    if (Math.abs(timeDiff) < 60000 && timeDiff >= -5 * 60000) {
                        if (!reminder.notifications.includes('due')) {
                            reminder.notifications.push('due');
                            if (Notification.permission === 'granted') {
                                new Notification('Task Due Now! 🔔', {
                                    body: `${reminder.name} is due now!`,
                                    icon: '⏰'
                                });
                            }
                        }
                    }
                }
            });
        }, 60000); // Check every minute

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// Initialize app with authentication
let authManager;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth system
    authManager = new AuthManager();

    // If user is already logged in, show app and initialize managers
    if (authManager.currentUser) {
        authManager.showApp();
    }
});

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
}

// Close create room modal
function closeCreateRoomModal() {
    document.getElementById('createRoomModal').classList.remove('show');
}

// Keyboard shortcut to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEditModal();
        closeCreateRoomModal();
    }
});
