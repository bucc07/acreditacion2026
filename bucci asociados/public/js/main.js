/* =====================================================
   Menú móvil
   ===================================================== */
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

navToggle.addEventListener('click', () => {
  const abierto = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', abierto);
});
mainNav.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    mainNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  })
);

/* =====================================================
   Servicios — GET /api/servicios (con respaldo si el backend no responde)
   ===================================================== */
const SERVICIOS_RESPALDO = [
  { nombre: 'Soporte técnico', icono: 'bi-tools', precio: null,
    descripcion: 'Mantenimiento preventivo y correctivo de PCs, notebooks, impresoras y periféricos.' },
  { nombre: 'Redes', icono: 'bi-router', precio: null,
    descripcion: 'Diseño, instalación y configuración de redes cableadas e inalámbricas.' },
  { nombre: 'Capacitaciones', icono: 'bi-mortarboard', precio: 15000,
    descripcion: 'Cursos de formación digital, herramientas ofimáticas y seguridad informática básica.' },
];

function formatearPrecio(precio) {
  if (precio === null || precio === undefined) return 'Consultar';
  return 'Desde ' + Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function llenarSelectServicios(servicios) {
  const select = document.getElementById('servicio_id');
  select.length = 1; // deja solo "Consulta general"
  servicios.filter((s) => s.id).forEach((s) => select.add(new Option(s.nombre, s.id)));
}

function renderServicios(servicios) {
  llenarSelectServicios(servicios);
  const lista = document.getElementById('servicios-lista');
  lista.innerHTML = '';

  // Opciones del formulario (solo servicios que vienen de la base, con id)
  const select = document.getElementById('servicio');
  select.length = 1;
  servicios.filter((s) => s.id).forEach((s) => select.add(new Option(s.nombre, s.id)));

  servicios.forEach((s) => {
    const card = document.createElement('article');
    card.className = 'card';

    const icono = document.createElement('i');
    icono.className = `bi ${s.icono} card-icon`;

    const titulo = document.createElement('h3');
    titulo.textContent = s.nombre;

    const desc = document.createElement('p');
    desc.textContent = s.descripcion;

    const precio = document.createElement('p');
    precio.className = 'price';
    precio.textContent = formatearPrecio(s.precio);

    card.append(icono, titulo, desc, precio);
    lista.appendChild(card);
  });
}

async function cargarServicios() {
  try {
    const res = await fetch('/api/servicios');
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    renderServicios(await res.json());
  } catch (err) {
    console.warn('No se pudo cargar /api/servicios, se usan datos de respaldo:', err.message);
    renderServicios(SERVICIOS_RESPALDO);
  }
}
cargarServicios();

/* =====================================================
   Formulario de consultas — validación en cliente + POST /api/consultas
   ===================================================== */
const form = document.getElementById('form-consulta');
const status = document.getElementById('form-status');
const btnEnviar = document.getElementById('btn-enviar');
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_TEL = /^[0-9+\-()\s]{6,20}$/;

const reglas = {
  nombre:   (v) => (v.length < 3 ? 'Ingresá tu nombre (mínimo 3 caracteres).' : ''),
  email:    (v) => (!v ? 'El email es obligatorio.' : !REGEX_EMAIL.test(v) ? 'Ingresá un email válido.' : ''),
  telefono: (v) => (v && !REGEX_TEL.test(v) ? 'Teléfono no válido (solo números, +, -, paréntesis).' : ''),
  asunto:   (v) => (v.length < 3 ? 'Ingresá un asunto.' : ''),
  mensaje:  (v) => (v.length < 20 ? `El mensaje debe tener al menos 20 caracteres (${v.length}/20).` : ''),
};

function validarCampo(nombre) {
  const input = form.elements[nombre];
  const mensaje = reglas[nombre](input.value.trim());
  document.getElementById(`error-${nombre}`).textContent = mensaje;
  input.closest('.field').classList.toggle('invalid', Boolean(mensaje));
  return !mensaje;
}

Object.keys(reglas).forEach((nombre) => {
  form.elements[nombre].addEventListener('blur', () => validarCampo(nombre));
  form.elements[nombre].addEventListener('input', () => {
    if (form.elements[nombre].closest('.field').classList.contains('invalid')) validarCampo(nombre);
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.className = 'form-status';
  status.textContent = '';

  const validos = Object.keys(reglas).map(validarCampo);
  if (validos.includes(false)) {
    status.className = 'form-status fail';
    status.textContent = 'Revisá los campos marcados.';
    return;
  }

  const datos = {};
  Object.keys(reglas).forEach((n) => (datos[n] = form.elements[n].value.trim()));
  datos.servicio_id = form.elements.servicio_id.value || null;
  datos.servicio_id = form.elements['servicio'].value || null;

  btnEnviar.disabled = true;
  try {
    const res = await fetch('/api/consultas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    status.className = 'form-status ok';
    status.textContent = '¡Gracias! Recibimos tu consulta y te responderemos a la brevedad.';
    form.reset();
  } catch (err) {
    console.error('Error al enviar la consulta:', err);
    status.className = 'form-status fail';
    status.textContent = 'No pudimos enviar tu consulta. Intentá de nuevo en unos minutos.';
  } finally {
    btnEnviar.disabled = false;
  }
});

/* =====================================================
   Extras: animaciones, contadores, menú activo, volver arriba
   ===================================================== */

// Aparición suave al hacer scroll
const aRevelar = document.querySelectorAll('.card, .member, .faq-item, .section-title');
aRevelar.forEach((el) => el.classList.add('reveal'));
const revealObserver = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.15 });
aRevelar.forEach((el) => revealObserver.observe(el));

// Contadores animados
function animarContador(el) {
  const meta = Number(el.dataset.count);
  const sufijo = el.dataset.suffix || '';
  const prefijo = sufijo ? '' : '+';
  const duracion = 1400;
  const inicio = performance.now();
  function paso(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    el.textContent = prefijo + Math.round(meta * progreso) + sufijo;
    if (progreso < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}
const contadorObserver = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => {
    if (e.isIntersecting) { animarContador(e.target); contadorObserver.unobserve(e.target); }
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach((el) => contadorObserver.observe(el));

// Link del menú activo según la sección visible
const enlacesMenu = document.querySelectorAll('.main-nav a[href^="#"]');
const seccionObserver = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => {
    if (e.isIntersecting) {
      enlacesMenu.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach((s) => seccionObserver.observe(s));

// Botón volver arriba
const botonArriba = document.getElementById('to-top');
window.addEventListener('scroll', () => {
  botonArriba.classList.toggle('show', window.scrollY > 600);
});

// Carrusel: se duplican los pasos para que el movimiento sea infinito
const pista = document.getElementById('steps-track');
[...pista.children].forEach((paso) => {
  const copia = paso.cloneNode(true);
  copia.setAttribute('aria-hidden', 'true');
  pista.appendChild(copia);
});
const carrusel = document.getElementById('carousel');
const btnCarrusel = document.getElementById('carousel-toggle');
btnCarrusel.addEventListener('click', () => {
  const pausado = carrusel.classList.toggle('pausado');
  btnCarrusel.innerHTML = pausado ? '<i class="bi bi-play-fill"></i> <span>Reanudar</span>' : '<i class="bi bi-pause-fill"></i> <span>Pausar</span>';
  btnCarrusel.setAttribute('aria-label', pausado ? 'Reanudar carrusel' : 'Pausar carrusel');
});

// Modo oscuro (usa la preferencia del sistema la primera vez y se recuerda)
const btnTema = document.getElementById('tema-toggle');
const raiz = document.documentElement;

function aplicarTema(tema) {
  raiz.dataset.tema = tema;
  const oscuro = tema === 'dark';
  btnTema.innerHTML = `<i class="bi ${oscuro ? 'bi-sun-fill' : 'bi-moon-stars-fill'}"></i>`;
  btnTema.setAttribute('aria-pressed', oscuro);
  btnTema.setAttribute('aria-label', oscuro ? 'Activar modo claro' : 'Activar modo oscuro');
  btnTema.title = oscuro ? 'Modo claro' : 'Modo oscuro';
}
aplicarTema(raiz.dataset.tema === 'dark' ? 'dark' : 'light');

btnTema.addEventListener('click', () => {
  const nuevo = raiz.dataset.tema === 'dark' ? 'light' : 'dark';
  aplicarTema(nuevo);
  try { localStorage.setItem('bucci_tema', nuevo); } catch (e) {}
});
