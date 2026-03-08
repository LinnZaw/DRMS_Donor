const API_BASE = 'http://localhost:8080/api';

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginButton = document.getElementById('login-btn');
const globalAlert = document.getElementById('global-alert');
const globalSpinner = document.getElementById('global-spinner');
const logoutLink = document.getElementById('logout-link');
const stockDownloadButton = document.getElementById('stock-download-btn');
const stockLoading = document.getElementById('stock-loading');
const distributionDownloadButton = document.getElementById('distribution-download-btn');
const distributionLoading = document.getElementById('distribution-loading');

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
  impact: false
};

document.addEventListener('DOMContentLoaded', () => {
  sanitizeEditableBehavior();
  setupFocusGuard();
  showLogin();
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

stockDownloadButton.addEventListener('click', downloadStockPdf);
distributionDownloadButton.addEventListener('click', downloadDistributionPdf);

logoutLink.addEventListener('click', (event) => {
  event.preventDefault();
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
  if (!sectionMap[section]) return;

  Object.values(sectionMap).forEach((view) => view.classList.add('d-none'));
  sectionMap[section].classList.remove('d-none');

  navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  hideGlobalAlert();

  if (section === 'stock') {
    await loadStockBalance();
  }

  if (section === 'distribution') {
    await loadDistributionReport();
  }

  if (section === 'impact' && !hasLoadedSection.impact) {
    hasLoadedSection.impact = true;
    await loadReport('impact-overview', 'impact-content', 'No impact metrics available.');
  }
}

async function loadStockBalance() {
  const container = document.getElementById('stock-content');
  container.innerHTML = '';
  showStockLoading(true);

  try {
    const responseData = await apiGet('/stocks');
    const stockRecords = responseData?.data?.stockInfos;
    renderStockTable(container, Array.isArray(stockRecords) ? stockRecords : []);
  } catch (error) {
    showGlobalAlert(error.message || 'Unable to fetch stock balance data.');
    container.innerHTML = '<p class="text-muted mb-0">No stock balance records available.</p>';
  } finally {
    showStockLoading(false);
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

async function loadDistributionReport() {
  const container = document.getElementById('distribution-content');
  container.innerHTML = '';
  showDistributionLoading(true);

  try {
    const responseData = await apiGet('/distribution');
    const distributionRecords = responseData?.data?.distributionRecords;
    renderDistributionTable(container, Array.isArray(distributionRecords) ? distributionRecords : []);
  } catch (error) {
    showGlobalAlert(error.message || 'Unable to fetch distribution report data.');
    container.innerHTML = '<p class="text-muted mb-0">No distribution records available.</p>';
  } finally {
    showDistributionLoading(false);
  }
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      showLogin();
      throw new Error('Session expired. Please login again.');
    }

    throw new Error(`Failed to load data (${response.status}).`);
  }

  return response.json();
}

function renderStockTable(container, records) {
  if (!records.length) {
    container.innerHTML = '<p class="text-muted mb-0">No stock balance records available.</p>';
    return;
  }

  const rows = records
    .map((record) => `
      <tr>
        <td>${escapeHtml(String(record.stockBalanceId ?? ''))}</td>
        <td>${escapeHtml(formatDate(record.createdDate))}</td>
        <td>${escapeHtml(String(record.type ?? ''))}</td>
        <td>${escapeHtml(String(record.itemDescription ?? ''))}</td>
        <td>${escapeHtml(String(record.quantity ?? ''))}</td>
        <td>${escapeHtml(String(record.itemName ?? ''))}</td>
        <td>${escapeHtml(String(record.storageLocation ?? ''))}</td>
        <td>${escapeHtml(formatDate(record.manufacturedDate))}</td>
        <td>${escapeHtml(formatDate(record.expiredDate))}</td>
      </tr>
    `)
    .join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped table-hover table-bordered mb-0 align-middle">
        <thead class="table-light">
          <tr>
            <th>Stock Balance ID</th>
            <th>Reported Date</th>
            <th>Type</th>
            <th>Item Description</th>
            <th>Quantity</th>
            <th>Item Name</th>
            <th>Storage Location</th>
            <th>Manufactured Date</th>
            <th>Expired Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function downloadStockPdf() {
  stockDownloadButton.disabled = true;
  stockDownloadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Downloading...';

  try {
    const response = await fetch(`${API_BASE}/stocks/stock-pdf`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to download PDF (${response.status}).`);
    }

    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = fileUrl;
    tempLink.download = 'Stock-Balance-Report.pdf';
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
    URL.revokeObjectURL(fileUrl);
  } catch (error) {
    showGlobalAlert(error.message || 'Unable to download stock balance report PDF.');
  } finally {
    stockDownloadButton.disabled = false;
    stockDownloadButton.innerHTML = '<i class="bi bi-file-earmark-pdf me-2"></i>Download PDF';
  }
}

async function downloadDistributionPdf() {
  distributionDownloadButton.disabled = true;
  distributionDownloadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Downloading...';

  try {
    const response = await fetch(`${API_BASE}/distribution/pdf`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to download PDF (${response.status}).`);
    }

    const blob = await response.blob();
    const fileUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = fileUrl;
    tempLink.download = 'Distribution-Report.pdf';
    document.body.appendChild(tempLink);
    tempLink.click();
    tempLink.remove();
    URL.revokeObjectURL(fileUrl);
  } catch (error) {
    showGlobalAlert(error.message || 'Unable to download distribution report PDF.');
  } finally {
    distributionDownloadButton.disabled = false;
    distributionDownloadButton.innerHTML = '<i class="bi bi-file-earmark-pdf me-2"></i>Download PDF';
  }
}

function renderDistributionTable(container, records) {
  if (!records.length) {
    container.innerHTML = '<p class="text-muted mb-0">No distribution records available.</p>';
    return;
  }

  const rows = records
    .map((record) => `
      <tr>
        <td>${escapeHtml(String(record.id ?? ''))}</td>
        <td>${escapeHtml(String(record.beneficiary?.beneficName ?? ''))}</td>
        <td>${escapeHtml(String(record.houseHoldNrc ?? ''))}</td>
        <td>${escapeHtml(String(record.beneficiary?.contact ?? ''))}</td>
        <td>${escapeHtml(String(record.familyMembers ?? ''))}</td>
        <td>${escapeHtml(String(record.underFive ?? ''))}</td>
        <td>${escapeHtml(String(record.disabled ?? ''))}</td>
        <td>${escapeHtml(String(record.locationName ?? ''))}</td>
        <td>${escapeHtml(String(record.distributedItems ?? ''))}</td>
        <td>${escapeHtml(String(record.user?.email ?? ''))}</td>
        <td>${escapeHtml(formatDate(record.distributionDate))}</td>
      </tr>
    `)
    .join('');

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped table-hover table-bordered mb-0 align-middle">
        <thead class="table-light">
          <tr>
            <th>ID</th>
            <th>Beneficiary Name</th>
            <th>NRC</th>
            <th>Contact</th>
            <th>Family Members</th>
            <th>No. of Under 5</th>
            <th>No. of Disabled</th>
            <th>Location Name</th>
            <th>Distributed Items</th>
            <th>Field Staff Name</th>
            <th>Distributed Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
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
  if (!data) return [];

  if (Array.isArray(data)) {
    if (!data.length) return [];

    if (typeof data[0] === 'object') {
      return Object.entries(data[0]);
    }

    return data.map((item, index) => [`Item ${index + 1}`, item]);
  }

  if (typeof data === 'object') {
    return Object.entries(data);
  }

  return [['Value', data]];
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
}

function toLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function showStockLoading(show) {
  stockLoading.classList.toggle('d-none', !show);
}

function showDistributionLoading(show) {
  distributionLoading.classList.toggle('d-none', !show);
}

function setButtonLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.innerHTML = isLoading
    ? '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...'
    : '<span class="btn-text">Login</span>';
}

function sanitizeEditableBehavior() {
  const editableElements = document.querySelectorAll('[contenteditable]');
  editableElements.forEach((element) => {
    if (!element.matches('input, textarea')) {
      element.removeAttribute('contenteditable');
    }
  });

  const tabbableContainers = document.querySelectorAll('div[tabindex], section[tabindex], article[tabindex], table[tabindex], nav[tabindex]');
  tabbableContainers.forEach((element) => {
    const tabindexValue = Number(element.getAttribute('tabindex'));
    if (!Number.isNaN(tabindexValue) && tabindexValue >= 0) {
      element.removeAttribute('tabindex');
    }
  });
}

function setupFocusGuard() {
  document.addEventListener('mousedown', (event) => {
    const editableTarget = event.target.closest('input, textarea, select, [type="search"], [contenteditable="true"]');
    if (editableTarget) return;

    const activeElement = document.activeElement;
    if (activeElement?.matches('input, textarea, select, [type="search"], [contenteditable="true"]')) {
      activeElement.blur();
    }
  });
}
