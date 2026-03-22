const SUPABASE_URL = 'https://uzubvvmfroozinyqdlbi.supabase.co';
// PLEASE NOTE: To make real API calls, we need the ANON PUBLIC KEY from Supabase dashboard.
// Without it, the application runs in a high-fidelity "Mock Mode" for UI demonstration and user flow logic.
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dWJ2dm1mcm9vemlueXFkbGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDM5OTQsImV4cCI6MjA4OTc3OTk5NH0.f-g9ADbts9WIHyGw9BQF6RZaJKjOJ24cOuPFHv7mMWg'; 

let supabaseClient = null;
let isMockMode = (SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY');

if (!isMockMode) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Check session on load
window.addEventListener('DOMContentLoaded', () => {
    // Check if we arrived via a Specific Mode (Log in vs Sign up)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'signup') {
        switchAuthMode('signup');
    }
    checkSession();
});

async function checkSession() {
    if (isMockMode) {
        let mockUser = localStorage.getItem('mockUser');
        if (mockUser) {
            handlePostLogin(JSON.parse(mockUser).name);
        } else {
            showAuth();
        }
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session) {
            handlePostLogin(session.user.user_metadata?.first_name || session.user.email.split('@')[0], session.user.email, session.user.id);
        } else {
            showAuth();
        }
    } catch(err) {
        console.error("Supabase Error:", err);
        showAuth();
    }
}

function trackUserGlobally(email, name) {
    if (!email) return;
    const users = JSON.parse(localStorage.getItem('all_auth_users') || '[]');
    let user = users.find(u => u.email === email);
    if (!user) {
        users.push({ email, name, created_at: new Date().toISOString(), last_login: new Date().toISOString() });
    } else {
        user.last_login = new Date().toISOString();
        if (name) user.name = name;
    }
    localStorage.setItem('all_auth_users', JSON.stringify(users));
}

function handlePostLogin(userName, userEmail, userId) {
    if (userEmail) {
        localStorage.setItem('currentUserEmail', userEmail);
        if (userId) localStorage.setItem('currentUserId', userId);
        trackUserGlobally(userEmail, userName);
    }
    const pendingPlan = localStorage.getItem('pending_plan');
    if (pendingPlan) {
        showPayment(userName, pendingPlan);
    } else {
        showDashboard(userName);
    }
}

function showAuth() {
    document.getElementById('auth-view').style.display = 'flex';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('payment-view').style.display = 'none';
}

function showPayment(userName, planId) {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('payment-view').style.display = 'flex';
    
    // Update payment UI
    const planNames = { 'standard': 'GEO/SEO Standard', 'plus': 'GEO/SEO Plus & Support', 'mvp': 'MVP SaaS Product' };
    const planPrices = { 'standard': '$50/mo', 'plus': '$150/mo', 'mvp': '$300-$5k' };
    
    document.getElementById('payment-plan-name').innerText = planNames[planId] || 'Selected Plan';
    document.getElementById('payment-plan-price').innerText = planPrices[planId] || '';
}

function showDashboard(userName) {
    document.body.classList.add('dashboard-active');
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('payment-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    document.getElementById('user-display-name').innerText = userName || 'User';
    
    renderProjects();
}

async function renderProjects() {
    const email = localStorage.getItem('currentUserEmail') || 'guest';
    const userId = localStorage.getItem('currentUserId');
    const mainArea = document.querySelector('.dash-main-area');
    let projects = [];

    if (isMockMode || !userId) {
        projects = JSON.parse(localStorage.getItem(`projects_${email}`) || '[]');
    } else {
        const { data, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (!error && data) {
            projects = data;
        } else if (error) {
            console.error("Error fetching projects:", error);
        }
    }
    
    if (projects.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('projects-list').style.display = 'none';
    } else {
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('projects-list').style.display = 'grid';
        
        const listContainer = document.getElementById('projects-list');
        listContainer.innerHTML = '';
        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.onclick = () => openProjectDetail(p);
            card.innerHTML = `
                <div class="project-info">
                    <div class="project-icon"><i data-lucide="layout"></i></div>
                    <div>
                        <h4>${p.name}</h4>
                        <span class="project-tag ${p.status}">${p.status}</span>
                    </div>
                </div>
                <div class="project-meta">
                    <span>Plan: ${p.plan}</span>
                    <span>Created: ${new Date(p.created_at).toLocaleDateString()}</span>
                </div>
            `;
            listContainer.appendChild(card);
        });
        lucide.createIcons();
    }
}

async function finalizePayment() {
    const planId = localStorage.getItem('pending_plan') || 'standard';
    const projectName = localStorage.getItem('pending_project_name') || 'New Project';
    const mockUser = JSON.parse(localStorage.getItem('mockUser') || '{"name": "User", "email": "guest"}');
    const email = localStorage.getItem('currentUserEmail') || mockUser.email;
    const userId = localStorage.getItem('currentUserId');
    
    if (isMockMode || !userId) {
        // Simulate payment success using local storage map
        const newProject = {
            id: Date.now(),
            name: projectName,
            plan: planId,
            status: 'active',
            created_at: new Date().toISOString()
        };
        const projectKey = `projects_${email}`;
        const projects = JSON.parse(localStorage.getItem(projectKey) || '[]');
        projects.push(newProject);
        localStorage.setItem(projectKey, JSON.stringify(projects));
    } else {
        // Real DB Insert
        const { error } = await supabaseClient.from('projects').insert([{
            user_id: userId,
            user_email: email,
            name: projectName,
            plan: planId,
            status: 'active'
        }]);
        if (error) console.error("Error inserting project:", error);
    }
    
    localStorage.removeItem('pending_plan');
    localStorage.removeItem('pending_project_name');
    
    showDashboard(mockUser.name);
}

function switchAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const tabs = document.querySelectorAll('.auth-tab');

    // Clear errors when toggling modes
    document.getElementById('login-error').innerText = '';
    document.getElementById('signup-error').innerText = '';

    if (mode === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
        toggleSignupFields(); // ensure right fields are showing
    }
}

function toggleSignupFields() {
    const type = document.querySelector('input[name="account_type"]:checked').value;
    const agencyFields = document.getElementById('agency-fields');
    const emailLabel = document.getElementById('signup-email-label');

    if (type === 'agency') {
        agencyFields.style.display = 'block';
        emailLabel.innerText = 'Company Email';
        document.getElementById('signup-company').required = true;
        document.getElementById('signup-location').required = true;
    } else {
        agencyFields.style.display = 'none';
        emailLabel.innerText = 'Email Address';
        document.getElementById('signup-company').required = false;
        document.getElementById('signup-location').required = false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.innerText = '';

    if (isMockMode) {
        // Mock authentication success
        let name = email.split('@')[0];
        name = name.charAt(0).toUpperCase() + name.slice(1);
        localStorage.setItem('mockUser', JSON.stringify({ email: email, name: name }));
        handlePostLogin(name, email);
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
            errorEl.innerText = 'Please check your email to verify your account before logging in.';
        } else {
            errorEl.innerText = error.message;
        }
    } else {
        handlePostLogin(data.user.user_metadata?.first_name || data.user.email.split('@')[0], data.user.email, data.user.id);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const type = document.querySelector('input[name="account_type"]:checked').value;
    const name = document.getElementById('signup-name').value;
    const surname = document.getElementById('signup-surname').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const company = document.getElementById('signup-company').value;
    const location = document.getElementById('signup-location').value;

    const errorEl = document.getElementById('signup-error');
    errorEl.innerText = '';

    if (isMockMode) {
        // Mock signup success
        let fullName = name + ' ' + surname;
        localStorage.setItem('mockUser', JSON.stringify({ email: email, name: fullName }));
        handlePostLogin(fullName, email);
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                first_name: name,
                last_name: surname,
                account_type: type,
                ...(type === 'agency' && { company_name: company, location: location })
            }
        }
    });

    if (error) {
        errorEl.innerText = error.message;
    } else {
        if (data.session) {
            handlePostLogin(name + ' ' + surname, email, data.user.id);
        } else {
            // Confirmation might still be required in Supabase settings
            alert('Account created! If you cannot log in, please check your email to verify your account, or disable "Confirm email" in your Supabase dashboard.');
            switchAuthMode('login');
        }
    }
}

async function handleLogout() {
    if (isMockMode) {
        localStorage.removeItem('mockUser');
        showAuth();
        switchAuthMode('login');
        return;
    }

    await supabaseClient.auth.signOut();
    showAuth();
    switchAuthMode('login');
}

// Modal Management
function openPlanModal() {
    document.getElementById('plan-modal').style.display = 'flex';
}

function closePlanModal() {
    document.getElementById('plan-modal').style.display = 'none';
}

function handleModalSelect(planId) {
    const nameInput = document.getElementById('project-name-input');
    if (!nameInput.value) {
        nameInput.style.borderColor = '#ef4444';
        return;
    }
    
    localStorage.setItem('pending_plan', planId);
    localStorage.setItem('pending_project_name', nameInput.value);
    
    nameInput.value = ''; // Reset for next time
    closePlanModal();
    const mockUser = JSON.parse(localStorage.getItem('mockUser') || '{"name": "User"}');
    showPayment(mockUser.name, planId);
}

// Project Detail View Management
let currentOpenProject = null;

function openProjectDetail(project) {
    currentOpenProject = project;
    const detailArea = document.getElementById('project-detail-area');
    
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('projects-list').style.display = 'none';
    detailArea.style.display = 'block';
    detailArea.dataset.active = 'true';
    
    document.getElementById('detail-project-name').innerText = project.name;
    document.getElementById('detail-project-plan').innerText = project.plan.toUpperCase() + ' PLAN';
    
    // Enable other sidebar tabs and hide selection hint
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('disabled'));
    const hint = document.getElementById('nav-selection-hint');
    if (hint) hint.style.display = 'none';

    loadProjectDetailData(project.id);
    switchDashboardTab('overview');
}

function closeProjectDetail() {
    currentOpenProject = null;
    const detailArea = document.getElementById('project-detail-area');
    detailArea.style.display = 'none';
    detailArea.dataset.active = 'false';
    
    // Disable other sidebar tabs and show selection hint
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        if (li.id !== 'nav-overview') li.classList.add('disabled');
    });
    const hint = document.getElementById('nav-selection-hint');
    if (hint) hint.style.display = 'block';

    switchDashboardTab('overview');
}

function switchDashboardTab(tabId) {
    const targetNav = document.getElementById(`nav-${tabId}`);
    if(targetNav && targetNav.classList.contains('disabled')) return;

    // Update nav UI
    const navItems = document.querySelectorAll('.sidebar-nav li');
    navItems.forEach(item => item.classList.remove('active'));
    if(targetNav) targetNav.classList.add('active');

    // Hide ALL possible content sections first
    const sections = [
        'projects-list', 'empty-state', 'project-detail-area',
        'detail-overview', 'detail-prompts', 'detail-sources', 'detail-models', 'detail-settings', 'detail-comply'
    ];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });

    if (tabId === 'overview') {
        const isDetail = document.getElementById('project-detail-area').dataset.active === 'true';
        if (isDetail) {
            document.getElementById('project-detail-area').style.display = 'block';
            document.getElementById('detail-overview').style.display = 'block';
        } else {
            // Re-render project list to show either list or empty state
            renderProjects();
        }
    } else {
        // Show specific detail tab
        document.getElementById('project-detail-area').style.display = 'block';
        const sectionEl = document.getElementById(`detail-${tabId}`);
        if(sectionEl) sectionEl.style.display = 'block';
    }
}

async function loadProjectDetailData(projectId) {
    let data = { overview: [], prompts: [], sources: [], models: [], comply: [] };
    const userId = localStorage.getItem('currentUserId');
    
    if (isMockMode || !userId) {
        const dataKey = `project_data_${projectId}`;
        const saved = JSON.parse(localStorage.getItem(dataKey) || '{}');
        data.overview = Array.isArray(saved.overview) ? saved.overview : (saved.overview ? [saved.overview] : []);
        data.prompts = Array.isArray(saved.prompts) ? saved.prompts : (saved.prompts ? [saved.prompts] : []);
        data.sources = Array.isArray(saved.sources) ? saved.sources : (saved.sources ? [saved.sources] : []);
        data.models = Array.isArray(saved.models) ? saved.models : (saved.models ? [saved.models] : []);
        data.comply = Array.isArray(saved.comply) ? saved.comply : (saved.comply ? [saved.comply] : []);
    } else {
        const { data: rowData, error } = await supabaseClient
            .from('projects')
            .select('overview, prompts, sources, models, comply')
            .eq('id', projectId)
            .single();
            
        if (!error && rowData) {
            data.overview = Array.isArray(rowData.overview) ? rowData.overview : [];
            data.prompts = Array.isArray(rowData.prompts) ? rowData.prompts : [];
            data.sources = Array.isArray(rowData.sources) ? rowData.sources : [];
            data.models = Array.isArray(rowData.models) ? rowData.models : [];
            data.comply = Array.isArray(rowData.comply) ? rowData.comply : [];
        }
    }

    // Sort all arrays by timestamp newest first
    const sortByTime = (arr) => [...arr].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 1. Overview Timeline
    const overviewContainer = document.getElementById('overview-msg-display').parentElement;
    overviewContainer.innerHTML = '';
    const sortedOverview = sortByTime(data.overview);
    if (sortedOverview.length === 0) {
        overviewContainer.innerHTML = '<div class="empty-package">No updates yet.</div>';
    } else {
        sortedOverview.forEach(item => {
            const div = document.createElement('div');
            div.className = 'update-timeline-item';
            div.innerHTML = `
                <div class="status-light ${item.color || 'green'}"></div>
                <div class="update-content">
                    <p class="update-msg">${item.msg}</p>
                    <span class="update-time">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
            `;
            overviewContainer.appendChild(div);
        });
    }

    // 2. Prompts Packages
    const promptsContainer = document.getElementById('prompts-files-display').parentElement;
    promptsContainer.innerHTML = ''; 
    const sortedPrompts = sortByTime(data.prompts);
    if (sortedPrompts.length === 0) {
        promptsContainer.innerHTML = '<div class="empty-package">No documentation packages yet.</div>';
    } else {
        sortedPrompts.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'package-card';
            
            let filesHtml = '';
            if (pkg.files && pkg.files.length > 0) {
                filesHtml = '<div class="package-files">';
                pkg.files.forEach(f => {
                    const icon = getFileIcon(f.type);
                    filesHtml += `<div class="file-badge"><i data-lucide="${icon}"></i> ${f.name}</div>`;
                });
                filesHtml += '</div>';
            }

            card.innerHTML = `
                <div class="package-header">
                    <h4 class="package-title">${pkg.title}</h4>
                    <span class="package-date">${new Date(pkg.timestamp).toLocaleDateString()}</span>
                </div>
                <p class="package-desc">${pkg.desc || ''}</p>
                ${filesHtml}
            `;
            promptsContainer.appendChild(card);
        });
    }

    // 3. Simple Text Blocks (Sources, Models, Comply)
    renderSimplePackages('sources', data.sources);
    renderSimplePackages('models', data.models);
    renderSimplePackages('comply', data.comply);

    lucide.createIcons();
}

function renderSimplePackages(tabId, items) {
    const container = document.getElementById(`${tabId}-content-display`).parentElement;
    container.innerHTML = '';
    const sorted = [...items].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (sorted.length === 0) {
        container.innerHTML = `<div class="empty-package">No ${tabId} data uploaded yet.</div>`;
        return;
    }

    sorted.forEach(item => {
        const div = document.createElement('div');
        div.className = 'package-card simple-text';
        div.innerHTML = `
            <div class="package-header">
                <span class="package-date">${new Date(item.timestamp).toLocaleString()}</span>
            </div>
            <div class="package-body">${item.content}</div>
        `;
        container.appendChild(div);
    });
}

function getFileIcon(type) {
    const map = {
        'pdf': 'file-text',
        'xlsx': 'file-spreadsheet',
        'xls': 'file-spreadsheet',
        'excel': 'file-spreadsheet',
        'jpg': 'image',
        'png': 'image',
        'jpeg': 'image',
        'docx': 'file-text',
        'doc': 'file-text',
        'txt': 'file-text'
    };
    return map[type] || 'file';
}

