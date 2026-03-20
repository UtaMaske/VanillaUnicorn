import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cloiwnjtyrmnoeoqhvag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2l3bmp0eXJtbm9lb3FodmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTMzMTIsImV4cCI6MjA4ODcyOTMxMn0.JGZOGytcTj0keyoANSSkqm8wGnFL3EOmsg1MqFpi8Es';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const userDisplay = document.getElementById('user-display');
const userRole = document.getElementById('user-role');
const btnLogout = document.getElementById('btn-logout');
const storageBody = document.getElementById('storage-body');
const navCompanySettings = document.getElementById('nav-company-settings');
// note: creation of new storage items moved out of this tab

let currentProfile = null;

function isOwnerPosition(position) {
    return String(position || '').trim().toLowerCase() === 'inhaber';
}

async function init() {
    console.log('[storage] init() starting');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[storage] session:', session);
    if (!session) { console.warn('[storage] no session, redirecting to Index.html'); window.location.href = 'Index.html'; return; }
    const user = session.user;
    if (userDisplay) userDisplay.textContent = user.email || 'Unbekannt';

    console.log('[storage] fetching profile for auth_user_id=', user.id);
    const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('auth_user_id', user.id).single();
    if (profileError) console.error('[storage] error fetching profile:', profileError);
    if (!profile) { console.warn('[storage] no profile found, redirecting'); window.location.href = 'Index.html'; return; }
    currentProfile = profile;
    console.log('[storage] loaded profile:', currentProfile);
    if (userRole) userRole.textContent = currentProfile.position || 'Mitarbeiter';

    const isOwner = isOwnerPosition(currentProfile.position);
    if (navCompanySettings) navCompanySettings.style.display = isOwner ? '' : 'none';
    if (userRole) {
        userRole.style.cursor = isOwner ? 'pointer' : 'default';
        userRole.title = isOwner ? 'Unternehmens-Einstellungen öffnen' : '';
        userRole.onclick = isOwner ? () => { window.location.href = 'company-settings.html'; } : null;
    }

    if (btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = 'Index.html'; };

    // setup list/chart toggles (elements exist in DOM)
    try {
        const btnStorageList = document.getElementById('btn-storage-list');
        const btnStorageChart = document.getElementById('btn-storage-chart');
        const storageChartContainer = document.getElementById('storage-chart-container');
        if (btnStorageList) btnStorageList.onclick = () => {
            const table = document.getElementById('storage-table'); if (table) table.style.display = '';
            if (storageChartContainer) storageChartContainer.style.display = 'none';
            btnStorageList.classList.add('active'); if (btnStorageChart) btnStorageChart.classList.remove('active');
        };
        if (btnStorageChart) btnStorageChart.onclick = () => {
            const table = document.getElementById('storage-table'); if (table) table.style.display = 'none';
            if (storageChartContainer) storageChartContainer.style.display = '';
            btnStorageChart.classList.add('active'); if (btnStorageList) btnStorageList.classList.remove('active');
            if (storageChart && typeof storageChart.update === 'function') storageChart.update();
        };
        // default to chart view
        try { if (btnStorageChart) btnStorageChart.click(); } catch(e) {}
    } catch (err) { console.warn('[storage] toggle setup failed', err); }

    await loadStorage();
}


async function loadStorage() {
    try {
        if (!currentProfile || !currentProfile.company) {
            console.warn('[storage] loadStorage: missing currentProfile or company', currentProfile);
            return;
        }
        const company = currentProfile.company;
        console.log('[storage] loading storage for company=', company);
        const { data, error } = await supabase.from('storage').select('*').eq('company', company).order('name', { ascending: true });
        if (error) {
            console.error('[storage] Fehler beim Laden des Lagers:', error);
            return;
        }
        console.log('[storage] loadStorage: received rows count=', (data || []).length);
        if ((data || []).length === 0) {
            console.warn('[storage] No rows returned for company filter — running diagnostic query without company filter');
            try {
                const { data: allData, error: allErr } = await supabase.from('storage').select('*').order('name', { ascending: true });
                if (allErr) console.error('[storage] diagnostic fetch all rows error:', allErr);
                else console.log('[storage] diagnostic fetch all rows count=', (allData || []).length, allData && allData.slice(0, 10));
            } catch (diagErr) {
                console.error('[storage] diagnostic fetch exception:', diagErr);
            }
        }
        renderStorageRows(data || []);
        try { renderStorageChart(data || []); } catch (err) { console.error('[storage] renderStorageChart failed', err); }
    } catch (err) {
        console.error('[storage] unexpected error in loadStorage:', err);
    }
}

// chart instance (kept global so we can destroy/update)
let storageChart = null;

function renderStorageChart(rows) {
    const labels = (rows || []).map(r => r.name || '-');
    const counts = (rows || []).map(r => Number(r.count) || 0);
    const canvas = document.getElementById('storage-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const threshold = 25;
    const thresholdPlugin = {
        id: 'thresholdLine',
        afterDatasetsDraw(chart) {
            const opts = chart.options.plugins['thresholdLine'] || {};
            const color = opts.color || 'rgba(220,53,69,0.9)';
            const dash = opts.dash || [6,4];
            const xScale = chart.scales['x'];
            if (!xScale) return;
            const xPos = xScale.getPixelForValue(threshold);
            const { ctx } = chart;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPos, chart.chartArea.top);
            ctx.lineTo(xPos, chart.chartArea.bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.setLineDash(dash);
            ctx.stroke();
            ctx.restore();
        }
    };

    if (storageChart) {
        try { storageChart.destroy(); } catch (_) {}
        storageChart = null;
    }

    storageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Anzahl',
                data: counts,
                backgroundColor: counts.map(c => c <= threshold ? 'rgba(220,53,69,0.7)' : 'rgba(0,123,255,0.7)')
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                thresholdLine: { color: 'rgba(220,53,69,0.9)', dash: [6,4] }
            },
            scales: { x: { beginAtZero: true } }
        },
        plugins: [thresholdPlugin]
    });
}

function renderStorageRows(rows) {
    if (!storageBody) return;
    console.log('[storage] renderStorageRows rows.length=', rows.length);
    storageBody.innerHTML = '';

    rows.forEach((r, idx) => {
        console.log(`[storage] row[${idx}] id=${r.id} name=${r.name} count=${r.count} category=${r.category} subcategory=${r.subcategory}`);
        const tr = document.createElement('tr');
        const countDisplay = escapeHtml(String(Number(r.count) || 0));
        tr.innerHTML = `
            <td>${escapeHtml(r.name || '-')}</td>
            <td>${escapeHtml(r.category || '-')}</td>
            <td>${escapeHtml(r.subcategory || '-')}</td>
            <td><span class="storage-count-display">${countDisplay}</span><input type="number" class="storage-count-input" value="${Number(r.count) || 0}" style="width:80px; display:none"></td>
            <td>
                <button class="edit-count" data-id="${r.id}">✏️</button>
                <button class="save-count" data-id="${r.id}" style="display:none">💾</button>
                <button class="del-item" data-id="${r.id}">🗑️</button>
            </td>
        `;

        const editBtn = tr.querySelector('.edit-count');
        const saveBtn = tr.querySelector('.save-count');
        const delBtn = tr.querySelector('.del-item');
        const displaySpan = tr.querySelector('.storage-count-display');
        const inputEl = tr.querySelector('.storage-count-input');

        editBtn.onclick = () => {
            displaySpan.style.display = 'none';
            inputEl.style.display = '';
            editBtn.style.display = 'none';
            saveBtn.style.display = '';
            inputEl.focus();
        };

        saveBtn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            let val = parseInt(inputEl.value);
            if (!Number.isFinite(val)) val = 0;
            try {
                const { error } = await supabase.from('storage').update({ count: val }).eq('id', id).eq('company', currentProfile.company);
                if (error) {
                    alert('Fehler beim Speichern: ' + (error.message || error));
                    console.error(error);
                    return;
                }
                displaySpan.textContent = String(val);
                displaySpan.style.display = '';
                inputEl.style.display = 'none';
                saveBtn.style.display = 'none';
                editBtn.style.display = '';
                saveBtn.textContent = '💾';
            } catch (err) {
                console.error('[storage] save exception', err);
                alert('Unerwarteter Fehler beim Speichern');
            }
        };

        delBtn.onclick = async (e) => {
            if (!confirm('Wirklich löschen?')) return;
            const id = e.currentTarget.dataset.id;
            const { error } = await supabase.from('storage').delete().eq('id', id).eq('company', currentProfile.company);
            if (error) {
                alert('Fehler beim Löschen');
                console.error(error);
                return;
            }
            tr.remove();
        };

        storageBody.appendChild(tr);
    });
}

function escapeHtml(unsafe) {
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', init);
