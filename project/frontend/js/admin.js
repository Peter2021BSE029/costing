const API_BASE = (function () {
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:3000/api';
})();

// Authentication check
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    window.location.href = 'login.html';
    return false;
  }

  // Check role for admin.html - only stores
  if (user.role !== 'stores') {
    alert('Access denied. Only stores users can access admin.');
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Add logout button to nav
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('nav');
  if (nav) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.className = 'nav-button';
    logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right"></i> Logout';
    logoutBtn.onclick = logout;
    nav.appendChild(logoutBtn);
  }
});

// Check auth on load
if (!checkAuth()) {
  // Will redirect
}

// Silently renew the token while the tab stays open, so an active admin
// session never hits a hard expiry mid-edit.
function refreshToken() {
  const token = localStorage.getItem('token');
  if (!token) return;

  fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(response => (response.ok ? response.json() : null))
    .then(data => {
      if (data && data.token) {
        localStorage.setItem('token', data.token);
      }
    })
    .catch(() => {});
}

setInterval(refreshToken, 20 * 60 * 1000);

const statusDiv = document.getElementById('status');
const refreshAdminDataBtn = document.getElementById('refresh-admin-data');
const materialsTableBody = document.querySelector('#admin-materials-table tbody');
const machinesTableBody = document.querySelector('#admin-machines-table tbody');
const usersTableBody = document.querySelector('#admin-users-table tbody');
const createMaterialForm = document.getElementById('create-material-form');
const createMachineForm = document.getElementById('create-machine-form');
const createUserForm = document.getElementById('create-user-form');
const materialsSearchInput = document.getElementById('materials-search');
const materialsCategoryFilter = document.getElementById('materials-category-filter');
const materialsSortSelect = document.getElementById('materials-sort');
const machinesSearchInput = document.getElementById('machines-search');
const machinesSetupFilter = document.getElementById('machines-setup-filter');
const machinesSortSelect = document.getElementById('machines-sort');

const adminState = {
  materials: [],
  machines: [],
  users: [],
  materialSearch: '',
  materialCategory: '',
  materialSort: { key: 'name', direction: 'asc' },
  machineSearch: '',
  machineSetupFilter: '',
  machineSort: { key: 'name', direction: 'asc' }
};

function showStatus(message, type = 'success') {
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers,
      ...options
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Admin API Error:', error);
    showStatus(`Error: ${error.message}`, 'error');
    throw error;
  }
}

function createTableCell(content) {
  const td = document.createElement('td');
  if (typeof content === 'string' || typeof content === 'number') {
    td.textContent = content;
  } else if (content instanceof HTMLElement) {
    td.appendChild(content);
  }
  return td;
}

function createEditableCell(value, type = 'text') {
  const input = document.createElement('input');
  input.type = type;
  input.value = value ?? '';
  if (type === 'number') input.step = '0.01';
  input.className = 'admin-input';
  return input;
}

function createEditableSelect(value, options) {
  const select = document.createElement('select');
  select.className = 'admin-input';
  options.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === value) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

async function loadAdminData() {
  try {
    const [materials, machines, users] = await Promise.all([
      apiRequest('/materials'),
      apiRequest('/machines'),
      apiRequest('/users')
    ]);

    adminState.materials = materials;
    adminState.machines = machines;
    adminState.users = users;
    populateMaterialCategoryFilter(materials);
    renderMaterials();
    renderMachines();
    renderUsers();
    showStatus('Admin data loaded successfully.');
  } catch (error) {
    console.error('Unable to load admin data:', error);
  }
}

function normalizeValue(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

function parseSortValue(value, fallbackKey = 'name') {
  const [key = fallbackKey, direction = 'asc'] = (value || '').split(':');
  return { key, direction };
}

function compareRecords(a, b, key, direction) {
  const aValue = a[key];
  const bValue = b[key];
  const isNumeric = !Number.isNaN(parseFloat(aValue)) || !Number.isNaN(parseFloat(bValue));
  let result;

  if (isNumeric) {
    result = (parseFloat(aValue) || 0) - (parseFloat(bValue) || 0);
  } else {
    result = normalizeValue(aValue).localeCompare(normalizeValue(bValue));
  }

  return direction === 'desc' ? result * -1 : result;
}

function populateMaterialCategoryFilter(materials) {
  const currentValue = materialsCategoryFilter.value;
  const categories = [...new Set(materials.map(material => material.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  materialsCategoryFilter.innerHTML = '<option value="">All categories</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    materialsCategoryFilter.appendChild(option);
  });
  materialsCategoryFilter.value = categories.includes(currentValue) ? currentValue : '';
  adminState.materialCategory = materialsCategoryFilter.value;
}

function getVisibleMaterials() {
  const search = normalizeValue(adminState.materialSearch);
  return adminState.materials
    .filter(material => {
      const matchesSearch = !search || [
        material.name,
        material.category,
        material.unit_of_measure,
        material.unit_cost
      ].some(value => normalizeValue(value).includes(search));
      const matchesCategory = !adminState.materialCategory || material.category === adminState.materialCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => compareRecords(a, b, adminState.materialSort.key, adminState.materialSort.direction));
}

function getVisibleMachines() {
  const search = normalizeValue(adminState.machineSearch);
  return adminState.machines
    .filter(machine => {
      const matchesSearch = !search || [
        machine.name,
        machine.cost_per_impression,
        machine.setup_cost
      ].some(value => normalizeValue(value).includes(search));
      const setupCost = parseFloat(machine.setup_cost || 0);
      const matchesSetupFilter = !adminState.machineSetupFilter
        || (adminState.machineSetupFilter === 'with-setup' && setupCost > 0)
        || (adminState.machineSetupFilter === 'no-setup' && setupCost <= 0);
      return matchesSearch && matchesSetupFilter;
    })
    .sort((a, b) => compareRecords(a, b, adminState.machineSort.key, adminState.machineSort.direction));
}

function createIconButton(iconClass, label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-action ${className}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<i class="bi ${iconClass}"></i>`;
  button.addEventListener('click', onClick);
  return button;
}

function renderEmptyRow(tbody, colspan, message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.className = 'admin-empty-state';
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function renderMaterials() {
  const materials = getVisibleMaterials();
  materialsTableBody.innerHTML = '';

  if (materials.length === 0) {
    renderEmptyRow(materialsTableBody, 5, 'No materials match the current search or filter.');
    return;
  }

  materials.forEach(material => {
    const row = document.createElement('tr');
    const nameInput = createEditableCell(material.name, 'text');
    const categoryInput = createEditableCell(material.category || '', 'text');
    const unitInput = createEditableCell(material.unit_of_measure || '', 'text');
    const costInput = createEditableCell(material.unit_cost ?? 0, 'number');
    
    const actionContainer = document.createElement('div');
    actionContainer.className = 'admin-actions';

    const saveButton = createIconButton('bi-check2', 'Save material', 'save-action', () => saveMaterial(material.id, row));
    const deleteButton = createIconButton('bi-trash3', 'Delete material', 'delete-action', () => {
      if (confirm(`Delete "${material.name}"?`)) {
        deleteMaterial(material.id);
      }
    });
    
    actionContainer.appendChild(saveButton);
    actionContainer.appendChild(deleteButton);

    row.appendChild(createTableCell(nameInput));
    row.appendChild(createTableCell(categoryInput));
    row.appendChild(createTableCell(unitInput));
    row.appendChild(createTableCell(costInput));
    row.appendChild(createTableCell(actionContainer));
    row.dataset.materialId = material.id;
    materialsTableBody.appendChild(row);
  });
}

function renderMachines() {
  const machines = getVisibleMachines();
  machinesTableBody.innerHTML = '';

  if (machines.length === 0) {
    renderEmptyRow(machinesTableBody, 4, 'No machines match the current search or filter.');
    return;
  }

  machines.forEach(machine => {
    const row = document.createElement('tr');
    const nameInput = createEditableCell(machine.name, 'text');
    const costInput = createEditableCell(machine.cost_per_impression ?? 0, 'number');
    const setupInput = createEditableCell(machine.setup_cost ?? 0, 'number');
    
    const actionContainer = document.createElement('div');
    actionContainer.className = 'admin-actions';

    const saveButton = createIconButton('bi-check2', 'Save machine', 'save-action', () => saveMachine(machine.id, row));
    const deleteButton = createIconButton('bi-trash3', 'Delete machine', 'delete-action', () => {
      if (confirm(`Delete "${machine.name}"?`)) {
        deleteMachine(machine.id);
      }
    });
    
    actionContainer.appendChild(saveButton);
    actionContainer.appendChild(deleteButton);

    row.appendChild(createTableCell(nameInput));
    row.appendChild(createTableCell(costInput));
    row.appendChild(createTableCell(setupInput));
    row.appendChild(createTableCell(actionContainer));
    row.dataset.machineId = machine.id;
    machinesTableBody.appendChild(row);
  });
}

function renderUsers() {
  usersTableBody.innerHTML = '';

  if (adminState.users.length === 0) {
    renderEmptyRow(usersTableBody, 4, 'No users yet.');
    return;
  }

  adminState.users.forEach(user => {
    const row = document.createElement('tr');
    const usernameCell = createTableCell(user.username);
    const fullNameInput = createEditableCell(user.full_name || '', 'text');
    const roleSelect = createEditableSelect(user.role, ['costing', 'stores']);

    const actionContainer = document.createElement('div');
    actionContainer.className = 'admin-actions';

    const saveButton = createIconButton('bi-check2', 'Save user', 'save-action', () => saveUser(user.id, row));
    const resetPasswordButton = createIconButton('bi-key', 'Reset password', 'save-action', () => resetUserPassword(user.id, user.username));
    const deleteButton = createIconButton('bi-trash3', 'Delete user', 'delete-action', () => {
      if (confirm(`Delete user "${user.username}"?`)) {
        deleteUser(user.id);
      }
    });

    actionContainer.appendChild(saveButton);
    actionContainer.appendChild(resetPasswordButton);
    actionContainer.appendChild(deleteButton);

    row.appendChild(usernameCell);
    row.appendChild(createTableCell(fullNameInput));
    row.appendChild(createTableCell(roleSelect));
    row.appendChild(createTableCell(actionContainer));
    row.dataset.userId = user.id;
    usersTableBody.appendChild(row);
  });
}

async function saveMaterial(id, row) {
  const inputs = row.querySelectorAll('input');
  const [nameInput, categoryInput, unitInput, costInput] = inputs;

  try {
    const updated = await apiRequest(`/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: nameInput.value,
        category: categoryInput.value,
        unit_of_measure: unitInput.value,
        unit_cost: parseFloat(costInput.value) || 0
      })
    });
    showStatus(`Material updated: ${updated.name}`);
    await loadAdminData();
  } catch (error) {
    console.error('Save material error:', error);
  }
}

async function saveMachine(id, row) {
  const inputs = row.querySelectorAll('input');
  const [nameInput, costInput, setupInput] = inputs;

  try {
    const updated = await apiRequest(`/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: nameInput.value,
        cost_per_impression: parseFloat(costInput.value) || 0,
        setup_cost: parseFloat(setupInput.value) || 0
      })
    });
    showStatus(`Machine updated: ${updated.name}`);
    await loadAdminData();
  } catch (error) {
    console.error('Save machine error:', error);
  }
}

async function deleteMaterial(id) {
  try {
    await apiRequest(`/materials/${id}`, {
      method: 'DELETE'
    });
    showStatus('Material deleted successfully.');
    await loadAdminData();
  } catch (error) {
    console.error('Delete material error:', error);
  }
}

async function deleteMachine(id) {
  try {
    await apiRequest(`/machines/${id}`, {
      method: 'DELETE'
    });
    showStatus('Machine deleted successfully.');
    await loadAdminData();
  } catch (error) {
    console.error('Delete machine error:', error);
  }
}

async function saveUser(id, row) {
  const fullNameInput = row.querySelector('input.admin-input');
  const roleSelect = row.querySelector('select.admin-input');

  try {
    const updated = await apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ full_name: fullNameInput.value, role: roleSelect.value })
    });
    showStatus(`User updated: ${updated.username}`);
    await loadAdminData();
  } catch (error) {
    console.error('Save user error:', error);
  }
}

async function resetUserPassword(id, username) {
  const newPassword = prompt(`New password for "${username}":`);
  if (!newPassword) return;

  try {
    await apiRequest(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPassword })
    });
    showStatus(`Password reset for ${username}.`);
  } catch (error) {
    console.error('Reset password error:', error);
  }
}

async function deleteUser(id) {
  try {
    await apiRequest(`/users/${id}`, {
      method: 'DELETE'
    });
    showStatus('User deleted successfully.');
    await loadAdminData();
  } catch (error) {
    console.error('Delete user error:', error);
  }
}

createMaterialForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('new-material-name').value;
  const category = document.getElementById('new-material-category').value;
  const unit = document.getElementById('new-material-unit').value;
  const cost = parseFloat(document.getElementById('new-material-cost').value) || 0;

  try {
    await apiRequest('/materials', {
      method: 'POST',
      body: JSON.stringify({ name, category, unit_of_measure: unit, unit_cost: cost })
    });
    createMaterialForm.reset();
    await loadAdminData();
    showStatus('New material added successfully.');
  } catch (error) {
    console.error('Create material error:', error);
  }
});

createMachineForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('new-machine-name').value;
  const cost = parseFloat(document.getElementById('new-machine-cost').value) || 0;
  const setup = parseFloat(document.getElementById('new-machine-setup').value) || 0;

  try {
    await apiRequest('/machines', {
      method: 'POST',
      body: JSON.stringify({ name, cost_per_impression: cost, setup_cost: setup })
    });
    createMachineForm.reset();
    await loadAdminData();
    showStatus('New machine added successfully.');
  } catch (error) {
    console.error('Create machine error:', error);
  }
});

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = document.getElementById('new-user-username').value;
  const full_name = document.getElementById('new-user-fullname').value;
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;

  try {
    await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({ username, full_name, password, role })
    });
    createUserForm.reset();
    await loadAdminData();
    showStatus('New user added successfully.');
  } catch (error) {
    console.error('Create user error:', error);
  }
});

refreshAdminDataBtn.addEventListener('click', loadAdminData);

materialsSearchInput.addEventListener('input', () => {
  adminState.materialSearch = materialsSearchInput.value;
  renderMaterials();
});

materialsCategoryFilter.addEventListener('change', () => {
  adminState.materialCategory = materialsCategoryFilter.value;
  renderMaterials();
});

materialsSortSelect.addEventListener('change', () => {
  adminState.materialSort = parseSortValue(materialsSortSelect.value);
  renderMaterials();
});

machinesSearchInput.addEventListener('input', () => {
  adminState.machineSearch = machinesSearchInput.value;
  renderMachines();
});

machinesSetupFilter.addEventListener('change', () => {
  adminState.machineSetupFilter = machinesSetupFilter.value;
  renderMachines();
});

machinesSortSelect.addEventListener('change', () => {
  adminState.machineSort = parseSortValue(machinesSortSelect.value);
  renderMachines();
});

document.addEventListener('click', (event) => {
  const sortButton = event.target.closest('.sort-header');
  if (!sortButton) return;

  const table = sortButton.dataset.table;
  const sortKey = sortButton.dataset.sort;
  if (table === 'materials') {
    const nextDirection = adminState.materialSort.key === sortKey && adminState.materialSort.direction === 'asc' ? 'desc' : 'asc';
    adminState.materialSort = { key: sortKey, direction: nextDirection };
    materialsSortSelect.value = `${sortKey}:${nextDirection}`;
    renderMaterials();
  }
  if (table === 'machines') {
    const nextDirection = adminState.machineSort.key === sortKey && adminState.machineSort.direction === 'asc' ? 'desc' : 'asc';
    adminState.machineSort = { key: sortKey, direction: nextDirection };
    machinesSortSelect.value = `${sortKey}:${nextDirection}`;
    renderMachines();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  loadAdminData();
});
