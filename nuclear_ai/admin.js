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
    calcEarnings();
});

async function calcEarnings() {
    let total = 0;
    // Map both short and long names to prices
    const planPrices = { 
        'plus': 199, 'geo/seo plus': 199, 'standard': 199,
        'enterprise': 799, 'geo/seo enterprise': 799,
        'mvp': 1000, 'geo/seo mvp': 1000, 'mvp saas product': 1000
    };
    if (isMockMode) {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith('projects_')) {
                const arr = JSON.parse(localStorage.getItem(k) || '[]');
                arr.forEach(p => {
                    const planKey = (p.plan || '').toLowerCase().trim();
                    total += planPrices[planKey] || 0;
                });
            }
        }
    } else {
        const { data, error } = await supabaseClient.from('projects').select('plan');
        if (!error && data) {
            data.forEach(p => {
                const planKey = (p.plan || '').toLowerCase().trim();
                total += planPrices[planKey] || 0;
            });
        }
    }
    const badge = document.getElementById('earnings-val');
    if(badge) badge.innerText = total.toLocaleString();
}

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

async function uploadFileToSupabase(file, bucket) {
    if (isMockMode) {
        // Return a valid dummy PDF for local testing
        return 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(filePath, file);
    if (uploadError) {
        console.error('Upload error', uploadError);
        return null;
    }
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
}

async function saveProjectData() {
    if (!currentSelectedProjectId || !currentProjectData) return;
    
    const activeTabObj = document.querySelector('.auth-tab.active');
    const activeTab = activeTabObj ? activeTabObj.innerText.toLowerCase() : 'overview';
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
        
        const fileInput = document.getElementById('prompts-file-upload');
        if (fileInput && fileInput.files.length > 0) {
            document.getElementById('prompts-title').disabled = true;
            const fileUrl = await uploadFileToSupabase(fileInput.files[0], 'prompts');
            document.getElementById('prompts-title').disabled = false;
            newItem.files = [{ name: fileInput.files[0].name, type: 'pdf', url: fileUrl }];
        } else {
            newItem.files = [];
        }
    } else if (activeTab === 'sources') {
        let auditData = {
            vci: document.getElementById('src-vci').value,
            ded: document.getElementById('src-ded').value,
            dcs: document.getElementById('src-dcs').value,
            vur: document.getElementById('src-vur').value,
            cmap: document.getElementById('src-cmap').value,
            dr_blind: document.getElementById('src-dr-blind').value,
            dr_context: document.getElementById('src-dr-context').value,
            dr_brand: document.getElementById('src-dr-brand').value,
            ce_llm: document.getElementById('src-ce-llm').value,
            ce_answer: document.getElementById('src-ce-answer').value,
            ce_density: document.getElementById('src-ce-density').value,
            ce_chunk: document.getElementById('src-ce-chunk').value,
            bt_score: document.getElementById('src-bt-score').value,
            bt_risk: document.getElementById('src-bt-risk').value,
            bt_citations: document.getElementById('src-bt-citations').value,
            bt_mentions: document.getElementById('src-bt-mentions').value,
            bt_mix: document.getElementById('src-bt-mix').value,
            ar_btn: document.getElementById('src-ar-btn').value,
            ar_form: document.getElementById('src-ar-form').value,
            ar_cta: document.getElementById('src-ar-cta').value,
            bi_ind: document.getElementById('src-bi-ind').value,
            bi_geo: document.getElementById('src-bi-geo').value,
        };

        const fileInput = document.getElementById('src-pdf-upload');
        if (fileInput && fileInput.files.length > 0) {
            const fileUrl = await uploadFileToSupabase(fileInput.files[0], 'audits');
            auditData.pdfFile = fileUrl;
        }

        newItem.content = JSON.stringify(auditData);

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

async function deleteProject() {
    if (!currentSelectedProjectId) return;
    if (!confirm("Are you sure you want to permanently delete this project?")) return;

    if (isMockMode) {
        const projectsKey = `projects_${currentSelectedEmail}`;
        let projects = JSON.parse(localStorage.getItem(projectsKey) || '[]');
        projects = projects.filter(p => p.id !== currentSelectedProjectId);
        localStorage.setItem(projectsKey, JSON.stringify(projects));
        localStorage.removeItem(`project_data_${currentSelectedProjectId}`);
    } else {
        const { error } = await supabaseClient.from('projects').delete().eq('id', currentSelectedProjectId);
        if (error) {
            alert("Error deleting project.");
            return;
        }
    }

    currentSelectedProjectId = null;
    document.getElementById('admin-empty-area').style.display = 'flex';
    document.getElementById('admin-editor-area').style.display = 'none';
    loadUserProjects(currentSelectedEmail);
    calcEarnings();
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
