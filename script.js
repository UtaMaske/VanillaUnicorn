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
let currentUserProfile = null; // Hinzugefügt, um den Fehler zu beheben

// DOM Elemente
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const loginError = document.getElementById('login-error');
const userDisplay = document.getElementById('user-display');
const userRole = document.getElementById('user-role');
const navDashboard = document.getElementById('nav-dashboard');

const essenProdukteDiv = document.getElementById('essen-produkte');
const trinkenShotsDiv = document.getElementById('trinken-shots');
const trinkenCocktailsDiv = document.getElementById('trinken-cocktails');
const trinkenHartalkDiv = document.getElementById('trinken-hartalk');
const trinkenNonalkDiv = document.getElementById('trinken-nonalk');
const privatProdukteDiv = document.getElementById('privat-produkte');
const cartItemsUl = document.getElementById('cart-items');
const totalSpan = document.getElementById('total');
const tipInput = document.getElementById('tip-input');
const tipDisplayInfo = document.getElementById('tip-display-info');
const btnTipAmount = document.getElementById('btn-tip-amount');
const btnTipTotal = document.getElementById('btn-tip-total');
const voucherCodeInput = document.getElementById('voucher-code');
const btnApplyVoucher = document.getElementById('btn-apply-voucher');
const voucherStatusDiv = document.getElementById('voucher-status');
const btnCheckout = document.getElementById('btn-checkout');

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

async function handleLogout() {
    console.log('Logout...');
    await supabase.auth.signOut();
    updateUI(null);
}

async function updateUI(user) {
    if (user) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        userDisplay.textContent = user.email;

        try {
            console.log('Lade Rolle aus Tabelle "users" für auth_user_id:', user.id);
            const { data: profile, error: pError } = await supabase.from('users').select('*').eq('auth_user_id', user.id).single();
            
            if (pError || !profile) {
                console.warn('Kein Profil gefunden:', pError?.message);
                currentUserProfile = null;
                userRole.textContent = 'Mitarbeiter';
                navDashboard.style.display = 'block';
            } else {
                console.log('Profil geladen:', profile);
                currentUserProfile = profile;
                userRole.textContent = profile.position || 'Mitarbeiter';
                navDashboard.style.display = 'block';
            }
        } catch (e) {
            console.error('Fehler beim UI-Update:', e);
            currentUserProfile = null;
        }
        fetchProducts();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        userDisplay.textContent = '';
        userRole.textContent = '';
        currentUserProfile = null;
    }
}

// --- APP LOGIK ---
async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').order('price', { ascending: true });
    if (error) { console.error('Produkte laden fehlgeschlagen:', error); return; }
    products = data || [];
    renderProducts();
}

function renderProducts() {
    // Clear all lists
    essenProdukteDiv.innerHTML = '';
    trinkenShotsDiv.innerHTML = '';
    trinkenCocktailsDiv.innerHTML = '';
    trinkenHartalkDiv.innerHTML = '';
    trinkenNonalkDiv.innerHTML = '';
    privatProdukteDiv.innerHTML = '';

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'produkt-item';
        div.innerHTML = `<span>${p.name}</span><span>${p.price.toFixed(2)} $</span>`;
        div.onclick = () => {
            const item = cart.find(i => String(i.id) === String(p.id));
            if (item) item.quantity++; else cart.push({...p, quantity: 1});
            updateCart();
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
        } else {
            privatProdukteDiv.appendChild(div);
        }
    });
}

function updateCart() {
    cartItemsUl.innerHTML = '';
    cart.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="item-name">${item.name}</span>
            <div class="quantity-container">
                <span class="qty-label">Menge:</span>
                <div class="quantity-controls">
                    <button class="qty-btn minus" data-id="${item.id}">-</button>
                    <input type="number" class="item-quantity" data-id="${item.id}" value="${item.quantity}" min="0">
                    <button class="qty-btn plus" data-id="${item.id}">+</button>
                </div>
            </div>
            <span class="item-total-price">${(item.price * item.quantity).toFixed(2)} $</span>
            <button class="remove-btn" data-id="${item.id}">🗑️</button>
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

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = (e) => { cart = cart.filter(i => String(i.id) !== String(e.target.dataset.id)); updateCart(); };
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
        voucherStatusDiv.innerHTML = `<span class="voucher-applied">-${discount.toFixed(2)} $</span>`;
    }
    let afterDiscount = Math.max(0, subtotal - discount);
    const tipVal = parseFloat(tipInput.value) || 0;
    tipAmount = tipMode === 'total' ? (tipVal > afterDiscount ? tipVal - afterDiscount : 0) : tipVal;
    tipDisplayInfo.textContent = `Trinkgeld: ${tipAmount.toFixed(2)} $`;
    totalSpan.textContent = (afterDiscount + tipAmount).toFixed(2);
}

function applyQuickTip(percent) {
    let subtotal = 0; cart.forEach(i => subtotal += i.price * i.quantity);
    let disc = 0;
    if (appliedVoucher) disc = appliedVoucher.discount_type === 'percent' ? subtotal * (appliedVoucher.discount / 100) : appliedVoucher.discount;
    let after = Math.max(0, subtotal - disc);
    let tip = after * (percent / 100);
    tipInput.value = tipMode === 'total' ? (after + tip).toFixed(2) : tip.toFixed(2);
    updateTotalsOnly();
}

async function applyVoucher() {
    const code = voucherCodeInput.value.trim();
    if (!code) { appliedVoucher = null; updateTotalsOnly(); return; }
    const { data, error } = await supabase.from('vouchers').select('*').eq('code', code).single();
    if (data && !error) {
        appliedVoucher = data;
        voucherStatusDiv.innerHTML = `<span class="voucher-applied">Aktiv!</span>`;
    } else {
        appliedVoucher = null;
        voucherStatusDiv.innerHTML = `<span class="voucher-error">Ungültig</span>`;
    }
    updateTotalsOnly();
}

async function checkout() {
    if (cart.length === 0) return;
    
    console.log('Starte Kassiervorgang...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('Nicht angemeldet!');
        return;
    }

    // NUTZE DIE INTERNE ID (public.users.id) FÜR DIE TRANSAKTION
    // Dies ist notwendig, da die Tabelle "transactions" einen Fremdschlüssel auf "public.users.id" hat.
    const transactionUserId = currentUserProfile?.id;

    if (!transactionUserId) {
        console.error('Konnte kein Profil in der Tabelle "users" für diesen Account finden!');
        alert('Fehler: Dein Benutzerkonto ist nicht korrekt in der "users"-Tabelle hinterlegt. Bitte kontaktiere den Admin.');
        return;
    }

    let subtotal = 0; 
    cart.forEach(i => subtotal += i.price * i.quantity);
    
    let disc = 0;
    if (appliedVoucher) {
        disc = appliedVoucher.discount_type === 'percent' ? subtotal * (appliedVoucher.discount / 100) : appliedVoucher.discount;
    }
    const finalSub = Math.max(0, subtotal - disc);

    const transactionData = {
        user_id: transactionUserId, // Nutzt die interne ID (z.B. add6651e...)
        subtotal: finalSub,
        tip_amount: tipAmount,
        total_amount: finalSub + tipAmount,
        voucher_code: appliedVoucher?.code || null
    };

    console.log('Sende Transaktionsdaten an Supabase:', transactionData);

    const { error } = await supabase.from('transactions').insert(transactionData);

    if (error) { 
        console.error('Supabase Transaction Error:', error);
        alert(`Fehler beim Speichern: ${error.message}`); 
        return; 
    }
    
    if (appliedVoucher?.type === 'single') {
        await supabase.from('vouchers').delete().eq('code', appliedVoucher.code);
    }
    
    alert('Kassiervorgang erfolgreich abgeschlossen!');
    cart = []; appliedVoucher = null; tipInput.value = ''; voucherCodeInput.value = ''; updateCart();
}

// --- INIT ---
function init() {
    btnLogin.onclick = handleLogin;
    btnLogout.onclick = handleLogout;
    btnTipAmount.onclick = () => { tipMode = 'amount'; btnTipAmount.classList.add('active'); btnTipTotal.classList.remove('active'); updateTotalsOnly(); };
    btnTipTotal.onclick = () => { tipMode = 'total'; btnTipTotal.classList.add('active'); btnTipAmount.classList.remove('active'); updateTotalsOnly(); };
    btnApplyVoucher.onclick = applyVoucher;
    btnCheckout.onclick = checkout;
    document.querySelectorAll('.btn-quick-tip').forEach(btn => {
        btn.onclick = (e) => { applyQuickTip(parseInt(e.target.dataset.percent)); document.querySelectorAll('.btn-quick-tip').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); };
    });
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') updateUI(session?.user);
        else if (event === 'SIGNED_OUT') updateUI(null);
    });
}
document.addEventListener('DOMContentLoaded', init);
