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

const statusDiv = document.getElementById('status');
const refreshAdminDataBtn = document.getElementById('refresh-admin-data');
const materialsTableBody = document.querySelector('#admin-materials-table tbody');
const machinesTableBody = document.querySelector('#admin-machines-table tbody');
const createMaterialForm = document.getElementById('create-material-form');
const createMachineForm = document.getElementById('create-machine-form');

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

async function loadAdminData() {
  try {
    const [materials, machines] = await Promise.all([
      apiRequest('/materials'),
      apiRequest('/machines')
    ]);

    renderMaterials(materials);
    renderMachines(machines);
    showStatus('Admin data loaded successfully.');
  } catch (error) {
    console.error('Unable to load admin data:', error);
  }
}

function renderMaterials(materials) {
  materialsTableBody.innerHTML = '';

  materials.forEach(material => {
    const row = document.createElement('tr');
    const nameInput = createEditableCell(material.name, 'text');
    const categoryInput = createEditableCell(material.category || '', 'text');
    const unitInput = createEditableCell(material.unit_of_measure || '', 'text');
    const costInput = createEditableCell(material.unit_cost ?? 0, 'number');
    
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '8px';
    
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Save';
    saveButton.className = 'secondary-button';
    saveButton.addEventListener('click', () => saveMaterial(material.id, row));
    
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'delete-button';
    deleteButton.style.backgroundColor = '#dc3545';
    deleteButton.style.color = 'white';
    deleteButton.addEventListener('click', () => {
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

function renderMachines(machines) {
  machinesTableBody.innerHTML = '';

  machines.forEach(machine => {
    const row = document.createElement('tr');
    const nameInput = createEditableCell(machine.name, 'text');
    const costInput = createEditableCell(machine.cost_per_impression ?? 0, 'number');
    const setupInput = createEditableCell(machine.setup_cost ?? 0, 'number');
    
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'flex';
    actionContainer.style.gap = '8px';
    
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Save';
    saveButton.className = 'secondary-button';
    saveButton.addEventListener('click', () => saveMachine(machine.id, row));
    
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'delete-button';
    deleteButton.style.backgroundColor = '#dc3545';
    deleteButton.style.color = 'white';
    deleteButton.addEventListener('click', () => {
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

refreshAdminDataBtn.addEventListener('click', loadAdminData);

window.addEventListener('DOMContentLoaded', () => {
  loadAdminData();
});
