import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cloiwnjtyrmnoeoqhvag.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2l3bmp0eXJtbm9lb3FodmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTMzMTIsImV4cCI6MjA4ODcyOTMxMn0.JGZOGytcTj0keyoANSSkqm8wGnFL3EOmsg1MqFpi8Es'; 
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');
const totalSalesAll = document.getElementById('total-sales-all');
const totalTipsAll = document.getElementById('total-tips-all');
const employeeStatsBody = document.getElementById('employee-stats-body');
const allTransactionsBody = document.getElementById('all-transactions-body');
const hourlyStatsBody = document.getElementById('hourly-stats-body');
const vouchersBody = document.getElementById('vouchers-body');
const btnCreateVoucher = document.getElementById('btn-create-voucher');
const productsBody = document.getElementById('products-body');
const btnCreateProduct = document.getElementById('btn-create-product');
const pCategorySelect = document.getElementById('p-category');
const pSubcatGroup = document.getElementById('p-subcat-group');

const statsDateInput = document.getElementById('stats-date');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
let hourlyChart = null;
let editingProductId = null; // Trackt, welches Produkt gerade bearbeitet wird

// Kategorie-Umschaltung für Produkte
if (pCategorySelect) {
    pCategorySelect.onchange = () => {
        pSubcatGroup.style.display = pCategorySelect.value === 'Trinken' ? 'block' : 'none';
    };
}

// Hilfsfunktion: E-Mail kürzen und formatieren (Max Mustermann)
function shortenEmail(email) {
    if (!email || !email.includes('@')) return email || 'Unbekannt';
    let name = email.split('@')[0]; // Teil vor dem @
    
    // Formatierung: Punkt durch Leerzeichen ersetzen, Erster Buchstabe groß, Buchstabe nach Leerzeichen groß
    return name.split('.').map(part => {
        if (!part) return '';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
}

// Hilfsfunktion: Business-Datum berechnen (Tag endet erst um 05:59 Uhr)
function getBusinessDate(dateInput) {
    const d = new Date(dateInput);
    const hours = d.getHours();
    // Wenn vor 6 Uhr morgens, ziehe einen Tag ab
    if (hours < 6) {
        d.setDate(d.getDate() - 1);
    }
    return d.toLocaleDateString('de-DE');
}

// Tab Logik
tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});

async function checkAuthAndLoad() {
    console.log('Dashboard: Prüfe Auth...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        console.log('Kein User eingeloggt. Umleitung zum Login...');
        window.location.href = 'Index.html';
        return;
    }

    const user = session.user;
    userDisplay.textContent = user.email;
    
    // DEBUG: Suche alle Profile mit dieser E-Mail
    const { data: allProfiles, error: allPError } = await supabase.from('users').select('*').eq('email', user.email);
    console.log('DEBUG: Alle Profile für E-Mail ' + user.email + ':', allProfiles);
    if (allProfiles && allProfiles.length > 1) {
        console.warn('DEBUG: WARNUNG! Mehrere Profile für diese E-Mail gefunden. Das erklärt fehlende Daten.');
    }

    // Lade Profil
    const { data: profile, error } = await supabase.from('users').select('*').eq('auth_user_id', user.id).single();

    if (error || !profile) {
        console.log('Kein Profil gefunden oder Fehler:', error?.message);
        alert('Zugriff verweigert: Dein Benutzerprofil konnte nicht geladen werden.');
        window.location.href = 'Index.html';
        return;
    }

    console.log('Profil geladen:', profile.position);
    
    // UI Anpassungen basierend auf Rolle
    if (profile.position !== 'Inhaber') {
        document.querySelector('h1').textContent = 'Mitarbeiter Dashboard';
        document.querySelector('.stat-card:nth-child(1) h3').textContent = 'Mein Umsatz';
        document.querySelector('.stat-card:nth-child(2) h3').textContent = 'Mein Trinkgeld';
        
        // Verstecke Tabs für Mitarbeiter
        document.querySelector('[data-tab="tab-vouchers"]').style.display = 'none';
        document.querySelector('[data-tab="tab-statistik"]').style.display = 'none';
        document.querySelector('[data-tab="tab-produkte"]').style.display = 'none';
        
        // Benenne "Mitarbeiter" Tab um und passe Tabellenkopf an
        const empTabBtn = document.querySelector('[data-tab="tab-mitarbeiter"]');
        if (empTabBtn) empTabBtn.textContent = 'Meine Statistik';
        
        const empTitle = document.querySelector('#tab-mitarbeiter h2');
        if (empTitle) empTitle.textContent = 'Meine Auswertung';
        
        const tableHead = document.querySelector('#employee-stats-table thead');
        if (tableHead) {
            tableHead.innerHTML = `
                <tr>
                    <th>Datum</th>
                    <th>Umsatz ($)</th>
                    <th>Trinkgeld ($)</th>
                    <th>Transaktionen</th>
                </tr>
            `;
        }

        // Entferne Mitarbeiter-Spalte aus Einzeltransaktionen
        const transHead = document.querySelector('#all-transactions-table thead tr');
        if (transHead) {
            transHead.innerHTML = `
                <th>Zeitpunkt</th>
                <th>Umsatz ($)</th>
                <th>Trinkgeld ($)</th>
                <th>Gesamt ($)</th>
                <th>Gutschein</th>
                <th>Aktion</th>
            `;
        }
    } else {
        // Sicherstellen, dass Inhaber alles sehen (Reset falls vorher Mitarbeiter eingeloggt war)
        document.querySelector('h1').textContent = 'Inhaber Dashboard';
        document.querySelector('.stat-card:nth-child(1) h3').textContent = 'Umsatz Heute';
        document.querySelector('.stat-card:nth-child(2) h3').textContent = 'Trinkgeld Heute';
        
        document.querySelector('[data-tab="tab-vouchers"]').style.display = 'inline-block';
        document.querySelector('[data-tab="tab-statistik"]').style.display = 'inline-block';
        document.querySelector('[data-tab="tab-produkte"]').style.display = 'inline-block';
        
        const empTabBtn = document.querySelector('[data-tab="tab-mitarbeiter"]');
        if (empTabBtn) empTabBtn.textContent = 'Mitarbeiter';

        const empTitle = document.querySelector('#tab-mitarbeiter h2');
        if (empTitle) empTitle.textContent = 'Mitarbeiter Auswertung';

        const tableHead = document.querySelector('#employee-stats-table thead');
        if (tableHead) {
            tableHead.innerHTML = `
                <tr>
                    <th>Mitarbeiter</th>
                    <th>Position</th>
                    <th>Umsatz ($)</th>
                    <th>Trinkgeld ($)</th>
                    <th>Transaktionen</th>
                </tr>
            `;
        }

        const transHead = document.querySelector('#all-transactions-table thead tr');
        if (transHead) {
            transHead.innerHTML = `
                <th>Zeitpunkt</th>
                <th>Mitarbeiter</th>
                <th>Umsatz ($)</th>
                <th>Trinkgeld ($)</th>
                <th>Gesamt ($)</th>
                <th>Gutschein</th>
                <th>Aktion</th>
            `;
        }
    }

    loadStats(profile);
    
    // Datums-Filter Initialisierung
    if (statsDateInput) {
        // Initialer Wert im deutschen Format
        const initialDate = getBusinessDate(new Date());
        statsDateInput.value = initialDate;
        
        // Da das Feld nun readonly ist, brauchen wir onchange nicht mehr direkt
        // Die Steuerung erfolgt über die Pfeile

        // Pfeil-Navigation
        document.getElementById('btn-prev-day').onclick = () => {
            let current;
            if (statsDateInput.value === 'Gesamt') {
                // Wenn 'Gesamt' aktiv, starte beim heutigen Business-Tag
                const parts = getBusinessDate(new Date()).split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                const parts = statsDateInput.value.split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            current.setDate(current.getDate() - 1);
            statsDateInput.value = current.toLocaleDateString('de-DE');
            loadStats(profile, statsDateInput.value);
        };

        document.getElementById('btn-next-day').onclick = () => {
            let current;
            if (statsDateInput.value === 'Gesamt') {
                // Wenn 'Gesamt' aktiv, starte beim heutigen Business-Tag
                const parts = getBusinessDate(new Date()).split('.');
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                const parts = statsDateInput.value.split('.');
                if (parts.length < 3) return; 
                current = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            current.setDate(current.getDate() + 1);
            statsDateInput.value = current.toLocaleDateString('de-DE');
            loadStats(profile, statsDateInput.value);
        };

        document.getElementById('btn-all-days').onclick = () => {
            statsDateInput.value = 'Gesamt';
            loadStats(profile, 'all');
        };
    }

    if (profile.position === 'Inhaber') {
        loadVouchers();
        loadProducts();
    }
}

async function loadStats(currentUserProfile, targetDate = null) {
    const isOwner = currentUserProfile.position === 'Inhaber';
    console.log('DEBUG: Starte loadStats für Datum:', targetDate || 'Heute');
    
    // ... Profile und Transaktionen laden (unverändert) ...
    
    // 1. Profile laden
    const { data: profiles, error: profError } = await supabase.from('users').select('*');
    if (profError) {
        console.warn('DEBUG: Profil-Ladefehler (RLS?):', profError.message);
    } else {
        console.log('DEBUG: Profile erfolgreich geladen:', profiles?.length || 0);
    }
    
    // 2. Transaktionen laden
    const { data: allTransactions, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

    if (transError) {
        console.error('DEBUG: Datenbank-Fehler beim Laden:', transError);
        allTransactionsBody.innerHTML = `<tr><td colspan="7" style="color:red;">Fehler: ${transError.message}</td></tr>`;
        return;
    }

    // Welches Datum wollen wir anzeigen?
    let displayDate;
    if (targetDate === 'all') {
        displayDate = 'Gesamt';
    } else if (targetDate && targetDate.includes('-')) {
        // Falls YYYY-MM-DD (von Pfeilen oder Input)
        displayDate = targetDate.split('-').reverse().join('.');
    } else if (targetDate && targetDate.includes('.')) {
        // Falls bereits DD.MM.YYYY
        displayDate = targetDate;
    } else {
        // Standard: Aktueller Business Day
        displayDate = getBusinessDate(new Date());
    }

    // UI Titel anpassen
    const dateLabel = (displayDate === getBusinessDate(new Date())) ? 'Heute' : displayDate;
    document.querySelector('.stat-card:nth-child(1) h3').textContent = isOwner ? `Umsatz ${dateLabel}` : `Mein Umsatz ${dateLabel}`;
    document.querySelector('.stat-card:nth-child(2) h3').textContent = isOwner ? `Trinkgeld ${dateLabel}` : `Mein Trinkgeld ${dateLabel}`;
    
    // WICHTIG: Überschreibe 'today' mit dem gewählten Datum für die restliche Logik
    const today = displayDate;

    // Alle erlaubten Transaktionen (für die Tabellen)
    const transactions = allTransactions.filter(t => isOwner || t.user_id === currentUserProfile.id);

    if (!transactions || transactions.length === 0) {
        console.warn('DEBUG: Keine Transaktionen gefunden.');
        allTransactionsBody.innerHTML = '<tr><td colspan="7">Keine Transaktionen gefunden.</td></tr>';
        employeeStatsBody.innerHTML = '<tr><td colspan="4">Keine Daten vorhanden.</td></tr>';
        totalSalesAll.textContent = '0.00 $';
        totalTipsAll.textContent = '0.00 $';
        return;
    }

    // Ab hier beginnt die Verarbeitung der gefundenen Daten
    const safeProfiles = profiles || [currentUserProfile];
    let todaySales = 0;
    let todayTips = 0;
    const stats = {};
    const dailyStats = {}; // Für Mitarbeiter-Ansicht (gruppiert nach Business Day)
    const hourlyStats = {}; 

    // Initialisierung der Mitarbeiter-Stats (für den gewählten Zeitraum)
    safeProfiles.forEach(p => {
        if (p.id && (isOwner || p.id === currentUserProfile.id)) {
            stats[p.id] = { email: p.email, position: p.position, sales: 0, tips: 0, count: 0 };
        }
    });

    allTransactionsBody.innerHTML = ''; 

    transactions.forEach(t => {
        const transDate = getBusinessDate(t.created_at);
        
        // Täglich gruppieren nach BUSINESS DAY (Immer für die Historie)
        const dateKey = transDate;
        if (!dailyStats[dateKey]) dailyStats[dateKey] = { sales: 0, tips: 0, count: 0 };
        dailyStats[dateKey].sales += t.subtotal;
        dailyStats[dateKey].tips += t.tip_amount;
        dailyStats[dateKey].count++;

        // Filter für den aktuell ausgewählten Tag (oder ALLE)
        if (today === 'Gesamt' || transDate === today) {
            todaySales += t.subtotal;
            todayTips += t.tip_amount;

            const dateObj = new Date(t.created_at);

            // Statistiken pro Mitarbeiter (ID kann auth_user_id oder interne id sein)
            // Wir suchen das Profil, um den richtigen Key in 'stats' zu treffen
            const profile = safeProfiles.find(p => p.id === t.user_id || p.auth_user_id === t.user_id);
            const statsKey = profile ? profile.id : t.user_id;

            if (stats[statsKey]) {
                stats[statsKey].sales += t.subtotal;
                stats[statsKey].tips += t.tip_amount;
                stats[statsKey].count++;
            }

            const email = profile ? shortenEmail(profile.email) : 'Unbekannt';

            // Gruppierung (30-Minuten-Intervalle)
            const hour = dateObj.getHours().toString().padStart(2, '0');
            const minutes = dateObj.getMinutes() < 30 ? '00' : '30';
            const timeKey = `${hour}:${minutes}`;
            
            if (!hourlyStats[timeKey]) hourlyStats[timeKey] = { sales: 0, tips: 0, count: 0 };
            hourlyStats[timeKey].sales += t.subtotal;
            hourlyStats[timeKey].tips += t.tip_amount;
            hourlyStats[timeKey].count++;

            // Zeile für "Einzeltransaktionen" Tabelle erstellen
            const dateStr = dateObj.toLocaleString('de-DE');
            const trRow = document.createElement('tr');
            const actionHtml = isOwner ? `<td><button class="delete-transaction-btn" data-id="${t.id}" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">🗑️</button></td>` : '<td>-</td>';
            const emailCell = isOwner ? `<td>${email}</td>` : '';

            trRow.innerHTML = `
                <td>${dateStr}</td>
                ${emailCell}
                <td>${t.subtotal.toFixed(2)}</td>
                <td>${t.tip_amount.toFixed(2)}</td>
                <td>${t.total_amount.toFixed(2)}</td>
                <td>${t.voucher_code || '-'}</td>
                ${actionHtml}
            `;
            allTransactionsBody.appendChild(trRow);
        }
    });

    // ... (Event Listener für Löschen nur wenn Inhaber)
    if (isOwner) {
        document.querySelectorAll('.delete-transaction-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const transactionId = e.currentTarget.dataset.id;
                if (confirm('Diese Transaktion wirklich unwiderruflich löschen?')) {
                    const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
                    if (error) alert('Fehler beim Löschen: ' + error.message);
                    else loadStats(currentUserProfile); 
                }
            };
        });
    }

    totalSalesAll.textContent = todaySales.toFixed(2) + ' $';
    totalTipsAll.textContent = todayTips.toFixed(2) + ' $';

    // Tabellen-Inhalt rendern
    employeeStatsBody.innerHTML = '';
    if (isOwner) {
        Object.values(stats).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${shortenEmail(s.email)}</td><td>${s.position}</td><td>${s.sales.toFixed(2)}</td><td>${s.tips.toFixed(2)}</td><td>${s.count}</td>`;
            employeeStatsBody.appendChild(tr);
        });
    } else {
        // Sicherstellen, dass HEUTE immer existiert (auch mit 0 Werten)
        if (!dailyStats[today]) {
            dailyStats[today] = { sales: 0, tips: 0, count: 0 };
        }

        const sortedDays = Object.keys(dailyStats).sort((a, b) => {
            const dateA = new Date(a.split('.').reverse().join('-'));
            const dateB = new Date(b.split('.').reverse().join('-'));
            return dateB - dateA;
        });

        sortedDays.forEach(day => {
            const s = dailyStats[day];
            const tr = document.createElement('tr');
            if (day === today) {
                tr.style.backgroundColor = 'rgba(0, 86, 179, 0.05)';
                tr.style.fontWeight = 'bold';
            }
            tr.innerHTML = `<td>${day} (Heute)</td><td>${s.sales.toFixed(2)}</td><td>${s.tips.toFixed(2)}</td><td>${s.count}</td>`;
            if (day !== today) tr.innerHTML = `<td>${day}</td><td>${s.sales.toFixed(2)}</td><td>${s.tips.toFixed(2)}</td><td>${s.count}</td>`;
            
            employeeStatsBody.appendChild(tr);
        });
    }

    // Chart nur für Inhaber
    if (isOwner) {
        hourlyStatsBody.innerHTML = '';
        const sortedHours = Object.keys(hourlyStats).sort();
        const chartLabels = sortedHours;
        const chartDataSales = sortedHours.map(h => hourlyStats[h].sales);
        const chartDataTips = sortedHours.map(h => hourlyStats[h].tips);

        sortedHours.forEach(hour => {
            const s = hourlyStats[hour];
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${hour}</td><td>${s.sales.toFixed(2)}</td><td>${s.tips.toFixed(2)}</td><td>${s.count}</td>`;
            hourlyStatsBody.appendChild(tr);
        });
        renderChart(chartLabels, chartDataSales, chartDataTips);
    }
}

function renderChart(labels, salesData, tipsData) {
    const ctx = document.getElementById('hourly-sales-chart').getContext('2d');
    
    if (hourlyChart) {
        hourlyChart.destroy();
    }

    hourlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Umsatz ($)',
                    data: salesData,
                    borderColor: '#0056b3',
                    backgroundColor: 'rgba(0, 86, 179, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Trinkgeld ($)',
                    data: tipsData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2) + ' $';
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' $';
                        }
                    }
                }
            }
        }
    });
}

btnLogout.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = 'Index.html';
};

document.addEventListener('DOMContentLoaded', checkAuthAndLoad);

async function loadVouchers() {
    console.log('Lade Gutscheine...');
    const { data: vouchers, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });

    if (error) {
        console.error('Fehler beim Laden der Gutscheine:', error.message);
        vouchersBody.innerHTML = '<tr><td colspan="5">Fehler beim Laden.</td></tr>';
        return;
    }

    vouchersBody.innerHTML = '';
    vouchers.forEach(v => {
        const tr = document.createElement('tr');
        const discountStr = v.discount_type === 'percent' ? `${v.discount_value}%` : `${v.discount_value.toFixed(2)} $`;
        const typeStr = v.is_multi_use ? '🔄 Mehrfach' : '🎫 Einmalig';

        tr.innerHTML = `
            <td>${v.code}</td>
            <td>${discountStr}</td>
            <td>${typeStr}</td>
            <td>${v.times_used || 0}</td>
            <td>
                <button class="delete-voucher-btn" data-code="${v.code}" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
            </td>
        `;
        vouchersBody.appendChild(tr);
    });

    // Delete Listener
    document.querySelectorAll('.delete-voucher-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const code = e.currentTarget.dataset.code;
            if (confirm(`Gutschein ${code} wirklich löschen?`)) {
                const { error } = await supabase.from('vouchers').delete().eq('code', code);
                if (error) alert('Fehler: ' + error.message);
                else loadVouchers();
            }
        };
    });
}

if (btnCreateVoucher) {
    btnCreateVoucher.onclick = async () => {
        const code = document.getElementById('v-code').value.trim().toUpperCase();
        const value = parseFloat(document.getElementById('v-discount').value);
        const discountType = document.getElementById('v-discount-type').value;
        const useType = document.getElementById('v-type').value;

        if (!code || isNaN(value)) {
            alert('Bitte Code und Wert eingeben!');
            return;
        }

        const { error } = await supabase.from('vouchers').insert([
            {
                code: code,
                discount_value: value,
                discount_type: discountType,
                is_multi_use: useType === 'multi',
                created_at: new Date().toISOString()
            }
        ]);

        if (error) {
            alert('Fehler beim Erstellen: ' + error.message);
        } else {
            alert('Gutschein erstellt!');
            document.getElementById('v-code').value = '';
            document.getElementById('v-discount').value = '';
            loadVouchers();
        }
    };
}

// --- PRODUKT VERWALTUNG ---
async function loadProducts() {
    console.log('Lade Produkte...');
    const { data: products, error } = await supabase.from('products').select('*').order('category', { ascending: true });

    if (error) {
        console.error('Fehler beim Laden der Produkte:', error.message);
        productsBody.innerHTML = '<tr><td colspan="5">Fehler beim Laden.</td></tr>';
        return;
    }

    if (products && products.length > 0) {
        console.log('DEBUG: Struktur des ersten Produkts:', products[0]);
    }

    productsBody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.dataset.id = p.id;
        
        // Initialer Zustand: Rein Text
        renderProductRowView(tr, p);
        
        productsBody.appendChild(tr);
    });
}

function renderProductRowView(tr, p) {
    tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${p.subcategory || '-'}</td>
        <td>${p.price.toFixed(2)} $</td>
        <td>
            <button class="edit-btn" style="background:#ffc107; color:black; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;">✏️</button>
            <button class="delete-btn" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
        </td>
    `;

    tr.querySelector('.edit-btn').onclick = () => renderProductRowEdit(tr, p);
    tr.querySelector('.delete-btn').onclick = async () => {
        if (confirm('Produkt wirklich löschen?')) {
            const { error } = await supabase.from('products').delete().eq('id', p.id);
            if (error) alert('Fehler: ' + error.message);
            else loadProducts();
        }
    };
}

function renderProductRowEdit(tr, p) {
    const cats = ['Essen', 'Trinken', 'Privat'];
    const catOptions = cats.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>`).join('');

    const subcats = ['NonAlk', 'Shots', 'Cocktails', 'HartAlk'];
    const subcatOptions = subcats.map(s => `<option value="${s}" ${p.subcategory === s ? 'selected' : ''}>${s}</option>`).join('');
    
    const subcatDisplay = p.category === 'Trinken' ? 'inline-block' : 'none';

    tr.innerHTML = `
        <td>
            <input type="text" value="${p.name}" class="edit-name" style="width: 100%; padding: 5px; border: 1px solid #007bff; border-radius: 4px;">
        </td>
        <td>
            <select class="edit-cat" style="padding: 5px; border: 1px solid #007bff; border-radius: 4px;">
                ${catOptions}
            </select>
        </td>
        <td>
            <select class="edit-subcat" style="display: ${subcatDisplay}; padding: 5px; border: 1px solid #007bff; border-radius: 4px;">
                ${subcatOptions}
            </select>
            <span class="subcat-dash" style="display: ${p.category !== 'Trinken' ? 'inline-block' : 'none'}; color: #999;">-</span>
        </td>
        <td>
            <input type="number" step="0.10" value="${p.price}" class="edit-price" style="width: 80px; padding: 5px; border: 1px solid #007bff; border-radius: 4px;"> $
        </td>
        <td>
            <button class="save-btn" style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;">💾</button>
            <button class="cancel-btn" style="background:#6c757d; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">❌</button>
        </td>
    `;

    const catSelect = tr.querySelector('.edit-cat');
    const subcatSelect = tr.querySelector('.edit-subcat');
    const subcatDash = tr.querySelector('.subcat-dash');

    catSelect.onchange = () => {
        const isTrinken = catSelect.value === 'Trinken';
        subcatSelect.style.display = isTrinken ? 'inline-block' : 'none';
        subcatDash.style.display = isTrinken ? 'none' : 'inline-block';
    };

    tr.querySelector('.cancel-btn').onclick = () => renderProductRowView(tr, p);
    
    tr.querySelector('.save-btn').onclick = async () => {
        const newName = tr.querySelector('.edit-name').value.trim();
        const newCat = catSelect.value;
        const newSubcat = newCat === 'Trinken' ? subcatSelect.value : null;
        const newPrice = parseFloat(tr.querySelector('.edit-price').value);

        console.log('--- UPDATE VERSUCH START ---');
        console.log('ID:', p.id);
        console.log('Neue Daten:', { name: newName, category: newCat, subcategory: newSubcat, price: newPrice });

        if (!newName || isNaN(newPrice)) {
            alert('Bitte gültige Daten eingeben!');
            return;
        }

        // Wir probieren es ohne .select() am Ende, da manche RLS Policies 
        // zwar UPDATE erlauben, aber das zurückgegebene Objekt (SELECT) blockieren.
        const response = await supabase.from('products')
            .update({
                name: newName,
                category: newCat,
                subcategory: newSubcat,
                price: newPrice
            })
            .eq('id', p.id);

        console.log('Supabase Roh-Antwort:', response);

        if (response.error) {
            console.error('RLS oder DB Fehler:', response.error.message);
            alert('Fehler beim Speichern: ' + response.error.message);
        } else {
            // Wenn status 204 (No Content) kommt, war es oft erfolgreich (bei update ohne select)
            // Wenn status 200 kommt, prüfen wir ob wir Daten haben (nur mit select)
            console.log('Update-Befehl gesendet. Status:', response.status);
            
            // Wir machen einen kurzen Delay und laden dann neu
            setTimeout(() => {
                loadProducts();
            }, 500);
        }
    };
}

if (btnCreateProduct) {
    btnCreateProduct.onclick = async () => {
        const name = document.getElementById('p-name').value.trim();
        const price = parseFloat(document.getElementById('p-price').value);
        const category = document.getElementById('p-category').value;
        const subcategory = category === 'Trinken' ? document.getElementById('p-subcategory').value : null;

        console.log('DEBUG: Versuche neues Produkt zu erstellen:', { name, price, category, subcategory });

        if (!name || isNaN(price)) {
            console.warn('DEBUG: Validierung fehlgeschlagen.');
            alert('Bitte Name und Preis eingeben!');
            return;
        }

        const { data, error, status } = await supabase.from('products').insert([
            {
                name: name,
                price: price,
                category: category,
                subcategory: subcategory
            }
        ]).select();

        console.log('DEBUG: Supabase Insert Response Status:', status);

        if (error) {
            console.error('DEBUG: Fehler beim Erstellen (RLS?):', error);
            alert('Fehler beim Erstellen: ' + error.message);
        } else {
            console.log('DEBUG: Produkt erfolgreich hinzugefügt. Erhaltene Daten:', data);
            alert('Produkt hinzugefügt!');
            resetProductForm();
            loadProducts();
        }
    };
}

function resetProductForm() {
    editingProductId = null;
    document.getElementById('p-name').value = '';
    document.getElementById('p-price').value = '';
    document.getElementById('p-category').value = 'Essen';
    pSubcatGroup.style.display = 'none';
    btnCreateProduct.innerHTML = '<span class="icon">💾</span> Speichern';
    btnCreateProduct.style.background = ''; 
    btnCreateProduct.style.color = '';
}

