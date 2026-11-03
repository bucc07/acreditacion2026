/* =====================================================
   Bucci y Asociados — Servidor (Node.js + Express + MySQL)
   ===================================================== */
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3001; // 3001 para no chocar con Live Server (3000)
const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-este-secreto-en-produccion';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',   // XAMPP: root sin contraseña
  database: process.env.DB_NAME || 'bucci_asociados',
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // sirve el frontend

/* ---------- Conexión simple a MySQL (createConnection, SIN pool) ----------
   Una sola conexión alcanza para este proyecto (pocos usuarios simultáneos).
   Si MySQL la cierra por inactividad, query() la reabre y reintenta una vez. */
let db;
async function conectarDB() {
  db = await mysql.createConnection(DB_CONFIG);
  console.log('Conectado a MySQL:', DB_CONFIG.database);
}
async function query(sql, params = []) {
  try {
    const [filas] = await db.query(sql, params);
    return filas;
  } catch (err) {
    if (err.fatal || err.code === 'PROTOCOL_CONNECTION_LOST') {
      await conectarDB();
      const [filas] = await db.query(sql, params);
      return filas;
    }
    throw err;
  }
}

/* Envuelve rutas async para atrapar errores */
const ruta = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

/* ---------- Autenticación (JWT) ---------- */
function requiereAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'No autorizado' });
  }
}

app.post('/api/login', ruta(async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Completá usuario y contraseña' });

  const [admin] = await query('SELECT * FROM administradores WHERE usuario = ?', [usuario]);
  const ok = admin && (await bcrypt.compare(password, admin.password_hash));
  if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = jwt.sign({ id: admin.id, usuario: admin.usuario, nombre: admin.nombre }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, nombre: admin.nombre });
}));

/* ---------- Rutas públicas ---------- */
app.get('/api/servicios', ruta(async (req, res) => {
  res.json(await query('SELECT id, nombre, descripcion, icono, precio FROM servicios WHERE activo = 1 ORDER BY id'));
}));

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
app.post('/api/consultas', ruta(async (req, res) => {
  const { nombre = '', email = '', telefono = '', asunto = '', mensaje = '', servicio_id = null } = req.body;
  const n = nombre.trim(), e = email.trim(), t = telefono.trim(), a = asunto.trim(), m = mensaje.trim();

  if (n.length < 3 || a.length < 3 || !REGEX_EMAIL.test(e) || m.length < 20) {
    return res.status(400).json({ error: 'Datos inválidos: revisá nombre, email, asunto y mensaje (mín. 20 caracteres)' });
  }

  // servicio_id es opcional, pero si viene tiene que existir (clave foránea)
  let servicioId = null;
  if (req.body.servicio_id !== undefined && req.body.servicio_id !== null && req.body.servicio_id !== '') {
    servicioId = Number.parseInt(req.body.servicio_id, 10);
    const [serv] = Number.isInteger(servicioId)
      ? await query('SELECT id FROM servicios WHERE id = ? AND activo = 1', [servicioId])
      : [];
    if (!serv) return res.status(400).json({ error: 'El servicio elegido no existe' });
  }

  const r = await query(
    'INSERT INTO consultas (nombre, email, telefono, asunto, mensaje, servicio_id) VALUES (?, ?, ?, ?, ?, ?)',
    [n.slice(0, 100), e.slice(0, 150), t ? t.slice(0, 30) : null, a.slice(0, 150), m, servicioId]
  );
  res.status(201).json({ id: r.insertId });
}));

/* ---------- Rutas protegidas (panel) ---------- */
app.get('/api/consultas/resumen', requiereAuth, ruta(async (req, res) => {
  const [r] = await query('SELECT COUNT(*) AS total, COALESCE(SUM(leida = 0), 0) AS no_leidas FROM consultas');
  res.json({ total: Number(r.total), no_leidas: Number(r.no_leidas) });
}));

// Filtros: ?estado=leidas|no_leidas &desde=YYYY-MM-DD &hasta=YYYY-MM-DD &q=texto
app.get('/api/consultas', requiereAuth, ruta(async (req, res) => {
  const { estado, desde, hasta, q } = req.query;
  const where = [], params = [];
  if (estado === 'leidas') where.push('c.leida = 1');
  if (estado === 'no_leidas') where.push('c.leida = 0');
  if (desde) { where.push('DATE(c.fecha) >= ?'); params.push(desde); }
  if (hasta) { where.push('DATE(c.fecha) <= ?'); params.push(hasta); }
  if (q) { where.push('(c.nombre LIKE ? OR c.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  // JOIN con servicios usando la clave foránea consultas.servicio_id
  const sql = 'SELECT c.id, c.nombre, c.email, c.asunto, c.fecha, c.leida, s.nombre AS servicio ' +
    'FROM consultas c LEFT JOIN servicios s ON s.id = c.servicio_id' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY c.fecha DESC';
  res.json(await query(sql, params));
}));

app.get('/api/consultas/:id', requiereAuth, ruta(async (req, res) => {
  const [c] = await query(
    `SELECT c.*, s.nombre AS servicio, a.nombre AS leida_por_nombre
     FROM consultas c
     LEFT JOIN servicios s ON s.id = c.servicio_id
     LEFT JOIN administradores a ON a.id = c.leida_por
     WHERE c.id = ?`, [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });
  res.json(c);
}));

app.patch('/api/consultas/:id/leida', requiereAuth, ruta(async (req, res) => {
  // Al marcar como leída se guarda qué administrador lo hizo (clave foránea leida_por)
  const leida = req.body.leida ? 1 : 0;
  const r = await query('UPDATE consultas SET leida = ?, leida_por = ? WHERE id = ?',
    [leida, leida ? req.admin.id : null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Consulta no encontrada' });
  res.json({ ok: true });
}));

app.delete('/api/consultas/:id', requiereAuth, ruta(async (req, res) => {
  const r = await query('DELETE FROM consultas WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Consulta no encontrada' });
  res.json({ ok: true });
}));

/* ---------- Arranque ---------- */
conectarDB()
  .then(() => app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('No se pudo conectar a MySQL. ¿Está iniciado en XAMPP y creaste la base?\n', err.message);
    process.exit(1);
  });
