let currentSelectedEmail = null;
let currentSelectedProjectId = null;

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

function loadUserProjects(email) {
    const list = document.getElementById('admin-project-list');
    list.innerHTML = '';
    
    const projectsKey = `projects_${email}`;
    const projects = JSON.parse(localStorage.getItem(projectsKey) || '[]');
    
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

function loadProjectData(projectId) {
    const dataKey = `project_data_${projectId}`;
    const data = JSON.parse(localStorage.getItem(dataKey) || '{}');
    
    document.getElementById('overview-msg').value = data.overview?.msg || '';
    document.getElementById('overview-color').value = data.overview?.color || 'green';
    
    document.getElementById('prompts-title').value = data.prompts?.title || '';
    document.getElementById('prompts-desc').value = data.prompts?.desc || '';
    document.getElementById('prompts-files').value = (data.prompts?.files || []).join(', ');
    
    document.getElementById('sources-content').value = data.sources?.content || '';
    document.getElementById('models-content').value = data.models?.content || '';
    document.getElementById('comply-content').value = data.comply?.content || '';
}

function saveProjectData() {
    if (!currentSelectedProjectId) return;
    
    const filesInput = document.getElementById('prompts-files').value;
    const filesArray = filesInput ? filesInput.split(',').map(s => s.trim()).filter(s => s) : [];

    const data = {
        overview: {
            msg: document.getElementById('overview-msg').value,
            color: document.getElementById('overview-color').value,
            timestamp: new Date().toISOString()
        },
        prompts: {
            title: document.getElementById('prompts-title').value,
            desc: document.getElementById('prompts-desc').value,
            files: filesArray,
            timestamp: new Date().toISOString()
        },
        sources: {
            content: document.getElementById('sources-content').value,
            timestamp: new Date().toISOString()
        },
        models: {
            content: document.getElementById('models-content').value,
            timestamp: new Date().toISOString()
        },
        comply: {
            content: document.getElementById('comply-content').value,
            timestamp: new Date().toISOString()
        }
    };
    
    const dataKey = `project_data_${currentSelectedProjectId}`;
    localStorage.setItem(dataKey, JSON.stringify(data));
    
    alert('Project data saved successfully!');
}
