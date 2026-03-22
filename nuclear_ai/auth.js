const SUPABASE_URL = 'https://uzubvvmfroozinyqdlbi.supabase.co';
// PLEASE NOTE: To make real API calls, we need the ANON PUBLIC KEY from Supabase dashboard.
// Without it, the application runs in a high-fidelity "Mock Mode" for UI demonstration and user flow logic.
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY'; 

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
            showDashboard(JSON.parse(mockUser).name);
        } else {
            showAuth();
        }
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session) {
            showDashboard(session.user.user_metadata?.first_name || session.user.email.split('@')[0]);
        } else {
            showAuth();
        }
    } catch(err) {
        console.error("Supabase Error:", err);
        showAuth();
    }
}

function showAuth() {
    document.getElementById('auth-view').style.display = 'flex';
    document.getElementById('dashboard-view').style.display = 'none';
}

function showDashboard(userName) {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    document.getElementById('user-display-name').innerText = userName || 'User';
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
        showDashboard(name);
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        errorEl.innerText = error.message;
    } else {
        showDashboard(data.user.user_metadata?.first_name || data.user.email.split('@')[0]);
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
        showDashboard(fullName);
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
        showDashboard(name + ' ' + surname);
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
