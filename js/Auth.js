const SUPABASE_URL_AUTH = 'https://stfntvxgzblnuptbvpsg.supabase.co';
const SUPABASE_KEY_AUTH = 'sb_publishable_L5uO_6r1WrIrcZeb-Kzv9A_Hx1FYqEq';
const API_AUTH = SUPABASE_URL_AUTH + '/auth/v1';

let authToken = localStorage.getItem('koreman_token') || null;

async function inloggen() {
  const email = document.getElementById('login-email').value.trim();
  const ww    = document.getElementById('login-ww').value;
  const fout  = document.getElementById('login-fout');
  const btn   = document.getElementById('login-btn');

  if (!email || !ww) { fout.textContent = 'Vul uw e-mailadres en wachtwoord in.'; return; }

  btn.textContent = 'Bezig...';
  btn.disabled = true;
  fout.textContent = '';

  const res = await fetch(API_AUTH + '/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY_AUTH },
    body: JSON.stringify({ email, password: ww }),
  });

  const data = await res.json();
  btn.textContent = 'Inloggen';
  btn.disabled = false;

  if (!res.ok) {
    fout.textContent = 'Onjuist e-mailadres of wachtwoord.';
    return;
  }

  authToken = data.access_token;
  localStorage.setItem('koreman_token', authToken);
  toonApp();
}

async function uitloggen() {
  await fetch(API_AUTH + '/logout', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY_AUTH, 'Authorization': 'Bearer ' + authToken },
  }).catch(() => {});
  authToken = null;
  localStorage.removeItem('koreman_token');
  document.getElementById('app-wrap').classList.add('verborgen');
  document.getElementById('login-scherm').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-ww').value = '';
  document.getElementById('login-fout').textContent = '';
}

document.getElementById('login-ww').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') inloggen();
});
document.getElementById('login-email').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('login-ww').focus();
});

// Automatisch inloggen als token nog geldig is
(async function() {
  if (!authToken) return;
  const res = await fetch(SUPABASE_URL_AUTH + '/auth/v1/user', {
    headers: { 'apikey': SUPABASE_KEY_AUTH, 'Authorization': 'Bearer ' + authToken },
  });
  if (res.ok) {
    toonApp();
  } else {
    authToken = null;
    localStorage.removeItem('koreman_token');
  }
})();