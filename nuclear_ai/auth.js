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
            // Email confirmation is disabled on Supabase
            handlePostLogin(name + ' ' + surname, email, data.user.id);
        } else {
            // Email confirmation is required
            document.getElementById('signup-form').innerHTML = `
                <div style="text-align: center; padding: 40px 0;">
                    <i data-lucide="mail-check" style="width: 48px; height: 48px; color: #22c55e; margin-bottom: 16px;"></i>
                    <h3 style="margin-bottom: 8px;">Check Your Email</h3>
                    <p style="color: #6b7280; margin-bottom: 16px; font-size: 15px; line-height: 1.5;">We've sent a verification link to <strong>${email}</strong>.<br>Please click the link to activate your account and log in.</p>
                    <div style="background: #fdfdfd; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 24px; font-size: 12px; color: #6b7280; text-align: left;">
                        <strong>Didn't receive it?</strong> Supabase restricts free tiers to 3 emails per hour. For testing, go to your Supabase Dashboard &rarr; Authentication &rarr; Providers &rarr; Email, and toggle off <strong>"Confirm email"</strong>.
                    </div>
                    <button type="button" class="btn-primary" onclick="window.location.reload()" style="width: 100%; justify-content: center;">Reload and Login</button>
                </div>
            `;
            lucide.createIcons();

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
    
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('projects-list').style.display = 'none';
    document.getElementById('project-detail-area').style.display = 'block';
    
    document.getElementById('detail-project-name').innerText = project.name;
    document.getElementById('detail-project-plan').innerText = project.plan;
    
    loadProjectDetailData(project.id);
    switchDashboardTab('overview');
}

function closeProjectDetail() {
    currentOpenProject = null;
    document.getElementById('project-detail-area').style.display = 'none';
    renderProjects();
}

function switchDashboardTab(tabName) {
    if (!currentOpenProject) return;

    // Update active nav link
    document.querySelectorAll('.sidebar-nav li').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-' + tabName);
    if(navEl) navEl.classList.add('active');

    // Show correct section
    const sections = document.querySelectorAll('.detail-content-section');
    sections.forEach(s => s.style.display = 'none');
    
    const sectionEl = document.getElementById('detail-' + tabName);
    if(sectionEl) sectionEl.style.display = 'block';
}

async function loadProjectDetailData(projectId) {
    let data = {};
    const userId = localStorage.getItem('currentUserId');
    
    if (isMockMode || !userId) {
        const dataKey = `project_data_${projectId}`;
        data = JSON.parse(localStorage.getItem(dataKey) || '{}');
    } else {
        const { data: rowData, error } = await supabaseClient
            .from('projects')
            .select('overview, prompts, sources, models, comply')
            .eq('id', projectId)
            .single();
            
        if (!error && rowData) {
            data = {
                overview: rowData.overview || {},
                prompts: rowData.prompts || {},
                sources: rowData.sources || {},
                models: rowData.models || {},
                comply: rowData.comply || {}
            };
        }
    }

    // Default resets
    document.getElementById('overview-msg-display').innerText = 'No recent updates.';
    document.getElementById('overview-time-display').innerText = '';
    document.querySelector('#overview-update-box .status-light').className = 'status-light';
    
    document.getElementById('prompts-title-display').innerText = 'No Prompts Documentation';
    document.getElementById('prompts-desc-display').innerText = 'Code documentation for the website will appear here.';
    document.getElementById('prompts-files-display').innerHTML = '';
    
    document.getElementById('sources-content-display').innerText = 'No sources documentation provided yet.';
    document.getElementById('models-content-display').innerText = 'Complete project documentation will appear here when updated.';
    document.getElementById('comply-content-display').innerText = 'Awaiting compliance review from the Nuclear AI team.';

    // Overview
    if (data.overview && data.overview.msg) {
        document.getElementById('overview-msg-display').innerText = data.overview.msg;
        if(data.overview.timestamp) document.getElementById('overview-time-display').innerText = new Date(data.overview.timestamp).toLocaleString();
        const light = document.querySelector('#overview-update-box .status-light');
        light.className = `status-light ${data.overview.color || 'green'}`;
    }

    // Prompts
    if (data.prompts && data.prompts.title) {
        document.getElementById('prompts-title-display').innerText = data.prompts.title;
        document.getElementById('prompts-desc-display').innerText = data.prompts.desc || '';
        
        const filesContainer = document.getElementById('prompts-files-display');
        if (data.prompts.files && data.prompts.files.length > 0) {
            data.prompts.files.forEach(f => {
                const fdiv = document.createElement('div');
                fdiv.className = 'file-record';
                fdiv.innerHTML = `<i data-lucide="file-text"></i> ${f}`;
                filesContainer.appendChild(fdiv);
            });
            lucide.createIcons();
        }
    }

    // Sources
    if (data.sources && data.sources.content) {
        document.getElementById('sources-content-display').innerText = data.sources.content;
        document.getElementById('sources-content-display').style.color = '#111827';
    }

    // Models
    if (data.models && data.models.content) {
        document.getElementById('models-content-display').innerText = data.models.content;
        document.getElementById('models-content-display').style.color = '#111827';
    }

    // Comply
    if (data.comply && data.comply.content) {
        document.getElementById('comply-content-display').innerText = data.comply.content;
    }
}
