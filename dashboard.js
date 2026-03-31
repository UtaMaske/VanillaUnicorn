import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cloiwnjtyrmnoeoqhvag.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2l3bmp0eXJtbm9lb3FodmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTMzMTIsImV4cCI6MjA4ODcyOTMxMn0.JGZOGytcTj0keyoANSSkqm8wGnFL3EOmsg1MqFpi8Es'; 
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DOM Elemente
const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');
const totalSalesAll = document.getElementById('total-sales-all');
const totalTipsAll = document.getElementById('total-tips-all');
const totalTipPool = document.getElementById('total-tip-pool');
const totalStaffTipShare = document.getElementById('total-staff-tip-share');
const totalBossTipShare = document.getElementById('total-boss-tip-share');
const labelBossTipShare = document.getElementById('label-boss-tip-share');
const cardTotalTips = document.getElementById('card-total-tips');
const cardTipPool = document.getElementById('card-tip-pool');
const cardStaffTipShare = document.getElementById('card-staff-tip-share');
const cardBossTipShare = document.getElementById('card-boss-tip-share');
const userRole = document.getElementById('user-role');
const navCompanySettings = document.getElementById('nav-company-settings');


const employeeStatsBodyLive = document.getElementById('employee-stats-body-live');
const allTransactionsBodyLive = document.getElementById('all-transactions-body-live');
const hourlyStatsBody = document.getElementById('hourly-stats-body');

const vouchersBody = document.getElementById('vouchers-body');
const btnCreateVoucher = document.getElementById('btn-create-voucher');
const productsBody = document.getElementById('products-body');
const btnCreateProduct = document.getElementById('btn-create-product');
const pCategorySelect = document.getElementById('p-category');
const pSubcatGroup = document.getElementById('p-subcat-group');
const tipPayoutsBody = document.getElementById('tip-payouts-body');

const statsDateInput = document.getElementById('stats-date');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Globale Variablen
let hourlyChart = null;
let productCharts = []; 
let activeProductCat = 'Trinken'; 
let currentUserProfile = null; 
let lastSelectedDate = null; // Speichert das letzte ausgewählte Datum 
let companySettings = {
    tip_distribution: 'Aufteilen',
    owner_tip_mode: 'none',
    owner_tip_fixed_percent: 0,
    owner_tip_multiplier: 1,
    vouchers_enabled: true,
    payment_default: 'Bar',
    payment_enforced: false,
    category_essen_enabled: true,
    category_trinken_enabled: true,
    category_privat_enabled: true,
    category_tuer_enabled: true
};
const buttonFeedbackTimeouts = new Map();

// --- HILFSFUNKTIONEN ---
function formatPrice(val) {
    const num = parseFloat(val) || 0;
    // Immer ohne Nachkommastellen anzeigen
    return Math.round(num) + '$';
}

function clampNumber(value, min, max, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function flashButtonFeedback(button, state, duration = 1000) {
    if (!button) return;
    button.classList.remove('btn-feedback-success', 'btn-feedback-error');
    button.classList.add(state === 'success' ? 'btn-feedback-success' : 'btn-feedback-error');

    if (buttonFeedbackTimeouts.has(button)) clearTimeout(buttonFeedbackTimeouts.get(button));
    const timeout = setTimeout(() => {
        button.classList.remove('btn-feedback-success', 'btn-feedback-error');
        buttonFeedbackTimeouts.delete(button);
    }, duration);
    buttonFeedbackTimeouts.set(button, timeout);
}

function shortenEmail(email) {
    if (!email || !email.includes('@')) return email || 'Unbekannt';
    let name = email.split('@')[0];
    return name.split('.').map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
}

function isOwnerPosition(position) {
    return String(position || '').trim().toLowerCase() === 'inhaber';
}

function isDoorStaffPosition(position) {
    return String(position || '').trim().toLowerCase() === 'türsteher*in';
}

function getAllowedProductStatsCategories(profile) {
    if (isDoorStaffPosition(profile?.position)) {
        return companySettings.category_tuer_enabled ? ['Tür'] : [];
    }

    const categories = [];
    if (companySettings.category_trinken_enabled) categories.push('Trinken');
    if (companySettings.category_essen_enabled) categories.push('Essen');
    if (companySettings.category_privat_enabled) categories.push('Privat');
    if (isOwnerPosition(profile?.position) && companySettings.category_tuer_enabled) categories.push('Tür');
    categories.push('Tänzer*innen');
    return categories;
}

function applyProductStatsRoleVisibility(profile) {
    const allowedCategories = new Set(getAllowedProductStatsCategories(profile));
    const isDoorStaff = isDoorStaffPosition(profile?.position);
    const isOwner = isOwnerPosition(profile?.position);
    const buttons = Array.from(document.querySelectorAll('.prod-cat-btn'));

    buttons.forEach(btn => {
        const cat = btn.dataset.cat;
        const isVisible = cat === 'all' ? !isDoorStaff : allowedCategories.has(cat);
        btn.style.display = isVisible ? '' : 'none';
        if (!isVisible) btn.classList.remove('active');
    });

    let fallbackCategory = activeProductCat;
    if (isOwner) fallbackCategory = 'all';
    if (fallbackCategory !== 'all' && !allowedCategories.has(fallbackCategory)) {
        fallbackCategory = allowedCategories.has('Trinken') ? 'Trinken' : (Array.from(allowedCategories)[0] || 'all');
    }
    if (fallbackCategory === 'all' && isDoorStaff) {
        fallbackCategory = 'Tür';
    }

    const activeButton = buttons.find(btn => btn.dataset.cat === fallbackCategory && btn.style.display !== 'none');
    if (activeButton) {
        buttons.forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
        activeProductCat = fallbackCategory;
    }
}

function getBusinessDate(dateInput) {
    const d = new Date(dateInput);
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('de-DE');
}

function applyDashboardRoleVisibility(profile) {
    const isOwner = isOwnerPosition(profile?.position);
    const ownerTabIds = ['tab-produkte', 'tab-tip-payouts'];

    ownerTabIds.forEach(tabId => {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (tabBtn) tabBtn.style.display = isOwner ? '' : 'none';
        const tabContent = document.getElementById(tabId);
        if (tabContent) tabContent.style.display = isOwner ? '' : 'none';
    });

    const vouchersTabBtn = document.querySelector('.tab-btn[data-tab="tab-vouchers"]');
    const vouchersTabContent = document.getElementById('tab-vouchers');
    const vouchersVisible = isOwner && companySettings.vouchers_enabled;
    if (vouchersTabBtn) vouchersTabBtn.style.display = vouchersVisible ? '' : 'none';
    if (vouchersTabContent) vouchersTabContent.style.display = vouchersVisible ? '' : 'none';

    if (!isOwner) {
        const activeBtn = document.querySelector('.tab-btn.active');
        if (activeBtn && [...ownerTabIds, 'tab-vouchers'].includes(activeBtn.dataset.tab)) {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            const defaultBtn = document.querySelector('.tab-btn[data-tab="tab-statistik"]');
            const defaultTab = document.getElementById('tab-statistik');
            if (defaultBtn) defaultBtn.classList.add('active');
            if (defaultTab) defaultTab.classList.add('active');
        }
    }

    if (isOwner) {
        const activeBtn = document.querySelector('.tab-btn.active');
        if (activeBtn && activeBtn.dataset.tab === 'tab-vouchers' && !companySettings.vouchers_enabled) {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            const defaultBtn = document.querySelector('.tab-btn[data-tab="tab-statistik"]');
            const defaultTab = document.getElementById('tab-statistik');
            if (defaultBtn) defaultBtn.classList.add('active');
            if (defaultTab) defaultTab.classList.add('active');
        }
    }

    applyProductStatsRoleVisibility(profile);
}

function getEnabledProductCreateCategories() {
    const categories = [];
    if (companySettings.category_essen_enabled) categories.push('Essen');
    if (companySettings.category_trinken_enabled) categories.push('Trinken');
    if (companySettings.category_privat_enabled) categories.push('Privat');
    if (companySettings.category_tuer_enabled) categories.push('Tür');
    return categories;
}

function applyProductCreateCategoryVisibility() {
    if (!pCategorySelect) return;

    const enabledCategories = getEnabledProductCreateCategories();
    const previousSelection = pCategorySelect.value;
    pCategorySelect.innerHTML = '';

    if (enabledCategories.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Keine Kategorie aktiv';
        pCategorySelect.appendChild(option);
        pCategorySelect.disabled = true;
        if (btnCreateProduct) btnCreateProduct.disabled = true;
        if (pSubcatGroup) pSubcatGroup.style.display = 'none';
        return;
    }

    enabledCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        pCategorySelect.appendChild(option);
    });

    pCategorySelect.disabled = false;
    if (btnCreateProduct) btnCreateProduct.disabled = false;

    const selectedCategory = enabledCategories.includes(previousSelection) ? previousSelection : enabledCategories[0];
    pCategorySelect.value = selectedCategory;
    if (pSubcatGroup) pSubcatGroup.style.display = selectedCategory === 'Trinken' ? '' : 'none';
}

async function ensureDancerProduct(userId, email, company) {
    const { error } = await supabase.from('products').upsert([
        {
            id: userId,
            name: shortenEmail(email),
            category: 'Tänzer*innen',
            subcategory: null,
            price: 0,
            company: company || null
        }
    ], { onConflict: 'id' });

    if (error) {
        console.error('Fehler beim Anlegen in products für Tänzer*in:', error);
        return false;
    }

    return true;
}

function toIsoDateString(dateValue) {
    if (!dateValue || dateValue === 'Gesamt') return null;
    if (dateValue === 'today') return new Date().toISOString().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;

    const parts = dateValue.split('.').map(p => p.trim()).filter(Boolean);
    if (parts.length !== 3) return dateValue;

    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
}

async function loadCompanyTipDistribution(company) {
    if (!company) return 'Aufteilen';

    const storageKey = `company_settings:${company}:tip_distribution`;
    const fallbackLocal = localStorage.getItem(storageKey);

    try {
        const { data, error } = await supabase
            .from('company_settings')
            .select('tip_distribution')
            .eq('company', company)
            .maybeSingle();

        if (error) {
            console.warn('[dashboard] company_settings not available, using local fallback', error.message);
            return fallbackLocal || 'Aufteilen';
        }

        const value = data?.tip_distribution === 'Selber Behalten' ? 'Selber Behalten' : 'Aufteilen';
        localStorage.setItem(storageKey, value);
        return value;
    } catch (e) {
        console.warn('[dashboard] loadCompanyTipDistribution failed, using local fallback', e);
        return fallbackLocal || 'Aufteilen';
    }
}

function normalizeCompanySettings(raw) {
    const s = raw || {};
    const ownerTipMode = ['none', 'fixed_percent', 'equal_share', 'multiplier'].includes(s.owner_tip_mode) ? s.owner_tip_mode : 'none';
    return {
        tip_distribution: s.tip_distribution === 'Selber Behalten' ? 'Selber Behalten' : 'Aufteilen',
        owner_tip_mode: ownerTipMode,
        owner_tip_fixed_percent: clampNumber(s.owner_tip_fixed_percent, 0, 100, 0),
        owner_tip_multiplier: clampNumber(s.owner_tip_multiplier, 0, 100, 1),
        vouchers_enabled: s.vouchers_enabled !== false,
        payment_default: s.payment_default === 'Karte' ? 'Karte' : 'Bar',
        payment_enforced: s.payment_enforced === true,
        category_essen_enabled: s.category_essen_enabled !== false,
        category_trinken_enabled: s.category_trinken_enabled !== false,
        category_privat_enabled: s.category_privat_enabled !== false,
        category_tuer_enabled: s.category_tuer_enabled !== false
    };
}

async function loadCompanySettings(company) {
    if (!company) {
        companySettings = normalizeCompanySettings({});
        return companySettings;
    }

    const configKey = `company_settings:${company}:config`;
    let localConfig = null;
    try {
        localConfig = JSON.parse(localStorage.getItem(configKey) || 'null');
    } catch (_) {
        localConfig = null;
    }

    try {
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company', company)
            .maybeSingle();

        if (error) {
            companySettings = normalizeCompanySettings(localConfig || {});
            return companySettings;
        }

        companySettings = normalizeCompanySettings(data || localConfig || {});
        localStorage.setItem(configKey, JSON.stringify(companySettings));
        return companySettings;
    } catch (_) {
        companySettings = normalizeCompanySettings(localConfig || {});
        return companySettings;
    }
}

function getPayoutDateKey(displayDate) {
    if (!displayDate || displayDate === 'Gesamt') return 'all';
    return toIsoDateString(displayDate) || 'all';
}

function getTipPayoutStorageKey(company, dateKey, userId) {
    return `tip_payout:${company}:${dateKey}:${userId}`;
}

async function setTipPayoutStatus(company, dateKey, userId, paid, amount) {
    const localKey = getTipPayoutStorageKey(company, dateKey, userId);
    const localPayload = {
        paid: !!paid,
        amount: Number(amount) || 0,
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase
            .from('tip_payouts')
            .upsert([
                {
                    company,
                    date_key: dateKey,
                    user_id: userId,
                    paid: !!paid,
                    amount_snapshot: Number(amount) || 0,
                    updated_at: new Date().toISOString()
                }
            ], { onConflict: 'company,date_key,user_id' });

        if (error) {
            localStorage.setItem(localKey, JSON.stringify(localPayload));
            return;
        }
    } catch (_) {
        localStorage.setItem(localKey, JSON.stringify(localPayload));
    }
}

async function loadTipPayoutStatusMap(company, dateKey, userIds) {
    const statusMap = new Map();
    if (!company || !userIds.length) return statusMap;

    try {
        const { data, error } = await supabase
            .from('tip_payouts')
            .select('user_id,paid,amount_snapshot,updated_at')
            .eq('company', company)
            .eq('date_key', dateKey)
            .in('user_id', userIds);

        if (!error && Array.isArray(data)) {
            data.forEach(row => {
                statusMap.set(String(row.user_id), {
                    paid: !!row.paid,
                    amount_snapshot: Number(row.amount_snapshot) || 0,
                    updated_at: row.updated_at || null
                });
            });
            return statusMap;
        }
    } catch (_) {
        // fallback below
    }

    userIds.forEach(userId => {
        const raw = localStorage.getItem(getTipPayoutStorageKey(company, dateKey, userId));
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            statusMap.set(String(userId), {
                paid: !!parsed.paid,
                amount_snapshot: Number(parsed.amount) || 0,
                updated_at: parsed.updated_at || null
            });
        } catch (_) {
            // ignore broken local entry
        }
    });

    return statusMap;
}

async function renderTipPayoutTable(stats, displayDate, tipSplit) {
    if (!tipPayoutsBody) return;

    const company = currentUserProfile?.company;
    const rows = Object.entries(stats)
        .map(([id, s]) => ({ id, ...s }))
        .filter(s => !isOwnerPosition(s.position));

    const recipientCount = rows.length;
    const splitPerRecipient = recipientCount > 0 ? (tipSplit.staffShare / recipientCount) : 0;

    const computedRows = rows.map(row => {
        const ownTips = Number(row.tips) || 0;
        const computed = companySettings.tip_distribution === 'Aufteilen'
            ? splitPerRecipient
            : ownTips;
        return { ...row, tipAmount: computed };
    });

    const dateKey = getPayoutDateKey(displayDate);
    const statusMap = await loadTipPayoutStatusMap(company, dateKey, computedRows.map(r => r.id));

    tipPayoutsBody.innerHTML = '';

    computedRows.forEach(row => {
        const status = statusMap.get(String(row.id)) || { paid: false };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${shortenEmail(row.email)}</td>
            <td>${row.position || '-'}</td>
            <td>${formatPrice(row.tipAmount)}</td>
            <td><span class="status-pill ${status.paid ? 'paid' : 'pending'}">${status.paid ? 'Ausgezahlt' : 'Offen'}</span></td>
            <td><button class="tip-toggle-btn ${status.paid ? 'mark-open' : ''}" data-user-id="${row.id}" data-paid="${status.paid ? '1' : '0'}" data-amount="${row.tipAmount}">${status.paid ? 'Auf offen setzen' : 'Als ausgezahlt markieren'}</button></td>
        `;
        tipPayoutsBody.appendChild(tr);
    });

    tipPayoutsBody.querySelectorAll('.tip-toggle-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const userId = e.currentTarget.dataset.userId;
            const currentPaid = e.currentTarget.dataset.paid === '1';
            const amount = Number(e.currentTarget.dataset.amount) || 0;
            await setTipPayoutStatus(company, dateKey, userId, !currentPaid, amount);
            await loadStats(currentUserProfile, statsDateInput?.value === 'Gesamt' ? 'all' : statsDateInput?.value);
        };
    });
}

function getOwnerTipLabel() {
    return 'Abgabe an Chef';
}

function applyBossCashLabel() {
    if (!labelBossTipShare) return;
    labelBossTipShare.textContent = getOwnerTipLabel();
}

function applyTipCardsVisibility() {
    const isSplit = companySettings.tip_distribution === 'Aufteilen';

    if (cardTotalTips) cardTotalTips.style.display = isSplit ? 'none' : '';
    if (cardTipPool) cardTipPool.style.display = isSplit ? '' : 'none';
    if (cardStaffTipShare) cardStaffTipShare.style.display = isSplit ? '' : 'none';
    if (cardBossTipShare) cardBossTipShare.style.display = '';
}

function calculateTipSplit(totalTips, staffParticipantCount) {
    const tips = Math.max(0, Number(totalTips) || 0);
    const staffCount = Math.max(0, Number(staffParticipantCount) || 0);

    if (companySettings.tip_distribution === 'Selber Behalten') {
        return { pool: 0, staffShare: tips, bossShare: 0 };
    }

    let bossShare = 0;
    const mode = companySettings.owner_tip_mode || 'none';

    if (mode === 'fixed_percent') {
        const pct = clampNumber(companySettings.owner_tip_fixed_percent, 0, 100, 0);
        bossShare = tips * (pct / 100);
    } else if (mode === 'equal_share') {
        bossShare = staffCount > 0 ? (tips / (staffCount + 1)) : tips;
    } else if (mode === 'multiplier') {
        const mult = clampNumber(companySettings.owner_tip_multiplier, 0, 100, 1);
        if (staffCount <= 0 && mult > 0) bossShare = tips;
        else if (staffCount > 0) bossShare = tips * (mult / (staffCount + mult));
    }

    bossShare = Math.min(tips, Math.max(0, bossShare));
    return {
        pool: tips,
        staffShare: tips - bossShare,
        bossShare
    };
}

// --- INITIALISIERUNG ---

function init() {
    // Tab Logik
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
            if (btn.dataset.tab === 'tab-prod-stats') loadProductStats(statsDateInput ? statsDateInput.value : 'Gesamt');
        };
    });

    // Produkt-Statistik Datum-Filter entfernt - verwendet jetzt das gleiche wie Live-Statistik

    // View Toggle Logik für Live Statistik
    const btnViewChart = document.getElementById('btn-view-chart');
    const btnViewTrans = document.getElementById('btn-view-trans');
    const btnViewEmp = document.getElementById('btn-view-emp');
    const chartContainer = document.getElementById('chart-view-container');
    const transContainer = document.getElementById('trans-view-container');
    const empContainer = document.getElementById('emp-view-container');

    if (btnViewChart && btnViewTrans && btnViewEmp) {
        btnViewChart.onclick = () => {
            btnViewChart.classList.add('active');
            btnViewTrans.classList.remove('active');
            btnViewEmp.classList.remove('active');
            if (chartContainer) chartContainer.style.display = 'block';
            if (transContainer) transContainer.style.display = 'none';
            if (empContainer) empContainer.style.display = 'none';
        };
        btnViewTrans.onclick = () => {
            btnViewTrans.classList.add('active');
            btnViewChart.classList.remove('active');
            btnViewEmp.classList.remove('active');
            if (chartContainer) chartContainer.style.display = 'none';
            if (transContainer) transContainer.style.display = 'block';
            if (empContainer) empContainer.style.display = 'none';
        };
        btnViewEmp.onclick = () => {
            btnViewEmp.classList.add('active');
            btnViewChart.classList.remove('active');
            btnViewTrans.classList.remove('active');
            if (chartContainer) chartContainer.style.display = 'none';
            if (transContainer) transContainer.style.display = 'none';
            if (empContainer) empContainer.style.display = 'block';
        };
    }

    // Kauf-Statistik Filter
    document.querySelectorAll('.prod-cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.prod-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeProductCat = btn.dataset.cat;
            loadProductStats(statsDateInput ? statsDateInput.value : 'Gesamt');
        };
    });

    // Datums-Filter
    if (statsDateInput) {
        const today = getBusinessDate(new Date());
        statsDateInput.value = today;
        lastSelectedDate = today; // Initiales Datum speichern
        
        document.getElementById('btn-prev-day').onclick = () => {
            const currentValue = statsDateInput.value;
            let current;
            
            if (currentValue === 'Gesamt' && lastSelectedDate) {
                // Wenn vorher "Alle" ausgewählt war, vom letzten Datum ausgehen
                const parts = lastSelectedDate.split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                // Normales Parsing
                const parts = currentValue.split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            
            current.setDate(current.getDate() - 1);
            const newDate = current.toLocaleDateString('de-DE');
            statsDateInput.value = newDate;
            lastSelectedDate = newDate; // Neues Datum speichern
            loadStats(currentUserProfile, newDate);
            loadProductStats(newDate);
        };
        
        document.getElementById('btn-next-day').onclick = () => {
            const currentValue = statsDateInput.value;
            let current;
            
            if (currentValue === 'Gesamt' && lastSelectedDate) {
                // Wenn vorher "Alle" ausgewählt war, vom letzten Datum ausgehen
                const parts = lastSelectedDate.split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                // Normales Parsing
                const parts = currentValue.split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            
            current.setDate(current.getDate() + 1);
            const newDate = current.toLocaleDateString('de-DE');
            statsDateInput.value = newDate;
            lastSelectedDate = newDate; // Neues Datum speichern
            loadStats(currentUserProfile, newDate);
            loadProductStats(newDate);
        };
        
        document.getElementById('btn-all-days').onclick = () => {
            // Speichere das aktuelle Datum bevor zu "Gesamt" gewechselt wird
            if (statsDateInput.value !== 'Gesamt') {
                lastSelectedDate = statsDateInput.value;
            }
            statsDateInput.value = 'Gesamt';
            loadStats(currentUserProfile, 'all');
            loadProductStats('Gesamt');
        };
    }

    if (btnCreateProduct) btnCreateProduct.onclick = handleCreateProduct;
    if (pCategorySelect) {
        pCategorySelect.onchange = () => {
            if (pSubcatGroup) pSubcatGroup.style.display = pCategorySelect.value === 'Trinken' ? '' : 'none';
        };
    }
    if (btnCreateVoucher) btnCreateVoucher.onclick = handleCreateVoucher;
    if (btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = 'Index.html'; };

    checkAuthAndLoad();
}

async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'Index.html'; return; }

    const user = session.user;
    if (userDisplay) userDisplay.textContent = shortenEmail(user.email);
    
    const { data: profile } = await supabase.from('users').select('*').eq('auth_user_id', user.id).single();
    if (!profile) { window.location.href = 'Index.html'; return; }
    if (!profile.company) {
        console.error('Profil ohne company, Zugriff verweigert:', profile.id);
        window.location.href = 'Index.html';
        return;
    }

    currentUserProfile = profile;
    if (userRole) userRole.textContent = profile.position || 'Mitarbeiter';
    // show/hide storage nav button based on owner role
    try {
        const navStorageBtn = document.getElementById('nav-storage');
        const isOwner = isOwnerPosition(profile.position);
        if (navStorageBtn) navStorageBtn.style.display = isOwner ? '' : 'none';
        if (navCompanySettings) navCompanySettings.style.display = isOwner ? '' : 'none';
        if (userRole) {
            userRole.style.cursor = isOwner ? 'pointer' : 'default';
            userRole.title = isOwner ? 'Unternehmens-Einstellungen öffnen' : '';
            userRole.onclick = isOwner ? () => { window.location.href = 'company-settings.html'; } : null;
        }
    } catch (e) { console.warn('[dashboard] could not set nav-storage visibility', e); }

    companySettings = await loadCompanySettings(profile.company);
    applyBossCashLabel();
    applyTipCardsVisibility();
    applyProductCreateCategoryVisibility();

    applyDashboardRoleVisibility(profile);
    loadStats(profile);
    
    if (isOwnerPosition(profile.position)) {
        loadVouchers();
        loadProducts();
    }
}

// --- LIVE STATISTIK LADEN ---

async function loadStats(currentUserProfile, targetDate = null) {
    const company = currentUserProfile?.company;
    if (!company) return;
    const isOwner = isOwnerPosition(currentUserProfile.position);
    const { data: profiles } = await supabase.from('users').select('*').eq('company', company);
    let transactionsQuery = supabase.from('transactions').select('*').eq('company', company).order('created_at', { ascending: false });
    const { data: allTransactions, error } = await transactionsQuery;

    if (error) return;

    let displayDate = targetDate === 'all' ? 'Gesamt' : (targetDate || getBusinessDate(new Date()));
    const today = displayDate;
    const transactions = allTransactions.filter(t => isOwner || t.user_id === currentUserProfile.id);

    let todaySales = 0, todayTips = 0, todayBarSales = 0, todayCardTips = 0;
    const stats = {}, hourlyStats = {}, dailyHourlyStats = {};
    const safeProfiles = profiles || [currentUserProfile];

    safeProfiles.forEach(p => {
        if (isOwner || p.id === currentUserProfile.id) {
            stats[p.id] = { email: p.email, position: p.position, sales: 0, tips: 0, count: 0 };
        }
    });

    if (allTransactionsBodyLive) allTransactionsBodyLive.innerHTML = '';

    transactions.forEach(t => {
        const transDate = getBusinessDate(t.created_at);
        if (today === 'Gesamt' || transDate === today) {
            todaySales += t.subtotal;
            todayTips += t.tip_amount;
            if (t.payment_method === 'Bar') todayBarSales += t.subtotal;
            else if (t.payment_method === 'Karte') todayCardTips += t.tip_amount;

            const profile = safeProfiles.find(p => p.id === t.user_id || p.auth_user_id === t.user_id);
            const statsKey = profile ? profile.id : t.user_id;
            if (stats[statsKey]) {
                stats[statsKey].sales += t.subtotal;
                stats[statsKey].tips += t.tip_amount;
                stats[statsKey].count++;
            }

            const dateObj = new Date(t.created_at);
            const hourKey = `${dateObj.getHours().toString().padStart(2, '0')}:${(Math.floor(dateObj.getMinutes() / 10) * 10).toString().padStart(2, '0')}`;
            
            if (today === 'Gesamt') {
                // Bei Gesamt-Ansicht: Sammle pro Tag und Stunde
                const dayKey = transDate;
                if (!dailyHourlyStats[dayKey]) dailyHourlyStats[dayKey] = {};
                if (!dailyHourlyStats[dayKey][hourKey]) dailyHourlyStats[dayKey][hourKey] = { sales: 0, tips: 0, count: 0 };
                dailyHourlyStats[dayKey][hourKey].sales += t.subtotal;
                dailyHourlyStats[dayKey][hourKey].tips += t.tip_amount;
                dailyHourlyStats[dayKey][hourKey].count++;
            } else {
                // Bei Tages-Ansicht: Normale stündliche Aggregation
                if (!hourlyStats[hourKey]) hourlyStats[hourKey] = { sales: 0, tips: 0, count: 0 };
                hourlyStats[hourKey].sales += t.subtotal;
                hourlyStats[hourKey].tips += t.tip_amount;
                hourlyStats[hourKey].count++;
            }

            const tr = document.createElement('tr');
            const action = isOwner ? `<td><button class="delete-transaction-btn del-trans" data-id="${t.id}">🗑️</button></td>` : '<td>-</td>';
            tr.innerHTML = `<td>${dateObj.toLocaleString('de-DE')}</td>${isOwner ? `<td>${profile ? shortenEmail(profile.email) : 'Unbekannt'}</td>` : ''}<td>${formatPrice(t.subtotal)}</td><td>${formatPrice(t.tip_amount)}</td><td>${formatPrice(t.total_amount)}</td><td>${t.voucher_code || '-'}</td>${action}`;
            if (allTransactionsBodyLive) allTransactionsBodyLive.appendChild(tr);
        }
    });

    if (isOwner) {
        document.querySelectorAll('.del-trans').forEach(btn => {
            btn.onclick = async (e) => {
                if (confirm('Löschen?')) {
                    await supabase.from('transactions').delete().eq('id', e.currentTarget.dataset.id);
                    loadStats(currentUserProfile, statsDateInput.value);
                }
            };
        });
    }

    if (totalSalesAll) totalSalesAll.textContent = formatPrice(todaySales);
    if (totalTipsAll) totalTipsAll.textContent = formatPrice(todayTips);
    const staffParticipantCount = Object.values(stats).filter(s => !isOwnerPosition(s.position)).length;
    const tipSplit = calculateTipSplit(todayTips, staffParticipantCount);
    if (totalTipPool) totalTipPool.textContent = formatPrice(tipSplit.pool);
    if (totalStaffTipShare) totalStaffTipShare.textContent = formatPrice(tipSplit.staffShare);

    const abgabeAnChef = companySettings.tip_distribution === 'Selber Behalten'
        ? (todayBarSales - todayTips)
        : todayBarSales;

    if (totalBossTipShare) {
        const bossValue = abgabeAnChef;
        totalBossTipShare.textContent = formatPrice(bossValue);
        totalBossTipShare.style.color = bossValue > 0 ? '#166534' : '#6c757d';
    }

    if (employeeStatsBodyLive) {
        employeeStatsBodyLive.innerHTML = '';
        Object.values(stats).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${shortenEmail(s.email)}</td><td>${s.position}</td><td>${formatPrice(s.sales)}</td><td>${formatPrice(s.tips)}</td><td>${s.count}</td>`;
            employeeStatsBodyLive.appendChild(tr);
        });
    }

    await renderTipPayoutTable(stats, today, tipSplit);

    let chartData;
    if (today === 'Gesamt') {
        // Bei Gesamt-Ansicht: Berechne Durchschnitt und Maximum pro 10-Minuten-Intervall
        chartData = calculateAverageMaxStats(dailyHourlyStats);
    } else {
        // Bei Tages-Ansicht: Normale stündliche Daten
        const sortedHours = Object.keys(hourlyStats).sort();
        chartData = {
            labels: sortedHours,
            sales: sortedHours.map(h => hourlyStats[h].sales),
            tips: sortedHours.map(h => hourlyStats[h].tips)
        };
    }
    renderChart(chartData.labels, chartData.sales, chartData.tips, chartData.avgSales, chartData.maxSales, chartData.avgTips, chartData.maxTips, today === 'Gesamt');
}

function calculateAverageMaxStats(dailyHourlyStats) {
    // Sammle alle möglichen 10-Minuten-Intervalle
    const allHours = new Set();
    Object.values(dailyHourlyStats).forEach(dayStats => {
        Object.keys(dayStats).forEach(hour => allHours.add(hour));
    });
    
    const sortedHours = Array.from(allHours).sort();
    const avgSales = [], maxSales = [], avgTips = [], maxTips = [];
    
    sortedHours.forEach(hour => {
        let totalSales = 0, totalTips = 0, dayCount = 0, maxSalesValue = 0, maxTipsValue = 0;
        
        // Gehe durch alle Tage für diese Stunde
        Object.values(dailyHourlyStats).forEach(dayStats => {
            if (dayStats[hour]) {
                totalSales += dayStats[hour].sales;
                totalTips += dayStats[hour].tips;
                maxSalesValue = Math.max(maxSalesValue, dayStats[hour].sales);
                maxTipsValue = Math.max(maxTipsValue, dayStats[hour].tips);
                dayCount++;
            }
        });
        
        // Berechne Durchschnitt (nur wenn Daten vorhanden)
        avgSales.push(dayCount > 0 ? totalSales / dayCount : 0);
        avgTips.push(dayCount > 0 ? totalTips / dayCount : 0);
        maxSales.push(maxSalesValue);
        maxTips.push(maxTipsValue);
    });
    
    return {
        labels: sortedHours,
        sales: avgSales, // Durchschnittlicher Umsatz pro 10-Minuten-Intervall
        tips: avgTips, // Durchschnittliches Trinkgeld pro 10-Minuten-Intervall
        avgSales: avgSales,
        maxSales: maxSales,
        avgTips: avgTips,
        maxTips: maxTips
    };
}

function renderChart(labels, sales, tips, avgSales = null, maxSales = null, avgTips = null, maxTips = null, isAllDays = false) {
    const ctx = document.getElementById('hourly-sales-chart')?.getContext('2d');
    if (!ctx) return;
    if (hourlyChart) hourlyChart.destroy();

    const datasets = [];

    if (isAllDays) {
        // Bei Gesamt-Ansicht: Zeige Durchschnitt und Maximum für Umsatz und Trinkgeld
        datasets.push(
            {
                label: 'Ø Umsatz pro 10 Min',
                data: avgSales || sales,
                borderColor: '#0056b3',
                backgroundColor: 'rgba(0, 86, 179, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                borderWidth: 3
            },
            {
                label: 'Max Umsatz pro 10 Min',
                data: maxSales,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                borderWidth: 3
            },
            {
                label: 'Ø Trinkgeld pro 10 Min',
                data: avgTips || tips,
                borderColor: '#ff6b35',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
                borderDash: [8, 4],
                pointBackgroundColor: '#ff6b35',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            },
            {
                label: 'Max Trinkgeld pro 10 Min',
                data: maxTips,
                borderColor: '#6f42c1',
                backgroundColor: 'rgba(111, 66, 193, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                borderWidth: 2,
                borderDash: [8, 4],
                pointBackgroundColor: '#6f42c1',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }
        );
    } else {
        // Bei Tages-Ansicht: Normale Umsatz/Trinkgeld Diagramme
        datasets.push(
            { label: 'Umsatz', data: sales, borderColor: '#0056b3', backgroundColor: 'rgba(0, 86, 179, 0.1)', fill: true, tension: 0.4 },
            { label: 'Trinkgeld', data: tips, borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: true, tension: 0.4 }
        );
    }

    hourlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return Math.round(value) + '$';
                        }
                    }
                }
            }
        }
    });
}

// --- PRODUKT VERWALTUNG ---

async function loadProducts() {
    const company = currentUserProfile?.company;
    if (!company) return;
    let query = supabase.from('products').select('*').eq('company', company).order('category');
    const { data: products } = await query;

    if (productsBody) {
        productsBody.innerHTML = '';
        products.forEach(p => {
            const tr = document.createElement('tr');
            renderProductRowView(tr, p);
            productsBody.appendChild(tr);
        });
    }
}

function renderProductRowView(tr, p) {
    const price = Number(p.price) || 0;
    const storedEk = p.ek ?? p.EK; // handle both lowercase and uppercase column names
    const ekRaw = (storedEk !== undefined && storedEk !== null && storedEk !== '') ? Number(storedEk) : null;
    const profit = ekRaw !== null ? price - ekRaw : 0;

    tr.innerHTML = `<td>${p.name}</td><td>${p.category}</td><td>${p.subcategory || '-'}</td><td>${formatPrice(price)}</td><td>${ekRaw !== null ? formatPrice(ekRaw) : '-'}</td><td>${formatPrice(profit)}</td>
        <td><button class="edit-btn">✏️</button><button class="del-p del-btn" data-id="${p.id}">🗑️</button></td>`;
    tr.querySelector('.edit-btn').onclick = () => renderProductRowEdit(tr, p);
    tr.querySelector('.del-p').onclick = async () => {
        if (!confirm('Löschen?')) return;
        const company = currentUserProfile?.company;
        let query = supabase.from('products').delete().eq('id', p.id);
        if (company) query = query.eq('company', company);
        await query;
        // Also remove any matching storage rows for this product name/company
        try {
            if (company) {
                const { error: sErr } = await supabase.from('storage').delete().eq('name', p.name).eq('company', company);
                if (sErr) console.warn('Error deleting storage rows for product', p.name, sErr);
                else console.log('Deleted storage rows for product', p.name);
            }
        } catch (e) { console.error('Unexpected error deleting storage rows', e); }
        loadProducts();
    };
}

function renderProductRowEdit(tr, p) {
    const cats = ['Essen', 'Trinken', 'Privat', 'Tür'];
    const catOptions = cats.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>`).join('');
    const price = Number(p.price) || 0;
    const storedEk = p.ek ?? p.EK; // handle both lowercase and uppercase column names
    const ek = (storedEk !== undefined && storedEk !== null && storedEk !== '') ? Number(storedEk) : '';

    tr.innerHTML = `<td><input type="text" value="${p.name}" class="edit-name"></td><td><select class="edit-cat">${catOptions}</select></td><td>-</td><td><input type="number" step="0.01" value="${price}" class="edit-price"></td><td><input type="number" step="0.01" value="${ek}" class="edit-ek" placeholder="(optional)"></td><td>-</td>
        <td><button class="save-btn">💾</button><button class="cancel-btn">❌</button></td>`;
    tr.querySelector('.cancel-btn').onclick = () => renderProductRowView(tr, p);
    tr.querySelector('.save-btn').onclick = async () => {
        const name = tr.querySelector('.edit-name').value;
        const category = tr.querySelector('.edit-cat').value;
        let price = parseFloat(tr.querySelector('.edit-price').value);
        if (!Number.isFinite(price)) price = 0;

        const ekInput = tr.querySelector('.edit-ek').value;
        const ekParsed = parseFloat(ekInput);
        const ek = ekInput.trim() === '' ? null : (Number.isFinite(ekParsed) ? ekParsed : null);

        const updateData = { name, category, price, EK: ek };

        try {
            const company = currentUserProfile?.company;
            let query = supabase.from('products').update(updateData).eq('id', p.id).select().maybeSingle();
            if (company) query = supabase.from('products').update(updateData).eq('id', p.id).eq('company', company).select().maybeSingle();
            const { data: prodUpdated, error } = await query;
            if (error) {
                console.error('Product update failed', error);
                alert('Fehler beim Speichern: ' + (error.message || error));
                return;
            }

            console.log('Product updated result:', prodUpdated);

            // If the product belongs to Essen or Trinken, update storage rows that reference the old product name
            try {
                if (company && ['Essen', 'Trinken'].includes(category)) {
                    const newSubcat = category === 'Trinken' ? (p.subcategory || '') : null;
                    const storageUpdate = { name, category, subcategory: newSubcat };
                    const { error: sErr } = await supabase.from('storage').update(storageUpdate).eq('name', p.name).eq('company', company);
                    if (sErr) console.warn('Could not update storage rows for product edit', sErr);
                    else console.log('Updated storage rows for product edit', storageUpdate);
                }
            } catch (se) { console.error('Unexpected error updating storage rows:', se); }

        } catch (err) {
            console.error('Unexpected error while updating product', err);
            alert('Unerwarteter Fehler beim Speichern');
            return;
        }

        loadProducts();
    };
}

async function handleCreateProduct() {
    const saveButton = btnCreateProduct;
    const name = document.getElementById('p-name').value;
    const price = parseFloat(document.getElementById('p-price').value);

    const ekValue = document.getElementById('p-ek').value;
    const ekParsed = parseFloat(ekValue);
    const ek = ekValue.trim() === '' ? null : (Number.isFinite(ekParsed) ? ekParsed : null);

    const category = document.getElementById('p-category').value;
    if (!category) {
        flashButtonFeedback(saveButton, 'error');
        return;
    }
    const subcategory = category === 'Trinken' ? document.getElementById('p-subcategory').value : null;

    const insertData = { name, price, category, subcategory, company: currentUserProfile?.company || null };
    if (ek !== null) insertData.EK = ek; // match schema column name

    const { error } = await supabase.from('products').insert([insertData]);
    if (error) {
        console.error('Product create failed', error);
        flashButtonFeedback(saveButton, 'error');
        return;
    }
    flashButtonFeedback(saveButton, 'success');
    // If product is in Essen or Trinken, also create a storage entry with count=0
    try {
        if (['Essen', 'Trinken'].includes(category) && currentUserProfile?.company) {
            const storageInsert = { name, category, subcategory, count: 0, company: currentUserProfile.company, created_at: new Date().toISOString() };
            const { error: sErr } = await supabase.from('storage').insert([storageInsert]);
            if (sErr) console.warn('Could not create storage entry for product:', sErr);
            else console.log('Created storage entry for product', storageInsert);
        }
    } catch (e) {
        console.error('Unexpected error creating storage entry:', e);
    }
    loadProducts();
}

// --- GUTSCHEIN VERWALTUNG ---

async function loadVouchers() {
    const company = currentUserProfile?.company;
    if (!company) return;
    let query = supabase.from('vouchers').select('*').eq('company', company).order('created_at', { ascending: false });
    const { data: vouchers, error } = await query;
    if (vouchersBody) {
        vouchersBody.innerHTML = '';
        vouchers.forEach(v => {
            const tr = document.createElement('tr');
            renderVoucherRowView(tr, v);
            vouchersBody.appendChild(tr);
        });
    }
}

function renderVoucherRowView(tr, v) {
    const isPermanent = v.type === 'multi' || v.type === true || String(v.type).toLowerCase() === 'permanent';
    const typeStr = isPermanent ? '🔄 Permanent' : '🎫 Einmalig';
    const expiryStr = v.expiry ? new Date(v.expiry).toLocaleDateString('de-DE') : '-';
    if (v.expiry && new Date(v.expiry).setHours(23,59,59,999) < new Date()) tr.classList.add('expired-row');
    else tr.classList.remove('expired-row');

    tr.innerHTML = `<td>${v.code}</td><td>${v.discount}${v.discount_type === 'percent' ? '%' : '$'}</td><td>${typeStr}</td><td>${expiryStr}</td><td>${v.times_used || 0}</td>
        <td><button class="edit-btn">✏️</button><button class="del-v del-btn" data-code="${v.code}">🗑️</button></td>`;
    tr.querySelector('.edit-btn').onclick = () => renderVoucherRowEdit(tr, v);
    tr.querySelector('.del-v').onclick = async () => {
        if (!confirm('Löschen?')) return;
        const company = currentUserProfile?.company;
        let query = supabase.from('vouchers').delete().eq('code', v.code);
        if (company) query = query.eq('company', company);
        await query;
        loadVouchers();
    };
}

function renderVoucherRowEdit(tr, v) {
    const expiryVal = v.expiry ? new Date(v.expiry).toISOString().split('T')[0] : '';
    tr.innerHTML = `<td><input type="text" value="${v.code}" class="edit-code"></td><td><input type="number" value="${v.discount}" class="edit-val"></td><td><select class="edit-type"><option value="multi" ${v.type==='multi'?'selected':''}>Permanent</option><option value="single" ${v.type!=='multi'?'selected':''}>Einmalig</option></select></td><td><input type="date" value="${expiryVal}" class="edit-expiry"></td><td>-</td>
        <td><button class="save-btn">💾</button><button class="cancel-btn">❌</button></td>`;
    tr.querySelector('.cancel-btn').onclick = () => renderVoucherRowView(tr, v);
    tr.querySelector('.save-btn').onclick = async () => {
        const code = tr.querySelector('.edit-code').value.toUpperCase();
        const discount = parseFloat(tr.querySelector('.edit-val').value);
        const type = tr.querySelector('.edit-type').value;
        const expiry = tr.querySelector('.edit-expiry').value || null;
        const company = currentUserProfile?.company;
        let query = supabase.from('vouchers').update({ code, discount, type, expiry }).eq('code', v.code);
        if (company) query = query.eq('company', company);
        await query;
        loadVouchers();
    };
}

async function handleCreateVoucher() {
    const saveButton = btnCreateVoucher;
    const code = document.getElementById('v-code').value.toUpperCase();
    const discount = parseFloat(document.getElementById('v-discount').value);
    const discount_type = document.getElementById('v-discount-type').value;
    const type = document.getElementById('v-type').value;
    const expiry = document.getElementById('v-expiry').value || null;
    const company = currentUserProfile?.company;
    if (!company) {
        flashButtonFeedback(saveButton, 'error');
        return;
    }
    const { error } = await supabase.from('vouchers').insert([{ code, discount, discount_type, type, expiry, company, created_at: new Date().toISOString() }]);
    if (error) {
        console.error('Voucher create failed', error);
        flashButtonFeedback(saveButton, 'error');
        return;
    }
    flashButtonFeedback(saveButton, 'success');
    loadVouchers();
}

// --- PRODUKT STATISTIK (CHARTS) ---

async function loadProductStats(selectedDate = null) {
    const company = currentUserProfile?.company;
    if (!company) return;
    const allowedCategories = new Set(getAllowedProductStatsCategories(currentUserProfile));

    if (activeProductCat !== 'all' && !allowedCategories.has(activeProductCat)) {
        activeProductCat = allowedCategories.has('Trinken') ? 'Trinken' : (Array.from(allowedCategories)[0] || 'all');
    }

    let productsQuery = supabase.from('products').select('id,name,category,subcategory').eq('company', company);
    const { data: products } = await productsQuery;

    let query = supabase.from('products_sales').select('*').eq('company', company);
    const selectedIsoDate = toIsoDateString(selectedDate);
    if (selectedIsoDate) query = query.eq('date', selectedIsoDate);
    const { data: sales } = await query;

    const container = document.getElementById('product-stats-container');
    if (!container) return;
    container.innerHTML = '';
    productCharts.forEach(c => c.destroy());
    productCharts = [];

    const salesRows = sales || [];
    const productsList = products || [];
    const countByProductId = {};

    salesRows.forEach(row => {
        if (!row?.product_id) return;
        countByProductId[row.product_id] = (countByProductId[row.product_id] || 0) + (Number(row.count) || 0);
    });

    const groups = {};
    productsList.forEach(product => {
        if (!allowedCategories.has(product.category)) return;
        if (activeProductCat !== 'all' && product.category !== activeProductCat) return;
        if (!groups[product.category]) groups[product.category] = [];
        groups[product.category].push({
            name: product.name,
            count: countByProductId[product.id] || 0
        });
    });

    const order = ['Trinken', 'Essen', 'Privat', 'Tür', 'Tänzer*innen'];
    order.forEach(cat => {
        if (!groups[cat]) return;
        const div = document.createElement('div');
        div.innerHTML = `<h3>${cat}</h3><canvas id="chart-${cat}"></canvas>`;
        container.appendChild(div);
        const ctx = document.getElementById(`chart-${cat}`).getContext('2d');
        const labels = groups[cat].map(i => i.name);
        const counts = groups[cat].map(i => Number(i.count) || 0);
        productCharts.push(new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Sales', data: counts, backgroundColor: '#0056b3' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } }));
    });
}

document.addEventListener('DOMContentLoaded', init);
