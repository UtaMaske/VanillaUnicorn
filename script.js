import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cloiwnjtyrmnoeoqhvag.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2l3bmp0eXJtbm9lb3FodmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTMzMTIsImV4cCI6MjA4ODcyOTMxMn0.JGZOGytcTj0keyoANSSkqm8wGnFL3EOmsg1MqFpi8Es'; 
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let products = []; 
let cart = [];
let total = 0;
let tipAmount = 0;
let tipMode = 'total'; 
let appliedVoucher = null;
let currentUserProfile = null; 
let paymentMethod = 'Bar'; // Standardmäßig Barzahlung
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

// Status timers to auto-clear messages
const statusTimeouts = new Map();
function showStatus(div, html, duration = 4000) {
    if (!div) return;
    div.innerHTML = html;
    if (statusTimeouts.has(div)) clearTimeout(statusTimeouts.get(div));
    const timeout = setTimeout(() => {
        if (div) div.innerHTML = '';
        statusTimeouts.delete(div);
    }, duration);
    statusTimeouts.set(div, timeout);
}
const buttonFeedbackTimeouts = new Map();
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
let selectedPrivatProduct = null; // Trackt das aktuell gewählte Privat-Produkt

// DOM Elemente
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnToggleAuth = document.getElementById('btn-toggle-auth');
const authTitle = document.getElementById('auth-title');
const registerFields = document.getElementById('register-fields');
const registerPosition = document.getElementById('register-position');
const btnLogout = document.getElementById('btn-logout');
const loginError = document.getElementById('login-error');
const userDisplay = document.getElementById('user-display');
const userRole = document.getElementById('user-role');
const navDashboard = document.getElementById('nav-dashboard');
const navStorage = document.getElementById('nav-storage');
const navCompanySettings = document.getElementById('nav-company-settings');


const employeeModal = document.getElementById('employee-modal');
const employeeListDiv = document.getElementById('employee-list');
const btnCloseModal = document.getElementById('btn-close-modal');

const essenProdukteDiv = document.getElementById('essen-produkte');
const trinkenShotsDiv = document.getElementById('trinken-shots');
const trinkenCocktailsDiv = document.getElementById('trinken-cocktails');
const trinkenHartalkDiv = document.getElementById('trinken-hartalk');
const trinkenNonalkDiv = document.getElementById('trinken-nonalk');
const privatProdukteDiv = document.getElementById('privat-produkte');
const tuerProdukteDiv = document.getElementById('tuer-produkte');
const cartItemsUl = document.getElementById('cart-items');
const totalSpan = document.getElementById('total');
const tipInput = document.getElementById('tip-input');
const tipDisplayInfo = document.getElementById('tip-display-info');
const btnTipAmount = document.getElementById('btn-tip-amount');
const btnTipTotal = document.getElementById('btn-tip-total');
const voucherCodeInput = document.getElementById('voucher-code');
const btnApplyVoucher = document.getElementById('btn-apply-voucher');
const voucherStatusDiv = document.getElementById('voucher-status');
const checkoutStatusDiv = document.getElementById('checkout-status');
const btnCheckout = document.getElementById('btn-checkout');
const btnPayCash = document.getElementById('btn-pay-cash');
const btnPayCard = document.getElementById('btn-pay-card');
const voucherSection = document.getElementById('voucher-section');
const paymentMethodSection = document.getElementById('payment-method-section');
let authMode = 'login';

function setAuthMode(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    const inRegisterMode = authMode === 'register';

    if (authTitle) authTitle.textContent = inRegisterMode ? 'Registrierung' : 'Kassen-Login';
    if (registerFields) registerFields.style.display = inRegisterMode ? 'block' : 'none';
    if (btnLogin) btnLogin.style.display = inRegisterMode ? 'none' : '';
    if (btnRegister) btnRegister.style.display = inRegisterMode ? '' : 'none';
    if (btnToggleAuth) {
        btnToggleAuth.textContent = inRegisterMode
            ? 'Ich habe schon ein Konto'
            : 'Noch kein Konto? Registrieren';
    }

    if (loginError) loginError.textContent = '';
}

async function ensureUserProfileForAuthUser(authUserId, email, position) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPosition = String(position || 'Mitarbeiter').trim() || 'Mitarbeiter';

    const { data: existingByAuthId, error: existingByAuthIdError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

    if (existingByAuthId) {
        return { profile: existingByAuthId, error: null };
    }

    if (existingByAuthIdError) {
        console.warn('Profilsuche per auth_user_id fehlgeschlagen:', existingByAuthIdError.message);
    }

    const { data: legacyProfile, error: legacyError } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .is('auth_user_id', null)
        .maybeSingle();

    if (legacyError) {
        return { profile: null, error: legacyError };
    }

    if (legacyProfile) {
        const { data: linkedProfile, error: linkError } = await supabase
            .from('users')
            .update({
                auth_user_id: authUserId,
                position: normalizedPosition
            })
            .eq('id', legacyProfile.id)
            .select('*')
            .single();

        if (linkError) {
            return { profile: null, error: linkError };
        }

        return { profile: linkedProfile, error: null };
    }

    const profilePayload = {
        auth_user_id: authUserId,
        email: normalizedEmail,
        position: normalizedPosition,
        created_at: new Date().toISOString()
    };

    const { data: insertedProfile, error: insertError } = await supabase
        .from('users')
        .insert([profilePayload])
        .select('*')
        .single();

    if (insertError) {
        return { profile: null, error: insertError };
    }

    return { profile: insertedProfile, error: null };
}

function isOwnerPosition(position) {
    return String(position || '').trim().toLowerCase() === 'inhaber';
}

function getCompanySettingsStorageKey(company) {
    return `company_settings:${company}:config`;
}

function normalizeCompanySettings(raw) {
    const s = raw || {};
    const ownerTipMode = ['none', 'fixed_percent', 'equal_share', 'multiplier'].includes(s.owner_tip_mode) ? s.owner_tip_mode : 'none';
    return {
        tip_distribution: s.tip_distribution === 'Selber Behalten' ? 'Selber Behalten' : 'Aufteilen',
        owner_tip_mode: ownerTipMode,
        owner_tip_fixed_percent: Number.isFinite(Number(s.owner_tip_fixed_percent)) ? Math.min(100, Math.max(0, Number(s.owner_tip_fixed_percent))) : 0,
        owner_tip_multiplier: Number.isFinite(Number(s.owner_tip_multiplier)) ? Math.min(100, Math.max(0, Number(s.owner_tip_multiplier))) : 1,
        vouchers_enabled: s.vouchers_enabled !== false,
        payment_default: s.payment_default === 'Karte' ? 'Karte' : 'Bar',
        payment_enforced: s.payment_enforced === true,
        category_essen_enabled: s.category_essen_enabled !== false,
        category_trinken_enabled: s.category_trinken_enabled !== false,
        category_privat_enabled: s.category_privat_enabled !== false,
        category_tuer_enabled: s.category_tuer_enabled !== false
    };
}

function isCategoryEnabled(category) {
    if (category === 'Essen') return companySettings.category_essen_enabled;
    if (category === 'Trinken') return companySettings.category_trinken_enabled;
    if (category === 'Privat') return companySettings.category_privat_enabled;
    if (category === 'Tür') return companySettings.category_tuer_enabled;
    return true;
}

function setPaymentMethod(nextMethod) {
    paymentMethod = nextMethod === 'Karte' ? 'Karte' : 'Bar';
    btnPayCash.classList.toggle('active', paymentMethod === 'Bar');
    btnPayCard.classList.toggle('active', paymentMethod === 'Karte');
}

function applyCompanySettingsToUI() {
    if (voucherSection) voucherSection.style.display = companySettings.vouchers_enabled ? '' : 'none';
    if (!companySettings.vouchers_enabled) {
        appliedVoucher = null;
        if (voucherCodeInput) voucherCodeInput.value = '';
        if (voucherStatusDiv) voucherStatusDiv.innerHTML = '';
    }

    if (paymentMethodSection) paymentMethodSection.style.display = '';
    setPaymentMethod(companySettings.payment_default);

    if (companySettings.payment_enforced) {
        if (btnPayCash) {
            btnPayCash.disabled = true;
            btnPayCash.style.display = companySettings.payment_default === 'Bar' ? '' : 'none';
        }
        if (btnPayCard) {
            btnPayCard.disabled = true;
            btnPayCard.style.display = companySettings.payment_default === 'Karte' ? '' : 'none';
        }
    } else {
        if (btnPayCash) {
            btnPayCash.disabled = false;
            btnPayCash.style.display = '';
        }
        if (btnPayCard) {
            btnPayCard.disabled = false;
            btnPayCard.style.display = '';
        }
    }

    renderProducts();
    updateTotalsOnly();
}

async function loadCompanySettings(company) {
    if (!company) {
        companySettings = normalizeCompanySettings({});
        return;
    }

    const storageKey = getCompanySettingsStorageKey(company);
    let localConfig = null;
    try {
        localConfig = JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch (e) {
        localConfig = null;
    }

    try {
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .eq('company', company)
            .maybeSingle();

        if (error) {
            console.warn('[kasse] company_settings fallback localStorage', error.message);
            companySettings = normalizeCompanySettings(localConfig || {});
            return;
        }

        companySettings = normalizeCompanySettings(data || localConfig || {});
        localStorage.setItem(storageKey, JSON.stringify(companySettings));
    } catch (e) {
        console.warn('[kasse] loadCompanySettings failed, fallback localStorage', e);
        companySettings = normalizeCompanySettings(localConfig || {});
    }
}

// --- LOGIN LOGIK ---
async function handleLogin() {
    console.log('Login-Versuch für:', loginEmail.value);
    const { data, error } = await supabase.auth.signInWithPassword({ 
        email: loginEmail.value, 
        password: loginPass.value 
    });

    if (error) {
        console.error('Auth-Fehler:', error.message);
        loginError.textContent = 'Login fehlgeschlagen: ' + error.message;
    } else {
        console.log('Auth erfolgreich, ID:', data.user.id);
        updateUI(data.user);
    }
}

async function handleRegister() {
    const email = String(loginEmail.value || '').trim().toLowerCase();
    const password = String(loginPass.value || '');
    const position = String(registerPosition?.value || 'Mitarbeiter');

    if (!email || !password) {
        loginError.textContent = 'Bitte E-Mail und Passwort angeben.';
        return;
    }

    if (password.length < 6) {
        loginError.textContent = 'Passwort muss mindestens 6 Zeichen haben.';
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                position
            }
        }
    });

    if (error) {
        loginError.textContent = 'Registrierung fehlgeschlagen: ' + error.message;
        return;
    }

    const authUserId = data?.user?.id;
    if (!authUserId) {
        loginError.textContent = 'Registrierung abgeschlossen, aber ohne Benutzer-ID. Prüfe Supabase Auth-Einstellungen.';
        return;
    }

    const { profile, error: profileError } = await ensureUserProfileForAuthUser(authUserId, email, position);
    if (profileError || !profile) {
        console.error('Profil konnte nicht erstellt/verknüpft werden:', profileError);
        loginError.textContent = 'Konto erstellt, aber Profil fehlt. Bitte Admin kontaktieren.';
        return;
    }

    if (position === 'Tänzer*in' && profile.company) {
        await ensureDancerProduct(profile.id, email, profile.company);
    }

    if (data.session) {
        loginError.textContent = 'Registrierung erfolgreich. Du bist jetzt eingeloggt.';
        return;
    }

    loginError.textContent = 'Registrierung erfolgreich. Wenn kein Login möglich ist, Email confirmation in Supabase deaktivieren.';
}

async function handleLogout() {
    console.log('Logout...');
    await supabase.auth.signOut();
    updateUI(null);
}

async function updateUI(user) {
    if (user) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        userDisplay.textContent = shortenEmail(user.email);

        try {
            console.log('Lade Rolle aus Tabelle "users" für auth_user_id:', user.id);
            const { data: profile, error: pError } = await supabase.from('users').select('*').eq('auth_user_id', user.id).single();
            
            if (pError || !profile) {
                console.warn('Kein Profil gefunden:', pError?.message);
                currentUserProfile = null;
                userRole.textContent = 'Mitarbeiter';
                navDashboard.style.display = 'none';
                products = [];
                renderProducts();
                showStatus(checkoutStatusDiv, `<span class="status-error">Kein Benutzerprofil gefunden. Bitte Admin kontaktieren.</span>`);
            } else {
                console.log('Profil geladen:', profile);
                currentUserProfile = profile;
                userRole.textContent = profile.position || 'Mitarbeiter';
                navDashboard.style.display = 'block';
                // show storage nav only to Inhaber
                const isOwner = isOwnerPosition(profile.position);
                if (navStorage) navStorage.style.display = isOwner ? 'block' : 'none';
                if (navCompanySettings) navCompanySettings.style.display = isOwner ? 'block' : 'none';
                if (userRole) {
                    userRole.style.cursor = isOwner ? 'pointer' : 'default';
                    userRole.title = isOwner ? 'Unternehmens-Einstellungen öffnen' : '';
                    userRole.onclick = isOwner ? () => { window.location.href = 'company-settings.html'; } : null;
                }

                if (!profile.company) {
                    console.error('Benutzerprofil ohne company:', profile.id);
                    products = [];
                    renderProducts();
                    showStatus(checkoutStatusDiv, `<span class="status-error">Deinem Konto ist keine Firma zugewiesen.</span>`);
                    return;
                }

                await loadCompanySettings(profile.company);
                applyCompanySettingsToUI();
            }
        } catch (e) {
            console.error('Fehler beim UI-Update:', e);
            currentUserProfile = null;
        }
        if (currentUserProfile?.company) fetchProducts();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        userDisplay.textContent = '';
        userRole.textContent = '';
        currentUserProfile = null;
        companySettings = normalizeCompanySettings({});
        if (navStorage) navStorage.style.display = 'none';
        if (navCompanySettings) navCompanySettings.style.display = 'none';
        if (userRole) {
            userRole.style.cursor = 'default';
            userRole.title = '';
            userRole.onclick = null;
        }
        applyCompanySettingsToUI();
    }
}

// --- APP LOGIK ---
async function fetchProducts() {
    const company = currentUserProfile?.company;
    const isDoorStaff = currentUserProfile?.position === 'Türsteher*in';
    const isOwner = currentUserProfile?.position === 'Inhaber';
    if (!company) {
        products = [];
        renderProducts();
        return;
    }
    let query = supabase.from('products').select('*').order('price', { ascending: true });
    query = query.eq('company', company);
    if (isDoorStaff) query = query.eq('category', 'Tür');
    else if (!isOwner) query = query.neq('category', 'Tür');
    const { data, error } = await query;
    if (error) { console.error('Produkte laden fehlgeschlagen:', error); return; }
    products = data || [];
    renderProducts();
}

function renderProducts() {
    const isDoorStaff = currentUserProfile?.position === 'Türsteher*in';
    const isOwner = currentUserProfile?.position === 'Inhaber';

    // Clear all lists
    essenProdukteDiv.innerHTML = '';
    trinkenShotsDiv.innerHTML = '';
    trinkenCocktailsDiv.innerHTML = '';
    trinkenHartalkDiv.innerHTML = '';
    trinkenNonalkDiv.innerHTML = '';
    privatProdukteDiv.innerHTML = '';
    if (tuerProdukteDiv) tuerProdukteDiv.innerHTML = '';

    products.forEach(p => {
        if (p.category === 'Tänzer*innen') return;
        if (!isCategoryEnabled(p.category)) return;
        if (isDoorStaff && p.category !== 'Tür') return;
        if (!isDoorStaff && !isOwner && p.category === 'Tür') return;

        const div = document.createElement('div');
        div.className = 'produkt-item';
        div.innerHTML = `<span>${p.name}</span><span>${Math.round(p.price)} $</span>`;
        div.onclick = () => {
            if (p.category === 'Privat') {
                openEmployeeModal(p);
            } else {
                addToCart(p);
            }
        };

        if (p.category === 'Essen') {
            essenProdukteDiv.appendChild(div);
        } else if (p.category === 'Trinken') {
            if (p.subcategory === 'Shots') trinkenShotsDiv.appendChild(div);
            else if (p.subcategory === 'Cocktails') trinkenCocktailsDiv.appendChild(div);
            else if (p.subcategory === 'HartAlk') trinkenHartalkDiv.appendChild(div);
            else if (p.subcategory === 'NonAlk') trinkenNonalkDiv.appendChild(div);
            else {
                // Fallback: If no subcategory, put in NonAlk or handle differently
                trinkenNonalkDiv.appendChild(div);
            }
        } else if (p.category === 'Privat') {
            privatProdukteDiv.appendChild(div);
        } else if (p.category === 'Tür' && tuerProdukteDiv) {
            tuerProdukteDiv.appendChild(div);
        }
    });

    // Hide categories/subcategories that have no products
    const essenSection = document.getElementById('essen-kategorie');
    if (essenSection) essenSection.style.display = (companySettings.category_essen_enabled && essenProdukteDiv.children.length) ? '' : 'none';

    const trinkenSection = document.getElementById('trinken-kategorie');
    const shotsBlock = trinkenShotsDiv.closest('.subkategorie-block');
    const cocktailsBlock = trinkenCocktailsDiv.closest('.subkategorie-block');
    const hartalkBlock = trinkenHartalkDiv.closest('.subkategorie-block');
    const nonalkBlock = trinkenNonalkDiv.closest('.subkategorie-block');

    if (shotsBlock) shotsBlock.style.display = trinkenShotsDiv.children.length ? '' : 'none';
    if (cocktailsBlock) cocktailsBlock.style.display = trinkenCocktailsDiv.children.length ? '' : 'none';
    if (hartalkBlock) hartalkBlock.style.display = trinkenHartalkDiv.children.length ? '' : 'none';
    if (nonalkBlock) nonalkBlock.style.display = trinkenNonalkDiv.children.length ? '' : 'none';

    if (trinkenSection) {
        const hasAnyTrinken = [trinkenShotsDiv, trinkenCocktailsDiv, trinkenHartalkDiv, trinkenNonalkDiv].some(div => div.children.length);
        trinkenSection.style.display = (companySettings.category_trinken_enabled && hasAnyTrinken) ? '' : 'none';
    }

    const privatSection = document.getElementById('privat-kategorie');
    if (privatSection) privatSection.style.display = (companySettings.category_privat_enabled && privatProdukteDiv.children.length) ? '' : 'none';

    const tuerSection = document.getElementById('tuer-kategorie');
    if (tuerSection) tuerSection.style.display = (companySettings.category_tuer_enabled && tuerProdukteDiv && tuerProdukteDiv.children.length) ? '' : 'none';

    if (isDoorStaff) {
        if (essenSection) essenSection.style.display = 'none';
        if (trinkenSection) trinkenSection.style.display = 'none';
        if (privatSection) privatSection.style.display = 'none';
        if (tuerSection) tuerSection.style.display = companySettings.category_tuer_enabled ? '' : 'none';
    }
}


function addToCart(p) {
    // Suche nach exakt diesem Produkt im Warenkorb (Name muss auch übereinstimmen wegen Privat-Auswahl)
    const item = cart.find(i => String(i.id) === String(p.id) && i.name === p.name);
    if (item) {
        item.quantity++;
    } else {
        cart.push({...p, quantity: 1});
    }
    updateCart();
}

// --- MODAL LOGIK ---
function shortenEmail(email) {
    if (!email || !email.includes('@')) return email || 'Unbekannt';
    let name = email.split('@')[0];
    return name.split('.').map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
}

async function fetchEmployees() {
    const company = currentUserProfile?.company;
    if (!company) return [];
    let query = supabase
        .from('users')
        .select('*')
        .eq('position', 'Tänzer*in')
        .eq('company', company)
        .order('email', { ascending: true });
    const { data, error } = await query;
    if (error) { console.error('Mitarbeiter laden fehlgeschlagen:', error); return []; }
    return data || [];
}

function openEmployeeModal(product) {
    selectedPrivatProduct = product;
    employeeModal.style.display = 'flex';
    renderEmployees();
}

async function renderEmployees() {
    employeeListDiv.innerHTML = '<p style="grid-column: 1/-1;">Lade Mitarbeiter...</p>';
    const employees = await fetchEmployees();
    employeeListDiv.innerHTML = '';
    employees.forEach(emp => {
        const div = document.createElement('div');
        div.className = 'employee-item';
        const displayName = emp.name || shortenEmail(emp.email);
        div.textContent = displayName;
        div.onclick = () => {
            selectEmployee(emp);
        };
        employeeListDiv.appendChild(div);
    });
}

function selectEmployee(emp) {
    const displayName = emp.name || shortenEmail(emp.email);
    const productWithEmp = {
        ...selectedPrivatProduct,
        name: `${selectedPrivatProduct.name} (${displayName})`,
        bookedEmployeeId: emp.id,
        bookedEmployeeName: displayName
    };
    
    addToCart(productWithEmp);
    closeEmployeeModal();
}

function closeEmployeeModal() {
    employeeModal.style.display = 'none';
    selectedPrivatProduct = null;
}

function updateCart() {
    cartItemsUl.innerHTML = '';
    cart.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="item-name">${item.name}</span>
            <div class="quantity-container">
                <div class="quantity-controls">
                    <button class="qty-btn minus" data-id="${item.id}">-</button>
                    <input type="number" class="item-quantity" data-id="${item.id}" value="${item.quantity}" min="0">
                    <button class="qty-btn plus" data-id="${item.id}">+</button>
                </div>
            </div>
            <span class="item-total-price">${Math.round(item.price * item.quantity)} $</span>
        `;
        cartItemsUl.appendChild(li);
    });

    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.dataset.id;
            const item = cart.find(i => String(i.id) === String(id));
            if (!item) return;
            if (e.target.classList.contains('plus')) item.quantity++;
            else if (item.quantity > 1) item.quantity--;
            else cart = cart.filter(i => String(i.id) !== String(id));
            updateCart();
        };
    });

    document.querySelectorAll('.item-quantity').forEach(input => {
        input.oninput = (e) => {
            const val = parseInt(e.target.value);
            const item = cart.find(i => String(i.id) === String(e.target.dataset.id));
            if (val === 0) cart = cart.filter(i => String(i.id) !== String(e.target.dataset.id));
            else if (val > 0 && item) item.quantity = val;
            updateTotalsOnly();
        };
    });

    updateTotalsOnly();
}

function updateTotalsOnly() {
    let subtotal = 0;
    cart.forEach(i => subtotal += i.price * i.quantity);
    let discount = 0;
    if (appliedVoucher) {
        discount = appliedVoucher.discount_type === 'percent' ? subtotal * (appliedVoucher.discount / 100) : appliedVoucher.discount;
        voucherStatusDiv.innerHTML = `<span class="voucher-applied">-${Math.round(discount)} $</span>`;
    }
    let afterDiscount = Math.max(0, subtotal - discount);
    const tipVal = parseFloat(tipInput.value) || 0;
    tipAmount = tipMode === 'total' ? (tipVal > afterDiscount ? tipVal - afterDiscount : 0) : tipVal;
    tipDisplayInfo.textContent = `Trinkgeld: ${Math.round(tipAmount)} $`;
    totalSpan.textContent = Math.round(afterDiscount + tipAmount);
}

function applyQuickTip(percent) {
    let subtotal = 0; cart.forEach(i => subtotal += i.price * i.quantity);
    let disc = 0;
    if (appliedVoucher) disc = appliedVoucher.discount_type === 'percent' ? subtotal * (appliedVoucher.discount / 100) : appliedVoucher.discount;
    let after = Math.max(0, subtotal - disc);
    let tip = after * (percent / 100);
    tipInput.value = tipMode === 'total' ? Math.round(after + tip) : Math.round(tip);
    updateTotalsOnly();
}

async function applyVoucher() {
    if (!companySettings.vouchers_enabled) {
        appliedVoucher = null;
        showStatus(voucherStatusDiv, `<span class="voucher-error">Gutscheine deaktiviert</span>`);
        updateTotalsOnly();
        return;
    }

    checkoutStatusDiv.innerHTML = '';
    const code = voucherCodeInput.value.trim().toUpperCase();
    const company = currentUserProfile?.company;
    if (!code) { appliedVoucher = null; updateTotalsOnly(); return; }
    if (!company) {
        appliedVoucher = null;
        showStatus(voucherStatusDiv, `<span class="voucher-error">Keine Firma</span>`);
        return;
    }
    
    const { data: voucher, error } = await supabase.from('vouchers').select('*').eq('code', code).eq('company', company).single();
    
    if (error || !voucher) {
        appliedVoucher = null;
        showStatus(voucherStatusDiv, `<span class="voucher-error">Ungültig</span>`);
        updateTotalsOnly();
        return;
    }

    // --- Prüfung Ablaufdatum ---
    if (voucher.expiry) {
        const expiryDate = new Date(voucher.expiry);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Nur Datum vergleichen
        
        if (expiryDate < today) {
            appliedVoucher = null;
            showStatus(voucherStatusDiv, `<span class="voucher-error">Abgelaufen</span>`);
            showStatus(checkoutStatusDiv, `<span class="status-error">Gutschein abgelaufen (${expiryDate.toLocaleDateString('de-DE')}).</span>`);
            updateTotalsOnly();
            return;
        }
    }

    // --- Prüfung ob Einmal-Gutschein schon genutzt (falls nicht gelöscht) ---
    if (voucher.type === 'single' && (voucher.times_used || 0) > 0) {
        appliedVoucher = null;
        showStatus(voucherStatusDiv, `<span class="voucher-error">Bereits genutzt</span>`);
        showStatus(checkoutStatusDiv, `<span class="status-error">Einmal-Gutschein wurde bereits verwendet.</span>`);
        updateTotalsOnly();
        return;
    }

    appliedVoucher = voucher;
    voucherStatusDiv.innerHTML = `<span class="voucher-applied">Aktiv!</span>`;
    updateTotalsOnly();
}

async function checkout() {
    if (cart.length === 0) return;
    checkoutStatusDiv.innerHTML = '';
    
    console.log('Starte Kassiervorgang...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        flashButtonFeedback(btnCheckout, 'error');
        return;
    }

    // NUTZE DIE INTERNE ID (public.users.id) FÜR DIE TRANSAKTION
    // Dies ist notwendig, da die Tabelle "transactions" einen Fremdschlüssel auf "public.users.id" hat.
    const transactionUserId = currentUserProfile?.id;

    if (!transactionUserId) {
        console.error('Konnte kein Profil in der Tabelle "users" für diesen Account finden!');
        flashButtonFeedback(btnCheckout, 'error');
        return;
    }

    let subtotal = 0; 
    cart.forEach(i => subtotal += i.price * i.quantity);
    
    let disc = 0;
    if (appliedVoucher) {
        disc = appliedVoucher.discount_type === 'percent' ? subtotal * (appliedVoucher.discount / 100) : appliedVoucher.discount;
    }
    const finalSub = Math.max(0, subtotal - disc);

    const company = currentUserProfile?.company;
    if (!company) {
        flashButtonFeedback(btnCheckout, 'error');
        return;
    }
    const transactionData = {
        user_id: transactionUserId, // Nutzt die interne ID (z.B. add6651e...)
        company,
        subtotal: finalSub,
        tip_amount: tipAmount,
        total_amount: finalSub + tipAmount,
        voucher_code: appliedVoucher?.code || null,
        payment_method: paymentMethod
    };

    console.log('Sende Transaktionsdaten an Supabase:', transactionData);

    const { error } = await supabase.from('transactions').insert(transactionData);

    if (error) { 
        console.error('Supabase Transaction Error:', error);
        flashButtonFeedback(btnCheckout, 'error');
        return; 
    }

    // --- NEU: Verkaufszahlen in products_sales aktualisieren (täglich) ---
    const today = new Date().toISOString().split('T')[0];
    for (const item of cart) {
        // 1. Zuerst das Produkt selbst aktualisieren (oder anlegen)
        const matchCriteria = { product_id: item.id, company, date: today };
        const { data: existingEntry } = await supabase
            .from('products_sales')
            .select('count')
            .match(matchCriteria)
            .single();

        if (existingEntry) {
            const existingCount = Number(existingEntry.count) || 0;
            await supabase
                .from('products_sales')
                .update({ count: existingCount + item.quantity })
                .match(matchCriteria);
        } else {
            await supabase
                .from('products_sales')
                .insert([{
                    product_id: item.id,
                    name: item.name,
                    category: item.category,
                    subcategory: item.subcategory,
                    count: item.quantity,
                    company,
                    date: today
                }]);
        }

        // 2. WENN Kategorie "Privat": Statistik für die Person (Mitarbeiter) erfassen
        if (item.category === 'Privat' && item.bookedEmployeeId) {
            const dancerProductMatch = { id: item.bookedEmployeeId, company };
            const { data: existingDancerProduct } = await supabase
                .from('products')
                .select('id')
                .match(dancerProductMatch)
                .single();

            if (!existingDancerProduct) {
                await supabase
                    .from('products')
                    .insert([{
                        id: item.bookedEmployeeId,
                        name: item.bookedEmployeeName,
                        category: 'Tänzer*innen',
                        subcategory: null,
                        price: 0,
                        company
                    }]);
            }

            const matchCriteria = { product_id: item.bookedEmployeeId, company, date: today };
            const { data: existingEmpEntry } = await supabase
                .from('products_sales')
                .select('count')
                .match(matchCriteria)
                .single();

            if (existingEmpEntry) {
                // Wenn Person schon drin: Count erhöhen
                const existingCount = Number(existingEmpEntry.count) || 0;
                await supabase
                    .from('products_sales')
                    .update({ count: existingCount + item.quantity })
                    .match(matchCriteria);
            } else {
                // Wenn Person noch nicht drin: Neu anlegen (Kategorie "Tänzer*in", Subcategory null)
                await supabase
                    .from('products_sales')
                    .insert([{
                        product_id: item.bookedEmployeeId,
                        name: item.bookedEmployeeName,
                        category: 'Tänzer*innen',
                        subcategory: null,
                        count: item.quantity,
                        company,
                        date: today
                    }]);
            }
        }

        // 3. Wenn Produkt zu Essen oder Trinken gehört, Lagerbestand reduzieren
        try {
            if (['Essen', 'Trinken'].includes(item.category)) {
                const { data: storageRow, error: storageErr } = await supabase
                    .from('storage')
                    .select('count,id')
                    .eq('company', company)
                    .eq('name', item.name)
                    .maybeSingle();

                if (storageErr) {
                    console.error('Fehler beim Lesen des Lager-Eintrags:', storageErr);
                } else if (!storageRow) {
                    console.warn('Kein Lager-Eintrag gefunden für Produkt', item.name);
                } else {
                    const existingCount = Number(storageRow.count) || 0;
                    const newCount = Math.max(0, existingCount - item.quantity);
                    const { error: updateErr } = await supabase.from('storage').update({ count: newCount }).eq('id', storageRow.id).eq('company', company);
                    if (updateErr) console.error('Fehler beim Aktualisieren des Lager-Eintrags:', updateErr);
                    else console.log(`Lager aktualisiert für ${item.name}: ${existingCount} -> ${newCount}`);
                }
            }
        } catch (e) {
            console.error('Unerwarteter Fehler beim Reduzieren des Lagerbestands:', e);
        }
    }
    
    if (appliedVoucher?.type === 'single') {
        await supabase.from('vouchers').delete().eq('code', appliedVoucher.code).eq('company', company);
    }
    
    flashButtonFeedback(btnCheckout, 'success');
    cart = []; appliedVoucher = null; tipInput.value = ''; voucherCodeInput.value = ''; 
    // paymentMethod bleibt erhalten (wird nicht zurückgesetzt)
    updateCart();
}

// --- INIT ---
function init() {
    btnLogin.onclick = handleLogin;
    if (btnRegister) btnRegister.onclick = handleRegister;
    if (btnToggleAuth) {
        btnToggleAuth.onclick = () => {
            setAuthMode(authMode === 'login' ? 'register' : 'login');
        };
    }
    btnLogout.onclick = handleLogout;
    btnTipAmount.onclick = () => { tipMode = 'amount'; btnTipAmount.classList.add('active'); btnTipTotal.classList.remove('active'); updateTotalsOnly(); };
    btnTipTotal.onclick = () => { tipMode = 'total'; btnTipTotal.classList.add('active'); btnTipAmount.classList.remove('active'); updateTotalsOnly(); };
    
    btnPayCash.onclick = () => {
        if (companySettings.payment_enforced) return;
        setPaymentMethod('Bar');
    };
    btnPayCard.onclick = () => {
        if (companySettings.payment_enforced) return;
        setPaymentMethod('Karte');
    };

    tipInput.oninput = updateTotalsOnly;

    btnApplyVoucher.onclick = applyVoucher;
    btnCheckout.onclick = checkout;
    btnCloseModal.onclick = closeEmployeeModal;
    document.querySelectorAll('.btn-quick-tip').forEach(btn => {
        btn.onclick = (e) => { applyQuickTip(parseInt(e.target.dataset.percent)); document.querySelectorAll('.btn-quick-tip').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); };
    });
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') updateUI(session?.user);
        else if (event === 'SIGNED_OUT') updateUI(null);
    });

    setAuthMode('login');
}
document.addEventListener('DOMContentLoaded', init);
