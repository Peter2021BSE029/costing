// API Base URL
const API_BASE = (function () {
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:3000/api';
})();

console.log('Script start');

// Authentication check
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    window.location.href = 'login.html';
    return false;
  }

  // Check role for index.html - allow costing or stores
  if (window.location.pathname.includes('index.html') && !['costing', 'stores'].includes(user.role)) {
    alert('Access denied');
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

// DOM Elements
const navHomeBtn = document.getElementById('nav-home');
const navCostingBtn = document.getElementById('nav-costing');
const navClientsBtn = document.getElementById('nav-clients');
const navJobsBtn = document.getElementById('nav-jobs');
const newJobBtn = document.getElementById('new-job');
const loadExistingJobBtn = document.getElementById('load-existing-job');
const comprehensiveForm = document.getElementById('comprehensive-costing-form');
const costingSection = document.getElementById('costing-section');
const homeSection = document.getElementById('home-section');
const clientsSection = document.getElementById('clients-section');
const jobsSection = document.getElementById('jobs-section');
const jobSummaryContainer = document.getElementById('job-summary-container');
const existingClientSelect = document.getElementById('existing-client');
const cancelCostingBtn = document.getElementById('cancel-costing');
const clientsContainer = document.getElementById('clients-container');
const jobsContainer = document.getElementById('jobs-container');
const statusDiv = document.getElementById('status');
const jobPageSize = document.getElementById('job-page-size');
const jobPagesPerCopy = document.getElementById('job-pages-per-copy');
const platesA1 = document.getElementById('plates-a1-qty');
const platesA2 = document.getElementById('plates-a2-qty');
const platesA3 = document.getElementById('plates-a3-qty');
const platesA1Cost = document.getElementById('plates-a1-cost');
const platesA2Cost = document.getElementById('plates-a2-cost');
const platesA3Cost = document.getElementById('plates-a3-cost');
const specialProcessesTotal = document.getElementById('special-processes-total');
const calculateSpecialProcessesBtn = document.getElementById('calculate-special-processes');
const bindingList = document.getElementById('binding-list');
const clientTypeSelect = document.getElementById('client-type');
const marginTierDisplay = document.getElementById('margin-tier-display');

// Material management
const addPaperBtn = document.getElementById('add-paper');
const paperMaterialsList = document.getElementById('paper-materials-list');
const addMaterialBtn = document.getElementById('add-material');
const materialsList = document.getElementById('materials-list');

// Machine management
const addMachineBtn = document.getElementById('add-machine');
const machinesList = document.getElementById('machines-list');

// Process management
// const addProcessBtn = document.getElementById('add-process');
// const processesList = document.getElementById('processes-list');

// Calculator modal
const calculatorModal = document.getElementById('calculator-modal');
const calcBaseRate = document.getElementById('calc-base-rate');
const calcMultiplier = document.getElementById('calc-multiplier');
const calcAdditionalCost = document.getElementById('calc-additional-cost');
const calcResult = document.getElementById('calc-result');
const calculateRateBtn = document.getElementById('calculate-rate');
const applyRateBtn = document.getElementById('apply-rate');
let currentCalculatorRow = null;

// Binding Calculator modal
const bindingCalculatorModal = document.getElementById('binding-calculator-modal');
const bindingCalcCopies = document.getElementById('binding-calc-copies');
const bindingCalcRate = document.getElementById('binding-calc-rate');
const bindingCalcSetup = document.getElementById('binding-calc-setup');
const bindingCalcResult = document.getElementById('binding-calc-result');
const bindingCalculateBtn = document.getElementById('binding-calculate');
const bindingApplyBtn = document.getElementById('binding-apply');
let currentBindingRow = null;

// Special Processes Calculator modal
const specialProcessesCalculatorModal = document.getElementById('special-processes-calculator-modal');
const spCalcQuantity = document.getElementById('sp-calc-quantity');
const spCalcRate = document.getElementById('sp-calc-rate');
const spCalcResult = document.getElementById('sp-calc-result');
const spCalculateBtn = document.getElementById('sp-calculate');
const spApplyBtn = document.getElementById('sp-apply');
let currentSpecialProcessRow = null;
const specialProcessesList = document.getElementById('special-processes-list');

// Wizard elements
const wizardPrevBtn = document.getElementById('wizard-prev');
const wizardNextBtn = document.getElementById('wizard-next');
const wizardStepDisplay = document.getElementById('wizard-step');
const wizardDotsContainer = document.getElementById('wizard-dots');
const saveSectionBtn = document.getElementById('save-section');
const saveJobBtn = document.getElementById('save-job');

console.log('Wizard elements found:', {
  wizardPrevBtn: !!wizardPrevBtn,
  wizardNextBtn: !!wizardNextBtn,
  wizardStepDisplay: !!wizardStepDisplay,
  wizardDotsContainer: !!wizardDotsContainer,
  saveSectionBtn: !!saveSectionBtn,
  saveJobBtn: !!saveJobBtn
});

// Wizard state
let currentWizardStep = 0;
const wizardSections = ['client-job', 'prepress', 'press', 'post-press', 'additional-costs', 'summary'];
let plateStock = { A1: 0, A2: 0, A3: 0 };

// Global data variables
let marginTiers = [];
let materials = [];
let machines = [];
let bindings = [];
let specialProcesses = [];
const sectionNames = {
  'client-job': 'Client & Job Information',
  'prepress': 'Pre-press',
  'press': 'Press (Materials & Machines)',
  'post-press': 'Post-press (Binding & Special Processes)',
  'additional-costs': 'Additional Costs',
  'summary': 'Cost Summary'
};

// Utility functions
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
      const body = await response.text();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showStatus('Session expired or invalid token. Redirecting to login...', 'error');
        setTimeout(() => window.location.href = 'login.html', 1200);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${body}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${body}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    if (error.message.includes('401') || error.message.includes('403')) {
      return;
    }
    showStatus(`Error: ${error.message}`, 'error');
    throw error;
  }
}

function showWizardSection(step) {
  const sections = document.querySelectorAll('.wizard-section');
  sections.forEach((section, index) => {
    section.style.display = index === step ? 'block' : 'none';
  });
  if (saveSectionBtn) {
    saveSectionBtn.style.display = step === wizardSections.length - 1 ? 'none' : 'inline-block';
  }
  renderWizardDots();
  updateWizardNavigation();
}

function renderWizardDots() {
  if (!wizardDotsContainer) return;
  wizardDotsContainer.innerHTML = '';
  wizardSections.forEach((section, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `wizard-dot${index === currentWizardStep ? ' active' : ''}`;
    dot.textContent = index + 1;
    dot.title = sectionNames[section];
    dot.addEventListener('click', () => {
      saveCurrentSection();
      currentWizardStep = index;
      showWizardSection(currentWizardStep);
    });
    wizardDotsContainer.appendChild(dot);
  });
}

function updateWizardNavigation() {
  wizardPrevBtn.disabled = currentWizardStep === 0;
  wizardNextBtn.disabled = currentWizardStep === wizardSections.length - 1;
  wizardStepDisplay.textContent = `Step ${currentWizardStep + 1} of ${wizardSections.length}: ${sectionNames[wizardSections[currentWizardStep]]}`;
  
  // Check if all sections are saved, excluding the summary page because it has no input data.
  const draft = getDraftData();
  const allSaved = wizardSections
    .filter(section => section !== 'summary')
    .every(section => draft[section]);
  saveJobBtn.disabled = !allSaved;
}

function nextWizardStep() {
  if (currentWizardStep < wizardSections.length - 1) {
    saveCurrentSection();
    currentWizardStep++;
    showWizardSection(currentWizardStep);
  }
}

function prevWizardStep() {
  if (currentWizardStep > 0) {
    currentWizardStep--;
    showWizardSection(currentWizardStep);
  }
}

function saveCurrentSection() {
  try {
    console.log('Saving current section:', currentWizardStep);
    const section = wizardSections[currentWizardStep];
    console.log('Section name:', section);

    const data = collectSectionData(section);
    console.log('Collected data:', data);
    saveSectionData(section, data);
    console.log('Data saved to localStorage');
    updateWizardNavigation();
  } catch (error) {
    console.error('Error saving section:', error);
    showStatus(`Error saving section: ${error.message}`, 'error');
  }
}

function collectSectionData(section) {
  console.log('Collecting data for section:', section);
  const formData = new FormData(comprehensiveForm);
  switch (section) {
    case 'client-job':
      return {
        existingClient: formData.get('existing-client'),
        clientName: formData.get('client-name'),
        clientType: formData.get('client-type'),
        clientAddress: formData.get('client-address'),
        clientContact: formData.get('client-contact'),
        clientEmail: formData.get('client-email'),
        marginTier: formData.get('margin-tier'),
        jobName: formData.get('job-name'),
        jobQuantity: formData.get('job-quantity'),
        jobPageSize: formData.get('job-page-size'),
        jobPagesPerCopy: formData.get('job-pages-per-copy'),
        jobDescription: formData.get('job-description')
      };
    case 'prepress':
      return {
        designPages: formData.get('design-pages'),
        designRate: formData.get('design-rate'),
        typesettingPages: formData.get('typesetting-pages'),
        typesettingRate: formData.get('typesetting-rate'),
        ctpCost: formData.get('ctp-cost')
      };
    case 'press':
      const materials = [];
      const materialIds = formData.getAll('material-id[]');
      const materialQuantities = formData.getAll('material-quantity[]');
      materialIds.forEach((id, index) => {
        if (id) {
          materials.push({
            id: id,
            quantity: materialQuantities[index] || 0
          });
        }
      });
      const paperMaterials = [];
      const paperMaterialIds = formData.getAll('paper-material-id[]');
      const paperMaterialQuantities = formData.getAll('paper-material-quantity[]');
      paperMaterialIds.forEach((id, index) => {
        if (id) {
          paperMaterials.push({
            id: id,
            quantity: paperMaterialQuantities[index] || 0
          });
        }
      });
      const machines = [];
      const machineIds = formData.getAll('machine-id[]');
      const machineImpressions = formData.getAll('machine-impressions[]');
      machineIds.forEach((id, index) => {
        if (id) {
          machines.push({
            id: id,
            impressions: machineImpressions[index] || 0
          });
        }
      });
      return {
        paperMaterials,
        materials,
        machines,
        platesA1Cost: formData.get('plates-a1-cost'),
        platesA2Cost: formData.get('plates-a2-cost'),
        platesA3Cost: formData.get('plates-a3-cost')
      };
    case 'post-press':
      const bindings = [];
      document.querySelectorAll('input[name="binding-selected[]"]:checked').forEach(checkbox => {
        const bindingId = checkbox.value;
        const costInput = checkbox.closest('.binding-item').querySelector('input[name="binding-cost[]"]');
        bindings.push({
          id: bindingId,
          cost: costInput?.value || 0
        });
      });
      const specialProcesses = [];
      document.querySelectorAll('input[name="special-process-cost[]"]').forEach(input => {
        const processId = input.dataset.processId;
        const cost = input.value || 0;
        if (cost > 0) {
          specialProcesses.push({
            id: processId,
            cost: cost
          });
        }
      });
      return { bindings, specialProcesses };
    case 'additional-costs':
      return {
        wastagePercent: formData.get('wastage-percent'),
        subcontractDescription: formData.get('subcontract-description'),
        subcontractCost: formData.get('subcontract-cost'),
        commissionCost: formData.get('commission-cost'),
        storagePercent: formData.get('storage-percent'),
        transportPercent: formData.get('transport-percent'),
        overheadPercent: formData.get('overhead-percent')
      };
    case 'summary':
      return {}; // Summary doesn't have input data
    default:
      return {};
  }
}

function populateSectionData(section, data) {
  switch (section) {
    case 'client-job':
      // Handle combined client and job data
      if (data.existingClient) document.getElementById('existing-client').value = data.existingClient;
      if (data.clientName) document.getElementById('client-name').value = data.clientName;
      if (data.clientType) document.getElementById('client-type').value = data.clientType;
      if (data.clientAddress) document.getElementById('client-address').value = data.clientAddress;
      if (data.clientContact) document.getElementById('client-contact').value = data.clientContact;
      if (data.clientEmail) document.getElementById('client-email').value = data.clientEmail;
      if (data.marginTier) document.getElementById('margin-tier').value = data.marginTier;
      setMarginTierFromClientType(data.clientType);

      if (data.jobName) document.getElementById('job-name').value = data.jobName;
      if (data.jobQuantity) document.getElementById('job-quantity').value = data.jobQuantity;
      if (data.jobPageSize) document.getElementById('job-page-size').value = data.jobPageSize;
      if (data.jobPagesPerCopy) document.getElementById('job-pages-per-copy').value = data.jobPagesPerCopy;
      if (data.jobDescription) document.getElementById('job-description').value = data.jobDescription;
      updatePlateSummary();
      break;
    case 'prepress':
      if (data.designPages) document.getElementById('design-pages').value = data.designPages;
      if (data.designRate) document.getElementById('design-rate').value = data.designRate;
      if (data.typesettingPages) document.getElementById('typesetting-pages').value = data.typesettingPages;
      if (data.typesettingRate) document.getElementById('typesetting-rate').value = data.typesettingRate;
      if (data.ctpCost) document.getElementById('ctp-cost').value = data.ctpCost;
      updateDesignSubtotal();
      updateTypesettingSubtotal();
      break;
    case 'press':
      // Handle paper stock materials first
      resetPaperMaterials();
      if (data.paperMaterials && data.paperMaterials.length > 0) {
        data.paperMaterials.forEach((material, index) => {
          if (index > 0) addPaperItem();
          const row = paperMaterialsList.querySelectorAll('.paper-material-item')[index];
          if (row) {
            const select = row.querySelector('select[name="paper-material-id[]"]');
            const quantityInput = row.querySelector('input[name="paper-material-quantity[]"]');
            if (select) select.value = material.id;
            if (quantityInput) quantityInput.value = material.quantity;
            updatePaperMaterialSelection(select);
            updateMaterialCost(select);
            updateMaterialSubtotal(quantityInput);
          }
        });
      }

      // Handle general materials
      resetMaterials();
      if (data.materials && data.materials.length > 0) {
        data.materials.forEach((material, index) => {
          if (index > 0) addMaterialItem();
          const row = materialsList.querySelectorAll('.material-item')[index];
          if (row) {
            const select = row.querySelector('select[name="material-id[]"]');
            const quantityInput = row.querySelector('input[name="material-quantity[]"]');
            if (select) select.value = material.id;
            if (quantityInput) quantityInput.value = material.quantity;
            updateMaterialCost(select);
            updateMaterialSubtotal(quantityInput);
          }
        });
      }
      if (data.platesA1Cost) document.getElementById('plates-a1-cost').value = data.platesA1Cost;
      if (data.platesA2Cost) document.getElementById('plates-a2-cost').value = data.platesA2Cost;
      if (data.platesA3Cost) document.getElementById('plates-a3-cost').value = data.platesA3Cost;
      updatePlatesCostSummary();

      // Clear existing machines
      resetMachines();
      if (data.machines && data.machines.length > 0) {
        data.machines.forEach((machine, index) => {
          if (index > 0) addMachineItem();
          const row = machinesList.querySelectorAll('.machine-item')[index];
          if (row) {
            const select = row.querySelector('select[name="machine-id[]"]');
            const impressionsInput = row.querySelector('input[name="machine-impressions[]"]');
            if (select) select.value = machine.id;
            if (impressionsInput) impressionsInput.value = machine.impressions;
            updateMachineCost(select);
            updateMachineSubtotal(impressionsInput);
          }
        });
      }
      break;
    case 'post-press':
      // Handle combined binding and special processes data
      if (data.bindings) {
        data.bindings.forEach(binding => {
          const checkbox = document.querySelector(`input[name="binding-selected[]"][value="${binding.id}"]`);
          if (checkbox) {
            checkbox.checked = true;
            const costInput = checkbox.closest('.binding-item').querySelector('input[name="binding-cost[]"]');
            if (costInput) costInput.value = binding.cost;
          }
        });
      }
      if (data.specialProcesses) {
        data.specialProcesses.forEach(process => {
          const costInput = document.querySelector(`input[data-process-id="${process.id}"]`);
          if (costInput) costInput.value = process.cost;
        });
        updateSpecialProcessesTotal();
      }
      break;
    case 'additional-costs':
      if (data.wastagePercent) document.getElementById('wastage-percent').value = data.wastagePercent;
      if (data.subcontractDescription) document.getElementById('subcontract-description').value = data.subcontractDescription;
      if (data.subcontractCost) document.getElementById('subcontract-cost').value = data.subcontractCost;
      if (data.storagePercent) document.getElementById('storage-percent').value = data.storagePercent;
      if (data.transportPercent) document.getElementById('transport-percent').value = data.transportPercent;
      if (data.overheadPercent) document.getElementById('overhead-percent').value = data.overheadPercent;
      break;
  }
}

function getDraftData() {
  const draft = localStorage.getItem('costing_draft');
  return draft ? JSON.parse(draft) : {};
}

function saveSectionData(section, data) {
  const draft = getDraftData();
  draft[section] = data;
  localStorage.setItem('costing_draft', JSON.stringify(draft));
}

function loadDraftData() {
  const draft = getDraftData();
  wizardSections.forEach(section => {
    if (draft[section]) {
      populateSectionData(section, draft[section]);
    }
  });
  updateCostSummary();
}

function clearDraftData() {
  localStorage.removeItem('costing_draft');
}

function collectAllData() {
  const draft = getDraftData();
  const allData = {};
  wizardSections.forEach(section => {
    allData[section] = draft[section] || {};
  });
  return allData;
}

function buildCostingDataFromDraft(allData) {
  const clientJobData = allData['client-job'] || {};
  const prepressData = allData.prepress || {};
  const pressData = allData.press || {};
  const postPressData = allData['post-press'] || {};
  const additionalCostsData = allData['additional-costs'] || {};

  // Build materials array
  const materialsArray = [];
  if (pressData.paperMaterials) {
    pressData.paperMaterials.forEach(mat => {
      const material = materials.find(m => m.id == mat.id);
      if (material) {
        materialsArray.push({
          material_id: parseInt(mat.id),
          quantity: parseFloat(mat.quantity || 0),
          unit_cost: material.unit_cost
        });
      }
    });
  }
  if (pressData.materials) {
    pressData.materials.forEach(mat => {
      const material = materials.find(m => m.id == mat.id);
      if (material) {
        materialsArray.push({
          material_id: parseInt(mat.id),
          quantity: parseFloat(mat.quantity || 0),
          unit_cost: material.unit_cost
        });
      }
    });
  }

  // Build machines array
  const machinesArray = [];
  if (pressData.machines) {
    pressData.machines.forEach(mach => {
      const machine = machines.find(m => m.id == mach.id);
      if (machine) {
        machinesArray.push({
          machine_id: parseInt(mach.id),
          impressions: parseInt(mach.impressions || 0),
          setup_cost: machine.setup_cost,
          cost_per_impression: machine.cost_per_impression
        });
      }
    });
  }

  // Calculate plate requirements
  const pageSize = clientJobData.jobPageSize;
  const pagesPerCopy = parseInt(clientJobData.jobPagesPerCopy || 0);
  const plateResults = calculatePlateRequirements(pagesPerCopy, pageSize);

  return {
    client: {
      name: clientJobData.clientName,
      type: clientJobData.clientType,
      address: clientJobData.clientAddress,
      contact: clientJobData.clientContact,
      email: clientJobData.clientEmail,
      margin_tier_id: parseInt(clientJobData.marginTier || 0)
    },
    job: {
      name: clientJobData.jobName,
      description: clientJobData.jobDescription,
      quantity: parseInt(clientJobData.jobQuantity || 0),
      page_size: pageSize,
      pages_per_copy: pagesPerCopy,
      stock_sheets: plateResults.stockSheets,
      plates_a1: plateResults.plates.A1,
      plates_a2: plateResults.plates.A2,
      plates_a3: plateResults.plates.A3
    },
    materials: materialsArray,
    plates: [
      { size: 'A1', quantity: plateResults.plates.A1, unit_cost: parseFloat(pressData.platesA1Cost || 0) },
      { size: 'A2', quantity: plateResults.plates.A2, unit_cost: parseFloat(pressData.platesA2Cost || 0) },
      { size: 'A3', quantity: plateResults.plates.A3, unit_cost: parseFloat(pressData.platesA3Cost || 0) }
    ],
    machines: machinesArray,
    processes: [], // Empty for now
    binding: {
      bindings: (postPressData.bindings || []).map(b => ({
        binding_id: parseInt(b.id),
        cost: parseFloat(b.cost || 0)
      }))
    },
    additional_costs: {
      design_pages: parseFloat(prepressData.designPages || 0),
      design_rate: parseFloat(prepressData.designRate || 50000),
      typesetting_pages: parseFloat(prepressData.typesettingPages || 0),
      typesetting_rate: parseFloat(prepressData.typesettingRate || 30000),
      ctp_cost: parseFloat(prepressData.ctpCost || 0),
      wastage_percent: parseFloat(additionalCostsData.wastagePercent || 5),
      wastage_cost: 0, // Will be calculated
      subcontract_description: additionalCostsData.subcontractDescription || '',
      subcontract_cost: parseFloat(additionalCostsData.subcontractCost || 0),
      storage_percent: parseFloat(additionalCostsData.storagePercent || 5),
      storage_cost: 0, // Will be calculated
      transport_percent: parseFloat(additionalCostsData.transportPercent || 10),
      transport_cost: 0, // Will be calculated
      overhead_percent: parseFloat(additionalCostsData.overheadPercent || 10),
      overhead_cost: 0, // Will be calculated
      special_processes_total: (postPressData.specialProcesses || []).reduce((sum, p) => sum + parseFloat(p.cost || 0), 0)
    }
  };
}

async function generateQuotation(jobId) {
  try {
    const response = await fetch(`${API_BASE}/costing/quotation/${jobId}`, {
      method: 'GET',
      mode: 'cors'
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${body}`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotation_${jobId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Quotation generation error:', error);
    showStatus(`Error generating quotation: ${error.message}`, 'error');
  }
}

function setActiveNav(button) {
  [navHomeBtn, navCostingBtn, navClientsBtn, navJobsBtn].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  if (button) button.classList.add('active');
}

function showSection(section) {
  [homeSection, clientsSection, jobsSection, costingSection].forEach(sec => {
    if (sec) sec.style.display = 'none';
  });
  if (section) section.style.display = 'block';
}

async function displayJobSummary() {
  try {
    const jobs = await apiRequest('/jobs');
    jobSummaryContainer.innerHTML = '';

    if (jobs.length === 0) {
      jobSummaryContainer.innerHTML = '<p>No recent jobs found.</p>';
      return;
    }

    jobs.slice(0, 5).forEach(job => {
      const jobCard = document.createElement('div');
      jobCard.className = 'client-card';
      jobCard.innerHTML = `
        <h3>${job.name}</h3>
        <div class="client-info">
          <div><strong>Client:</strong> ${job.client_name || 'N/A'}</div>
          <div><strong>Status:</strong> ${job.status || 'pending'}</div>
          <div><strong>Quantity:</strong> ${job.quantity}</div>
          <div><strong>Created:</strong> ${new Date(job.created_at).toLocaleDateString()}</div>
        </div>
        <div class="card-actions">
          <button type="button" class="load-job-btn" data-job-id="${job.id}">Edit</button>
          <button type="button" class="print-quotation-btn" data-job-id="${job.id}">Quotation</button>
        </div>
      `;
      jobSummaryContainer.appendChild(jobCard);
    });
  } catch (error) {
    console.error('Error loading job summary:', error);
    jobSummaryContainer.innerHTML = '<p>Unable to load job summary.</p>';
  }
}

async function loadCostSheetData() {
  marginTiers = await apiRequest('/clients/margin-tiers');
  materials = await apiRequest('/materials');
  machines = await apiRequest('/machines');
  bindings = await apiRequest('/bindings');
  specialProcesses = await apiRequest('/special-processes');
  const clients = await apiRequest('/clients');
  // Load plate stock from system settings
  try {
    const settings = await apiRequest('/system-settings');
    plateStock.A1 = settings.find(s => s.setting_name === 'PLATES_A1_STOCK')?.setting_value || 100;
    plateStock.A2 = settings.find(s => s.setting_name === 'PLATES_A2_STOCK')?.setting_value || 200;
    plateStock.A3 = settings.find(s => s.setting_name === 'PLATES_A3_STOCK')?.setting_value || 300;
  } catch (error) {
    console.warn('Could not load plate stock settings, using defaults');
  }
  populateMarginTiers(marginTiers);
  populateMaterials();
  populatePaperMaterials();
  populateMachines();
  populateBindings();
  populateSpecialProcesses();
  populateExistingClients(clients);
}

async function loadJobForEdit(jobId) {
  try {
    const job = await apiRequest(`/jobs/${jobId}`);
    await loadCostSheetData();
    showSection(costingSection);
    setActiveNav(navCostingBtn);
    
    // Populate all sections from job data
    populateCostSheetFromJob(job);
    
    // Save all sections to draft
    wizardSections.forEach(section => {
      const data = collectSectionData(section);
      saveSectionData(section, data);
    });
    
    // Show first section
    currentWizardStep = 0;
    showWizardSection(currentWizardStep);
    
  } catch (error) {
    console.error('Error loading job:', error);
  }
}

function populateExistingClients(clients) {
  existingClientSelect.innerHTML = '<option value="">Select an existing client...</option>';
  window.cachedClients = clients;
  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = `${client.name} (${client.type || 'N/A'})`;
    existingClientSelect.appendChild(option);
  });
}

function loadExistingClient(clientId) {
  const client = window.cachedClients?.find(c => c.id == clientId);
  if (!client) return;
  document.getElementById('client-name').value = client.name || '';
  document.getElementById('client-type').value = client.type || '';
  document.getElementById('client-address').value = client.address || '';
  document.getElementById('client-contact').value = client.contact || '';
  document.getElementById('client-email').value = client.email || '';
  document.getElementById('margin-tier').value = client.margin_tier_id || '';
  setMarginTierFromClientType(client.type);
}

function setMarginTierFromClientType(clientType) {
  if (!clientType || !marginTiers || marginTiers.length === 0) return;

  const normalizedType = clientType.toString().trim().toLowerCase();
  const matchingTier = marginTiers.find(tier => tier.tier_name.toString().trim().toLowerCase() === normalizedType);
  if (matchingTier) {
    document.getElementById('margin-tier').value = matchingTier.id;
    marginTierDisplay.textContent = `${matchingTier.tier_name} (${matchingTier.margin_percentage}% margin)`;
    marginTierDisplay.style.display = 'block';
    updateCostSummary();
  } else {
    document.getElementById('margin-tier').value = '';
    marginTierDisplay.textContent = '';
    marginTierDisplay.style.display = 'none';
    updateCostSummary();
  }
}

function clearClientFields() {
  document.getElementById('client-name').value = '';
  document.getElementById('client-type').value = '';
  document.getElementById('client-address').value = '';
  document.getElementById('client-contact').value = '';
  document.getElementById('client-email').value = '';
  document.getElementById('margin-tier').value = '';
  marginTierDisplay.textContent = '';
  marginTierDisplay.style.display = 'none';
  existingClientSelect.value = '';
}

function setMaterialRow(row, material) {
  const select = row.querySelector('select[name="material-id[]"]');
  const quantityInput = row.querySelector('input[name="material-quantity[]"]');
  if (select) {
    select.value = material.material_id;
    if (quantityInput) quantityInput.value = material.quantity;
    updateMaterialCost(select);
    if (quantityInput) updateMaterialSubtotal(quantityInput);
  }
}

function setMachineRow(row, machine) {
  const select = row.querySelector('select[name="machine-id[]"]');
  const impressionsInput = row.querySelector('input[name="machine-impressions[]"]');
  if (select) {
    select.value = machine.machine_id;
    if (impressionsInput) impressionsInput.value = machine.impressions;
    updateMachineCost(select);
    if (impressionsInput) updateMachineSubtotal(impressionsInput);
  }
}

function setProcessRow(row, process) {
  const select = row.querySelector('select[name="process-id[]"]');
  const quantityInput = row.querySelector('input[name="process-quantity[]"]');
  if (select) {
    select.value = process.process_id;
    if (quantityInput) quantityInput.value = process.quantity;
    updateProcessCost(select);
    if (quantityInput) updateProcessSubtotal(quantityInput);
  }
}

function populateCostSheetFromJob(job) {
  if (!job) return;
  clearClientFields();
  if (window.cachedClients) {
    const matchingClient = window.cachedClients.find(c => c.id == job.client_id);
    if (matchingClient) {
      existingClientSelect.value = matchingClient.id;
      loadExistingClient(matchingClient.id);
    }
  }

  document.getElementById('job-name').value = job.name || '';
  document.getElementById('job-quantity').value = job.quantity || '';
  document.getElementById('job-page-size').value = job.page_size || '';
  document.getElementById('job-pages-per-copy').value = job.pages_per_copy || '';
  document.getElementById('job-description').value = job.description || '';

  updatePlateSummary();
  resetMaterials();
  resetMachines();
  // resetProcesses();

  if (Array.isArray(job.materials) && job.materials.length > 0) {
    let materialIndex = 0;
    let paperIndex = 0;
    job.materials.forEach((material, index) => {
      if (isPaperMaterial(material)) {
        if (paperIndex > 0) addPaperItem();
        const row = paperMaterialsList.querySelectorAll('.paper-material-item')[paperIndex];
        if (row) {
          const select = row.querySelector('select[name="paper-material-id[]"]');
          const quantityInput = row.querySelector('input[name="paper-material-quantity[]"]');
          if (select) select.value = material.material_id;
          if (quantityInput) quantityInput.value = material.quantity;
          updatePaperMaterialSelection(select);
          updateMaterialCost(select);
          updateMaterialSubtotal(quantityInput);
        }
        paperIndex += 1;
      } else {
        if (materialIndex > 0) addMaterialItem();
        const row = materialsList.querySelectorAll('.material-item')[materialIndex];
        if (row) setMaterialRow(row, material);
        materialIndex += 1;
      }
    });
  }

  if (Array.isArray(job.machines) && job.machines.length > 0) {
    job.machines.forEach((machine, index) => {
      if (index > 0) addMachineItem();
      const row = machinesList.querySelectorAll('.machine-item')[index];
      if (row) setMachineRow(row, machine);
    });
  }

  if (Array.isArray(job.processes) && job.processes.length > 0) {
    // job.processes.forEach((process, index) => {
    //   if (index > 0) addProcessItem();
    //   const row = processesList.querySelectorAll('.process-row')[index];
    //   if (row) setProcessRow(row, process);
    // });
    // For now, we don't load individual processes since we use a total field
  }

  if (job.binding) {
    const jobBindings = Array.isArray(job.binding.bindings) ? job.binding.bindings : [job.binding];
    jobBindings.forEach(bindingItem => {
      const checkbox = document.querySelector(`input[name="binding-selected[]"][value="${bindingItem.binding_id}"]`);
      if (checkbox) {
        checkbox.checked = true;
        const costInput = checkbox.closest('.binding-item').querySelector('input[name="binding-cost[]"]');
        if (costInput) {
          costInput.value = bindingItem.cost || 0;
        }
      }
    });
  }

  if (job.additional_costs) {
    document.getElementById('design-pages').value = job.additional_costs.design_pages || '';
    document.getElementById('design-rate').value = job.additional_costs.design_rate || '';
    document.getElementById('typesetting-pages').value = job.additional_costs.typesetting_pages || '';
    document.getElementById('typesetting-rate').value = job.additional_costs.typesetting_rate || '';
    document.getElementById('wastage-percent').value = job.additional_costs.wastage_percent || '';
    document.getElementById('wastage-cost').value = job.additional_costs.wastage_cost || '';
    document.getElementById('subcontract-description').value = job.additional_costs.subcontract_description || '';
    document.getElementById('subcontract-cost').value = job.additional_costs.subcontract_cost || '';
    document.getElementById('storage-cost').value = job.additional_costs.storage_cost || '';
    document.getElementById('transport-cost').value = job.additional_costs.transport_cost || '';
  }

  updateDesignSubtotal();
  updateTypesettingSubtotal();
  updateCostSummary();
}

// Event Listeners
navHomeBtn.addEventListener('click', () => {
  showSection(homeSection);
  setActiveNav(navHomeBtn);
  displayJobSummary();
});

navClientsBtn.addEventListener('click', async () => {
  showSection(clientsSection);
  setActiveNav(navClientsBtn);
  try {
    const clients = await apiRequest('/clients');
    displayClients(clients);
  } catch (error) {
    // Error already shown by apiRequest
  }
});

navJobsBtn.addEventListener('click', async () => {
  showSection(jobsSection);
  setActiveNav(navJobsBtn);
  try {
    const jobs = await apiRequest('/jobs');
    displayJobs(jobs);
  } catch (error) {
    // Error already shown by apiRequest
  }
});

navCostingBtn.addEventListener('click', async () => {
  console.log('Costing button clicked');
  showSection(costingSection);
  setActiveNav(navCostingBtn);
  try {
    console.log('Loading cost sheet data...');
    // Only load if materials, machines, etc. are empty
    if (!materials || materials.length === 0) {
      await loadCostSheetData();
    } else {
      // Data already loaded, just repopulate UI
      populateMarginTiers(marginTiers);
      populateMaterials();
      populatePaperMaterials();
      populateMachines();
      populateBindings();
      populateSpecialProcesses();
    }
    console.log('Loading draft data...');
    loadDraftData(); // Load any saved draft data
    console.log('Showing wizard section:', currentWizardStep);
    showWizardSection(currentWizardStep); // Show first section
    console.log('Cost sheet loaded');
  } catch (error) {
    console.error('Error loading cost sheet data:', error);
  }
});

loadExistingJobBtn.addEventListener('click', () => {
  showSection(jobsSection);
  setActiveNav(navJobsBtn);
});

newJobBtn.addEventListener('click', () => {
  clearDraftData();
  comprehensiveForm.reset();
  // Reset dynamic sections
  resetMaterials();
  resetMachines();
  resetProcesses();
  // Reset wizard to first step
  currentWizardStep = 0;
  showWizardSection(0);
  updateCostSummary();
  showSection(costingSection);
  setActiveNav(navCostingBtn);
});

cancelCostingBtn.addEventListener('click', () => {
  if (!confirm('Discard changes and close the cost sheet?')) {
    return;
  }
  clearDraftData();
  showSection(homeSection);
  setActiveNav(navHomeBtn);
  comprehensiveForm.reset();
  // Reset dynamic sections
  resetMaterials();
  resetMachines();
  // resetProcesses();
  updateCostSummary();
  currentWizardStep = 0; // Reset wizard
});

existingClientSelect.addEventListener('change', () => {
  const clientId = existingClientSelect.value;
  if (clientId) {
    loadExistingClient(clientId);
  } else {
    clearClientFields();
  }
});

clientTypeSelect.addEventListener('change', () => {
  const clientType = clientTypeSelect.value;
  setMarginTierFromClientType(clientType);
});

if (platesA1Cost) {
  platesA1Cost.addEventListener('input', updatePlatesCostSummary);
}
if (platesA2Cost) {
  platesA2Cost.addEventListener('input', updatePlatesCostSummary);
}
if (platesA3Cost) {
  platesA3Cost.addEventListener('input', updatePlatesCostSummary);
}

if (jobPageSize) {
  jobPageSize.addEventListener('change', updatePlateSummary);
}

if (jobPagesPerCopy) {
  jobPagesPerCopy.addEventListener('input', updatePlateSummary);
}

jobSummaryContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('load-job-btn')) {
    loadJobForEdit(e.target.dataset.jobId);
  } else if (e.target.classList.contains('print-quotation-btn')) {
    generateQuotation(e.target.dataset.jobId);
  }
});

jobsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('load-job-btn')) {
    loadJobForEdit(e.target.dataset.jobId);
  } else if (e.target.classList.contains('print-quotation-btn')) {
    generateQuotation(e.target.dataset.jobId);
  }
});

// Material management
addMaterialBtn.addEventListener('click', () => {
  addMaterialItem();
});

materialsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-material')) {
    const item = e.target.closest('.material-item');
    const allItems = materialsList.querySelectorAll('.material-item');
    if (allItems.length > 1) {
      item.remove();
      updateCostSummary();
    } else {
      // Don't remove the last item, just reset it
      const selects = item.querySelectorAll('select');
      const inputs = item.querySelectorAll('input');
      selects.forEach(select => select.value = '');
      inputs.forEach(input => input.value = '');
      updateCostSummary();
    }
  }
});

materialsList.addEventListener('change', (e) => {
  if (e.target.name === 'material-id[]') {
    updateMaterialCost(e.target);
  }
});

materialsList.addEventListener('input', (e) => {
  if (e.target.name === 'material-quantity[]') {
    updateMaterialSubtotal(e.target);
  }
});

if (addPaperBtn) {
  addPaperBtn.addEventListener('click', () => addPaperItem());
}

if (paperMaterialsList) {
  paperMaterialsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-paper-material')) {
      const item = e.target.closest('.paper-material-item');
      const allItems = paperMaterialsList.querySelectorAll('.paper-material-item');
      if (allItems.length > 1) {
        item.remove();
        updateCostSummary();
      } else {
        const selects = item.querySelectorAll('select');
        const inputs = item.querySelectorAll('input');
        selects.forEach(select => select.value = '');
        inputs.forEach(input => input.value = '');
        updateCostSummary();
      }
    }
  });

  paperMaterialsList.addEventListener('change', (e) => {
    if (e.target.name === 'paper-material-id[]') {
      updatePaperMaterialSelection(e.target);
      updateMaterialCost(e.target);
    }
  });

  paperMaterialsList.addEventListener('input', (e) => {
    if (e.target.name === 'paper-material-quantity[]') {
      updateMaterialSubtotal(e.target);
    }
  });
}

// Machine management
addMachineBtn.addEventListener('click', () => {
  addMachineItem();
});

machinesList.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-machine')) {
    const item = e.target.closest('.machine-item');
    const allItems = machinesList.querySelectorAll('.machine-item');
    if (allItems.length > 1) {
      item.remove();
      updateCostSummary();
    } else {
      // Don't remove the last item, just reset it
      const selects = item.querySelectorAll('select');
      const inputs = item.querySelectorAll('input');
      selects.forEach(select => select.value = '');
      inputs.forEach(input => input.value = '');
      updateCostSummary();
    }
  }
});

machinesList.addEventListener('change', (e) => {
  if (e.target.name === 'machine-id[]') {
    updateMachineCost(e.target);
  }
});

machinesList.addEventListener('input', (e) => {
  if (e.target.name === 'machine-impressions[]') {
    updateMachineSubtotal(e.target);
  }
});

// Process management
// addProcessBtn.addEventListener('click', () => {
//   addProcessItem();
// });

// processesList.addEventListener('click', (e) => {
//   if (e.target.classList.contains('remove-process')) {
//     const row = e.target.closest('.process-row');
//     const allRows = processesList.querySelectorAll('.process-row');
//     if (allRows.length > 1) {
//       row.remove();
//       updateCostSummary();
//     } else {
//       // Don't remove the last row, just reset it
//       const selects = row.querySelectorAll('select');
//       const inputs = row.querySelectorAll('input');
//       selects.forEach(select => select.value = '');
//       inputs.forEach(input => input.value = '');
//       updateCostSummary();
//     }
//   } else if (e.target.classList.contains('calculator-btn')) {
//     openCalculatorModal(e.target);
//   }
// });

// Calculator modal event listeners
document.getElementById('calc-close').addEventListener('click', () => {
  calculatorModal.style.display = 'none';
});

document.getElementById('binding-calc-close').addEventListener('click', () => {
  bindingCalculatorModal.style.display = 'none';
});

document.getElementById('special-processes-calc-close').addEventListener('click', () => {
  specialProcessesCalculatorModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === calculatorModal) {
    calculatorModal.style.display = 'none';
  }
  if (e.target === bindingCalculatorModal) {
    bindingCalculatorModal.style.display = 'none';
  }
  if (e.target === specialProcessesCalculatorModal) {
    specialProcessesCalculatorModal.style.display = 'none';
  }
});

calculateRateBtn.addEventListener('click', () => {
  const baseRate = parseFloat(calcBaseRate.value) || 0;
  const multiplier = parseFloat(calcMultiplier.value) || 1;
  const additionalCost = parseFloat(calcAdditionalCost.value) || 0;
  const result = (baseRate * multiplier) + additionalCost;
  calcResult.value = result.toFixed(2);
});

applyRateBtn.addEventListener('click', () => {
  if (currentCalculatorRow && calcResult.value) {
    const rateInput = currentCalculatorRow.querySelector('input[name="process-rate[]"]');
    const quantityInput = currentCalculatorRow.querySelector('input[name="process-quantity[]"]');
    
    if (rateInput) {
      rateInput.value = calcResult.value;
      if (quantityInput) {
        updateProcessSubtotal(quantityInput);
      }
    }
    
    calculatorModal.style.display = 'none';
    resetCalculatorModal();
  }
});

// Binding calculator event listeners
bindingCalculateBtn.addEventListener('click', () => {
  const copies = parseFloat(bindingCalcCopies.value) || 0;
  const rate = parseFloat(bindingCalcRate.value) || 0;
  const setup = parseFloat(bindingCalcSetup.value) || 0;
  const result = (copies * rate) + setup;
  bindingCalcResult.value = result.toFixed(2);
});

bindingApplyBtn.addEventListener('click', () => {
  if (currentBindingRow && bindingCalcResult.value) {
    const costInput = currentBindingRow.querySelector('input[name="binding-cost[]"]');
    if (costInput) {
      costInput.value = bindingCalcResult.value;
      updateCostSummary();
    }
    bindingCalculatorModal.style.display = 'none';
    resetBindingCalculatorModal();
  }
});

// Special processes calculator event listeners
spCalculateBtn.addEventListener('click', () => {
  const quantity = parseFloat(spCalcQuantity.value) || 0;
  const rate = parseFloat(spCalcRate.value) || 0;
  const result = quantity * rate;
  spCalcResult.value = result.toFixed(2);
});

spApplyBtn.addEventListener('click', () => {
  if (currentSpecialProcessRow && spCalcResult.value) {
    const costInput = currentSpecialProcessRow.querySelector('input[name="special-process-cost[]"]');
    if (costInput) {
      costInput.value = spCalcResult.value;
      updateSpecialProcessesTotal();
    }
    specialProcessesCalculatorModal.style.display = 'none';
    resetSpecialProcessesCalculatorModal();
  }
});

// processesList.addEventListener('change', (e) => {
//   if (e.target.name === 'process-id[]') {
//     updateProcessCost(e.target);
//   }
// });

// processesList.addEventListener('input', (e) => {
//   if (e.target.name === 'process-quantity[]') {
//     updateProcessSubtotal(e.target);
//   }
// });

if (calculateSpecialProcessesBtn) {
  calculateSpecialProcessesBtn.addEventListener('click', () => {
    openSpecialProcessesCalculator();
  });
}

if (bindingList) {
  bindingList.addEventListener('click', (e) => {
    const button = e.target.closest('.calculator-btn');
    if (button) {
      const bindingId = button.dataset.bindingId;
      openBindingCalculator(bindingId);
    }
  });
}

if (specialProcessesList) {
  specialProcessesList.addEventListener('click', (e) => {
    const button = e.target.closest('.calculator-btn');
    if (button) {
      const processId = button.dataset.processId;
      openSpecialProcessCalculator(processId);
    }
  });
}

// Binding management
// document.getElementById('binding-method').addEventListener('change', (e) => {
//   updateBindingCost(e.target);
//   // Note: Subtotal is not automatically updated - requires Calculate button
// });

// document.getElementById('binding-copies').addEventListener('input', () => {
//   // Note: Subtotal is not automatically updated - requires Calculate button
// });

// document.getElementById('calculate-binding').addEventListener('click', () => {
//   updateBindingSubtotal();
// });

// Additional costs
document.getElementById('design-pages').addEventListener('input', () => {
  updateDesignSubtotal();
});

document.getElementById('design-rate').addEventListener('input', () => {
  updateDesignSubtotal();
});

document.getElementById('typesetting-pages').addEventListener('input', () => {
  updateTypesettingSubtotal();
});

document.getElementById('typesetting-rate').addEventListener('input', () => {
  updateTypesettingSubtotal();
});

document.getElementById('wastage-percent').addEventListener('input', updateCostSummary);
document.getElementById('subcontract-cost').addEventListener('input', updateCostSummary);
document.getElementById('binding-other-cost')?.addEventListener('input', updateCostSummary);
document.getElementById('special-process-other-cost')?.addEventListener('input', () => {
  updateSpecialProcessesTotal();
});

document.getElementById('storage-percent').addEventListener('input', updateCostSummary);
document.getElementById('transport-percent').addEventListener('input', updateCostSummary);
document.getElementById('overhead-percent').addEventListener('input', updateCostSummary);

// Wizard event listeners
console.log('Attaching wizard event listeners');
if (wizardPrevBtn) {
  wizardPrevBtn.addEventListener('click', () => {
    console.log('Previous button clicked');
    prevWizardStep();
  });
} else {
  console.error('wizardPrevBtn not found');
}

if (wizardNextBtn) {
  wizardNextBtn.addEventListener('click', () => {
    console.log('Next button clicked');
    nextWizardStep();
  });
} else {
  console.error('wizardNextBtn not found');
}

if (saveSectionBtn) {
  saveSectionBtn.addEventListener('click', () => {
    console.log('Save section button clicked');
    saveCurrentSection();
  });
} else {
  console.error('saveSectionBtn not found');
}

if (saveJobBtn) {
  saveJobBtn.addEventListener('click', async () => {
    console.log('Save job button clicked');
    try {
      const allData = collectAllData();
      const costingData = buildCostingDataFromDraft(allData);
      
      // Validate required fields
      if (!costingData.client.name) {
        showStatus('Client name is required', 'error');
        return;
      }
      if (!costingData.client.margin_tier_id) {
        showStatus('Margin tier must be selected', 'error');
        return;
      }
      if (!costingData.job.name) {
        showStatus('Job name is required', 'error');
        return;
      }
      if (!costingData.job.quantity || Number.isNaN(Number(costingData.job.quantity))) {
        showStatus('Job quantity is required and must be a valid number', 'error');
        return;
      }
      if (!costingData.job.page_size) {
        showStatus('Book page size selection is required', 'error');
        return;
      }
      if (!costingData.job.pages_per_copy || Number.isNaN(Number(costingData.job.pages_per_copy))) {
        showStatus('Pages per copy is required and must be a valid number', 'error');
        return;
      }

      const result = await apiRequest('/costing', {
        method: 'POST',
        body: JSON.stringify(costingData)
      });

      showStatus(`Costing saved successfully! Job ID: ${result.job_id}. You can generate a quotation from the Jobs list.`);
      clearDraftData();

      showSection(homeSection);
      setActiveNav(navHomeBtn);
      comprehensiveForm.reset();
      resetMaterials();
      resetMachines();
      updateCostSummary();
      currentWizardStep = 0;

    } catch (error) {
      console.error('Costing submission error:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  });
} else {
  console.error('saveJobBtn not found');
}

// Helper functions
function populateMarginTiers(tiers) {
  const select = document.getElementById('margin-tier');
  const clientTypeSelect = document.getElementById('client-type');
  select.innerHTML = '<option value="">Select margin tier...</option>';
  clientTypeSelect.innerHTML = '<option value="">Select client type...</option>';

  tiers.forEach(tier => {
    const tierOption = document.createElement('option');
    tierOption.value = tier.id;
    tierOption.textContent = `${tier.tier_name} (${tier.margin_percentage}% margin)`;
    select.appendChild(tierOption);

    const clientTypeOption = document.createElement('option');
    clientTypeOption.value = tier.tier_name;
    clientTypeOption.textContent = tier.tier_name;
    clientTypeSelect.appendChild(clientTypeOption);
  });
}

function populateJobClients(clients) {
  const select = document.getElementById('job-client');
  select.innerHTML = '<option value="">Select client...</option>';

  clients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name;
    select.appendChild(option);
  });
}

function displayJobs(jobs) {
  jobsContainer.innerHTML = '';

  if (jobs.length === 0) {
    jobsContainer.innerHTML = '<p>No jobs found. Add your first job!</p>';
    return;
  }

  jobs.forEach(job => {
    const jobCard = document.createElement('div');
    jobCard.className = 'client-card'; // Reuse the same styling

    jobCard.innerHTML = `
      <h3>${job.name}</h3>
      <div class="client-info">
        <div><strong>Client:</strong> ${job.client_name}</div>
        <div><strong>Margin Tier:</strong> ${job.tier_name} (${job.margin_percentage}%)</div>
        <div><strong>Quantity:</strong> ${job.quantity}</div>
        <div><strong>Status:</strong> ${job.status}</div>
        <div><strong>Description:</strong> ${job.description || 'N/A'}</div>
        <div><strong>Created:</strong> ${new Date(job.created_at).toLocaleDateString()}</div>
      </div>
      <div class="card-actions">
        <button type="button" class="load-job-btn" data-job-id="${job.id}">Edit</button>
        <button type="button" class="print-quotation-btn" data-job-id="${job.id}">Quotation</button>
      </div>
    `;

    jobsContainer.appendChild(jobCard);
  });
}

function displayClients(clients) {
  clientsContainer.innerHTML = '';

  if (clients.length === 0) {
    clientsContainer.innerHTML = '<p>No clients found. Create your first client!</p>';
    return;
  }

  clients.forEach(client => {
    const clientCard = document.createElement('div');
    clientCard.className = 'client-card';

    clientCard.innerHTML = `
      <h3>${client.name}</h3>
      <div class="client-info">
        <div><strong>Type:</strong> ${client.type || 'N/A'}</div>
        <div><strong>Address:</strong> ${client.address || 'N/A'}</div>
        <div><strong>Contact:</strong> ${client.contact || 'N/A'}</div>
        <div><strong>Email:</strong> ${client.email || 'N/A'}</div>
        <div><strong>Created:</strong> ${client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}</div>
      </div>
    `;

    clientsContainer.appendChild(clientCard);
  });
}

// Comprehensive Costing Form Functions
function isPaperMaterial(material) {
  const name = (material.name || '').toString().toLowerCase();
  const category = (material.category || '').toString().toLowerCase();
  if (name.includes('plate')) return false;
  return category.includes('paper') || category.includes('stock') || /\b(a[1-6]|b[0-9]+)\b/.test(name) || name.includes('paper');
}

function populateMaterials() {
  const materialSelects = document.querySelectorAll('select[name="material-id[]"]');
  materialSelects.forEach(select => {
    const currentValue = select.value; // Preserve current selection
    select.innerHTML = '<option value="">Select material...</option>';
    materials.forEach(material => {
      if (isPaperMaterial(material) || material.name.toLowerCase().includes('plate')) {
        return;
      }
      const option = document.createElement('option');
      option.value = material.id;
      option.textContent = `${material.name} (${material.unit_cost} UGX/${material.unit_of_measure || 'unit'})`;
      select.appendChild(option);
    });
    select.value = currentValue; // Restore selection
  });
}

function populatePaperMaterials() {
  const paperSelects = document.querySelectorAll('select[name="paper-material-id[]"]');
  paperSelects.forEach(select => {
    const currentValue = select.value;
    select.innerHTML = '<option value="">Select paper...</option>';
    materials.forEach(material => {
      if (!isPaperMaterial(material)) return;
      const option = document.createElement('option');
      option.value = material.id;
      option.textContent = `${material.name} (${material.unit_cost} UGX/${material.unit_of_measure || 'unit'})`;
      select.appendChild(option);
    });
    select.value = currentValue;
  });
}

function populateMachines() {
  const machineSelects = document.querySelectorAll('select[name="machine-id[]"]');
  machineSelects.forEach(select => {
    const currentValue = select.value; // Preserve current selection
    select.innerHTML = '<option value="">Select machine...</option>';
    machines.forEach(machine => {
      const option = document.createElement('option');
      option.value = machine.id;
      option.textContent = `${machine.name} (${machine.cost_per_impression} UGX/impression)`;
      select.appendChild(option);
    });
    select.value = currentValue; // Restore selection
  });
}

function populateBindings() {
  bindingList.innerHTML = '';
  const uniqueBindings = [...new Map(bindings.map(binding => [binding.id, binding])).values()];
  uniqueBindings.forEach(binding => {
    const bindingItem = document.createElement('div');
    bindingItem.className = 'binding-item';
    bindingItem.innerHTML = `
      <input type="checkbox" name="binding-selected[]" value="${binding.id}" data-binding-id="${binding.id}">
      <span>${binding.method}</span>
      <input type="number" name="binding-cost[]" min="0" step="0.01" placeholder="Cost" readonly>
      <button type="button" class="calculator-btn" title="Calculate Binding Cost" data-binding-id="${binding.id}"><img src="../images/icons/calculator.png" alt="Calc" class="calculator-icon"></button>
    `;
    bindingList.appendChild(bindingItem);
  });
}

function populateSpecialProcesses() {
  specialProcessesList.innerHTML = '';
  const uniqueProcesses = [...new Map(specialProcesses.map(process => [process.id, process])).values()];
  uniqueProcesses.forEach(process => {
    const processItem = document.createElement('div');
    processItem.className = 'special-process-item';
    processItem.innerHTML = `
      <div class="process-info">
        <span class="process-name">${process.name}</span>
        <span class="process-rate">(${process.rate_per_unit} UGX/${process.unit_type || 'unit'})</span>
      </div>
      <input type="number" name="special-process-cost[]" data-process-id="${process.id}" min="0" step="0.01" placeholder="Cost" readonly>
      <button type="button" class="calculator-btn" title="Calculate" data-process-id="${process.id}"><img src="../images/icons/calculator.png" alt="Calc" class="calculator-icon"></button>
    `;
    specialProcessesList.appendChild(processItem);
  });
}

function addMaterialItem() {
  const materialItem = document.createElement('tr');
  materialItem.className = 'material-item';
  materialItem.innerHTML = `
    <td>
      <select name="material-id[]" required>
        <option value="">Select material...</option>
      </select>
    </td>
    <td><input type="number" name="material-quantity[]" min="0.01" step="0.01" required></td>
    <td><input type="number" name="material-cost[]" min="0" step="0.01" readonly></td>
    <td><input type="number" name="material-subtotal[]" readonly></td>
    <td><button type="button" class="remove-material">🗑️</button></td>
  `;
  materialsList.appendChild(materialItem);
  populateMaterials();
}

function addPaperItem() {
  const paperItem = document.createElement('tr');
  paperItem.className = 'paper-material-item';
  paperItem.innerHTML = `
    <td>
      <select name="paper-material-id[]" required>
        <option value="">Select paper...</option>
      </select>
    </td>
    <td><input type="number" name="paper-material-quantity[]" min="0.01" step="0.01" required></td>
    <td><input type="number" name="paper-material-cost[]" min="0" step="0.01" readonly></td>
    <td><input type="number" name="paper-material-subtotal[]" readonly></td>
    <td><button type="button" class="remove-paper-material">🗑️</button></td>
  `;
  paperMaterialsList.appendChild(paperItem);
  populatePaperMaterials();
}

function resetPaperMaterials() {
  const paperMaterialItems = paperMaterialsList.querySelectorAll('.paper-material-item');
  for (let i = 1; i < paperMaterialItems.length; i++) {
    paperMaterialItems[i].remove();
  }
  const firstItem = paperMaterialsList.querySelector('.paper-material-item');
  if (firstItem) {
    const selects = firstItem.querySelectorAll('select');
    const inputs = firstItem.querySelectorAll('input');
    selects.forEach(select => select.value = '');
    inputs.forEach(input => input.value = '');
  }
}

function addMachineItem() {
  const machineItem = document.createElement('tr');
  machineItem.className = 'machine-item';
  machineItem.innerHTML = `
    <td>
      <select name="machine-id[]" required>
        <option value="">Select machine...</option>
      </select>
    </td>
    <td><input type="number" name="machine-impressions[]" min="1" required></td>
    <td><input type="number" name="machine-setup-percent[]" min="0" step="0.1" placeholder="Setup %" value="10"></td>
    <td><input type="number" name="machine-running[]" readonly></td>
    <td><input type="number" name="machine-subtotal[]" readonly></td>
    <td><button type="button" class="remove-machine">🗑️</button></td>
  `;
  machinesList.appendChild(machineItem);
  populateMachines();
}

function addProcessItem() {
  const processRow = document.createElement('tr');
  processRow.className = 'process-row';
  processRow.innerHTML = `
    <td>
      <select name="process-id[]" required>
        <option value="">Select process...</option>
      </select>
    </td>
    <td>
      <input type="number" name="process-quantity[]" min="0.01" step="0.01" required>
    </td>
    <td>
      <input type="number" name="process-rate[]" min="0" step="0.01" readonly>
      <button type="button" class="calculator-btn" title="Calculate Rate">🧮</button>
    </td>
    <td>
      <input type="number" name="process-subtotal[]" readonly>
    </td>
    <td>
      <button type="button" class="remove-process">Remove</button>
    </td>
  `;
  // processesList.appendChild(processRow);
  // populateSpecialProcesses();
}

function resetMaterials() {
  // Remove all dynamically added material items, keep the first one
  const materialItems = materialsList.querySelectorAll('.material-item');
  for (let i = 1; i < materialItems.length; i++) {
    materialItems[i].remove();
  }
  // Reset the first item
  const firstItem = materialsList.querySelector('.material-item');
  if (firstItem) {
    const selects = firstItem.querySelectorAll('select');
    const inputs = firstItem.querySelectorAll('input');
    selects.forEach(select => select.value = '');
    inputs.forEach(input => input.value = '');
  }
}

function resetMachines() {
  // Remove all dynamically added machine items, keep the first one
  const machineItems = machinesList.querySelectorAll('.machine-item');
  for (let i = 1; i < machineItems.length; i++) {
    machineItems[i].remove();
  }
  // Reset the first item
  const firstItem = machinesList.querySelector('.machine-item');
  if (firstItem) {
    const selects = firstItem.querySelectorAll('select');
    const inputs = firstItem.querySelectorAll('input');
    selects.forEach(select => select.value = '');
    inputs.forEach(input => input.value = '');
  }
}

function resetProcesses() {
  // Remove all dynamically added process rows, keep the first one
  // const processRows = processesList.querySelectorAll('.process-row');
  // for (let i = 1; i < processRows.length; i++) {
  //   processRows[i].remove();
  // }
  // Reset the first row
  // const firstRow = processesList.querySelector('.process-row');
  // if (firstRow) {
  //   const selects = firstRow.querySelectorAll('select');
  //   const inputs = firstRow.querySelectorAll('input');
  //   selects.forEach(select => select.value = '');
  //   inputs.forEach(input => input.value = '');
  // }
}

function updateMaterialCost(selectElement) {
  const materialId = selectElement.value;
  const material = materials.find(m => m.id == materialId);
  const item = selectElement.closest('tr');
  const costInput = item.querySelector('input[name$="material-cost[]"]');
  const quantityInput = item.querySelector('input[name$="material-quantity[]"]');

  if (material && costInput && quantityInput) {
    costInput.value = material.unit_cost;
    updateMaterialSubtotal(quantityInput);
  } else if (costInput && quantityInput) {
    costInput.value = '';
    updateMaterialSubtotal(quantityInput);
  }
}

function updateMaterialSubtotal(quantityInput) {
  const item = quantityInput.closest('tr');
  const costInput = item.querySelector('input[name$="material-cost[]"]');
  const subtotalInput = item.querySelector('input[name$="material-subtotal[]"]');

  if (costInput && subtotalInput) {
    const subtotal = parseFloat(costInput.value || 0) * parseFloat(quantityInput.value || 0);
    subtotalInput.value = subtotal.toFixed(2);
    // Store subtotal for later calculation
    item.dataset.subtotal = subtotal;
    updateCostSummary();
  }
}

function parsePaperSizeFromMaterial(material) {
  if (!material || !material.name) return null;
  const name = material.name.toString().toUpperCase();
  const match = name.match(/\b(A[1-6]|B\d+)\b/);
  if (match) return match[1];
  if (name.includes('A1')) return 'A1';
  if (name.includes('A2')) return 'A2';
  if (name.includes('A3')) return 'A3';
  if (name.includes('A4')) return 'A4';
  if (name.includes('A5')) return 'A5';
  if (name.includes('A6')) return 'A6';
  return null;
}

function updatePaperMaterialSelection(selectElement) {
  const material = materials.find(m => m.id == selectElement.value);
  if (!material) return;
  const size = parsePaperSizeFromMaterial(material);
  if (size && jobPageSize) {
    jobPageSize.value = size;
    updatePlateSummary();
  }
}

function updateMachineCost(selectElement) {
  const machineId = selectElement.value;
  const machine = machines.find(m => m.id == machineId);
  const item = selectElement.closest('.machine-item');
  const setupPercentInput = item.querySelector('input[name="machine-setup-percent[]"]');
  const runningInput = item.querySelector('input[name="machine-running[]"]');
  const impressionsInput = item.querySelector('input[name="machine-impressions[]"]');

  if (machine && setupPercentInput && runningInput && impressionsInput) {
    // Setup percent is editable, default to 10%
    if (!setupPercentInput.value) setupPercentInput.value = '10';
    runningInput.value = machine.cost_per_impression;
    updateMachineSubtotal(impressionsInput);
  } else if (setupPercentInput && runningInput && impressionsInput) {
    setupPercentInput.value = '10';
    runningInput.value = '';
    updateMachineSubtotal(impressionsInput);
  }
}

function updateMachineSubtotal(impressionsInput) {
  const item = impressionsInput.closest('.machine-item');
  const setupPercentInput = item.querySelector('input[name="machine-setup-percent[]"]');
  const runningInput = item.querySelector('input[name="machine-running[]"]');
  const subtotalInput = item.querySelector('input[name="machine-subtotal[]"]');

  if (setupPercentInput && runningInput && subtotalInput) {
    const runningCost = parseFloat(runningInput.value || 0) * parseFloat(impressionsInput.value || 0);
    const setupPercent = parseFloat(setupPercentInput.value || 0);
    const setupCost = runningCost * (setupPercent / 100);
    const subtotal = setupCost + runningCost;
    subtotalInput.value = subtotal.toFixed(2);
    item.dataset.subtotal = subtotal;
    updateCostSummary();
  }
}

function updateProcessCost(selectElement) {
  const processId = selectElement.value;
  const process = specialProcesses.find(p => p.id == processId);
  const row = selectElement.closest('.process-row');
  const rateInput = row.querySelector('input[name="process-rate[]"]');
  const quantityInput = row.querySelector('input[name="process-quantity[]"]');

  if (process && rateInput && quantityInput) {
    rateInput.value = process.rate_per_unit;
    updateProcessSubtotal(quantityInput);
  } else if (rateInput && quantityInput) {
    rateInput.value = '';
    updateProcessSubtotal(quantityInput);
  }
}

function updateProcessSubtotal(quantityInput) {
  const row = quantityInput.closest('.process-row');
  const rateInput = row.querySelector('input[name="process-rate[]"]');
  const subtotalInput = row.querySelector('input[name="process-subtotal[]"]');

  if (rateInput && subtotalInput) {
    const subtotal = parseFloat(rateInput.value || 0) * parseFloat(quantityInput.value || 0);
    subtotalInput.value = subtotal.toFixed(2);
    row.dataset.subtotal = subtotal;
    updateCostSummary();
  }
}

function updateDesignSubtotal() {
  const pages = parseFloat(document.getElementById('design-pages').value || 0);
  const rate = parseFloat(document.getElementById('design-rate').value || 0);
  const subtotal = pages * rate;
  document.getElementById('design-subtotal').value = subtotal.toFixed(2);
  updateCostSummary();
}

function updateTypesettingSubtotal() {
  const pages = parseFloat(document.getElementById('typesetting-pages').value || 0);
  const rate = parseFloat(document.getElementById('typesetting-rate').value || 0);
  const subtotal = pages * rate;
  document.getElementById('typesetting-subtotal').value = subtotal.toFixed(2);
  updateCostSummary();
}

function updateCostSummary() {
  // Calculate material costs
  const materialItems = document.querySelectorAll('.material-item');
  let materialTotal = 0;
  materialItems.forEach(item => {
    const subtotalInput = item.querySelector('input[name="material-subtotal[]"]');
    if (subtotalInput) {
      materialTotal += parseFloat(subtotalInput.value || 0);
    }
  });
  document.getElementById('materials-total').textContent = materialTotal.toFixed(2);

  // Calculate plates costs
  const a1Qty = parseInt(platesA1?.value || 0);
  const a2Qty = parseInt(platesA2?.value || 0);
  const a3Qty = parseInt(platesA3?.value || 0);
  
  const a1Cost = parseFloat(platesA1Cost?.value || 0);
  const a2Cost = parseFloat(platesA2Cost?.value || 0);
  const a3Cost = parseFloat(platesA3Cost?.value || 0);
  
  const platesTotal = (a1Qty * a1Cost) + (a2Qty * a2Cost) + (a3Qty * a3Cost);
  document.getElementById('plates-total').textContent = platesTotal.toFixed(2);

  // Calculate machine costs
  const machineItems = document.querySelectorAll('.machine-item');
  let machineTotal = 0;
  machineItems.forEach(item => {
    const subtotalInput = item.querySelector('input[name="machine-subtotal[]"]');
    if (subtotalInput) {
      machineTotal += parseFloat(subtotalInput.value || 0);
    }
  });
  document.getElementById('machines-total').textContent = machineTotal.toFixed(2);

  // Calculate process costs
  const processTotal = parseFloat(specialProcessesTotal?.value || 0);
  document.getElementById('processes-total').textContent = processTotal.toFixed(2);

  // Calculate binding costs
  let bindingSubtotal = 0;
  document.querySelectorAll('input[name="binding-selected[]"]:checked').forEach(checkbox => {
    const costInput = checkbox.closest('.binding-item').querySelector('input[name="binding-cost[]"]');
    if (costInput) {
      bindingSubtotal += parseFloat(costInput.value || 0);
    }
  });
  const bindingOtherCost = parseFloat(document.getElementById('binding-other-cost')?.value || 0);
  bindingSubtotal += bindingOtherCost;
  document.getElementById('binding-total').textContent = bindingSubtotal.toFixed(2);

  // Calculate additional costs
  const designSubtotalInput = document.getElementById('design-subtotal');
  const typesettingSubtotalInput = document.getElementById('typesetting-subtotal');
  const wastagePercentInput = document.getElementById('wastage-percent');
  const subcontractCostInput = document.getElementById('subcontract-cost');
  const storagePercentInput = document.getElementById('storage-percent');
  const transportPercentInput = document.getElementById('transport-percent');
  const overheadPercentInput = document.getElementById('overhead-percent');
  const wastageCostInput = document.getElementById('wastage-cost');
  const storageCostInput = document.getElementById('storage-cost');
  const transportCostInput = document.getElementById('transport-cost');
  const overheadCostInput = document.getElementById('overhead-cost');

  const designSubtotal = designSubtotalInput ? parseFloat(designSubtotalInput.value || 0) : 0;
  const typesettingSubtotal = typesettingSubtotalInput ? parseFloat(typesettingSubtotalInput.value || 0) : 0;
  const subcontractCost = subcontractCostInput ? parseFloat(subcontractCostInput.value || 0) : 0;
  const baseCost = materialTotal + platesTotal + machineTotal + processTotal + bindingSubtotal + designSubtotal + typesettingSubtotal + subcontractCost;

  const wastagePercent = wastagePercentInput ? parseFloat(wastagePercentInput.value || 0) : 0;
  const storagePercent = storagePercentInput ? parseFloat(storagePercentInput.value || 0) : 0;
  const transportPercent = transportPercentInput ? parseFloat(transportPercentInput.value || 0) : 0;
  const overheadPercent = overheadPercentInput ? parseFloat(overheadPercentInput.value || 0) : 0;

  const wastageCost = baseCost * wastagePercent / 100;
  const storageCost = baseCost * storagePercent / 100;
  const transportCost = baseCost * transportPercent / 100;
  const overheadCost = baseCost * overheadPercent / 100;

  if (wastageCostInput) wastageCostInput.value = wastageCost.toFixed(2);
  if (storageCostInput) storageCostInput.value = storageCost.toFixed(2);
  if (transportCostInput) transportCostInput.value = transportCost.toFixed(2);
  if (overheadCostInput) overheadCostInput.value = overheadCost.toFixed(2);

  const additionalTotal = designSubtotal + typesettingSubtotal + wastageCost + subcontractCost + storageCost + transportCost + overheadCost;
  if (designSubtotalInput) designSubtotalInput.value = designSubtotal.toFixed(2);
  if (typesettingSubtotalInput) typesettingSubtotalInput.value = typesettingSubtotal.toFixed(2);
  document.getElementById('design-total').textContent = designSubtotal.toFixed(2);
  document.getElementById('typesetting-total').textContent = typesettingSubtotal.toFixed(2);
  document.getElementById('wastage-total').textContent = wastageCost.toFixed(2);
  document.getElementById('subcontract-total').textContent = subcontractCost.toFixed(2);
  document.getElementById('storage-total').textContent = storageCost.toFixed(2);
  document.getElementById('transport-total').textContent = transportCost.toFixed(2);
  document.getElementById('overhead-total').textContent = overheadCost.toFixed(2);

  // Calculate grand total
  const grandTotal = materialTotal + platesTotal + machineTotal + processTotal + bindingSubtotal + additionalTotal;
  document.getElementById('grand-total').textContent = grandTotal.toFixed(2);

  // Calculate VAT (18%)
  const vatAmount = grandTotal * 0.18;
  document.getElementById('vat-amount').textContent = vatAmount.toFixed(2);

  // Calculate with margin
  const marginTierId = document.getElementById('margin-tier').value;
  const marginTier = marginTiers.find(t => t.id == marginTierId);
  let marginAmount = 0;
  if (marginTier) {
    marginAmount = grandTotal * (marginTier.margin_percentage / 100);
    document.getElementById('margin-amount').textContent = marginAmount.toFixed(2);
  } else {
    document.getElementById('margin-amount').textContent = '0.00';
  }

  // Calculate final total
  const finalTotal = grandTotal + vatAmount + marginAmount;
  document.getElementById('final-total').textContent = finalTotal.toFixed(2);
}

function getPaperSizeOrdinal(size) {
  const normalized = (size || '').toUpperCase();
  const map = { A1: 1, A2: 2, A3: 3, A4: 4, A5: 5, A6: 6 };
  return map[normalized] || null;
}

function getPagesPerSide(stockSize, targetSize) {
  const stockOrdinal = getPaperSizeOrdinal(stockSize);
  const targetOrdinal = getPaperSizeOrdinal(targetSize);

  if (!stockOrdinal || !targetOrdinal || targetOrdinal < stockOrdinal) {
    return 0;
  }

  return Math.pow(2, targetOrdinal - stockOrdinal);
}

function calculatePlateRequirements(pagesPerCopy, targetSize) {
  const plateSizes = ['A1', 'A2', 'A3'];
  let remainingPages = pagesPerCopy;
  const plates = { A1: 0, A2: 0, A3: 0 };

  for (const plateSize of plateSizes) {
    const pagesPerSide = getPagesPerSide('A1', plateSize);
    const targetPagesPerSide = getPagesPerSide(plateSize, targetSize);
    const capacity = targetPagesPerSide;
    const availableStock = plateStock[plateSize] || 0;

    if (!capacity || availableStock <= 0) {
      continue;
    }

    const maxPlates = Math.min(availableStock, Math.floor(remainingPages / capacity));
    if (maxPlates > 0) {
      plates[plateSize] += maxPlates;
      remainingPages -= maxPlates * capacity;
    }
  }

  if (remainingPages > 0) {
    // Find the smallest plate that can fit the remaining pages and has stock
    const fallbackSize = plateSizes.find(size => {
      const targetPagesPerSide = getPagesPerSide(size, targetSize);
      return targetPagesPerSide >= remainingPages && (plateStock[size] || 0) > 0;
    });
    if (fallbackSize) {
      plates[fallbackSize] += 1;
    } else {
      // No suitable plate with stock, use the largest available
      const largestAvailable = plateSizes.find(size => (plateStock[size] || 0) > 0);
      if (largestAvailable) {
        plates[largestAvailable] += Math.ceil(remainingPages / getPagesPerSide(largestAvailable, targetSize));
      }
    }
  }

  const totalPlates = plates.A1 + plates.A2 + plates.A3;
  const stockSheets = Math.ceil(pagesPerCopy / (getPagesPerSide('A1', targetSize) * 2 || 1));

  return { plates, totalPlates, stockSheets };
}

function updatePlateSummary() {
  const pageSize = jobPageSize?.value;
  const pagesPerCopy = parseInt(jobPagesPerCopy?.value || '0', 10);

  if (!pageSize || !pagesPerCopy || pagesPerCopy <= 0) {
    document.getElementById('stock-sheets-total').textContent = '0';
    if (platesA1) platesA1.value = '0';
    if (platesA2) platesA2.value = '0';
    if (platesA3) platesA3.value = '0';
    updatePlatesCostSummary();
    updateCostSummary();
    return;
  }

  const { plates, totalPlates, stockSheets } = calculatePlateRequirements(pagesPerCopy, pageSize);
  document.getElementById('stock-sheets-total').textContent = stockSheets.toString();
  if (platesA1) platesA1.value = plates.A1;
  if (platesA2) platesA2.value = plates.A2;
  if (platesA3) platesA3.value = plates.A3;
  updatePlatesCostSummary();
  updateCostSummary();
}

function updatePlatesCostSummary() {
  const a1Qty = parseInt(platesA1?.value || 0);
  const a2Qty = parseInt(platesA2?.value || 0);
  const a3Qty = parseInt(platesA3?.value || 0);
  
  const a1Cost = parseFloat(platesA1Cost?.value || 0);
  const a2Cost = parseFloat(platesA2Cost?.value || 0);
  const a3Cost = parseFloat(platesA3Cost?.value || 0);
  
  const a1Subtotal = a1Qty * a1Cost;
  const a2Subtotal = a2Qty * a2Cost;
  const a3Subtotal = a3Qty * a3Cost;
  
  document.getElementById('plates-a1-subtotal').value = a1Subtotal.toFixed(2);
  document.getElementById('plates-a2-subtotal').value = a2Subtotal.toFixed(2);
  document.getElementById('plates-a3-subtotal').value = a3Subtotal.toFixed(2);
  
  const platesTotal = a1Subtotal + a2Subtotal + a3Subtotal;
  document.getElementById('plates-total').textContent = platesTotal.toFixed(2);
}

function collectCostingData() {
  const formData = new FormData(comprehensiveForm);

  // Collect materials
  const materials = [];
  const materialIds = formData.getAll('material-id[]');
  const materialQuantities = formData.getAll('material-quantity[]');
  const materialCosts = formData.getAll('material-cost[]');

  materialIds.forEach((id, index) => {
    const quantity = parseFloat(materialQuantities[index] || 0);
    const unitCost = parseFloat(materialCosts[index] || 0);
    if (id && quantity > 0) {
      materials.push({
        material_id: parseInt(id),
        quantity,
        unit_cost: unitCost
      });
    }
  });

  // Collect machines
  const machines = [];
  const machineIds = formData.getAll('machine-id[]');
  const machineImpressions = formData.getAll('machine-impressions[]');
  const machineSetups = formData.getAll('machine-setup[]');
  const machineRunnings = formData.getAll('machine-running[]');

  machineIds.forEach((id, index) => {
    const impressions = parseInt(machineImpressions[index] || 0);
    const costPerImpression = parseFloat(machineRunnings[index] || 0);
    if (id && impressions > 0 && !Number.isNaN(costPerImpression)) {
      machines.push({
        machine_id: parseInt(id),
        impressions,
        setup_cost: parseFloat(machineSetups[index] || 0),
        cost_per_impression: costPerImpression
      });
    }
  });

  // Collect processes (now just the total)
  const processes = []; // Empty array since we use total now

  const pageSize = formData.get('job-page-size');
  const pagesPerCopy = parseInt(formData.get('job-pages-per-copy') || 0);
  const plateResults = calculatePlateRequirements(pagesPerCopy, pageSize);

  // Collect plate costs
  const platesA1Qty = parseInt(document.getElementById('plates-a1-qty')?.value || 0);
  const platesA2Qty = parseInt(document.getElementById('plates-a2-qty')?.value || 0);
  const platesA3Qty = parseInt(document.getElementById('plates-a3-qty')?.value || 0);
  const platesA1UnitCost = parseFloat(document.getElementById('plates-a1-cost')?.value || 0);
  const platesA2UnitCost = parseFloat(document.getElementById('plates-a2-cost')?.value || 0);
  const platesA3UnitCost = parseFloat(document.getElementById('plates-a3-cost')?.value || 0);

  return {
    client: {
      name: formData.get('client-name'),
      type: formData.get('client-type'),
      address: formData.get('client-address'),
      contact: formData.get('client-contact'),
      email: formData.get('client-email'),
      margin_tier_id: parseInt(formData.get('margin-tier') || 0)
    },
    job: {
      name: formData.get('job-name'),
      description: formData.get('job-description'),
      quantity: parseInt(formData.get('job-quantity') || 0),
      page_size: pageSize,
      pages_per_copy: pagesPerCopy,
      stock_sheets: plateResults.stockSheets,
      plates_a1: plateResults.plates.A1,
      plates_a2: plateResults.plates.A2,
      plates_a3: plateResults.plates.A3
    },
    materials,
    plates: [
      { size: 'A1', quantity: platesA1Qty, unit_cost: platesA1UnitCost },
      { size: 'A2', quantity: platesA2Qty, unit_cost: platesA2UnitCost },
      { size: 'A3', quantity: platesA3Qty, unit_cost: platesA3UnitCost }
    ],
    machines,
    processes,
    binding: {
      bindings: Array.from(document.querySelectorAll('input[name="binding-selected[]"]:checked')).map(checkbox => {
        const bindingId = checkbox.value;
        const costInput = checkbox.closest('.binding-item').querySelector('input[name="binding-cost[]"]');
        return {
          binding_id: parseInt(bindingId),
          cost: parseFloat(costInput?.value || 0)
        };
      })
    },
    additional_costs: {
      design_pages: parseFloat(formData.get('design-pages') || 0),
      design_rate: parseFloat(formData.get('design-rate') || 0),
      typesetting_pages: parseFloat(formData.get('typesetting-pages') || 0),
      typesetting_rate: parseFloat(formData.get('typesetting-rate') || 0),
      wastage_percent: parseFloat(formData.get('wastage-percent') || 0),
      wastage_cost: parseFloat(formData.get('wastage-cost') || 0),
      subcontract_description: formData.get('subcontract-description') || '',
      subcontract_cost: parseFloat(formData.get('subcontract-cost') || 0),
      storage_percent: parseFloat(formData.get('storage-percent') || 0),
      storage_cost: parseFloat(formData.get('storage-cost') || 0),
      transport_percent: parseFloat(formData.get('transport-percent') || 0),
      transport_cost: parseFloat(formData.get('transport-cost') || 0),
      overhead_percent: parseFloat(formData.get('overhead-percent') || 0),
      overhead_cost: parseFloat(formData.get('overhead-cost') || 0),
      special_processes_total: parseFloat(specialProcessesTotal?.value || 0)
    }
  };
}

function openBindingCalculator(bindingId) {
  const binding = bindings.find(b => b.id == bindingId);
  if (!binding) return;

  // Find the binding item row
  currentBindingRow = document.querySelector(`input[data-binding-id="${bindingId}"]`).closest('.binding-item');
  
  // Set default values from binding
  bindingCalcRate.value = binding.rate_per_copy || 0;
  bindingCalcCopies.value = '1';
  bindingCalcSetup.value = '0';
  bindingCalcResult.value = '';
  
  // Open the modal
  bindingCalculatorModal.style.display = 'block';
}

function resetBindingCalculatorModal() {
  bindingCalcCopies.value = '1';
  bindingCalcRate.value = '';
  bindingCalcSetup.value = '0';
  bindingCalcResult.value = '';
  currentBindingRow = null;
}

function openSpecialProcessesCalculator() {
  // For now, just a placeholder - could open a modal with process selection
  const currentValue = parseFloat(specialProcessesTotal?.value || 0);
  const newValue = prompt('Enter total special processes cost:', currentValue);
  if (newValue !== null && !isNaN(parseFloat(newValue))) {
    specialProcessesTotal.value = parseFloat(newValue);
    updateCostSummary();
  }
}

function openSpecialProcessCalculator(processId) {
  const process = specialProcesses.find(p => p.id == processId);
  if (!process) return;

  // Find the special process item row
  currentSpecialProcessRow = document.querySelector(`input[data-process-id="${processId}"]`).closest('.special-process-item');
  
  // Set default values from process
  spCalcRate.value = process.rate_per_unit || 0;
  spCalcQuantity.value = '1';
  spCalcResult.value = '';
  
  // Open the modal
  specialProcessesCalculatorModal.style.display = 'block';
}

function resetSpecialProcessesCalculatorModal() {
  spCalcQuantity.value = '1';
  spCalcRate.value = '';
  spCalcResult.value = '';
  currentSpecialProcessRow = null;
}

function updateSpecialProcessesTotal() {
  const processItems = document.querySelectorAll('input[name="special-process-cost[]"]');
  let total = 0;
  processItems.forEach(item => {
    total += parseFloat(item.value || 0);
  });
  const otherProcessCost = parseFloat(document.getElementById('special-process-other-cost')?.value || 0);
  total += otherProcessCost;
  specialProcessesTotal.value = total.toFixed(2);
  updateCostSummary();
}

function openCalculatorModal(button) {
  currentCalculatorRow = button.closest('.process-row');
  if (currentCalculatorRow) {
    const rateInput = currentCalculatorRow.querySelector('input[name="process-rate[]"]');
    if (rateInput && rateInput.value) {
      calcBaseRate.value = rateInput.value;
    } else {
      calcBaseRate.value = '';
    }
    calcMultiplier.value = '1';
    calcAdditionalCost.value = '0';
    calcResult.value = '';
    calculatorModal.style.display = 'block';
  }
}

function resetCalculatorModal() {
  calcBaseRate.value = '';
  calcMultiplier.value = '1';
  calcAdditionalCost.value = '0';
  calcResult.value = '';
  currentCalculatorRow = null;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app');
  showSection(homeSection);
  setActiveNav(navHomeBtn);
  displayJobSummary();
  
  // Initialize wizard
  console.log('Initializing wizard, currentWizardStep:', currentWizardStep);
  updateWizardNavigation();
});