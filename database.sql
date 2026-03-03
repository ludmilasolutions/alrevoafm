-- =====================================================
-- BASE DE DATOS PARA SISTEMA DE TURNOS DE PELUQUERÍA
-- =====================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    telefono TEXT UNIQUE NOT NULL,
    email TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLA: servicios
-- =====================================================
CREATE TABLE IF NOT EXISTS servicios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    precio NUMERIC(10, 2) NOT NULL,
    activo BOOLEAN DEFAULT true
);

-- =====================================================
-- TABLA: turnos
-- =====================================================
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    servicio_id UUID REFERENCES servicios(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    hora TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'completado', 'cancelado')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_hora ON turnos(fecha, hora);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_servicios_activo ON servicios(activo);

-- =====================================================
-- DATOS INICIALES DE SERVICIOS
-- =====================================================
INSERT INTO servicios (nombre, precio, activo) VALUES
    ('Corte de cabello', 2500, true),
    ('Tintura', 5000, true),
    ('Peinado', 3000, true),
    ('Maquillaje', 4000, true),
    ('Manicura', 2000, true),
    ('Pedicura', 2500, true),
    ('Tratamiento capilar', 3500, true),
    ('Barbería', 3000, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS) - Desactivadas por defecto
-- Para producción, configurar políticas según necesidades
-- =====================================================
-- ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCIÓN PARA VERIFICAR HORARIOS DISPONIBLES
-- =====================================================
CREATE OR REPLACE FUNCTION verificar_horario_disponible(p_fecha DATE, p_hora TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    resultado BOOLEAN;
BEGIN
    SELECT COUNT(*) = 0 INTO resultado
    FROM turnos
    WHERE fecha = p_fecha AND hora = p_hora AND estado != 'cancelado';
    
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN PARA OBTENER HORARIOS OCUPADOS
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_horarios_ocupados(p_fecha DATE)
RETURNS TABLE(hora TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT t.hora
    FROM turnos t
    WHERE t.fecha = p_fecha AND t.estado != 'cancelado'
    ORDER BY t.hora;
END;
$$ LANGUAGE plpgsql;
