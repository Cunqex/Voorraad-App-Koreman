// ── Supabase configuratie ──
const SUPABASE_URL = 'https://stfntvxgzblnuptbvpsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L5uO_6r1WrIrcZeb-Kzv9A_Hx1FYqEq';
const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};
const API_ART = `${SUPABASE_URL}/rest/v1/artikelen`;
const API_CAT = `${SUPABASE_URL}/rest/v1/categorieen`;

// ── Supabase calls: Artikelen ──
async function laadArtikelen() {
  const res = await fetch(`${API_ART}?order=naam.asc`, { headers });
  return res.ok ? await res.json() : [];
}
async function voegArtikelToe(data) {
  const res = await fetch(API_ART, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  const json = await res.json(); return json[0];
}
async function updateArtikel(id, data) {
  const res = await fetch(`${API_ART}?id=eq.${id}`, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  const json = await res.json(); return json[0];
}
async function verwijderArtikel(id) {
  await fetch(`${API_ART}?id=eq.${id}`, { method: 'DELETE', headers });
}

// ── Supabase calls: Categorieën ──
async function laadCategorieen() {
  const res = await fetch(`${API_CAT}?order=naam.asc`, { headers });
  return res.ok ? await res.json() : [];
}
async function voegCatToeDB(naam) {
  const res = await fetch(API_CAT, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ naam }) });
  const json = await res.json(); return json[0];
}
async function updateCatDB(id, naam) {
  const res = await fetch(`${API_CAT}?id=eq.${id}`, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ naam }) });
  const json = await res.json(); return json[0];
}
async function verwijderCatDB(id) {
  await fetch(`${API_CAT}?id=eq.${id}`, { method: 'DELETE', headers });
}

// ── State ──
let artikelen = [];
let categorieen = [];
let editId = null;
let editCatId = null;
let huidigePagina = 'voorraad';

// ── Hulpfuncties ──
function status(a) {
  if (a.stock === 0) return 'leeg';
  if (a.stock < a.min) return 'laag';
  return 'ok';
}
function statusLabel(s) {
  return s === 'ok' ? 'Op voorraad' : s === 'laag' ? 'Bijna op' : 'Bestellen';
}

// ── Navigatie ──
function toonPagina(pagina) {
  huidigePagina = pagina;
  document.getElementById('pagina-voorraad').classList.toggle('verborgen', pagina !== 'voorraad');
  document.getElementById('pagina-categorieen').classList.toggle('verborgen', pagina !== 'categorieen');
  document.querySelectorAll('.nav-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && pagina === 'voorraad') || (i === 1 && pagina === 'categorieen'));
  });
  document.getElementById('btn-hoofdactie').textContent = pagina === 'voorraad' ? '+ Artikel toevoegen' : '+ Categorie toevoegen';
  document.getElementById('btn-hoofdactie').onclick = pagina === 'voorraad' ? openModal : () => document.getElementById('nieuwe-cat').focus();
  document.getElementById('btn-export').style.display = pagina === 'voorraad' ? '' : 'none';
  if (pagina === 'categorieen') renderCategorieen();
}

// ── Render voorraadtabel ──
function render() {
  const zoek = document.getElementById('zoek').value.toLowerCase();
  const catFilter = document.getElementById('f-cat').value;
  const statusFilter = document.getElementById('f-status').value;

  const lijst = artikelen.filter(a => {
    if (zoek && !a.naam.toLowerCase().includes(zoek) && !a.cat.toLowerCase().includes(zoek)) return false;
    if (catFilter && a.cat !== catFilter) return false;
    if (statusFilter && status(a) !== statusFilter) return false;
    return true;
  });

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = lijst.length === 0
    ? '<tr><td colspan="7" class="leeg-cel">Geen artikelen gevonden</td></tr>'
    : lijst.map(a => {
        const s = status(a);
        return `<tr>
          <td class="naam-cel" title="${a.naam}">${a.naam}</td>
          <td><span class="cat-pill">${a.cat}</span></td>
          <td style="color:var(--subtekst)">${a.maat || '—'}</td>
          <td style="font-weight:500">${a.stock}</td>
          <td style="color:var(--subtekst)">${a.min}</td>
          <td><span class="status-dot status-${s}"><span class="dot dot-${s}"></span>${statusLabel(s)}</span></td>
          <td><div class="acties-cel">
            <button class="btn-ic groen" onclick="pasStockAan(${a.id}, -1)" title="Verlagen">−</button>
            <button class="btn-ic groen" onclick="pasStockAan(${a.id}, 1)" title="Verhogen">+</button>
            <button class="btn-ic" onclick="bewerk(${a.id})" title="Bewerken">✎</button>
            <button class="btn-ic rood" onclick="verwijder(${a.id})" title="Verwijderen">✕</button>
          </div></td>
        </tr>`;
      }).join('');

  // Stats
  document.getElementById('s-totaal').textContent = artikelen.length;
  document.getElementById('s-ok').textContent     = artikelen.filter(a => status(a) === 'ok').length;
  document.getElementById('s-laag').textContent   = artikelen.filter(a => status(a) === 'laag').length;
  document.getElementById('s-leeg').textContent   = artikelen.filter(a => status(a) === 'leeg').length;

  // Waarschuwingsbalk
  const aandacht = artikelen.filter(a => status(a) !== 'ok');
  const bar = document.getElementById('alert-bar');
  if (aandacht.length > 0) {
    bar.textContent = `${aandacht.length} artikel(en) vereisen aandacht: ${aandacht.map(a => a.naam).join(' · ')}`;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

// ── Render categorieëntabel ──
function renderCategorieen() {
  const tbody = document.getElementById('tbody-cat');
  if (categorieen.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="leeg-cel">Nog geen categorieën aangemaakt</td></tr>';
    return;
  }
  tbody.innerHTML = categorieen.map(c => {
    const aantal = artikelen.filter(a => a.cat === c.naam).length;
    return `<tr>
      <td style="font-weight:500">${c.naam}</td>
      <td>
      ${aantal > 0 
      ? `<span style="color:var(--goud);cursor:pointer;text-decoration:underline" onclick="toonCatArtikelen('${c.naam}')">${aantal} artikel${aantal !== 1 ? 'en' : ''}</span>`
      : `<span style="color:var(--subtekst)">0 artikelen</span>`
      }
      </td>
      <td><div class="acties-cel">
        <button class="btn-ic" onclick="bewerkCat(${c.id})" title="Bewerken">✎</button>
        <button class="btn-ic rood" onclick="verwijderCat(${c.id})" title="Verwijderen">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── Dropdown categorieën vullen ──
function vulCatDropdowns() {
  const opties = categorieen.map(c => `<option value="${c.naam}">${c.naam}</option>`).join('');
  document.getElementById('f-cat').innerHTML = '<option value="">Alle categorieën</option>' + opties;
  document.getElementById('f-cat-m').innerHTML = opties;
}

// ── Stock aanpassen ──
async function pasStockAan(id, delta) {
  const a = artikelen.find(x => x.id === id);
  if (!a) return;
  const nieuweStock = Math.max(0, a.stock + delta);
  const bijgewerkt = await updateArtikel(id, { stock: nieuweStock });
  if (bijgewerkt) {
    const idx = artikelen.findIndex(x => x.id === id);
    artikelen[idx] = bijgewerkt;
    render();
  }
}

// ── Artikel verwijderen ──
async function verwijder(id) {
  if (!confirm('Weet u zeker dat u dit artikel wilt verwijderen?')) return;
  await verwijderArtikel(id);
  artikelen = artikelen.filter(a => a.id !== id);
  render();
}

// ── Artikel modal ──
function openModal() {
  editId = null;
  document.getElementById('modal-titel').textContent = 'Nieuw artikel';
  document.getElementById('f-naam').value  = '';
  document.getElementById('f-maat').value  = '';
  document.getElementById('f-stock').value = '0';
  document.getElementById('f-min').value   = '2';
  if (categorieen.length > 0) document.getElementById('f-cat-m').value = categorieen[0].naam;
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-naam').focus(), 50);
}

function bewerk(id) {
  const a = artikelen.find(x => x.id === id);
  if (!a) return;
  editId = id;
  document.getElementById('modal-titel').textContent = 'Artikel bewerken';
  document.getElementById('f-naam').value  = a.naam;
  document.getElementById('f-cat-m').value = a.cat;
  document.getElementById('f-maat').value  = a.maat || '';
  document.getElementById('f-stock').value = a.stock;
  document.getElementById('f-min').value   = a.min;
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-naam').focus(), 50);
}

function closeModal() { document.getElementById('modal-bg').classList.remove('open'); }

async function opslaan() {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) { alert('Vul een artikelnaam in.'); return; }
  const gegevens = {
    naam,
    cat:   document.getElementById('f-cat-m').value,
    maat:  document.getElementById('f-maat').value.trim(),
    stock: Math.max(0, parseInt(document.getElementById('f-stock').value) || 0),
    min:   Math.max(0, parseInt(document.getElementById('f-min').value)   || 0),
  };
  const btn = document.querySelector('.btn-opsl');
  btn.textContent = 'Bezig...'; btn.disabled = true;
  if (editId !== null) {
    const bijgewerkt = await updateArtikel(editId, gegevens);
    if (bijgewerkt) artikelen[artikelen.findIndex(a => a.id === editId)] = bijgewerkt;
  } else {
    const nieuw = await voegArtikelToe(gegevens);
    if (nieuw) artikelen.push(nieuw);
  }
  btn.textContent = 'Opslaan'; btn.disabled = false;
  closeModal(); render();
}

// ── Categorieën beheer ──
async function voegCatToe() {
  const input = document.getElementById('nieuwe-cat');
  const naam = input.value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  if (categorieen.find(c => c.naam.toLowerCase() === naam.toLowerCase())) { alert('Deze categorie bestaat al.'); return; }
  const nieuw = await voegCatToeDB(naam);
  if (nieuw) { categorieen.push(nieuw); categorieen.sort((a,b) => a.naam.localeCompare(b.naam)); }
  input.value = '';
  vulCatDropdowns();
  renderCategorieen();
}

function bewerkCat(id) {
  const c = categorieen.find(x => x.id === id);
  if (!c) return;
  editCatId = id;
  document.getElementById('f-cat-naam').value = c.naam;
  document.getElementById('modal-cat-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-cat-naam').focus(), 50);
}

function closeCatModal() { document.getElementById('modal-cat-bg').classList.remove('open'); }

async function slaatCatOp() {
  const naam = document.getElementById('f-cat-naam').value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  const oudNaam = categorieen.find(c => c.id === editCatId)?.naam;
  const bijgewerkt = await updateCatDB(editCatId, naam);
  if (bijgewerkt) {
    const idx = categorieen.findIndex(c => c.id === editCatId);
    categorieen[idx] = bijgewerkt;
    // Bijwerken in artikelen
    artikelen.forEach(a => { if (a.cat === oudNaam) a.cat = naam; });
  }
  closeCatModal();
  vulCatDropdowns();
  renderCategorieen();
  render();
}

async function verwijderCat(id) {
  const c = categorieen.find(x => x.id === id);
  const aantalArtikelen = artikelen.filter(a => a.cat === c.naam).length;
  if (aantalArtikelen > 0) { alert(`Kan niet verwijderen — ${aantalArtikelen} artikel(en) gebruiken deze categorie.`); return; }
  if (!confirm(`Categorie "${c.naam}" verwijderen?`)) return;
  await verwijderCatDB(id);
  categorieen = categorieen.filter(x => x.id !== id);
  vulCatDropdowns();
  renderCategorieen();
}

// ── Bestellijst exporteren ──
function exporteerBestellijst() {
  const tebestellen = artikelen.filter(a => status(a) !== 'ok');
  if (tebestellen.length === 0) { alert('Alle artikelen zijn voldoende op voorraad.'); return; }

  const datum = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
  const regels = tebestellen.map(a =>
    `<tr>
      <td>${a.naam}</td>
      <td>${a.cat}</td>
      <td>${a.maat || '—'}</td>
      <td style="color:#c0392b;font-weight:600">${a.stock}</td>
      <td>${a.min}</td>
      <td>${statusLabel(status(a))}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">
    <title>Bestellijst Koreman Maastricht</title>
    <style>
      body { font-family: 'Georgia', serif; color: #1c1a17; padding: 40px; max-width: 900px; margin: 0 auto; }
      h1 { font-size: 28px; font-weight: 300; letter-spacing: 0.1em; margin-bottom: 4px; }
      .sub { color: #B8965A; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px; }
      .datum { font-size: 13px; color: #7a7369; margin-bottom: 32px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #faf8f5; padding: 10px 14px; text-align: left; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #7a7369; border-bottom: 1px solid #e5dfd5; }
      td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid #e5dfd5; }
      .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
    </style>
  </head><body>
    <div class="sub">Koreman Maastricht — Vloeren & Interieur</div>
    <h1>Bestellijst</h1>
    <div class="datum">Gegenereerd op ${datum} · ${tebestellen.length} artikel(en)</div>
    <table>
      <thead><tr><th>Artikel</th><th>Categorie</th><th>Afmeting</th><th>Huidig</th><th>Minimum</th><th>Status</th></tr></thead>
      <tbody>${regels}</tbody>
    </table>
    <div class="footer">Koreman Maastricht — Intern voorraadbeheer</div>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bestellijst-koreman-${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function toonCatArtikelen(catNaam) {
  toonPagina('voorraad');
  document.getElementById('f-cat').value = catNaam;
  document.getElementById('zoek').value = '';
  document.getElementById('f-status').value = '';
  render();
}

// ── Events ──
document.getElementById('modal-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-cat-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeCatModal(); });
document.getElementById('nieuwe-cat').addEventListener('keydown', e => { if (e.key === 'Enter') voegCatToe(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeCatModal(); }
  if (e.key === 'Enter' && document.getElementById('modal-bg').classList.contains('open')) opslaan();
  if (e.key === 'Enter' && document.getElementById('modal-cat-bg').classList.contains('open')) slaatCatOp();
});

// ── Opstarten ──
(async () => {
  document.getElementById('tbody').innerHTML = '<tr><td colspan="7" class="leeg-cel">Gegevens laden...</td></tr>';
  [artikelen, categorieen] = await Promise.all([laadArtikelen(), laadCategorieen()]);
  vulCatDropdowns();
  render();
})();