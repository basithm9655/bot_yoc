/**
 * PSG College of Technology - Youth Outreach Club
 * Manavar Illam Volunteer Registration Bot Prototype JavaScript
 */

const SESSION_ID = 'student_session_' + Math.random().toString(36).substring(2, 9);
let allRegistrationsData = [];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Start Chatbot initial greeting
    sendChatMessage('');
    
    // Load Admin Dashboard data
    loadDashboardData();
});

/* ==========================================================================
   VIEW TAB SWITCHER
   ========================================================================== */
function switchView(viewName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

    if (viewName === 'student') {
        document.getElementById('tab-student').classList.add('active');
        document.getElementById('view-student').classList.add('active');
    } else if (viewName === 'admin') {
        document.getElementById('tab-admin').classList.add('active');
        document.getElementById('view-admin').classList.add('active');
        loadDashboardData();
    }
}

/* ==========================================================================
   STUDENT WHATSAPP BOT SIMULATOR
   ========================================================================== */
async function sendChatMessage(userText) {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (userText !== '') {
        appendMessage('user', userText);
    }
    
    chatInput.value = '';
    chatInput.disabled = true;
    sendBtn.disabled = true;
    
    clearQuickOptions();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: SESSION_ID,
                message: userText
            })
        });

        const data = await response.json();
        
        // Small simulated delay for typing feel
        setTimeout(() => {
            appendMessage('bot', data.text);
            renderQuickOptions(data.options || [], data.is_confirmation);
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
            
            // Refresh admin dashboard silently in case a registration was completed
            if (data.text.includes('Registration successful')) {
                loadDashboardData();
            }
        }, 300);

    } catch (error) {
        console.error('Error sending message:', error);
        appendMessage('bot', '⚠️ Connection error. Please check your backend server.');
        chatInput.disabled = false;
        sendBtn.disabled = false;
    }
}

function handleSendSubmit(event) {
    event.preventDefault();
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value.strip ? chatInput.value.strip() : chatInput.value.trim();
    if (text) {
        sendChatMessage(text);
    }
}

function appendMessage(sender, text) {
    const chatBody = document.getElementById('chat-body');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgDiv.innerHTML = `
        <div class="msg-content">${escapeHTML(text)}</div>
        <span class="msg-time">${timeStr}</span>
    `;
    
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function renderQuickOptions(options, isConfirmation = false) {
    const container = document.getElementById('quick-options');
    container.innerHTML = '';

    if (!options || options.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        
        if (opt.includes('Confirm')) {
            btn.classList.add('confirm-btn');
        } else if (opt.includes('Cancel')) {
            btn.classList.add('cancel-btn');
        }

        btn.innerHTML = escapeHTML(opt);
        btn.onclick = () => sendChatMessage(opt);
        container.appendChild(btn);
    });
}

function clearQuickOptions() {
    const container = document.getElementById('quick-options');
    container.innerHTML = '';
    container.style.display = 'none';
}

function resetChat() {
    const chatBody = document.getElementById('chat-body');
    chatBody.innerHTML = '';
    sendChatMessage('restart');
}

/* ==========================================================================
   ADMIN DASHBOARD LOGIC
   ========================================================================== */
async function loadDashboardData() {
    try {
        const selectedCat = document.getElementById('category-filter') ? document.getElementById('category-filter').value : 'All';
        const response = await fetch(`/api/registrations?category=${encodeURIComponent(selectedCat)}`);
        const data = await response.json();

        // Update Date Display
        if (data.date) {
            const dateObj = new Date(data.date);
            const formattedDateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
            document.getElementById('current-date-display').innerText = formattedDateStr;
        }

        // Update Total Count
        document.getElementById('kpi-total').innerText = data.total;

        // Render Category Pills
        renderCategoryPills(data.category_counts);

        // Store and Render Registrations Table
        allRegistrationsData = data.registrations || [];
        filterTable();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Error loading registrations data', 'error');
    }
}

function renderCategoryPills(counts) {
    const container = document.getElementById('kpi-category-pills');
    container.innerHTML = '';

    if (!counts) return;

    Object.keys(counts).forEach(cat => {
        const count = counts[cat];
        const pill = document.createElement('div');
        pill.className = 'cat-pill';
        pill.innerHTML = `<span>${escapeHTML(cat)}</span> <span class="count">${count}</span>`;
        container.appendChild(pill);
    });
}

function renderRegistrationsTable(rows) {
    const tbody = document.getElementById('registrations-tbody');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No volunteer registrations found for today.</td></tr>';
        return;
    }

    rows.forEach((reg, index) => {
        const tr = document.createElement('tr');

        // Determine category badge class
        let catBadgeClass = 'badge-cat';
        if (reg.category.includes('Boys')) catBadgeClass += ' boys';
        else if (reg.category.includes('Day Scholar')) catBadgeClass += ' day-scholar';
        else if (reg.category.includes('Hostel')) catBadgeClass += ' hostel-girls';

        // Format timestamp
        let regTimeStr = reg.registered_at;
        try {
            const timeObj = new Date(reg.registered_at);
            regTimeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch(e) {}

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHTML(reg.name)}</strong></td>
            <td><code>${escapeHTML(reg.roll_number)}</code></td>
            <td><span class="${catBadgeClass}">${escapeHTML(reg.category)}</span></td>
            <td>${regTimeStr}</td>
            <td class="text-right">
                <button class="btn-danger-sm" onclick="confirmDelete(${reg.id}, '${escapeHTML(reg.name)}')">
                    <i class="fa-solid fa-trash-can"></i> Remove
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function filterCategory() {
    loadDashboardData();
}

function filterTable() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    if (!query) {
        renderRegistrationsTable(allRegistrationsData);
        return;
    }

    const filtered = allRegistrationsData.filter(reg => 
        reg.name.toLowerCase().includes(query) || 
        reg.roll_number.toLowerCase().includes(query)
    );

    renderRegistrationsTable(filtered);
}

async function confirmDelete(id, name) {
    if (confirm(`Are you sure you want to remove "${name}" from today's volunteer list?`)) {
        try {
            const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast(`Removed ${name} from volunteer list.`, 'success');
                loadDashboardData();
            } else {
                showToast(data.message || 'Failed to remove registration', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete registration', 'error');
        }
    }
}

async function resetDemoData() {
    if (confirm('Reset database with default demo volunteer data?')) {
        try {
            const res = await fetch('/api/reset-demo', { method: 'POST' });
            const data = await res.json();
            showToast(data.message, 'success');
            loadDashboardData();
            resetChat();
        } catch (error) {
            showToast('Failed to reset demo data', 'error');
        }
    }
}

/* ==========================================================================
   ANNOUNCEMENT GENERATOR & EXPORT
   ========================================================================== */
async function openAnnouncementModal() {
    try {
        const res = await fetch('/api/announcement');
        const data = await res.json();
        
        document.getElementById('announcement-text').value = data.announcement;
        document.getElementById('announcement-modal').classList.add('active');
    } catch (error) {
        showToast('Failed to generate announcement text', 'error');
    }
}

function closeAnnouncementModal() {
    document.getElementById('announcement-modal').classList.remove('active');
}

function copyAnnouncementText() {
    const textarea = document.getElementById('announcement-text');
    textarea.select();
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textarea.value).then(() => {
            showToast('Formatted list copied to clipboard! Ready to paste into WhatsApp.', 'success');
        }).catch(err => {
            document.execCommand('copy');
            showToast('Formatted list copied to clipboard!', 'success');
        });
    } else {
        document.execCommand('copy');
        showToast('Formatted list copied to clipboard!', 'success');
    }
}

function downloadCSV() {
    window.location.href = '/api/export-csv';
    showToast('Downloading volunteers CSV file...', 'success');
}

/* ==========================================================================
   UTILITY & TOAST NOTIFICATIONS
   ========================================================================== */
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${escapeHTML(message)}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3500);
}
