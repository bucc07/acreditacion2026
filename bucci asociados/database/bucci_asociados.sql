-- =====================================================
-- Bucci y Asociados — Base de datos
-- Acreditación de Programación IV
-- Ejecutar desde phpMyAdmin (pestaña SQL) o consola MySQL
-- =====================================================

DROP DATABASE IF EXISTS bucci_asociados;

CREATE DATABASE bucci_asociados
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bucci_asociados;

-- -----------------------------------------------------
-- Tabla: administradores
-- Guarda los usuarios que pueden entrar al panel.
-- La contraseña se guarda hasheada con bcrypt (nunca en texto plano).
-- -----------------------------------------------------
CREATE TABLE administradores (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabla: servicios
-- Listado que se muestra en el sitio público (GET /api/servicios).
-- precio NULL = se muestra "Consultar".
-- -----------------------------------------------------
CREATE TABLE servicios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion TEXT         NOT NULL,
  icono       VARCHAR(50)  NOT NULL,
  precio      DECIMAL(10,2) NULL,
  activo      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabla: consultas
-- Mensajes enviados desde el formulario de contacto.
-- leida: 0 = no leída, 1 = leída.
-- RELACIONES (claves foráneas):
--   consultas.servicio_id -> servicios.id        (N consultas : 1 servicio)
--   consultas.leida_por   -> administradores.id  (N consultas : 1 administrador)
-- ON DELETE SET NULL: si se borra el servicio o el admin, la consulta se conserva.
-- -----------------------------------------------------
CREATE TABLE consultas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  telefono    VARCHAR(30)  NULL,
  asunto      VARCHAR(150) NOT NULL,
  mensaje     TEXT         NOT NULL,
  fecha       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leida       TINYINT(1)   NOT NULL DEFAULT 0,
  servicio_id INT UNSIGNED NULL,   -- FK: servicio sobre el que consulta (opcional)
  leida_por   INT UNSIGNED NULL,   -- FK: administrador que la marcó como leída
  leida_en    TIMESTAMP    NULL,
  INDEX idx_leida (leida),
  INDEX idx_fecha (fecha),
  CONSTRAINT fk_consultas_servicio
    FOREIGN KEY (servicio_id) REFERENCES servicios (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_consultas_admin
    FOREIGN KEY (leida_por) REFERENCES administradores (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Administrador inicial
-- usuario: admin   |   contraseña: Bucci2026!
-- (hash bcrypt, 10 rondas) — cambiala antes de la entrega si querés
INSERT INTO administradores (usuario, password_hash, nombre) VALUES
('admin', '$2b$10$.MyHhSQlFizoL7cTlSX9P.N8oxupe11W1WU2jxCC0Aq.2Ptbqv/qG', 'Nicolás Bucci');

-- Servicios de la empresa
INSERT INTO servicios (nombre, descripcion, icono, precio) VALUES
('Soporte técnico',
 'Mantenimiento preventivo y correctivo de PCs, notebooks, impresoras y periféricos, con diagnóstico y reparación de fallas de hardware y software.',
 'bi-tools', NULL),
('Redes',
 'Diseño, instalación y configuración de redes cableadas e inalámbricas, cableado estructurado y configuración de routers, switches y puntos de acceso.',
 'bi-router', NULL),
('Capacitaciones',
 'Cursos de formación digital, uso de herramientas ofimáticas, seguridad informática básica y mantenimiento preventivo de equipos.',
 'bi-mortarboard', 15000.00);

-- Consultas de ejemplo (para probar el panel)
-- servicio_id 2 = Redes, 1 = Soporte técnico | leida_por 1 = admin
INSERT INTO consultas (nombre, email, telefono, asunto, mensaje, leida, servicio_id, leida_por, leida_en) VALUES
('María Gómez', 'maria.gomez@ejemplo.com', '2964-555-0101', 'Red de oficina',
 'Necesitamos instalar una red cableada en una oficina de 8 puestos. ¿Pueden pasar a presupuestar?', 0, 2, NULL, NULL),
('Comercio El Faro', 'contacto@elfaro.example.com', NULL, 'Mantenimiento de equipos',
 'Tenemos 5 PCs lentas en el local y queremos un servicio de mantenimiento preventivo.', 1, 1, 1, NOW());
