const API_BASE = 'http://localhost:8080/api';
const TOKEN_KEY = 'drmsAuthToken';

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginButton = document.getElementById('login-btn');
const globalAlert = document.getElementById('global-alert');
const globalSpinner = document.getElementById('global-spinner');
const logoutLink = document.getElementById('logout-link');

const sectionMap = {
  home: document.getElementById('section-home'),
  stock: document.getElementById('section-stock'),
  distribution: document.getElementById('section-distribution'),
  impact: document.getElementById('section-impact'),
  about: document.getElementById('section-about')
};

const navLinks = Array.from(document.querySelectorAll('[data-section]'));
const quickLinks = Array.from(document.querySelectorAll('[data-quick-section]'));

const hasLoadedSection = {
  stock: false,
  distribution: false,
  impact: false
};

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    showDashboard();
    switchSection('home');
  } else {
    showLogin();
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.classList.add('d-none');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showLoginError('Please enter both email and password.');
    return;
  }

  setButtonLoading(true);

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Invalid email or password.');
    }

    const payload = await response.json();
    const token = payload.token || payload.accessToken || payload.jwt;

    if (!token) {
      throw new Error('Login succeeded but token was not provided by API.');
    }

    localStorage.setItem(TOKEN_KEY, token);
    showDashboard();
    switchSection('home');
    loginForm.reset();
  } catch (error) {
    showLoginError(error.message || 'Unable to login. Please try again.');
  } finally {
    setButtonLoading(false);
  }
});

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = link.dataset.section;
    if (target) {
      switchSection(target);
    }
  });
});

quickLinks.forEach((button) => {
  button.addEventListener('click', () => {
    switchSection(button.dataset.quickSection);
  });
});

logoutLink.addEventListener('click', (event) => {
  event.preventDefault();
  localStorage.removeItem(TOKEN_KEY);
  Object.keys(hasLoadedSection).forEach((key) => {
    hasLoadedSection[key] = false;
  });
  showLogin();
});

function showLogin() {
  dashboardView.classList.add('d-none');
  loginView.classList.remove('d-none');
  hideGlobalAlert();
}

function showDashboard() {
  loginView.classList.add('d-none');
  dashboardView.classList.remove('d-none');
}

async function switchSection(section) {
  if (!sectionMap[section]) {
    return;
  }

  Object.values(sectionMap).forEach((view) => view.classList.add('d-none'));
  sectionMap[section].classList.remove('d-none');

  navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  hideGlobalAlert();

  if (section === 'stock' && !hasLoadedSection.stock) {
    hasLoadedSection.stock = true;
    await loadReport('stock-balance', 'stock-content', 'No stock records available.');
  }

  if (section === 'distribution' && !hasLoadedSection.distribution) {
    hasLoadedSection.distribution = true;
    await loadReport('distribution', 'distribution-content', 'No distribution records available.');
  }

  if (section === 'impact' && !hasLoadedSection.impact) {
    hasLoadedSection.impact = true;
    await loadReport('impact-overview', 'impact-content', 'No impact metrics available.');
  }
}

async function loadReport(endpoint, containerId, emptyMessage) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  showSpinner(true);

  try {
    const reportData = await apiGet(`/reports/${endpoint}`);
    renderReport(container, reportData, emptyMessage);
  } catch (error) {
    showGlobalAlert(error.message || 'Unable to fetch report data.');
    container.innerHTML = `<p class="text-muted mb-0">${emptyMessage}</p>`;
  } finally {
    showSpinner(false);
  }
}

async function apiGet(path) {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      showLogin();
      throw new Error('Session expired. Please login again.');
    }

    throw new Error(`Failed to load data (${response.status}).`);
  }

  return response.json();
}

function renderReport(container, data, emptyMessage) {
  const entries = normalizeToEntries(data);

  if (!entries.length) {
    container.innerHTML = `<p class="text-muted mb-0">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = entries
    .map(([label, value]) => `
      <article class="report-item">
        <div class="label">${escapeHtml(toLabel(label))}</div>
        <div class="value">${escapeHtml(String(value))}</div>
      </article>
    `)
    .join('');
}

function normalizeToEntries(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    if (!data.length) {
      return [];
    }

    if (typeof data[0] === 'object' && data[0] !== null) {
      return Object.entries(data[0]);
    }

    return data.map((item, index) => [`Item ${index + 1}`, item]);
  }

  if (typeof data === 'object') {
    return Object.entries(data);
  }

  return [['Value', data]];
}

function toLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove('d-none');
}

function showGlobalAlert(message) {
  globalAlert.textContent = message;
  globalAlert.classList.remove('d-none');
}

function hideGlobalAlert() {
  globalAlert.textContent = '';
  globalAlert.classList.add('d-none');
}

function showSpinner(show) {
  globalSpinner.classList.toggle('d-none', !show);
}

function setButtonLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.innerHTML = isLoading
    ? '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Logging in...'
    : '<span class="btn-text">Login</span>';
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
