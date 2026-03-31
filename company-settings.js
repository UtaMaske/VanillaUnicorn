import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cloiwnjtyrmnoeoqhvag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2l3bmp0eXJtbm9lb3FodmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTMzMTIsImV4cCI6MjA4ODcyOTMxMn0.JGZOGytcTj0keyoANSSkqm8wGnFL3EOmsg1MqFpi8Es';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const userDisplay = document.getElementById('user-display');
const userRole = document.getElementById('user-role');
const btnLogout = document.getElementById('btn-logout');
const navStorage = document.getElementById('nav-storage');

const btnViewTip = document.getElementById('btn-view-tip');
const btnViewCashdesk = document.getElementById('btn-view-cashdesk');
const btnViewStaff = document.getElementById('btn-view-staff');
const settingsViewTip = document.getElementById('settings-view-tip');
const settingsViewCashdesk = document.getElementById('settings-view-cashdesk');
const settingsViewStaff = document.getElementById('settings-view-staff');

const btnSaveTipSettings = document.getElementById('btn-save-tip-settings');
const btnSaveCashdeskSettings = document.getElementById('btn-save-cashdesk-settings');
const btnSaveStaffSettings = document.getElementById('btn-save-staff-settings');
const tipSettingsStatus = document.getElementById('tip-settings-status');
const cashdeskSettingsStatus = document.getElementById('cashdesk-settings-status');
const staffSettingsStatus = document.getElementById('staff-settings-status');
const settingVouchersEnabled = document.getElementById('setting-vouchers-enabled');
const settingPaymentDefault = document.getElementById('setting-payment-default');
const settingPaymentEnforced = document.getElementById('setting-payment-enforced');
const settingCatEssen = document.getElementById('setting-cat-essen');
const settingCatTrinken = document.getElementById('setting-cat-trinken');
const settingCatPrivat = document.getElementById('setting-cat-privat');
const settingCatTuer = document.getElementById('setting-cat-tuer');
const settingOwnerTipMode = document.getElementById('setting-owner-tip-mode');
const settingOwnerTipFixedPercent = document.getElementById('setting-owner-tip-fixed-percent');
const settingOwnerTipMultiplier = document.getElementById('setting-owner-tip-multiplier');
const ownerTipPercentGroup = document.getElementById('owner-tip-percent-group');
const ownerTipMultiplierGroup = document.getElementById('owner-tip-multiplier-group');
const ownerTipSettingsBlock = document.getElementById('owner-tip-settings-block');

const usersAdminBody = document.getElementById('users-admin-body');
const btnCreateUser = document.getElementById('btn-create-user');

let currentUserProfile = null;

const DEFAULT_COMPANY_SETTINGS = {
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

function shortenEmail(email) {
    if (!email || !email.includes('@')) return email || 'Unbekannt';
    const name = email.split('@')[0];
    return name.split('.').map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
}

function isOwnerPosition(position) {
    return String(position || '').trim().toLowerCase() === 'inhaber';
}

function clampNumber(value, min, max, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function showStatus(targetElement, message, isError = false) {
    if (!targetElement) return;
    targetElement.innerHTML = `<span class="${isError ? 'status-error' : 'status-success'}">${message}</span>`;
}

function activateSettingsView(view) {
    const views = [settingsViewTip, settingsViewCashdesk, settingsViewStaff];
    const buttons = [btnViewTip, btnViewCashdesk, btnViewStaff];

    views.forEach(v => v?.classList.remove('active'));
    buttons.forEach(b => b?.classList.remove('active'));

    if (view === 'tip') {
        settingsViewTip?.classList.add('active');
        btnViewTip?.classList.add('active');
        return;
    }

    if (view === 'cashdesk') {
        settingsViewCashdesk?.classList.add('active');
        btnViewCashdesk?.classList.add('active');
        return;
    }

    settingsViewStaff?.classList.add('active');
    btnViewStaff?.classList.add('active');
}

function applyOwnerTipModeVisibility() {
    const isSplitMode = getTipDistributionSelection() === 'Aufteilen';
    if (ownerTipSettingsBlock) ownerTipSettingsBlock.style.display = isSplitMode ? '' : 'none';

    if (!isSplitMode) {
        if (ownerTipPercentGroup) ownerTipPercentGroup.style.display = 'none';
        if (ownerTipMultiplierGroup) ownerTipMultiplierGroup.style.display = 'none';
        return;
    }

    const mode = settingOwnerTipMode?.value || 'none';
    if (ownerTipPercentGroup) ownerTipPercentGroup.style.display = mode === 'fixed_percent' ? '' : 'none';
    if (ownerTipMultiplierGroup) ownerTipMultiplierGroup.style.display = mode === 'multiplier' ? '' : 'none';
}

function getTipDistributionSelection() {
    const selected = document.querySelector('input[name="tip-distribution"]:checked');
    return selected?.value === 'Selber Behalten' ? 'Selber Behalten' : 'Aufteilen';
}

function setTipDistributionSelection(value) {
    const safeValue = value === 'Selber Behalten' ? 'Selber Behalten' : 'Aufteilen';
    const radio = document.querySelector(`input[name="tip-distribution"][value="${safeValue}"]`);
    if (radio) radio.checked = true;
}

function getCompanySettingsStorageKey(company) {
    return `company_settings:${company}:config`;
}

function parseLocalSettings(rawValue) {
    if (!rawValue) return null;
    try {
        return JSON.parse(rawValue);
    } catch (e) {
        return null;
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

function applyCompanySettingsToForm(settings) {
    const normalized = normalizeCompanySettings(settings);
    setTipDistributionSelection(normalized.tip_distribution);

    if (settingOwnerTipMode) settingOwnerTipMode.value = normalized.owner_tip_mode;
    if (settingOwnerTipFixedPercent) settingOwnerTipFixedPercent.value = String(normalized.owner_tip_fixed_percent);
    if (settingOwnerTipMultiplier) settingOwnerTipMultiplier.value = String(normalized.owner_tip_multiplier);
    applyOwnerTipModeVisibility();

    if (settingVouchersEnabled) settingVouchersEnabled.checked = normalized.vouchers_enabled;
    if (settingPaymentDefault) settingPaymentDefault.value = normalized.payment_default;
    if (settingPaymentEnforced) settingPaymentEnforced.checked = normalized.payment_enforced;
    if (settingCatEssen) settingCatEssen.checked = normalized.category_essen_enabled;
    if (settingCatTrinken) settingCatTrinken.checked = normalized.category_trinken_enabled;
    if (settingCatPrivat) settingCatPrivat.checked = normalized.category_privat_enabled;
    if (settingCatTuer) settingCatTuer.checked = normalized.category_tuer_enabled;
}

function getCompanySettingsFromForm() {
    return {
        tip_distribution: getTipDistributionSelection(),
        owner_tip_mode: settingOwnerTipMode?.value || 'none',
        owner_tip_fixed_percent: clampNumber(settingOwnerTipFixedPercent?.value, 0, 100, 0),
        owner_tip_multiplier: clampNumber(settingOwnerTipMultiplier?.value, 0, 100, 1),
        vouchers_enabled: !!settingVouchersEnabled?.checked,
        payment_default: settingPaymentDefault?.value === 'Karte' ? 'Karte' : 'Bar',
        payment_enforced: !!settingPaymentEnforced?.checked,
        category_essen_enabled: !!settingCatEssen?.checked,
        category_trinken_enabled: !!settingCatTrinken?.checked,
        category_privat_enabled: !!settingCatPrivat?.checked,
        category_tuer_enabled: !!settingCatTuer?.checked
    };
}

async function loadCompanySettings() {
    const company = currentUserProfile?.company;
    if (!company) return;

    const storageKey = getCompanySettingsStorageKey(company);
    const localConfig = parseLocalSettings(localStorage.getItem(storageKey));
    const legacyTip = localStorage.getItem(`company_settings:${company}:tip_distribution`);
    const localValue = normalizeCompanySettings({
        ...DEFAULT_COMPANY_SETTINGS,
        ...(localConfig || {}),
        ...(legacyTip ? { tip_distribution: legacyTip } : {})
    });

    try {
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company', company)
            .maybeSingle();

        if (error) {
            console.warn('[company-settings] company_settings not available, fallback to localStorage', error.message);
            applyCompanySettingsToForm(localValue);
            return;
        }

        const merged = normalizeCompanySettings({ ...DEFAULT_COMPANY_SETTINGS, ...(data || {}) });
        localStorage.setItem(storageKey, JSON.stringify(merged));
        localStorage.setItem(`company_settings:${company}:tip_distribution`, merged.tip_distribution);
        applyCompanySettingsToForm(merged);
    } catch (e) {
        console.warn('[company-settings] failed loading setting, fallback to localStorage', e);
        applyCompanySettingsToForm(localValue);
    }
}

async function saveCompanySettings() {
    const company = currentUserProfile?.company;
    if (!company) {
        showStatus(tipSettingsStatus, 'Keine Firma zugewiesen.', true);
        showStatus(cashdeskSettingsStatus, 'Keine Firma zugewiesen.', true);
        return;
    }

    const settingsFromForm = normalizeCompanySettings(getCompanySettingsFromForm());
    const storageKey = getCompanySettingsStorageKey(company);

    try {
        const { error } = await supabase
            .from('company_settings')
            .upsert([
                {
                    company,
                    ...settingsFromForm,
                    updated_at: new Date().toISOString()
                }
            ], { onConflict: 'company' });

        if (error) {
            console.warn('[company-settings] could not persist in table, fallback to localStorage', error.message);
            localStorage.setItem(storageKey, JSON.stringify(settingsFromForm));
            localStorage.setItem(`company_settings:${company}:tip_distribution`, settingsFromForm.tip_distribution);
            showStatus(tipSettingsStatus, 'Gespeichert (lokal).');
            showStatus(cashdeskSettingsStatus, 'Gespeichert (lokal).');
            return;
        }

        localStorage.setItem(storageKey, JSON.stringify(settingsFromForm));
        localStorage.setItem(`company_settings:${company}:tip_distribution`, settingsFromForm.tip_distribution);
        showStatus(tipSettingsStatus, 'Unternehmens-Einstellung gespeichert.');
        showStatus(cashdeskSettingsStatus, 'Kassen-Einstellungen gespeichert.');
    } catch (e) {
        console.error('[company-settings] save failed', e);
        localStorage.setItem(storageKey, JSON.stringify(settingsFromForm));
        localStorage.setItem(`company_settings:${company}:tip_distribution`, settingsFromForm.tip_distribution);
        showStatus(tipSettingsStatus, 'Gespeichert (lokal).');
        showStatus(cashdeskSettingsStatus, 'Gespeichert (lokal).');
    }
}

async function saveTipSettings() {
    await saveCompanySettings();
}

async function saveCashdeskSettings() {
    await saveCompanySettings();
}

async function saveStaffSettings() {
    await loadAdminUsers();
    showStatus(staffSettingsStatus, 'Mitarbeiter-Ansicht aktualisiert. Änderungen werden direkt gespeichert.');
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

async function loadAdminUsers() {
    const company = currentUserProfile?.company;
    if (!company || !usersAdminBody) return;

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('company', company)
        .order('email', { ascending: true });

    if (error) {
        console.error('[company-settings] loadAdminUsers failed', error);
        return;
    }

    usersAdminBody.innerHTML = '';
    (users || []).forEach(u => {
        const tr = document.createElement('tr');
        renderUserRowView(tr, u);
        usersAdminBody.appendChild(tr);
    });
}

function renderUserRowView(tr, u) {
    tr.innerHTML = `<td>${u.email}</td><td>${u.position}</td><td>${new Date(u.created_at).toLocaleDateString('de-DE')}</td>
        <td><button class="edit-btn">✏️</button><button class="del-u del-btn" data-id="${u.id}">🗑️</button></td>`;

    tr.querySelector('.edit-btn').onclick = () => renderUserRowEdit(tr, u);
    tr.querySelector('.del-u').onclick = async () => {
        if (!confirm('Mitarbeiter aus Firma entfernen?')) return;
        const company = currentUserProfile?.company;
        let query = supabase.from('users').update({ company: null }).eq('id', u.id);
        if (company) query = query.eq('company', company);
        const { error } = await query;
        if (error) {
            console.error('[company-settings] detach user from company failed', error);
            return;
        }
        loadAdminUsers();
    };
}

function renderUserRowEdit(tr, u) {
    tr.innerHTML = `<td><input type="text" value="${u.email}" class="edit-email"></td><td><select class="edit-pos"><option value="Mitarbeiter" ${u.position==='Mitarbeiter'?'selected':''}>Mitarbeiter</option><option value="Tänzer*in" ${u.position==='Tänzer*in'?'selected':''}>Tänzer*in</option><option value="Türsteher*in" ${u.position==='Türsteher*in'?'selected':''}>Türsteher*in</option><option value="Inhaber" ${u.position==='Inhaber'?'selected':''}>Inhaber</option></select></td><td>-</td>
        <td><button class="save-btn">💾</button><button class="cancel-btn">❌</button></td>`;

    tr.querySelector('.cancel-btn').onclick = () => renderUserRowView(tr, u);
    tr.querySelector('.save-btn').onclick = async () => {
        const email = tr.querySelector('.edit-email').value;
        const position = tr.querySelector('.edit-pos').value;
        const company = currentUserProfile?.company;

        let updateQuery = supabase.from('users').update({ email, position }).eq('id', u.id).select().maybeSingle();
        if (company) updateQuery = supabase.from('users').update({ email, position }).eq('id', u.id).eq('company', company).select().maybeSingle();

        const { error } = await updateQuery;
        if (error) {
            console.error('[company-settings] update user failed', error);
            loadAdminUsers();
            return;
        }

        if (position === 'Tänzer*in') {
            await ensureDancerProduct(u.id, email, company);
        }

        loadAdminUsers();
    };
}

async function handleCreateUser() {
    const email = String(document.getElementById('u-email').value || '').trim().toLowerCase();
    const position = document.getElementById('u-position').value;
    const company = currentUserProfile?.company;

    if (!company) {
        showStatus(staffSettingsStatus, 'Keine Firma zugewiesen.', true);
        return;
    }

    if (!email) {
        showStatus(staffSettingsStatus, 'Bitte eine E-Mail angeben.', true);
        return;
    }

    const { data: existingUserByEmail, error: existingUserError } = await supabase
        .from('users')
        .select('id,email,company')
        .eq('email', email)
        .maybeSingle();

    if (existingUserError) {
        console.error('[company-settings] lookup existing user failed', existingUserError);
        showStatus(staffSettingsStatus, 'Mitarbeiter konnte nicht geprüft werden.', true);
        return;
    }

    let managedUser = null;
    let actionLabel = 'Mitarbeiter angelegt.';

    if (existingUserByEmail) {
        const hasNoCompany = existingUserByEmail.company === null || String(existingUserByEmail.company).trim() === '';
        if (!hasNoCompany) {
            if (existingUserByEmail.company === company) {
                const { data: updatedUser, error: updateError } = await supabase
                    .from('users')
                    .update({ position })
                    .eq('id', existingUserByEmail.id)
                    .select('id,email,company')
                    .maybeSingle();

                if (updateError) {
                    console.error('[company-settings] update existing company user failed', updateError);
                    showStatus(staffSettingsStatus, 'Vorhandener Mitarbeiter konnte nicht aktualisiert werden.', true);
                    return;
                }

                if (!updatedUser) {
                    showStatus(staffSettingsStatus, 'Aktualisierung blockiert (RLS). Bitte Rechte prüfen.', true);
                    return;
                }

                managedUser = updatedUser;
                actionLabel = 'Mitarbeiter existiert bereits und wurde aktualisiert.';
            } else {
                showStatus(staffSettingsStatus, `E-Mail ist bereits einer anderen Firma zugewiesen (${existingUserByEmail.company}).`, true);
                return;
            }
        } else {
            const { data: linkedUser, error: linkError } = await supabase
                .from('users')
                .update({ company, position })
                .eq('id', existingUserByEmail.id)
                .select('id,email,company')
                .maybeSingle();

            if (linkError) {
                console.error('[company-settings] link existing user failed', linkError);
                showStatus(staffSettingsStatus, 'Vorhandener Mitarbeiter konnte nicht übernommen werden.', true);
                return;
            }

            if (!linkedUser || linkedUser.company !== company) {
                showStatus(staffSettingsStatus, 'Firma konnte nicht zugewiesen werden (RLS/Policy).', true);
                return;
            }

            managedUser = linkedUser;
            actionLabel = 'Mitarbeiter übernommen und Firma zugewiesen.';
        }
    } else {
        const { data: newUser, error } = await supabase
            .from('users')
            .insert([{ email, position, company, created_at: new Date().toISOString() }])
            .select('id,email,company')
            .single();

        if (error) {
            console.error('[company-settings] create user failed', error);
            showStatus(staffSettingsStatus, 'Mitarbeiter konnte nicht angelegt werden.', true);
            return;
        }

        managedUser = newUser;
    }

    if (position === 'Tänzer*in') {
        await ensureDancerProduct(managedUser.id, managedUser.email, company);
    }

    showStatus(staffSettingsStatus, actionLabel);
    loadAdminUsers();
}

async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'Index.html';
        return;
    }

    const user = session.user;
    if (userDisplay) userDisplay.textContent = shortenEmail(user.email);

    const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

    if (error || !profile || !profile.company) {
        window.location.href = 'Index.html';
        return;
    }

    if (!isOwnerPosition(profile.position)) {
        window.location.href = 'dashboard.html';
        return;
    }

    currentUserProfile = profile;

    if (userRole) {
        userRole.textContent = profile.position || 'Mitarbeiter';
        userRole.style.cursor = 'pointer';
        userRole.title = 'Unternehmens-Einstellungen';
        userRole.onclick = () => { window.location.href = 'company-settings.html'; };
    }

    if (navStorage) navStorage.onclick = () => { window.location.href = 'storage.html'; };

    await loadCompanySettings();
    await loadAdminUsers();
}

function init() {
    if (btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = 'Index.html'; };
    if (btnViewTip) btnViewTip.onclick = () => activateSettingsView('tip');
    if (btnViewCashdesk) btnViewCashdesk.onclick = () => activateSettingsView('cashdesk');
    if (btnViewStaff) btnViewStaff.onclick = () => activateSettingsView('staff');

    if (btnSaveTipSettings) btnSaveTipSettings.onclick = saveTipSettings;
    if (btnSaveCashdeskSettings) btnSaveCashdeskSettings.onclick = saveCashdeskSettings;
    if (btnSaveStaffSettings) btnSaveStaffSettings.onclick = saveStaffSettings;
    if (settingOwnerTipMode) settingOwnerTipMode.onchange = applyOwnerTipModeVisibility;
    document.querySelectorAll('input[name="tip-distribution"]').forEach(radio => {
        radio.onchange = applyOwnerTipModeVisibility;
    });
    if (btnCreateUser) btnCreateUser.onclick = handleCreateUser;

    activateSettingsView('tip');
    applyOwnerTipModeVisibility();
    checkAuthAndLoad();
}

document.addEventListener('DOMContentLoaded', init);
