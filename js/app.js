// ── Supabase configuratie ──
const SUPABASE_URL = 'https://stfntvxgzblnuptbvpsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L5uO_6r1WrIrcZeb-Kzv9A_Hx1FYqEq';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

const API = `${SUPABASE_URL}/rest/v1/artikelen`;

async function laadArtikelen() {
  const res = await fetch(`${API}?order=id.asc`, { headers });
  if (!res.ok) { console.error('Fout bij ophalen:', await res.text()); return []; }
  return await res.json();
}

async function voegToe(artikel) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(artikel),
  });
  if (!res.ok) { console.error('Fout bij toevoegen:', await res.text()); return null; }
  const data = await res.json();
  return data[0];
}

async function updateArtikel(id, wijzigingen) {
  const res = await fetch(`${API}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(wijzigingen),
  });
  if (!res.ok) { console.error('Fout bij updaten:', await res.text()); return null; }
  const data = await res.json();
  return data[0];
}

async function verwijderArtikel(id) {
  const res = await fetch(`${API}?id=eq.${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) { console.error('Fout bij verwijderen:', await res.text()); }
}

let artikelen = [];
let editId = null;

function status(a) {
  if (a.stock === 0) return 'leeg';
  if (a.stock < a.min) return 'laag';
  return 'ok';
}

function statusLabel(s) {
  if (s === 'ok')   return 'Op voorraad';
  if (s === 'laag') return 'Bijna op';
  return 'Bestellen';
}

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

  if (lijst.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="leeg-cel">Geen artikelen gevonden</td></tr>';
  } else {
    tbody.innerHTML = lijst.map(a => {
      const s = status(a);
      return `
        <tr>
          <td class="naam-cel" title="${a.naam}">${a.naam}</td>
          <td><span class="cat-pill">${a.cat}</span></td>
          <td style="color:var(--subtekst)">${a.maat || '—'}</td>
          <td style="font-weight:500">${a.stock}</td>
          <td style="color:var(--subtekst)">${a.min}</td>
          <td>
            <span class="status-dot status-${s}">
              <span class="dot dot-${s}"></span>${statusLabel(s)}
            </span>
          </td>
          <td>
            <div class="acties-cel">
              <button class="btn-ic" onclick="bewerk(${a.id})" title="Bewerken">✎</button>
              <button class="btn-ic rood" onclick="verwijder(${a.id})" title="Verwijderen">✕</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  document.getElementById('s-totaal').textContent = artikelen.length;
  document.getElementById('s-ok').textContent     = artikelen.filter(a => status(a) === 'ok').length;
  document.getElementById('s-laag').textContent   = artikelen.filter(a => status(a) === 'laag').length;
  document.getElementById('s-leeg').textContent   = artikelen.filter(a => status(a) === 'leeg').length;

  const aandacht = artikelen.filter(a => status(a) !== 'ok');
  const bar = document.getElementById('alert-bar');
  if (aandacht.length > 0) {
    bar.textContent = `${aandacht.length} artikel(en) vereisen aandacht: ${aandacht.map(a => a.naam).join(' · ')}`;
    bar.classList.add('show');
  } else {
    bar.classList.remove('show');
  }
}

function toonLader(aan) {
  document.getElementById('tbody').innerHTML = aan
    ? '<tr><td colspan="7" class="leeg-cel">Gegevens laden...</td></tr>'
    : '';
}

async function verwijder(id) {
  if (!confirm('Weet u zeker dat u dit artikel wilt verwijderen?')) return;
  await verwijderArtikel(id);
  artikelen = artikelen.filter(a => a.id !== id);
  render();
}

function openModal() {
  editId = null;
  document.getElementById('modal-titel').textContent = 'Nieuw artikel';
  document.getElementById('f-naam').value  = '';
  document.getElementById('f-cat-m').value = 'Vloerkleed';
  document.getElementById('f-maat').value  = '';
  document.getElementById('f-stock').value = '0';
  document.getElementById('f-min').value   = '2';
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

function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
}

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
  btn.textContent = 'Bezig...';
  btn.disabled = true;

  if (editId !== null) {
    const bijgewerkt = await updateArtikel(editId, gegevens);
    if (bijgewerkt) {
      const idx = artikelen.findIndex(a => a.id === editId);
      artikelen[idx] = bijgewerkt;
    }
  } else {
    const nieuw = await voegToe(gegevens);
    if (nieuw) artikelen.push(nieuw);
  }

  btn.textContent = 'Opslaan';
  btn.disabled = false;
  closeModal();
  render();
}

document.getElementById('modal-bg').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && document.getElementById('modal-bg').classList.contains('open')) {
    opslaan();
  }
});

(async () => {
  toonLader(true);
  artikelen = await laadArtikelen();
  render();
})();