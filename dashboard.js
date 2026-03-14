import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cloiwnjtyrmnoeoqhvag.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2l3bmp0eXJtbm9lb3FodmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTMzMTIsImV4cCI6MjA4ODcyOTMxMn0.JGZOGytcTj0keyoANSSkqm8wGnFL3EOmsg1MqFpi8Es'; 
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DOM Elemente
const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');
const totalSalesAll = document.getElementById('total-sales-all');
const totalTipsAll = document.getElementById('total-tips-all');
const totalBossCash = document.getElementById('total-boss-cash');
const labelBossCash = document.getElementById('label-boss-cash');

const employeeStatsBodyLive = document.getElementById('employee-stats-body-live');
const allTransactionsBodyLive = document.getElementById('all-transactions-body-live');
const hourlyStatsBody = document.getElementById('hourly-stats-body');

const vouchersBody = document.getElementById('vouchers-body');
const btnCreateVoucher = document.getElementById('btn-create-voucher');
const productsBody = document.getElementById('products-body');
const btnCreateProduct = document.getElementById('btn-create-product');
const pCategorySelect = document.getElementById('p-category');
const pSubcatGroup = document.getElementById('p-subcat-group');

const usersAdminBody = document.getElementById('users-admin-body');
const btnCreateUser = document.getElementById('btn-create-user');

const statsDateInput = document.getElementById('stats-date');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Globale Variablen
let hourlyChart = null;
let productCharts = []; 
let activeProductCat = 'Trinken'; 
let currentUserProfile = null; 
let lastSelectedDate = null; // Speichert das letzte ausgewählte Datum 

// --- HILFSFUNKTIONEN ---
function formatPrice(val) {
    const num = parseFloat(val) || 0;
    // Immer ohne Nachkommastellen anzeigen
    return Math.round(num) + '$';
}

function shortenEmail(email) {
    if (!email || !email.includes('@')) return email || 'Unbekannt';
    let name = email.split('@')[0];
    return name.split('.').map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
}

function getBusinessDate(dateInput) {
    const d = new Date(dateInput);
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('de-DE');
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
            if (btn.dataset.tab === 'tab-prod-stats') loadProductStats();
        };
    });

    // Kategorie-Umschaltung für Produkt-Erstellung
    if (pCategorySelect) {
        pCategorySelect.onchange = () => {
            pSubcatGroup.style.display = pCategorySelect.value === 'Trinken' ? 'block' : 'none';
        };
    }

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
            loadProductStats();
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
        };
        
        document.getElementById('btn-all-days').onclick = () => {
            // Speichere das aktuelle Datum bevor zu "Gesamt" gewechselt wird
            if (statsDateInput.value !== 'Gesamt') {
                lastSelectedDate = statsDateInput.value;
            }
            statsDateInput.value = 'Gesamt';
            loadStats(currentUserProfile, 'all');
        };
    }

    if (btnCreateProduct) btnCreateProduct.onclick = handleCreateProduct;
    if (btnCreateVoucher) btnCreateVoucher.onclick = handleCreateVoucher;
    if (btnCreateUser) btnCreateUser.onclick = handleCreateUser;
    if (btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = 'Index.html'; };

    checkAuthAndLoad();
}

async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'Index.html'; return; }

    const user = session.user;
    if (userDisplay) userDisplay.textContent = user.email;
    
    const { data: profile } = await supabase.from('users').select('*').eq('auth_user_id', user.id).single();
    if (!profile) { window.location.href = 'Index.html'; return; }

    currentUserProfile = profile;
    loadStats(profile);
    
    if (profile.position === 'Inhaber') {
        loadVouchers();
        loadProducts();
        loadAdminUsers();
    }
}

// --- LIVE STATISTIK LADEN ---

async function loadStats(currentUserProfile, targetDate = null) {
    const isOwner = currentUserProfile.position === 'Inhaber';
    const { data: profiles } = await supabase.from('users').select('*');
    const { data: allTransactions, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });

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
    if (totalBossCash) {
        const abgabe = todayBarSales - todayCardTips;
        totalBossCash.textContent = formatPrice(abgabe);
        totalBossCash.style.color = abgabe < 0 ? '#dc3545' : '#166534';
    }

    if (employeeStatsBodyLive) {
        employeeStatsBodyLive.innerHTML = '';
        Object.values(stats).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${shortenEmail(s.email)}</td><td>${s.position}</td><td>${formatPrice(s.sales)}</td><td>${formatPrice(s.tips)}</td><td>${s.count}</td>`;
            employeeStatsBodyLive.appendChild(tr);
        });
    }

    if (isOwner) {
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
    const { data: products } = await supabase.from('products').select('*').order('category');
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
    tr.innerHTML = `<td>${p.name}</td><td>${p.category}</td><td>${p.subcategory || '-'}</td><td>${formatPrice(p.price)}</td>
        <td><button class="edit-btn">✏️</button><button class="del-p del-btn" data-id="${p.id}">🗑️</button></td>`;
    tr.querySelector('.edit-btn').onclick = () => renderProductRowEdit(tr, p);
    tr.querySelector('.del-p').onclick = async () => { if(confirm('Löschen?')) { await supabase.from('products').delete().eq('id', p.id); loadProducts(); } };
}

function renderProductRowEdit(tr, p) {
    const cats = ['Essen', 'Trinken', 'Privat'];
    const catOptions = cats.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>`).join('');
    tr.innerHTML = `<td><input type="text" value="${p.name}" class="edit-name"></td><td><select class="edit-cat">${catOptions}</select></td><td>-</td><td><input type="number" step="0.01" value="${p.price}" class="edit-price"></td>
        <td><button class="save-btn">💾</button><button class="cancel-btn">❌</button></td>`;
    tr.querySelector('.cancel-btn').onclick = () => renderProductRowView(tr, p);
    tr.querySelector('.save-btn').onclick = async () => {
        const name = tr.querySelector('.edit-name').value;
        const category = tr.querySelector('.edit-cat').value;
        const price = parseFloat(tr.querySelector('.edit-price').value);
        await supabase.from('products').update({ name, category, price }).eq('id', p.id);
        loadProducts();
    };
}

async function handleCreateProduct() {
    const name = document.getElementById('p-name').value;
    const price = parseFloat(document.getElementById('p-price').value);
    const category = document.getElementById('p-category').value;
    const subcategory = category === 'Trinken' ? document.getElementById('p-subcategory').value : null;
    await supabase.from('products').insert([{ name, price, category, subcategory }]);
    loadProducts();
}

// --- GUTSCHEIN VERWALTUNG ---

async function loadVouchers() {
    const { data: vouchers, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
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
    tr.querySelector('.del-v').onclick = async () => { if(confirm('Löschen?')) { await supabase.from('vouchers').delete().eq('code', v.code); loadVouchers(); } };
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
        await supabase.from('vouchers').update({ code, discount, type, expiry }).eq('code', v.code);
        loadVouchers();
    };
}

async function handleCreateVoucher() {
    const code = document.getElementById('v-code').value.toUpperCase();
    const discount = parseFloat(document.getElementById('v-discount').value);
    const discount_type = document.getElementById('v-discount-type').value;
    const type = document.getElementById('v-type').value;
    const expiry = document.getElementById('v-expiry').value || null;
    await supabase.from('vouchers').insert([{ code, discount, discount_type, type, expiry, created_at: new Date().toISOString() }]);
    loadVouchers();
}

// --- MITARBEITER VERWALTUNG ---

async function loadAdminUsers() {
    const { data: users } = await supabase.from('users').select('*').order('email');
    if (usersAdminBody) {
        usersAdminBody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            renderUserRowView(tr, u);
            usersAdminBody.appendChild(tr);
        });
    }
}

function renderUserRowView(tr, u) {
    tr.innerHTML = `<td>${u.email}</td><td>${u.position}</td><td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td><button class="edit-btn">✏️</button><button class="del-u del-btn" data-id="${u.id}">🗑️</button></td>`;
    tr.querySelector('.edit-btn').onclick = () => renderUserRowEdit(tr, u);
    tr.querySelector('.del-u').onclick = async () => { if(confirm('Löschen?')) { await supabase.from('users').delete().eq('id', u.id); loadAdminUsers(); } };
}

function renderUserRowEdit(tr, u) {
    tr.innerHTML = `<td><input type="text" value="${u.email}" class="edit-email"></td><td><select class="edit-pos"><option value="Mitarbeiter" ${u.position==='Mitarbeiter'?'selected':''}>Mitarbeiter</option><option value="Tänzer*in" ${u.position==='Tänzer*in'?'selected':''}>Tänzer*in</option><option value="Inhaber" ${u.position==='Inhaber'?'selected':''}>Inhaber</option></select></td><td>-</td>
        <td><button class="save-btn">💾</button><button class="cancel-btn">❌</button></td>`;
    tr.querySelector('.cancel-btn').onclick = () => renderUserRowView(tr, u);
    tr.querySelector('.save-btn').onclick = async () => {
        const email = tr.querySelector('.edit-email').value;
        const position = tr.querySelector('.edit-pos').value;
        await supabase.from('users').update({ email, position }).eq('id', u.id);
        loadAdminUsers();
    };
}

async function handleCreateUser() {
    const email = document.getElementById('u-email').value;
    const position = document.getElementById('u-position').value;
    await supabase.from('users').insert([{ email, position, company: currentUserProfile?.company, created_at: new Date().toISOString() }]);
    loadAdminUsers();
}

// --- PRODUKT STATISTIK (CHARTS) ---

async function loadProductStats() {
    const { data: sales } = await supabase.from('products_sales').select('*');
    const container = document.getElementById('product-stats-container');
    if (!container) return;
    container.innerHTML = '';
    productCharts.forEach(c => c.destroy());
    productCharts = [];
    const groups = {};
    sales.forEach(s => {
        if (activeProductCat !== 'all' && s.category !== activeProductCat) return;
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
    });
    const order = ['Trinken', 'Essen', 'Privat', 'Tänzer*innen'];
    order.forEach(cat => {
        if (!groups[cat]) return;
        const div = document.createElement('div');
        div.innerHTML = `<h3>${cat}</h3><canvas id="chart-${cat}"></canvas>`;
        container.appendChild(div);
        const ctx = document.getElementById(`chart-${cat}`).getContext('2d');
        productCharts.push(new Chart(ctx, { type: 'bar', data: { labels: groups[cat].map(i => i.name), datasets: [{ label: 'Sales', data: groups[cat].map(i => i.count), backgroundColor: '#0056b3' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } }));
    });
}

document.addEventListener('DOMContentLoaded', init);
