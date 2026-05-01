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
const API_LOC = `${SUPABASE_URL}/rest/v1/locaties`;
const API_LEV = `${SUPABASE_URL}/rest/v1/leveranciers`;

// ── API helpers ──
async function dbGet(url) {
  const res = await fetch(url, { headers });
  return res.ok ? await res.json() : [];
}
async function dbPost(url, data) {
  const res = await fetch(url, { method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  const json = await res.json(); return json[0];
}
async function dbPatch(url, data) {
  const res = await fetch(url, { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(data) });
  const json = await res.json(); return json[0];
}
async function dbDelete(url) {
  await fetch(url, { method: 'DELETE', headers });
}

// ── State ──
let artikelen = [];
let categorieen = [];
let locaties = [];
let leveranciers = [];
let editId = null;
let editCatId = null;
let editLocId = null;
let editLevId = null;
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
function euro(v) {
  return v ? `€ ${parseFloat(v).toFixed(2).replace('.', ',')}` : '—';
}
function leverancierNaam(id) {
  const l = leveranciers.find(x => x.id === id);
  return l ? l.naam : '—';
}

// ── Navigatie ──
function toonPagina(pagina) {
  huidigePagina = pagina;
  ['voorraad','categorieen','locaties','leveranciers'].forEach(p => {
    document.getElementById(`pagina-${p}`).classList.toggle('verborgen', p !== pagina);
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-pagina="${pagina}"]`)?.classList.add('active');
  if (pagina === 'categorieen') renderCategorieen();
  if (pagina === 'locaties') renderLocaties();
  if (pagina === 'leveranciers') renderLeveranciers();
}

function toonCatArtikelen(catNaam) {
  toonPagina('voorraad');
  document.getElementById('f-cat').value = catNaam;
  document.getElementById('zoek').value = '';
  document.getElementById('f-status').value = '';
  document.getElementById('f-loc').value = '';
  render();
}

// ── Render voorraad ──
function render() {
  const zoek = document.getElementById('zoek').value.toLowerCase();
  const catFilter = document.getElementById('f-cat').value;
  const statusFilter = document.getElementById('f-status').value;
  const locFilter = document.getElementById('f-loc').value;

  const lijst = artikelen.filter(a => {
    if (zoek && !a.naam.toLowerCase().includes(zoek) && !(a.cat||'').toLowerCase().includes(zoek)) return false;
    if (catFilter && a.cat !== catFilter) return false;
    if (statusFilter && status(a) !== statusFilter) return false;
    if (locFilter && a.locatie !== locFilter) return false;
    return true;
  });

  const totaalWaarde = artikelen.reduce((sum, a) => sum + (a.stock * (parseFloat(a.inkoopprijs) || 0)), 0);

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = lijst.length === 0
    ? '<tr><td colspan="9" class="leeg-cel">Geen artikelen gevonden</td></tr>'
    : lijst.map(a => {
        const s = status(a);
        const img = a.afbeelding_url
          ? `<img src="${a.afbeelding_url}" class="artikel-thumb" onclick="toonAfbeelding('${a.afbeelding_url}', '${a.naam.replace(/'/g,"\\'")}')"/>`
          : `<div class="artikel-thumb-leeg">—</div>`;
        return `<tr>
          <td>${img}</td>
          <td class="naam-cel" title="${a.naam}">${a.naam}${a.notitie ? `<div class="notitie-preview">${a.notitie}</div>` : ''}</td>
          <td><span class="cat-pill">${a.cat || '—'}</span></td>
          <td style="color:var(--subtekst);font-size:12px">${a.locatie || '—'}</td>
          <td style="font-weight:500">${a.stock}</td>
          <td style="color:var(--subtekst)">${a.min}</td>
          <td style="font-size:12px">${euro(a.verkoopprijs)}</td>
          <td><span class="status-dot status-${s}"><span class="dot dot-${s}"></span>${statusLabel(s)}</span></td>
          <td><div class="acties-cel">
            <button class="btn-ic groen" onclick="pasStockAan(${a.id},-1)" title="Verlagen">−</button>
            <button class="btn-ic groen" onclick="pasStockAan(${a.id},1)" title="Verhogen">+</button>
            <button class="btn-ic" onclick="bewerk(${a.id})" title="Bewerken">✎</button>
            <button class="btn-ic rood" onclick="verwijder(${a.id})" title="Verwijderen">✕</button>
          </div></td>
        </tr>`;
      }).join('');

  document.getElementById('s-totaal').textContent = artikelen.length;
  document.getElementById('s-ok').textContent     = artikelen.filter(a => status(a) === 'ok').length;
  document.getElementById('s-laag').textContent   = artikelen.filter(a => status(a) === 'laag').length;
  document.getElementById('s-leeg').textContent   = artikelen.filter(a => status(a) === 'leeg').length;
  document.getElementById('s-waarde').textContent = `€ ${totaalWaarde.toFixed(2).replace('.',',')}`;

  const aandacht = artikelen.filter(a => status(a) !== 'ok');
  const bar = document.getElementById('alert-bar');
  if (aandacht.length > 0) {
    bar.textContent = `${aandacht.length} artikel(en) vereisen aandacht: ${aandacht.map(a => a.naam).join(' · ')}`;
    bar.classList.add('show');
  } else { bar.classList.remove('show'); }
}

// ── Afbeelding lightbox ──
function toonAfbeelding(url, naam) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox-naam').textContent = naam;
  document.getElementById('lightbox').classList.add('open');
}
function sluitLightbox() { document.getElementById('lightbox').classList.remove('open'); }

// ── Dropdowns vullen ──
function vulDropdowns() {
  const catOpties = categorieen.map(c => `<option value="${c.naam}">${c.naam}</option>`).join('');
  document.getElementById('f-cat').innerHTML = '<option value="">Alle categorieën</option>' + catOpties;
  document.getElementById('f-cat-m').innerHTML = catOpties || '<option value="">— geen categorieën —</option>';

  const locOpties = locaties.map(l => `<option value="${l.naam}">${l.naam}</option>`).join('');
  document.getElementById('f-loc').innerHTML = '<option value="">Alle locaties</option>' + locOpties;
  document.getElementById('f-loc-m').innerHTML = '<option value="">— geen locatie —</option>' + locOpties;

  const levOpties = leveranciers.map(l => `<option value="${l.id}">${l.naam}</option>`).join('');
  document.getElementById('f-lev-m').innerHTML = '<option value="">— geen leverancier —</option>' + levOpties;
}

// ── Stock aanpassen ──
async function pasStockAan(id, delta) {
  const a = artikelen.find(x => x.id === id);
  if (!a) return;
  const nieuweStock = Math.max(0, a.stock + delta);
  const bijgewerkt = await dbPatch(`${API_ART}?id=eq.${id}`, { stock: nieuweStock });
  if (bijgewerkt) { artikelen[artikelen.findIndex(x => x.id === id)] = bijgewerkt; render(); }
}

// ── Artikel verwijderen ──
async function verwijder(id) {
  if (!confirm('Weet u zeker dat u dit artikel wilt verwijderen?')) return;
  await dbDelete(`${API_ART}?id=eq.${id}`);
  artikelen = artikelen.filter(a => a.id !== id);
  render();
}

// ── Artikel modal ──
function openModal() {
  editId = null;
  huidigeAfbeeldingUrl = null;
  document.getElementById('modal-titel').textContent = 'Nieuw artikel';
  document.getElementById('f-naam').value = '';
  document.getElementById('f-maat').value = '';
  document.getElementById('f-stock').value = '0';
  document.getElementById('f-min').value = '2';
  document.getElementById('f-inkoopprijs').value = '0';
  document.getElementById('f-verkoopprijs').value = '0';
  document.getElementById('f-notitie').value = '';
  document.getElementById('f-afbeelding-bestand').value = '';
  document.getElementById('upload-label').textContent = '📁 Klik om een afbeelding te kiezen';
  document.getElementById('upload-label').classList.remove('gekozen');
  document.getElementById('upload-status').textContent = '';
  document.getElementById('afbeelding-preview').style.display = 'none';
  if (categorieen.length > 0) document.getElementById('f-cat-m').selectedIndex = 0;
  document.getElementById('f-loc-m').selectedIndex = 0;
  document.getElementById('f-lev-m').selectedIndex = 0;
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-naam').focus(), 50);
}

function bewerk(id) {
  const a = artikelen.find(x => x.id === id);
  if (!a) return;
  editId = id;
  huidigeAfbeeldingUrl = a.afbeelding_url || null;
  document.getElementById('modal-titel').textContent = 'Artikel bewerken';
  document.getElementById('f-naam').value = a.naam;
  document.getElementById('f-cat-m').value = a.cat || '';
  document.getElementById('f-maat').value = a.maat || '';
  document.getElementById('f-stock').value = a.stock;
  document.getElementById('f-min').value = a.min;
  document.getElementById('f-inkoopprijs').value = a.inkoopprijs || '0';
  document.getElementById('f-verkoopprijs').value = a.verkoopprijs || '0';
  document.getElementById('f-notitie').value = a.notitie || '';
  document.getElementById('f-loc-m').value = a.locatie || '';
  document.getElementById('f-lev-m').value = a.leverancier_id || '';
  document.getElementById('f-afbeelding-bestand').value = '';
  const label = document.getElementById('upload-label');
  const status = document.getElementById('upload-status');
  const prev = document.getElementById('afbeelding-preview');
  if (a.afbeelding_url) {
    label.textContent = '✓ Huidige afbeelding (kies nieuw bestand om te vervangen)';
    label.classList.add('gekozen');
    status.textContent = '';
    prev.src = a.afbeelding_url;
    prev.style.display = 'block';
  } else {
    label.textContent = '📁 Klik om een afbeelding te kiezen';
    label.classList.remove('gekozen');
    status.textContent = '';
    prev.style.display = 'none';
  }
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-naam').focus(), 50);
}

function closeModal() { document.getElementById('modal-bg').classList.remove('open'); }

// ── Afbeelding upload ──
let huidigeAfbeeldingUrl = null;

document.getElementById('f-afbeelding-bestand')?.addEventListener('change', async function() {
  const bestand = this.files[0];
  if (!bestand) return;
  const label = document.getElementById('upload-label');
  const status = document.getElementById('upload-status');
  const preview = document.getElementById('afbeelding-preview');

  label.textContent = '⏳ Uploaden...';
  status.textContent = '';

  const bestandsnaam = `${Date.now()}-${bestand.name.replace(/\s+/g, '-')}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/afbeeldingen/${bestandsnaam}`;

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': bestand.type,
        'x-upsert': 'true',
      },
      body: bestand,
    });

    if (!res.ok) throw new Error(await res.text());

    huidigeAfbeeldingUrl = `${SUPABASE_URL}/storage/v1/object/public/afbeeldingen/${bestandsnaam}`;
    label.textContent = `✓ ${bestand.name}`;
    label.classList.add('gekozen');
    status.textContent = 'Afbeelding klaar om op te slaan';
    status.style.color = '#2e6b3e';
    preview.src = huidigeAfbeeldingUrl;
    preview.style.display = 'block';
  } catch (err) {
    label.textContent = '📁 Klik om een afbeelding te kiezen';
    label.classList.remove('gekozen');
    status.textContent = 'Upload mislukt — controleer of de storage bucket bestaat';
    status.style.color = '#c0392b';
    console.error('Upload fout:', err);
  }
});

async function opslaan() {
  const naam = document.getElementById('f-naam').value.trim();
  if (!naam) { alert('Vul een artikelnaam in.'); return; }
  const levId = document.getElementById('f-lev-m').value;
  const gegevens = {
    naam,
    cat: document.getElementById('f-cat-m').value || null,
    maat: document.getElementById('f-maat').value.trim() || null,
    stock: Math.max(0, parseInt(document.getElementById('f-stock').value) || 0),
    min: Math.max(0, parseInt(document.getElementById('f-min').value) || 0),
    inkoopprijs: parseFloat(document.getElementById('f-inkoopprijs').value) || 0,
    verkoopprijs: parseFloat(document.getElementById('f-verkoopprijs').value) || 0,
    notitie: document.getElementById('f-notitie').value.trim() || null,
    locatie: document.getElementById('f-loc-m').value || null,
    leverancier_id: levId ? parseInt(levId) : null,
    afbeelding_url: huidigeAfbeeldingUrl,
  };
  const btn = document.querySelector('#modal-bg .btn-opsl');
  btn.textContent = 'Bezig...'; btn.disabled = true;
  if (editId !== null) {
    const bijgewerkt = await dbPatch(`${API_ART}?id=eq.${editId}`, gegevens);
    if (bijgewerkt) artikelen[artikelen.findIndex(a => a.id === editId)] = bijgewerkt;
  } else {
    const nieuw = await dbPost(API_ART, gegevens);
    if (nieuw) artikelen.push(nieuw);
  }
  btn.textContent = 'Opslaan'; btn.disabled = false;
  closeModal(); render();
}

// ── Categorieën ──
function renderCategorieen() {
  const tbody = document.getElementById('tbody-cat');
  tbody.innerHTML = categorieen.length === 0
    ? '<tr><td colspan="3" class="leeg-cel">Nog geen categorieën aangemaakt</td></tr>'
    : categorieen.map(c => {
        const aantal = artikelen.filter(a => a.cat === c.naam).length;
        return `<tr>
          <td style="font-weight:500">${c.naam}</td>
          <td>${aantal > 0
            ? `<span style="color:var(--goud);cursor:pointer;text-decoration:underline" onclick="toonCatArtikelen('${c.naam}')">${aantal} artikel${aantal !== 1 ? 'en' : ''}</span>`
            : '<span style="color:var(--subtekst)">0 artikelen</span>'}</td>
          <td><div class="acties-cel">
            <button class="btn-ic" onclick="bewerkCat(${c.id})" title="Bewerken">✎</button>
            <button class="btn-ic rood" onclick="verwijderCat(${c.id})" title="Verwijderen">✕</button>
          </div></td>
        </tr>`;
      }).join('');
}

async function voegCatToe() {
  const input = document.getElementById('nieuwe-cat');
  const naam = input.value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  if (categorieen.find(c => c.naam.toLowerCase() === naam.toLowerCase())) { alert('Deze categorie bestaat al.'); return; }
  const nieuw = await dbPost(API_CAT, { naam });
  if (nieuw) { categorieen.push(nieuw); categorieen.sort((a,b) => a.naam.localeCompare(b.naam)); }
  input.value = ''; vulDropdowns(); renderCategorieen();
}

function bewerkCat(id) {
  editCatId = id;
  document.getElementById('f-cat-naam').value = categorieen.find(c => c.id === id)?.naam || '';
  document.getElementById('modal-cat-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-cat-naam').focus(), 50);
}
function closeCatModal() { document.getElementById('modal-cat-bg').classList.remove('open'); }

async function slaatCatOp() {
  const naam = document.getElementById('f-cat-naam').value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  const oudNaam = categorieen.find(c => c.id === editCatId)?.naam;
  const bijgewerkt = await dbPatch(`${API_CAT}?id=eq.${editCatId}`, { naam });
  if (bijgewerkt) {
    categorieen[categorieen.findIndex(c => c.id === editCatId)] = bijgewerkt;
    artikelen.forEach(a => { if (a.cat === oudNaam) a.cat = naam; });
  }
  closeCatModal(); vulDropdowns(); renderCategorieen(); render();
}

async function verwijderCat(id) {
  const c = categorieen.find(x => x.id === id);
  const aantal = artikelen.filter(a => a.cat === c.naam).length;
  if (aantal > 0) { alert(`Kan niet verwijderen — ${aantal} artikel(en) gebruiken deze categorie.`); return; }
  if (!confirm(`Categorie "${c.naam}" verwijderen?`)) return;
  await dbDelete(`${API_CAT}?id=eq.${id}`);
  categorieen = categorieen.filter(x => x.id !== id);
  vulDropdowns(); renderCategorieen();
}

// ── Locaties ──
function renderLocaties() {
  const tbody = document.getElementById('tbody-loc');
  tbody.innerHTML = locaties.length === 0
    ? '<tr><td colspan="3" class="leeg-cel">Nog geen locaties aangemaakt</td></tr>'
    : locaties.map(l => {
        const aantal = artikelen.filter(a => a.locatie === l.naam).length;
        return `<tr>
          <td style="font-weight:500">${l.naam}</td>
          <td style="color:var(--subtekst)">${aantal} artikel${aantal !== 1 ? 'en' : ''}</td>
          <td><div class="acties-cel">
            <button class="btn-ic" onclick="bewerkLoc(${l.id})" title="Bewerken">✎</button>
            <button class="btn-ic rood" onclick="verwijderLoc(${l.id})" title="Verwijderen">✕</button>
          </div></td>
        </tr>`;
      }).join('');
}

async function voegLocToe() {
  const input = document.getElementById('nieuwe-loc');
  const naam = input.value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  if (locaties.find(l => l.naam.toLowerCase() === naam.toLowerCase())) { alert('Deze locatie bestaat al.'); return; }
  const nieuw = await dbPost(API_LOC, { naam });
  if (nieuw) { locaties.push(nieuw); locaties.sort((a,b) => a.naam.localeCompare(b.naam)); }
  input.value = ''; vulDropdowns(); renderLocaties();
}

function bewerkLoc(id) {
  editLocId = id;
  document.getElementById('f-loc-naam').value = locaties.find(l => l.id === id)?.naam || '';
  document.getElementById('modal-loc-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-loc-naam').focus(), 50);
}
function closeLocModal() { document.getElementById('modal-loc-bg').classList.remove('open'); }

async function slaatLocOp() {
  const naam = document.getElementById('f-loc-naam').value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  const oudNaam = locaties.find(l => l.id === editLocId)?.naam;
  const bijgewerkt = await dbPatch(`${API_LOC}?id=eq.${editLocId}`, { naam });
  if (bijgewerkt) {
    locaties[locaties.findIndex(l => l.id === editLocId)] = bijgewerkt;
    artikelen.forEach(a => { if (a.locatie === oudNaam) a.locatie = naam; });
  }
  closeLocModal(); vulDropdowns(); renderLocaties(); render();
}

async function verwijderLoc(id) {
  const l = locaties.find(x => x.id === id);
  const aantal = artikelen.filter(a => a.locatie === l.naam).length;
  if (aantal > 0) { alert(`Kan niet verwijderen — ${aantal} artikel(en) op deze locatie.`); return; }
  if (!confirm(`Locatie "${l.naam}" verwijderen?`)) return;
  await dbDelete(`${API_LOC}?id=eq.${id}`);
  locaties = locaties.filter(x => x.id !== id);
  vulDropdowns(); renderLocaties();
}

// ── Leveranciers ──
function renderLeveranciers() {
  const tbody = document.getElementById('tbody-lev');
  tbody.innerHTML = leveranciers.length === 0
    ? '<tr><td colspan="5" class="leeg-cel">Nog geen leveranciers aangemaakt</td></tr>'
    : leveranciers.map(l => `<tr>
        <td style="font-weight:500">${l.naam}</td>
        <td style="color:var(--subtekst)">${l.telefoon || '—'}</td>
        <td style="color:var(--subtekst)">${l.email || '—'}</td>
        <td>${l.website ? `<a href="${l.website}" target="_blank" style="color:var(--goud)">Bezoek website</a>` : '—'}</td>
        <td><div class="acties-cel">
          <button class="btn-ic" onclick="bewerkLev(${l.id})" title="Bewerken">✎</button>
          <button class="btn-ic rood" onclick="verwijderLev(${l.id})" title="Verwijderen">✕</button>
        </div></td>
      </tr>`).join('');
}

function openLevModal() {
  editLevId = null;
  document.getElementById('modal-lev-titel').textContent = 'Nieuwe leverancier';
  ['f-lev-naam','f-lev-tel','f-lev-email','f-lev-website'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal-lev-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-lev-naam').focus(), 50);
}

function bewerkLev(id) {
  const l = leveranciers.find(x => x.id === id);
  if (!l) return;
  editLevId = id;
  document.getElementById('modal-lev-titel').textContent = 'Leverancier bewerken';
  document.getElementById('f-lev-naam').value = l.naam;
  document.getElementById('f-lev-tel').value = l.telefoon || '';
  document.getElementById('f-lev-email').value = l.email || '';
  document.getElementById('f-lev-website').value = l.website || '';
  document.getElementById('modal-lev-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-lev-naam').focus(), 50);
}
function closeLevModal() { document.getElementById('modal-lev-bg').classList.remove('open'); }

async function slaatLevOp() {
  const naam = document.getElementById('f-lev-naam').value.trim();
  if (!naam) { alert('Vul een naam in.'); return; }
  const gegevens = {
    naam,
    telefoon: document.getElementById('f-lev-tel').value.trim() || null,
    email: document.getElementById('f-lev-email').value.trim() || null,
    website: document.getElementById('f-lev-website').value.trim() || null,
  };
  if (editLevId !== null) {
    const bijgewerkt = await dbPatch(`${API_LEV}?id=eq.${editLevId}`, gegevens);
    if (bijgewerkt) leveranciers[leveranciers.findIndex(l => l.id === editLevId)] = bijgewerkt;
  } else {
    const nieuw = await dbPost(API_LEV, gegevens);
    if (nieuw) leveranciers.push(nieuw);
  }
  closeLevModal(); vulDropdowns(); renderLeveranciers();
}

async function verwijderLev(id) {
  const l = leveranciers.find(x => x.id === id);
  if (!confirm(`Leverancier "${l.naam}" verwijderen?`)) return;
  await dbDelete(`${API_LEV}?id=eq.${id}`);
  leveranciers = leveranciers.filter(x => x.id !== id);
  vulDropdowns(); renderLeveranciers();
}

// ── Bestellijst exporteren ──
function exporteerBestellijst() {
  const tebestellen = artikelen.filter(a => status(a) !== 'ok');
  if (tebestellen.length === 0) { alert('Alle artikelen zijn voldoende op voorraad.'); return; }
  const datum = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
  const regels = tebestellen.map(a => `<tr>
    <td>${a.naam}</td><td>${a.cat||'—'}</td><td>${a.maat||'—'}</td>
    <td>${a.locatie||'—'}</td><td>${leverancierNaam(a.leverancier_id)}</td>
    <td style="color:#c0392b;font-weight:600">${a.stock}</td><td>${a.min}</td>
    <td>${statusLabel(status(a))}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">
    <title>Bestellijst Koreman Maastricht</title>
    <style>body{font-family:Georgia,serif;color:#1c1a17;padding:40px;max-width:1000px;margin:0 auto}
    h1{font-size:28px;font-weight:300;letter-spacing:.1em;margin-bottom:4px}.sub{color:#B8965A;font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px}
    .datum{font-size:13px;color:#7a7369;margin-bottom:32px}table{width:100%;border-collapse:collapse}
    th{background:#faf8f5;padding:10px 14px;text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7a7369;border-bottom:1px solid #e5dfd5}
    td{padding:11px 14px;font-size:13px;border-bottom:1px solid #e5dfd5}.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center}</style>
  </head><body>
    <div class="sub">Koreman Maastricht — Vloeren & Interieur</div>
    <h1>Bestellijst</h1>
    <div class="datum">Gegenereerd op ${datum} · ${tebestellen.length} artikel(en)</div>
    <table><thead><tr><th>Artikel</th><th>Categorie</th><th>Afmeting</th><th>Locatie</th><th>Leverancier</th><th>Huidig</th><th>Minimum</th><th>Status</th></tr></thead>
    <tbody>${regels}</tbody></table>
    <div class="footer">Koreman Maastricht — Intern voorraadbeheer</div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bestellijst-koreman-${new Date().toISOString().slice(0,10)}.html`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Events ──
document.getElementById('modal-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-cat-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeCatModal(); });
document.getElementById('modal-loc-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeLocModal(); });
document.getElementById('modal-lev-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeLevModal(); });
document.getElementById('lightbox').addEventListener('click', e => { if (e.target === e.currentTarget) sluitLightbox(); });
document.getElementById('nieuwe-cat').addEventListener('keydown', e => { if (e.key === 'Enter') voegCatToe(); });
document.getElementById('nieuwe-loc').addEventListener('keydown', e => { if (e.key === 'Enter') voegLocToe(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeCatModal(); closeLocModal(); closeLevModal(); sluitLightbox(); }
});

// ── Opstarten ──
(async () => {
  document.getElementById('tbody').innerHTML = '<tr><td colspan="9" class="leeg-cel">Gegevens laden...</td></tr>';
  [artikelen, categorieen, locaties, leveranciers] = await Promise.all([
    dbGet(`${API_ART}?order=naam.asc`),
    dbGet(`${API_CAT}?order=naam.asc`),
    dbGet(`${API_LOC}?order=naam.asc`),
    dbGet(`${API_LEV}?order=naam.asc`),
  ]);
  vulDropdowns();
  render();
})();