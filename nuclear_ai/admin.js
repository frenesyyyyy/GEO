const SUPABASE_URL = 'https://uzubvvmfroozinyqdlbi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dWJ2dm1mcm9vemlueXFkbGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDM5OTQsImV4cCI6MjA4OTc3OTk5NH0.f-g9ADbts9WIHyGw9BQF6RZaJKjOJ24cOuPFHv7mMWg';
const isMockMode = (SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY');
let supabaseClient = null;

if (!isMockMode && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let currentSelectedEmail = null;
let currentSelectedProjectId = null;
let currentProjectData = null; // Stores all arrays from the active project

window.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});

function loadUsers() {
    const users = JSON.parse(localStorage.getItem('all_auth_users') || '[]');
    const list = document.getElementById('admin-user-list');
    list.innerHTML = '';
    
    if (users.length === 0) {
        list.innerHTML = '<li style="color: #6b7280; text-align: center; font-size: 13px;">No users found</li>';
        return;
    }

    users.forEach(u => {
        const li = document.createElement('li');
        li.dataset.email = u.email;
        li.innerHTML = `
            <span class="title-text">${u.name || 'Unknown'}</span>
            <span class="sub-text">${u.email}</span>
        `;
        li.onclick = () => selectUser(u.email, li);
        list.appendChild(li);
    });
}

function selectUser(email, liElement) {
    currentSelectedEmail = email;
    currentSelectedProjectId = null;
    
    // Update active UI
    document.querySelectorAll('#admin-user-list li').forEach(el => el.classList.remove('active'));
    liElement.classList.add('active');
    
    // Reset editor UI
    document.getElementById('admin-projects-col').style.display = 'block';
    document.getElementById('admin-editor-area').style.display = 'none';
    document.getElementById('admin-empty-area').style.display = 'flex';
    document.getElementById('selected-user-email').innerText = email;
    
    loadUserProjects(email);
}

async function loadUserProjects(email) {
    const list = document.getElementById('admin-project-list');
    list.innerHTML = '';
    
    let projects = [];
    if (isMockMode) {
        const projectsKey = `projects_${email}`;
        projects = JSON.parse(localStorage.getItem(projectsKey) || '[]');
    } else {
        const { data, error } = await supabaseClient.from('projects').select('*').eq('user_email', email);
        if (!error && data) projects = data;
    }
    
    if (projects.length === 0) {
        list.innerHTML = '<li style="color: #6b7280; text-align: center; font-size: 13px;">No projects found</li>';
        return;
    }

    projects.forEach(p => {
        const li = document.createElement('li');
        li.dataset.id = p.id;
        li.innerHTML = `
            <span class="title-text">${p.name}</span>
            <span class="sub-text">Plan: ${p.plan} | Status: ${p.status}</span>
        `;
        li.onclick = () => selectProject(p, li);
        list.appendChild(li);
    });
}

function selectProject(project, liElement) {
    currentSelectedProjectId = project.id;
    
    document.querySelectorAll('#admin-project-list li').forEach(el => el.classList.remove('active'));
    liElement.classList.add('active');
    
    document.getElementById('admin-empty-area').style.display = 'none';
    document.getElementById('admin-editor-area').style.display = 'block';
    document.getElementById('editing-project-name').innerText = `Editing: ${project.name}`;
    
    loadProjectData(project.id);
}

function switchAdminTab(tabName) {
    // Update tab UI
    const tabs = document.querySelectorAll('.admin-editor-tabs .auth-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    // Show correct content
    const contents = document.querySelectorAll('.admin-tab-content');
    contents.forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tabName}`).style.display = 'block';
}

async function loadProjectData(projectId) {
    let data = { overview: [], prompts: [], sources: [], models: [], comply: [] };
    if (isMockMode) {
        const dataKey = `project_data_${projectId}`;
        const saved = JSON.parse(localStorage.getItem(dataKey) || '{}');
        // Ensure all are arrays
        data.overview = Array.isArray(saved.overview) ? saved.overview : (saved.overview ? [saved.overview] : []);
        data.prompts = Array.isArray(saved.prompts) ? saved.prompts : (saved.prompts ? [saved.prompts] : []);
        data.sources = Array.isArray(saved.sources) ? saved.sources : (saved.sources ? [saved.sources] : []);
        data.models = Array.isArray(saved.models) ? saved.models : (saved.models ? [saved.models] : []);
        data.comply = Array.isArray(saved.comply) ? saved.comply : (saved.comply ? [saved.comply] : []);
    } else {
        const { data: row, error } = await supabaseClient.from('projects').select('overview, prompts, sources, models, comply').eq('id', projectId).single();
        if (!error && row) {
            data.overview = Array.isArray(row.overview) ? row.overview : [];
            data.prompts = Array.isArray(row.prompts) ? row.prompts : [];
            data.sources = Array.isArray(row.sources) ? row.sources : [];
            data.models = Array.isArray(row.models) ? row.models : [];
            data.comply = Array.isArray(row.comply) ? row.comply : [];
        }
    }
    
    currentProjectData = data;
    renderHistoryAll();
    
    // Clear forms for new entry
    document.querySelectorAll('.admin-tab-content input, .admin-tab-content textarea').forEach(el => el.value = '');
    document.getElementById('overview-color').value = 'green';
}

function renderHistoryAll() {
    renderTabHistory('overview');
    renderTabHistory('prompts');
    renderTabHistory('sources');
    renderTabHistory('models');
    renderTabHistory('comply');
}

function renderTabHistory(tab) {
    const list = document.getElementById(`history-${tab}`);
    if (!list) return;
    list.innerHTML = '';
    
    const items = currentProjectData[tab] || [];
    if (items.length === 0) {
        list.innerHTML = '<div style="color: #6b7280; font-size: 12px; padding: 10px;">No history yet.</div>';
        return;
    }

    // Sort by newest first
    const sorted = [...items].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    sorted.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        let preview = '';
        if (tab === 'overview') preview = item.msg;
        else if (tab === 'prompts') preview = item.title;
        else preview = (item.content || '').substring(0, 40) + '...';

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span style="font-weight: 600; font-size: 13px;">${new Date(item.timestamp).toLocaleDateString()}</span>
                <button onclick="deleteEntry('${tab}', '${item.timestamp}')" class="btn-delete-small"><i data-lucide="trash-2"></i></button>
            </div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">${preview}</div>
        `;
        list.appendChild(div);
    });
    lucide.createIcons();
}

async function saveProjectData() {
    if (!currentSelectedProjectId || !currentProjectData) return;
    
    const activeTab = document.querySelector('.auth-tab.active').innerText.toLowerCase();
    let newItem = { timestamp: new Date().toISOString() };

    if (activeTab === 'overview') {
        const msg = document.getElementById('overview-msg').value;
        if(!msg) return alert("Message is required");
        newItem.msg = msg;
        newItem.color = document.getElementById('overview-color').value;
    } else if (activeTab === 'prompts') {
        const title = document.getElementById('prompts-title').value;
        if(!title) return alert("Title is required");
        newItem.title = title;
        newItem.desc = document.getElementById('prompts-desc').value;
        const filesInput = document.getElementById('prompts-files').value;
        newItem.files = filesInput ? filesInput.split(',').map(s => {
            const name = s.trim();
            const ext = name.split('.').pop().toLowerCase();
            return { name, type: ext };
        }).filter(f => f.name) : [];
    } else {
        const content = document.getElementById(`${activeTab}-content`).value;
        if(!content) return alert("Content is required");
        newItem.content = content;
    }

    // Append to existing array
    currentProjectData[activeTab].push(newItem);
    
    if (isMockMode) {
        localStorage.setItem(`project_data_${currentSelectedProjectId}`, JSON.stringify(currentProjectData));
        alert('Package appended successfully (Mock Mode)!');
        loadProjectData(currentSelectedProjectId);
    } else {
        const updateData = {};
        updateData[activeTab] = currentProjectData[activeTab];

        const { error } = await supabaseClient.from('projects').update(updateData).eq('id', currentSelectedProjectId);
        
        if (error) {
            console.error('Error updating project:', error);
            alert('Failed to save data.');
        } else {
            alert('New package added successfully!');
            loadProjectData(currentSelectedProjectId);
        }
    }
}

async function deleteEntry(tab, timestamp) {
    if (!confirm("Are you sure you want to delete this historical entry?")) return;
    
    currentProjectData[tab] = currentProjectData[tab].filter(i => i.timestamp !== timestamp);
    
    if (isMockMode) {
        localStorage.setItem(`project_data_${currentSelectedProjectId}`, JSON.stringify(currentProjectData));
        renderHistoryAll();
    } else {
        const updateData = {};
        updateData[tab] = currentProjectData[tab];
        const { error } = await supabaseClient.from('projects').update(updateData).eq('id', currentSelectedProjectId);
        if (error) alert("Error deleting entry");
        else renderHistoryAll();
    }
}
