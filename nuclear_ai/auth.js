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
            handlePostLogin(session.user.user_metadata?.first_name || session.user.email.split('@')[0], session.user.email);
        } else {
            showAuth();
        }
    } catch(err) {
        console.error("Supabase Error:", err);
        showAuth();
    }
}

function handlePostLogin(userName, userEmail) {
    if (userEmail) localStorage.setItem('currentUserEmail', userEmail);
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

function renderProjects() {
    const email = localStorage.getItem('currentUserEmail') || 'guest';
    const projects = JSON.parse(localStorage.getItem(`projects_${email}`) || '[]');
    const mainArea = document.querySelector('.dash-main-area');
    
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

function finalizePayment() {
    const planId = localStorage.getItem('pending_plan');
    const projectName = localStorage.getItem('pending_project_name') || 'New Project';
    const mockUser = JSON.parse(localStorage.getItem('mockUser') || '{"name": "User", "email": "guest"}');
    const email = localStorage.getItem('currentUserEmail') || mockUser.email;
    
    // Simulate payment success
    const newProject = {
        id: Date.now(),
        name: projectName,
        plan: planId || 'standard',
        status: 'active',
        created_at: new Date().toISOString()
    };
    
    const projectKey = `projects_${email}`;
    const projects = JSON.parse(localStorage.getItem(projectKey) || '[]');
    projects.push(newProject);
    localStorage.setItem(projectKey, JSON.stringify(projects));
    
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
        errorEl.innerText = error.message;
    } else {
        handlePostLogin(data.user.user_metadata?.first_name || data.user.email.split('@')[0], data.user.email);
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
        handlePostLogin(name + ' ' + surname, email);
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
