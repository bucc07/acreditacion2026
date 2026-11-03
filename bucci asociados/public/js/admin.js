/* =====================================================
   Panel de administración — Bucci y Asociados
   ===================================================== */
const $ = (id) => document.getElementById(id);
let consultas = [];      // lista actual (según filtros)
let actual = null;       // consulta abierta en el detalle

/* ---------- Sesión ---------- */
const getToken = () => sessionStorage.getItem('bucci_token');

function mostrarLogin(mensaje = '') {
  sessionStorage.removeItem('bucci_token');
  $('vista-panel').hidden = true;
  $('vista-login').hidden = false;
  $('login-error').textContent = mensaje;
}
function mostrarPanel() {
  $('vista-login').hidden = true;
  $('vista-panel').hidden = false;
  $('admin-nombre').textContent = sessionStorage.getItem('bucci_nombre') || '';
  cargarTodo();
}

/* Fetch con token; si el servidor responde 401 se cierra la sesión */
async function api(url, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken(), ...(opciones.headers || {}) },
  });
  if (res.status === 401) { mostrarLogin('Tu sesión expiró. Ingresá de nuevo.'); throw new Error('401'); }
  if (!res.ok) throw new Error('Error ' + res.status);
  return res.json();
}

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: $('usuario').value.trim(), password: $('password').value }),
    });
    const datos = await res.json();
    if (!res.ok) { $('login-error').textContent = datos.error || 'No se pudo iniciar sesión'; return; }
    sessionStorage.setItem('bucci_token', datos.token);
    sessionStorage.setItem('bucci_nombre', datos.nombre);
    $('password').value = '';
    mostrarPanel();
  } catch {
    $('login-error').textContent = 'No se pudo conectar con el servidor.';
  }
});

$('ver-pass').addEventListener('click', () => {
  const oculto = $('password').type === 'password';
  $('password').type = oculto ? 'text' : 'password';
  $('ver-pass').innerHTML = `<i class="bi ${oculto ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
  $('ver-pass').setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

$('btn-logout').addEventListener('click', () => mostrarLogin());

/* ---------- Carga de datos ---------- */
async function cargarResumen() {
  const r = await api('/api/consultas/resumen');
  $('r-total').textContent = r.total;
  $('r-nuevas').textContent = r.no_leidas;
  $('r-leidas').textContent = r.total - r.no_leidas;
}

async function cargarConsultas() {
  const p = new URLSearchParams();
  if ($('f-q').value.trim()) p.set('q', $('f-q').value.trim());
  if ($('f-estado').value) p.set('estado', $('f-estado').value);
  if ($('f-desde').value) p.set('desde', $('f-desde').value);
  if ($('f-hasta').value) p.set('hasta', $('f-hasta').value);
  consultas = await api('/api/consultas?' + p.toString());
  renderTabla();
}

const cargarTodo = () => Promise.all([cargarResumen(), cargarConsultas()]).catch(() => {});

const fmtFecha = (f) => new Date(f).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

function renderTabla() {
  const tbody = $('tbody');
  tbody.innerHTML = '';
  $('vacio').hidden = consultas.length > 0;

  consultas.forEach((c) => {
    const tr = document.createElement('tr');
    if (!c.leida) tr.className = 'nueva';

    const celdaEstado = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge ' + (c.leida ? 'leida' : 'nueva');
    badge.textContent = c.leida ? 'Leída' : 'Nueva';
    celdaEstado.appendChild(badge);

    const celdas = [c.nombre, c.email, c.asunto, c.servicio || '—', fmtFecha(c.fecha)].map((t) => {
      const td = document.createElement('td');
      td.textContent = t;
      return td;
    });

    const celdaAccion = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.title = c.leida ? 'Marcar como no leída' : 'Marcar como leída';
    btn.innerHTML = `<i class="bi ${c.leida ? 'bi-envelope' : 'bi-envelope-open'}"></i>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); cambiarEstado(c.id, !c.leida); });
    celdaAccion.appendChild(btn);

    tr.append(celdaEstado, ...celdas, celdaAccion);
    tr.addEventListener('click', () => abrirDetalle(c.id));
    tbody.appendChild(tr);
  });
}

/* ---------- Acciones ---------- */
async function cambiarEstado(id, leida) {
  await api(`/api/consultas/${id}/leida`, { method: 'PATCH', body: JSON.stringify({ leida }) });
  await cargarTodo();
}

async function abrirDetalle(id) {
  actual = await api('/api/consultas/' + id);
  $('d-asunto').textContent = actual.asunto;
  $('d-nombre').textContent = actual.nombre;
  $('d-email').textContent = actual.email;
  $('d-email').href = 'mailto:' + actual.email;
  $('d-telefono').textContent = actual.telefono || '—';
  $('d-fecha').textContent = fmtFecha(actual.fecha);
  $('d-servicio').textContent = actual.servicio || '—';
  $('d-servicio').textContent = actual.servicio || 'Consulta general';
  $('d-estado').textContent = actual.leida
    ? 'Leída' + (actual.leida_por_nombre ? ` por ${actual.leida_por_nombre}` : '')
    : 'No leída';
  $('d-leida-por').textContent = actual.leida ? (actual.leida_por_nombre || '—') : '—';
  $('d-mensaje').textContent = actual.mensaje;
  $('d-toggle').textContent = actual.leida ? 'Marcar como no leída' : 'Marcar como leída';
  $('detalle').showModal();
}

$('d-toggle').addEventListener('click', async () => {
  await cambiarEstado(actual.id, !actual.leida);
  $('detalle').close();
});

$('d-eliminar').addEventListener('click', async () => {
  if (!confirm('¿Eliminar esta consulta? No se puede deshacer.')) return;
  await api('/api/consultas/' + actual.id, { method: 'DELETE' });
  $('detalle').close();
  cargarTodo();
});

$('d-cerrar').addEventListener('click', () => $('detalle').close());
$('detalle').addEventListener('click', (e) => { if (e.target === $('detalle')) $('detalle').close(); });

/* ---------- Filtros ---------- */
let temporizador;
$('f-q').addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(cargarConsultas, 300); });
['f-estado', 'f-desde', 'f-hasta'].forEach((id) => $(id).addEventListener('change', cargarConsultas));
$('btn-limpiar').addEventListener('click', () => { $('filtros').reset(); cargarConsultas(); });
$('filtros').addEventListener('submit', (e) => e.preventDefault());

/* ---------- Exportar CSV (lo que se ve en pantalla) ---------- */
$('btn-csv').addEventListener('click', () => {
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const filas = [['ID', 'Nombre', 'Email', 'Asunto', 'Servicio', 'Fecha', 'Estado'].map(esc).join(',')];
  consultas.forEach((c) => filas.push([c.id, c.nombre, c.email, c.asunto, c.servicio || '', fmtFecha(c.fecha), c.leida ? 'Leída' : 'No leída'].map(esc).join(',')));
  const blob = new Blob(['\ufeff' + filas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'consultas-bucci.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- Inicio: si ya hay token, entra directo ---------- */
if (getToken()) mostrarPanel();
