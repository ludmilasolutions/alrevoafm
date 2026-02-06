// Configuración de Supabase - REEMPLAZAR con tus credenciales
const SUPABASE_URL = 'https://nptthngcshkbuavkjujf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdHRobmdjc2hrYnVhdmtqdWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTAyMTcsImV4cCI6MjA4NTgyNjIxN30.0P2Yf-wHtNzgoIFLEN-DYME85NFEjKtmz2cyIkyuZfg';

// Inicialización única de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global de la aplicación
let appState = {
    usuario: null,
    permisos: [],
    carrito: [],
    pagos: [],
    descuento: { tipo: 'porcentaje', valor: 0 },
    productoActual: null,
    cajaActiva: null,
    modoOscuro: window.matchMedia('(prefers-color-scheme: dark)').matches
};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// Función principal de inicialización
async function initApp() {
    // Verificar sesión activa
    await checkSession();
    
    // Configurar eventos globales
    setupEventListeners();
    
    // Configurar atajos de teclado
    setupKeyboardShortcuts();
    
    // Cargar configuración inicial
    await cargarConfiguracion();
    
    // Verificar estado de caja
    await verificarCajaActiva();
    
    console.log('Sistema POS inicializado correctamente');
}

// ==================== AUTENTICACIÓN ====================
async function checkSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            // Cargar datos del usuario
            await cargarUsuario(session.user.id);
            // Mostrar aplicación
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            
            // Actualizar UI
            document.getElementById('user-name').textContent = appState.usuario?.username || 'Usuario';
            updateNavigationPermissions();
            
            // Enfocar campo scanner si estamos en sección venta
            if (document.getElementById('seccion-venta').classList.contains('active')) {
                document.getElementById('scanner-input').focus();
            }
        }
    } catch (error) {
        console.error('Error verificando sesión:', error);
        showNotification('Error al verificar sesión', 'error');
    }
}

async function cargarUsuario(userId) {
    try {
        const { data: usuario, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        if (usuario) {
            appState.usuario = usuario;
            await cargarPermisosUsuario(userId);
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }
}

async function cargarPermisosUsuario(userId) {
    try {
        const { data: permisos, error } = await supabaseClient
            .from('permisos')
            .select('permiso')
            .eq('usuario_id', userId)
            .eq('activo', true);
        
        if (error) throw error;
        
        appState.permisos = permisos.map(p => p.permiso);
    } catch (error) {
        console.error('Error cargando permisos:', error);
    }
}

// Login
document.getElementById('login-btn').addEventListener('click', async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Por favor ingrese email y contraseña', 'warning');
        return;
    }
    
    this.classList.add('loading');
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        if (data.user) {
            await cargarUsuario(data.user.id);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            document.getElementById('user-name').textContent = appState.usuario?.username || 'Usuario';
            updateNavigationPermissions();
            showNotification('Sesión iniciada correctamente', 'success');
            
            // Enfocar campo scanner
            document.getElementById('scanner-input').focus();
        }
    } catch (error) {
        console.error('Error en login:', error);
        document.getElementById('login-error').textContent = error.message;
        document.getElementById('login-error').style.display = 'block';
        showNotification('Error en inicio de sesión', 'error');
    } finally {
        this.classList.remove('loading');
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async function() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        // Resetear estado
        appState = {
            usuario: null,
            permisos: [],
            carrito: [],
            pagos: [],
            descuento: { tipo: 'porcentaje', valor: 0 },
            productoActual: null,
            cajaActiva: null
        };
        
        // Mostrar login
        document.getElementById('app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-error').style.display = 'none';
        
        showNotification('Sesión cerrada correctamente', 'success');
    } catch (error) {
        console.error('Error en logout:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
});

// ==================== PERMISOS DINÁMICOS ====================
async function hasPermission(permiso) {
    // Si es administrador, tiene todos los permisos
    if (appState.usuario?.rol === 'Administrador') {
        return true;
    }
    
    // Consultar permisos en tiempo real
    try {
        const { data, error } = await supabaseClient
            .from('permisos')
            .select('activo')
            .eq('usuario_id', appState.usuario?.id)
            .eq('permiso', permiso)
            .single();
        
        if (error || !data) return false;
        
        return data.activo;
    } catch (error) {
        console.error('Error verificando permiso:', error);
        return false;
    }
}

function updateNavigationPermissions() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const section = link.dataset.section;
        
        // Mostrar/ocultar según permisos
        switch(section) {
            case 'caja':
                if (!appState.usuario || (appState.usuario.rol !== 'Administrador' && !appState.permisos.includes('acceder_caja'))) {
                    link.style.display = 'none';
                }
                break;
            case 'reportes':
                if (!appState.usuario || (appState.usuario.rol !== 'Administrador' && !appState.permisos.includes('ver_reportes'))) {
                    link.style.display = 'none';
                }
                break;
            case 'configuracion':
                if (!appState.usuario || appState.usuario.rol !== 'Administrador') {
                    link.style.display = 'none';
                }
                break;
        }
    });
}

// ==================== NAVEGACIÓN RESPONSIVA ====================
function setupEventListeners() {
    // Navegación entre secciones
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetSection = this.dataset.section;
            showSection(targetSection);
            
            // Cerrar menú en móvil
            if (window.innerWidth < 768) {
                document.getElementById('main-nav').classList.remove('active');
            }
        });
    });
    
    // Menú hamburguesa
    document.getElementById('menu-toggle').addEventListener('click', function() {
        document.getElementById('main-nav').classList.toggle('active');
    });
    
    // Cerrar menú al hacer clic fuera (en móvil)
    document.addEventListener('click', function(e) {
        const nav = document.getElementById('main-nav');
        const toggle = document.getElementById('menu-toggle');
        
        if (window.innerWidth < 768 && 
            nav.classList.contains('active') && 
            !nav.contains(e.target) && 
            !toggle.contains(e.target)) {
            nav.classList.remove('active');
        }
    });
    
    // Campo scanner
    const scannerInput = document.getElementById('scanner-input');
    scannerInput.addEventListener('input', handleScannerInput);
    scannerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            buscarProductoPorCodigo(this.value);
            this.value = '';
        }
    });
    
    // Buscador manual (F6)
    document.getElementById('btn-buscar-manual').addEventListener('click', showBuscadorManual);
    
    // Carrito
    document.getElementById('btn-agregar-carrito').addEventListener('click', agregarAlCarrito);
    document.getElementById('btn-limpiar-carrito').addEventListener('click', limpiarCarrito);
    
    // Cantidad
    document.getElementById('btn-cantidad-menos').addEventListener('click', () => cambiarCantidad(-1));
    document.getElementById('btn-cantidad-mas').addEventListener('click', () => cambiarCantidad(1));
    document.getElementById('cantidad-producto').addEventListener('change', actualizarCantidad);
    
    // Descuento
    document.getElementById('btn-aplicar-descuento').addEventListener('click', aplicarDescuento);
    
    // Pagos
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.addEventListener('click', function() {
            seleccionarMedioPago(this.dataset.medio);
        });
    });
    
    document.getElementById('btn-agregar-pago').addEventListener('click', agregarPago);
    document.getElementById('btn-finalizar-venta').addEventListener('click', finalizarVenta);
    document.getElementById('btn-cancelar-venta').addEventListener('click', cancelarVenta);
    
    // Productos
    document.getElementById('btn-nuevo-producto').addEventListener('click', () => mostrarModalProducto());
    document.getElementById('btn-refrescar-productos').addEventListener('click', cargarProductos);
    document.getElementById('btn-filtrar-productos').addEventListener('click', cargarProductos);
    document.getElementById('filtro-productos').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') cargarProductos();
    });
    
    // Historial
    document.getElementById('btn-ventas-hoy').addEventListener('click', cargarVentasHoy);
    document.getElementById('btn-filtrar-historial').addEventListener('click', cargarHistorial);
    
    // Caja
    document.getElementById('btn-abrir-caja').addEventListener('click', mostrarModalAperturaCaja);
    document.getElementById('btn-cerrar-caja').addEventListener('click', cerrarCaja);
    
    // Reportes
    document.getElementById('btn-generar-reporte').addEventListener('click', generarReporte);
    
    // Configuración
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            mostrarTabConfiguracion(tabId);
        });
    });
    
    // Modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    
    // Cerrar modal al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // Buscador de productos
    document.getElementById('btn-buscar-productos').addEventListener('click', buscarProductosManual);
    
    // Formulario producto
    document.getElementById('form-producto').addEventListener('submit', guardarProducto);
    
    // Cálculo automático de precio
    document.getElementById('producto-precio-costo').addEventListener('input', calcularPrecioVenta);
    document.getElementById('producto-margen').addEventListener('input', calcularPrecioVenta);
    document.getElementById('producto-precio-venta').addEventListener('input', calcularMargen);
    
    // Apertura caja
    document.getElementById('form-apertura-caja').addEventListener('submit', abrirCaja);
}

function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Desactivar todos los enlaces
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    document.getElementById(`seccion-${sectionId}`).classList.add('active');
    
    // Activar enlace correspondiente
    document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add('active');
    
    // Actualizar título
    document.getElementById('current-section').textContent = sectionId.toUpperCase();
    
    // Enfocar scanner si es sección venta
    if (sectionId === 'venta') {
        setTimeout(() => {
            document.getElementById('scanner-input').focus();
        }, 100);
    }
    
    // Cargar datos según sección
    switch(sectionId) {
        case 'productos':
            cargarProductos();
            break;
        case 'historial':
            cargarVentasHoy();
            break;
        case 'caja':
            cargarEstadoCaja();
            break;
        case 'reportes':
            // Resetear fechas a hoy
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById('reporte-fecha-inicio').value = hoy;
            document.getElementById('reporte-fecha-fin').value = hoy;
            break;
        case 'configuracion':
            cargarConfiguracionTicket();
            break;
    }
}

// ==================== ATAJOS DE TECLADO ====================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Solo atajos en desktop y cuando no estemos en inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || window.innerWidth < 768) {
            return;
        }
        
        switch(e.key) {
            case 'F1':
                e.preventDefault();
                if (document.getElementById('btn-finalizar-venta') && !document.getElementById('btn-finalizar-venta').disabled) {
                    finalizarVenta();
                }
                break;
            case 'F2':
                e.preventDefault();
                document.getElementById('descuento-input').focus();
                break;
            case 'F3':
                e.preventDefault();
                // Eliminar último item del carrito
                if (appState.carrito.length > 0) {
                    appState.carrito.pop();
                    actualizarCarritoUI();
                }
                break;
            case 'F4':
                e.preventDefault();
                showSection('caja');
                break;
            case 'F5':
                e.preventDefault();
                if (document.getElementById('seccion-historial').classList.contains('active')) {
                    cargarVentasHoy();
                } else {
                    showSection('historial');
                }
                break;
            case 'F6':
                e.preventDefault();
                showBuscadorManual();
                break;
            case 'Escape':
                e.preventDefault();
                // Cerrar modales abiertos
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
                break;
            case '1':
                if (document.getElementById('seccion-venta').classList.contains('active')) {
                    seleccionarMedioPago('EFECTIVO');
                }
                break;
            case '2':
                if (document.getElementById('seccion-venta').classList.contains('active')) {
                    seleccionarMedioPago('TARJETA');
                }
                break;
            case '3':
                if (document.getElementById('seccion-venta').classList.contains('active')) {
                    seleccionarMedioPago('TRANSFERENCIA/QR');
                }
                break;
        }
    });
}

// ==================== GESTIÓN DE PRODUCTOS ====================
async function buscarProductoPorCodigo(codigo) {
    if (!codigo || codigo.trim() === '') return;
    
    try {
        const { data: producto, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('codigo_barra', codigo.trim())
            .eq('activo', true)
            .single();
        
        if (error) throw error;
        
        if (producto) {
            mostrarProductoEncontrado(producto);
        } else {
            showNotification('Producto no encontrado', 'warning');
        }
    } catch (error) {
        console.error('Error buscando producto:', error);
        showNotification('Error buscando producto', 'error');
    }
}

function mostrarProductoEncontrado(producto) {
    appState.productoActual = producto;
    
    const productoInfo = document.getElementById('producto-info');
    document.getElementById('producto-nombre').textContent = producto.nombre;
    document.getElementById('producto-precio').textContent = `S/ ${parseFloat(producto.precio_venta).toFixed(2)}`;
    document.getElementById('producto-stock').textContent = producto.stock;
    document.getElementById('cantidad-producto').value = 1;
    document.getElementById('cantidad-producto').max = producto.stock;
    
    productoInfo.style.display = 'block';
    
    // Resaltar visualmente
    productoInfo.style.animation = 'none';
    setTimeout(() => {
        productoInfo.style.animation = 'fadeIn 0.5s ease';
    }, 10);
}

function handleScannerInput(e) {
    // En móvil, enfocar automáticamente el campo
    if (window.innerWidth < 768) {
        e.target.focus();
    }
}

async function cargarProductos() {
    try {
        const filtro = document.getElementById('filtro-productos').value;
        const proveedor = document.getElementById('filtro-proveedor').value;
        const estado = document.getElementById('filtro-estado').value;
        
        let query = supabaseClient
            .from('productos')
            .select('*')
            .order('nombre');
        
        // Aplicar filtros
        if (filtro) {
            query = query.or(`codigo_barra.ilike.%${filtro}%,nombre.ilike.%${filtro}%`);
        }
        
        if (proveedor) {
            query = query.eq('proveedor', proveedor);
        }
        
        if (estado === 'activos') {
            query = query.eq('activo', true);
        } else if (estado === 'inactivos') {
            query = query.eq('activo', false);
        }
        
        const { data: productos, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.getElementById('productos-body');
        tbody.innerHTML = '';
        
        if (productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No se encontraron productos</td></tr>';
            return;
        }
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            const margen = producto.margen_ganancia ? 
                `${parseFloat(producto.margen_ganancia).toFixed(2)}%` : 'N/A';
            
            tr.innerHTML = `
                <td>${producto.codigo_barra}</td>
                <td>${producto.nombre}</td>
                <td>S/ ${parseFloat(producto.precio_venta).toFixed(2)}</td>
                <td>S/ ${parseFloat(producto.precio_costo).toFixed(2)}</td>
                <td>${margen}</td>
                <td>${producto.stock}</td>
                <td>${producto.proveedor || '-'}</td>
                <td>
                    <span class="${producto.activo ? 'text-success' : 'text-danger'}">
                        ${producto.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="acciones">
                    <button class="btn btn-sm" onclick="editarProducto('${producto.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarProducto('${producto.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // Cargar proveedores únicos para el filtro
        await cargarProveedores();
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos', 'error');
    }
}

async function cargarProveedores() {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('proveedor')
            .not('proveedor', 'is', null)
            .order('proveedor');
        
        if (error) throw error;
        
        const proveedores = [...new Set(data.map(p => p.proveedor))];
        const select = document.getElementById('filtro-proveedor');
        select.innerHTML = '<option value="">Todos los proveedores</option>';
        
        proveedores.forEach(proveedor => {
            if (proveedor) {
                const option = document.createElement('option');
                option.value = proveedor;
                option.textContent = proveedor;
                select.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error cargando proveedores:', error);
    }
}

function mostrarModalProducto(producto = null) {
    const modal = document.getElementById('modal-producto');
    const titulo = document.getElementById('modal-producto-titulo');
    const form = document.getElementById('form-producto');
    
    if (producto) {
        titulo.innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
        document.getElementById('producto-codigo').value = producto.codigo_barra;
        document.getElementById('producto-nombre').value = producto.nombre;
        document.getElementById('producto-precio-costo').value = producto.precio_costo;
        document.getElementById('producto-margen').value = producto.margen_ganancia || '';
        document.getElementById('producto-precio-venta').value = producto.precio_venta;
        document.getElementById('producto-stock').value = producto.stock;
        document.getElementById('producto-proveedor').value = producto.proveedor || '';
        document.getElementById('producto-activo').value = producto.activo;
        
        form.dataset.productoId = producto.id;
    } else {
        titulo.innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
        form.reset();
        delete form.dataset.productoId;
    }
    
    modal.classList.add('active');
    document.getElementById('producto-codigo').focus();
}

function calcularPrecioVenta() {
    const costo = parseFloat(document.getElementById('producto-precio-costo').value) || 0;
    const margen = parseFloat(document.getElementById('producto-margen').value) || 0;
    
    if (costo > 0 && margen > 0) {
        const precioVenta = costo * (1 + margen / 100);
        document.getElementById('producto-precio-venta').value = precioVenta.toFixed(2);
    }
}

function calcularMargen() {
    const costo = parseFloat(document.getElementById('producto-precio-costo').value) || 0;
    const venta = parseFloat(document.getElementById('producto-precio-venta').value) || 0;
    
    if (costo > 0 && venta > 0) {
        const margen = ((venta - costo) / costo) * 100;
        document.getElementById('producto-margen').value = margen.toFixed(2);
    }
}

async function guardarProducto(e) {
    e.preventDefault();
    
    // Verificar permiso
    const permiso = e.target.dataset.productoId ? 'modificar_productos' : 'cargar_productos';
    const tienePermiso = await hasPermission(permiso);
    
    if (!tienePermiso) {
        showNotification('No tiene permisos para esta acción', 'error');
        return;
    }
    
    const producto = {
        codigo_barra: document.getElementById('producto-codigo').value.trim(),
        nombre: document.getElementById('producto-nombre').value.trim(),
        precio_costo: parseFloat(document.getElementById('producto-precio-costo').value),
        precio_venta: parseFloat(document.getElementById('producto-precio-venta').value),
        stock: parseInt(document.getElementById('producto-stock').value),
        proveedor: document.getElementById('producto-proveedor').value.trim() || null,
        activo: document.getElementById('producto-activo').value === 'true',
        margen_ganancia: document.getElementById('producto-margen').value ? 
            parseFloat(document.getElementById('producto-margen').value) : null
    };
    
    // Validaciones
    if (!producto.codigo_barra || !producto.nombre) {
        showNotification('Código y nombre son obligatorios', 'warning');
        return;
    }
    
    if (producto.precio_costo < 0 || producto.precio_venta < 0) {
        showNotification('Los precios deben ser positivos', 'warning');
        return;
    }
    
    if (producto.stock < 0) {
        showNotification('El stock no puede ser negativo', 'warning');
        return;
    }
    
    try {
        let error;
        
        if (e.target.dataset.productoId) {
            // Actualizar producto existente
            const { error: updateError } = await supabaseClient
                .from('productos')
                .update(producto)
                .eq('id', e.target.dataset.productoId);
            
            error = updateError;
        } else {
            // Crear nuevo producto
            const { error: insertError } = await supabaseClient
                .from('productos')
                .insert([producto]);
            
            error = insertError;
        }
        
        if (error) throw error;
        
        showNotification('Producto guardado correctamente', 'success');
        document.getElementById('modal-producto').classList.remove('active');
        cargarProductos();
    } catch (error) {
        console.error('Error guardando producto:', error);
        
        if (error.code === '23505') {
            showNotification('El código de barras ya existe', 'error');
        } else {
            showNotification('Error guardando producto', 'error');
        }
    }
}

async function editarProducto(productoId) {
    try {
        const { data: producto, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('id', productoId)
            .single();
        
        if (error) throw error;
        
        mostrarModalProducto(producto);
    } catch (error) {
        console.error('Error cargando producto:', error);
        showNotification('Error cargando producto', 'error');
    }
}

async function eliminarProducto(productoId) {
    if (!await hasPermission('modificar_productos')) {
        showNotification('No tiene permisos para eliminar productos', 'error');
        return;
    }
    
    if (!confirm('¿Está seguro de eliminar este producto? Se marcará como inactivo.')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('productos')
            .update({ activo: false })
            .eq('id', productoId);
        
        if (error) throw error;
        
        showNotification('Producto eliminado correctamente', 'success');
        cargarProductos();
    } catch (error) {
        console.error('Error eliminando producto:', error);
        showNotification('Error eliminando producto', 'error');
    }
}

// ==================== PROCESO DE VENTA ====================
function cambiarCantidad(delta) {
    const input = document.getElementById('cantidad-producto');
    let nuevaCantidad = parseInt(input.value) + delta;
    
    if (nuevaCantidad < 1) nuevaCantidad = 1;
    if (nuevaCantidad > parseInt(input.max)) nuevaCantidad = parseInt(input.max);
    
    input.value = nuevaCantidad;
}

function actualizarCantidad() {
    const input = document.getElementById('cantidad-producto');
    let cantidad = parseInt(input.value);
    
    if (isNaN(cantidad) || cantidad < 1) cantidad = 1;
    if (cantidad > parseInt(input.max)) cantidad = parseInt(input.max);
    
    input.value = cantidad;
}

function agregarAlCarrito() {
    if (!appState.productoActual) {
        showNotification('No hay producto seleccionado', 'warning');
        return;
    }
    
    const cantidad = parseInt(document.getElementById('cantidad-producto').value);
    
    if (cantidad > appState.productoActual.stock) {
        showNotification('Stock insuficiente', 'error');
        return;
    }
    
    // Buscar si el producto ya está en el carrito
    const index = appState.carrito.findIndex(item => 
        item.producto.id === appState.productoActual.id);
    
    if (index !== -1) {
        // Actualizar cantidad
        appState.carrito[index].cantidad += cantidad;
    } else {
        // Agregar nuevo item
        appState.carrito.push({
            producto: appState.productoActual,
            cantidad: cantidad,
            precioUnitario: appState.productoActual.precio_venta
        });
    }
    
    // Actualizar UI
    actualizarCarritoUI();
    
    // Resetear producto actual
    appState.productoActual = null;
    document.getElementById('producto-info').style.display = 'none';
    document.getElementById('scanner-input').value = '';
    document.getElementById('scanner-input').focus();
    
    showNotification('Producto agregado al carrito', 'success');
}

function actualizarCarritoUI() {
    const container = document.getElementById('carrito-items');
    const subtotalEl = document.getElementById('carrito-subtotal');
    const totalEl = document.getElementById('carrito-total');
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    
    if (appState.carrito.length === 0) {
        container.innerHTML = `
            <div class="empty-carrito">
                <i class="fas fa-shopping-cart fa-2x"></i>
                <p>El carrito está vacío</p>
                <p>Escanee un producto o use F6 para buscar</p>
            </div>
        `;
        
        btnFinalizar.disabled = true;
        return;
    }
    
    // Calcular subtotal
    let subtotal = 0;
    
    container.innerHTML = '';
    appState.carrito.forEach((item, index) => {
        const itemTotal = item.cantidad * item.precioUnitario;
        subtotal += itemTotal;
        
        const div = document.createElement('div');
        div.className = 'carrito-item';
        div.innerHTML = `
            <div class="carrito-item-info">
                <div class="carrito-item-nombre">${item.producto.nombre}</div>
                <div class="carrito-item-codigo">${item.producto.codigo_barra}</div>
            </div>
            <div class="carrito-item-precio">S/ ${item.precioUnitario.toFixed(2)}</div>
            <div class="carrito-item-cantidad">
                <button class="btn btn-sm" onclick="actualizarCantidadCarrito(${index}, -1)">
                    <i class="fas fa-minus"></i>
                </button>
                <span>${item.cantidad}</span>
                <button class="btn btn-sm" onclick="actualizarCantidadCarrito(${index}, 1)">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="carrito-item-total">S/ ${itemTotal.toFixed(2)}</div>
            <button class="carrito-item-remove" onclick="eliminarDelCarrito(${index})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(div);
    });
    
    // Calcular descuento
    let descuento = 0;
    if (appState.descuento.valor > 0) {
        if (appState.descuento.tipo === 'porcentaje') {
            descuento = subtotal * (appState.descuento.valor / 100);
        } else {
            descuento = appState.descuento.valor;
        }
        
        if (descuento > subtotal) descuento = subtotal;
    }
    
    // Actualizar totales
    const total = subtotal - descuento;
    
    subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
    document.getElementById('carrito-descuento').textContent = `S/ ${descuento.toFixed(2)}`;
    totalEl.textContent = `S/ ${total.toFixed(2)}`;
    
    // Actualizar total a pagar
    document.getElementById('total-a-pagar').textContent = `S/ ${total.toFixed(2)}`;
    
    // Habilitar botón finalizar si hay productos
    btnFinalizar.disabled = appState.carrito.length === 0 || appState.pagos.length === 0;
}

function actualizarCantidadCarrito(index, delta) {
    const item = appState.carrito[index];
    const nuevaCantidad = item.cantidad + delta;
    
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(index);
        return;
    }
    
    if (nuevaCantidad > item.producto.stock) {
        showNotification('Stock insuficiente', 'error');
        return;
    }
    
    item.cantidad = nuevaCantidad;
    actualizarCarritoUI();
}

function eliminarDelCarrito(index) {
    appState.carrito.splice(index, 1);
    actualizarCarritoUI();
    showNotification('Producto eliminado del carrito', 'info');
}

function limpiarCarrito() {
    if (appState.carrito.length === 0) return;
    
    if (!confirm('¿Está seguro de vaciar el carrito?')) {
        return;
    }
    
    appState.carrito = [];
    appState.pagos = [];
    appState.descuento = { tipo: 'porcentaje', valor: 0 };
    
    document.getElementById('descuento-input').value = '';
    document.getElementById('descuento-tipo').value = 'porcentaje';
    
    actualizarCarritoUI();
    actualizarPagosUI();
    showNotification('Carrito vaciado', 'info');
}

function aplicarDescuento() {
    const valor = parseFloat(document.getElementById('descuento-input').value) || 0;
    const tipo = document.getElementById('descuento-tipo').value;
    
    if (valor <= 0) {
        showNotification('Ingrese un valor válido para el descuento', 'warning');
        return;
    }
    
    if (tipo === 'porcentaje' && valor > 100) {
        showNotification('El descuento porcentual no puede ser mayor a 100%', 'warning');
        return;
    }
    
    appState.descuento = { tipo, valor };
    actualizarCarritoUI();
    showNotification('Descuento aplicado correctamente', 'success');
}

// ==================== MEDIOS DE PAGO ====================
function seleccionarMedioPago(medio) {
    // Actualizar UI de botones
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.medio === medio) {
            btn.classList.add('active');
        }
    });
    
    // Establecer medio seleccionado
    document.getElementById('pago-monto').placeholder = `Monto en ${medio}`;
    document.getElementById('pago-monto').focus();
}

function agregarPago() {
    const medioElement = document.querySelector('.btn-pago.active');
    if (!medioElement) {
        showNotification('Seleccione un medio de pago primero', 'warning');
        return;
    }
    
    const medio = medioElement.dataset.medio;
    const monto = parseFloat(document.getElementById('pago-monto').value);
    
    if (!monto || monto <= 0) {
        showNotification('Ingrese un monto válido', 'warning');
        return;
    }
    
    // Verificar que no exceda el total
    const totalAPagar = parseFloat(document.getElementById('carrito-total').textContent.replace('S/ ', ''));
    const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    
    if (totalPagado + monto > totalAPagar) {
        showNotification('El monto excede el total a pagar', 'warning');
        return;
    }
    
    // Agregar pago
    appState.pagos.push({ medio, monto });
    
    // Actualizar UI
    actualizarPagosUI();
    
    // Resetear campos
    document.getElementById('pago-monto').value = '';
    showNotification('Pago agregado correctamente', 'success');
}

function actualizarPagosUI() {
    const container = document.getElementById('pagos-lista');
    const totalPagadoEl = document.getElementById('total-pagado');
    const cambioEl = document.getElementById('total-cambio');
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    
    if (appState.pagos.length === 0) {
        container.innerHTML = `
            <div class="empty-pagos">
                <i class="fas fa-receipt fa-2x"></i>
                <p>No hay pagos registrados</p>
            </div>
        `;
        
        totalPagadoEl.textContent = 'S/ 0.00';
        cambioEl.textContent = 'S/ 0.00';
        btnFinalizar.disabled = true;
        return;
    }
    
    // Calcular total pagado
    const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    const totalAPagar = parseFloat(document.getElementById('carrito-total').textContent.replace('S/ ', ''));
    const cambio = totalPagado - totalAPagar;
    
    // Mostrar pagos
    container.innerHTML = '';
    appState.pagos.forEach((pago, index) => {
        const div = document.createElement('div');
        div.className = 'pago-item';
        div.innerHTML = `
            <div>
                <strong>${pago.medio}</strong>
            </div>
            <div>
                S/ ${pago.monto.toFixed(2)}
            </div>
            <button class="pago-item-remove" onclick="eliminarPago(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(div);
    });
    
    // Actualizar totales
    totalPagadoEl.textContent = `S/ ${totalPagado.toFixed(2)}`;
    cambioEl.textContent = `S/ ${cambio >= 0 ? cambio.toFixed(2) : '0.00'}`;
    
    // Habilitar botón finalizar si se cubrió el total
    btnFinalizar.disabled = appState.carrito.length === 0 || totalPagado < totalAPagar;
}

function eliminarPago(index) {
    appState.pagos.splice(index, 1);
    actualizarPagosUI();
    showNotification('Pago eliminado', 'info');
}

// ==================== FINALIZACIÓN DE VENTA (ATÓMICA) ====================
async function finalizarVenta() {
    // Verificar caja activa
    if (!appState.cajaActiva) {
        showNotification('No hay caja activa. Abra una caja primero.', 'error');
        showSection('caja');
        return;
    }
    
    // Verificar que hay productos en el carrito
    if (appState.carrito.length === 0) {
        showNotification('El carrito está vacío', 'warning');
        return;
    }
    
    // Verificar que el total pagado cubre el total
    const totalAPagar = parseFloat(document.getElementById('carrito-total').textContent.replace('S/ ', ''));
    const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    
    if (totalPagado < totalAPagar) {
        showNotification('El pago no cubre el total de la venta', 'error');
        return;
    }
    
    // Deshabilitar botón para evitar múltiples clics
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    btnFinalizar.disabled = true;
    btnFinalizar.classList.add('loading');
    
    try {
        // PASO 1: Revalidar stock en tiempo real
        for (const item of appState.carrito) {
            const { data: producto, error } = await supabaseClient
                .from('productos')
                .select('stock')
                .eq('id', item.producto.id)
                .single();
            
            if (error) throw error;
            
            if (producto.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para ${item.producto.nombre}. Stock actual: ${producto.stock}`);
            }
        }
        
        // PASO 2: Generar ticket ID atómico
        const ticketId = await generarTicketIdAtomico();
        
        // PASO 3: Calcular subtotal y total
        const subtotal = appState.carrito.reduce((sum, item) => 
            sum + (item.cantidad * item.precioUnitario), 0);
        
        const descuento = appState.descuento.valor > 0 ? 
            (appState.descuento.tipo === 'porcentaje' ? 
                subtotal * (appState.descuento.valor / 100) : 
                appState.descuento.valor) : 0;
        
        const total = subtotal - descuento;
        
        // PASO 4: Crear venta en transacción
        const ventaData = {
            ticket_id: ticketId,
            caja_id: appState.cajaActiva.id,
            usuario_id: appState.usuario.id,
            subtotal: subtotal,
            descuento: descuento,
            total: total
        };
        
        // Insertar venta
        const { data: venta, error: ventaError } = await supabaseClient
            .from('ventas')
            .insert([ventaData])
            .select()
            .single();
        
        if (ventaError) throw ventaError;
        
        // Insertar detalles de venta
        const detalles = appState.carrito.map(item => ({
            venta_id: venta.id,
            producto_id: item.producto.id,
            cantidad: item.cantidad,
            precio_unitario: item.precioUnitario,
            subtotal: item.cantidad * item.precioUnitario
        }));
        
        const { error: detallesError } = await supabaseClient
            .from('detalle_ventas')
            .insert(detalles);
        
        if (detallesError) throw detallesError;
        
        // Insertar pagos
        const pagosData = appState.pagos.map(pago => ({
            venta_id: venta.id,
            medio_pago: pago.medio,
            monto: pago.monto
        }));
        
        const { error: pagosError } = await supabaseClient
            .from('pagos_venta')
            .insert(pagosData);
        
        if (pagosError) throw pagosError;
        
        // PASO 5: Generar ticket
        await generarTicket(venta);
        
        // PASO 6: Recargar estado desde BD
        await recargarEstadoPostVenta();
        
        // PASO 7: Resetear venta actual
        appState.carrito = [];
        appState.pagos = [];
        appState.descuento = { tipo: 'porcentaje', valor: 0 };
        
        document.getElementById('descuento-input').value = '';
        document.getElementById('descuento-tipo').value = 'porcentaje';
        
        actualizarCarritoUI();
        actualizarPagosUI();
        
        showNotification(`Venta finalizada correctamente: ${ticketId}`, 'success');
        
        // Enfocar scanner para próxima venta
        document.getElementById('scanner-input').focus();
        
    } catch (error) {
        console.error('Error finalizando venta:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        btnFinalizar.disabled = false;
        btnFinalizar.classList.remove('loading');
    }
}

async function generarTicketIdAtomico() {
    try {
        // Llamar a la función de BD que genera el ticket ID atómico
        const { data, error } = await supabaseClient.rpc('generar_ticket_id');
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error generando ticket ID:', error);
        throw new Error('No se pudo generar el número de ticket');
    }
}

async function generarTicket(venta) {
    try {
        // Cargar configuración del ticket
        const { data: config, error } = await supabaseClient
            .from('configuracion')
            .select('*');
        
        if (error) throw error;
        
        const configMap = {};
        config.forEach(item => {
            configMap[item.clave] = item.valor;
        });
        
        // Construir ticket
        const ticketContent = document.getElementById('ticket-content');
        const fecha = new Date(venta.fecha).toLocaleString('es-ES');
        
        let itemsHTML = '';
        appState.carrito.forEach(item => {
            const totalItem = item.cantidad * item.precioUnitario;
            itemsHTML += `
                <div class="ticket-item">
                    <div>${item.producto.nombre} x${item.cantidad}</div>
                    <div>S/ ${totalItem.toFixed(2)}</div>
                </div>
                <div style="font-size: 10px; margin-bottom: 5px;">
                    ${item.producto.codigo_barra} @ S/ ${item.precioUnitario.toFixed(2)}
                </div>
            `;
        });
        
        ticketContent.innerHTML = `
            <div class="ticket-header">
                <h1>${configMap.ticket_encabezado || 'AFMSOLUTIONS'}</h1>
                <div>${configMap.ticket_encabezado_extra || ''}</div>
                <div>${configMap.empresa_direccion || ''}</div>
                <div>${configMap.empresa_telefono || ''}</div>
                <div>${fecha}</div>
                <div><strong>Ticket: ${venta.ticket_id}</strong></div>
                <div>Atendido por: ${appState.usuario?.username || ''}</div>
            </div>
            
            <div class="ticket-items">
                ${itemsHTML}
            </div>
            
            <div class="ticket-totals">
                <div class="ticket-item">
                    <div>Subtotal:</div>
                    <div>S/ ${venta.subtotal.toFixed(2)}</div>
                </div>
                <div class="ticket-item">
                    <div>Descuento:</div>
                    <div>S/ ${venta.descuento.toFixed(2)}</div>
                </div>
                <div class="ticket-item">
                    <div><strong>TOTAL:</strong></div>
                    <div><strong>S/ ${venta.total.toFixed(2)}</strong></div>
                </div>
                
                <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px;">
                    <strong>PAGOS:</strong>
                    ${appState.pagos.map(pago => `
                        <div class="ticket-item">
                            <div>${pago.medio}:</div>
                            <div>S/ ${pago.monto.toFixed(2)}</div>
                        </div>
                    `).join('')}
                    
                    <div class="ticket-item">
                        <div>Cambio:</div>
                        <div>S/ ${(appState.pagos.reduce((s, p) => s + p.monto, 0) - venta.total).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div class="ticket-footer">
                <div>${configMap.ticket_pie || '¡Gracias por su compra!'}</div>
                <div>${configMap.ticket_legal || ''}</div>
                <div>${configMap.ticket_contacto || ''}</div>
            </div>
        `;
        
        // Imprimir ticket
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket ${venta.ticket_id}</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; }
                    .ticket-header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                    .ticket-header h1 { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
                    .ticket-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                    .ticket-totals { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
                    .ticket-footer { text-align: center; margin-top: 15px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
                    @media print { body { width: 80mm; } }
                </style>
            </head>
            <body>
                ${ticketContent.innerHTML}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 1000);
                    };
                </script>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Error generando ticket:', error);
        // No fallar la venta si hay error en el ticket
        showNotification('Venta registrada pero error generando ticket', 'warning');
    }
}

async function recargarEstadoPostVenta() {
    // Recargar productos del carrito para actualizar stock
    for (const item of appState.carrito) {
        try {
            const { data: producto, error } = await supabaseClient
                .from('productos')
                .select('stock')
                .eq('id', item.producto.id)
                .single();
            
            if (!error && producto) {
                // Actualizar en UI si el producto está visible
                const stockElement = document.querySelector(`[data-producto-id="${item.producto.id}"] .producto-stock`);
                if (stockElement) {
                    stockElement.textContent = producto.stock;
                }
            }
        } catch (e) {
            console.error('Error recargando stock:', e);
        }
    }
    
    // Recargar estado de caja
    await verificarCajaActiva();
}

function cancelarVenta() {
    if (appState.carrito.length === 0) return;
    
    if (!confirm('¿Está seguro de cancelar esta venta? Se perderán todos los productos del carrito.')) {
        return;
    }
    
    limpiarCarrito();
}

// ==================== BUSCADOR MANUAL (F6) ====================
function showBuscadorManual() {
    const modal = document.getElementById('modal-buscador');
    modal.classList.add('active');
    
    // Cargar proveedores para el buscador
    cargarProveedoresBuscador();
    
    // Enfocar primer campo
    document.getElementById('buscador-codigo').focus();
}

async function cargarProveedoresBuscador() {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('proveedor')
            .not('proveedor', 'is', null)
            .eq('activo', true)
            .order('proveedor');
        
        if (error) throw error;
        
        const proveedores = [...new Set(data.map(p => p.proveedor))];
        const select = document.getElementById('buscador-proveedor');
        select.innerHTML = '<option value="">Todos los proveedores</option>';
        
        proveedores.forEach(proveedor => {
            if (proveedor) {
                const option = document.createElement('option');
                option.value = proveedor;
                option.textContent = proveedor;
                select.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error cargando proveedores:', error);
    }
}

async function buscarProductosManual() {
    try {
        const codigo = document.getElementById('buscador-codigo').value;
        const nombre = document.getElementById('buscador-nombre').value;
        const proveedor = document.getElementById('buscador-proveedor').value;
        
        let query = supabaseClient
            .from('productos')
            .select('*')
            .eq('activo', true)
            .order('nombre');
        
        if (codigo) {
            query = query.ilike('codigo_barra', `%${codigo}%`);
        }
        
        if (nombre) {
            query = query.ilike('nombre', `%${nombre}%`);
        }
        
        if (proveedor) {
            query = query.eq('proveedor', proveedor);
        }
        
        const { data: productos, error } = await query.limit(50);
        
        if (error) throw error;
        
        const tbody = document.getElementById('buscador-body');
        tbody.innerHTML = '';
        
        if (productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No se encontraron productos</td></tr>';
            return;
        }
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.codigo_barra}</td>
                <td>${producto.nombre}</td>
                <td>S/ ${parseFloat(producto.precio_venta).toFixed(2)}</td>
                <td>${producto.stock}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="agregarDesdeBuscador('${producto.id}')">
                        <i class="fas fa-cart-plus"></i> Agregar
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error buscando productos:', error);
        showNotification('Error buscando productos', 'error');
    }
}

async function agregarDesdeBuscador(productoId) {
    try {
        const { data: producto, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('id', productoId)
            .eq('activo', true)
            .single();
        
        if (error) throw error;
        
        mostrarProductoEncontrado(producto);
        
        // Cerrar modal
        document.getElementById('modal-buscador').classList.remove('active');
        
        // Enfocar cantidad y auto-seleccionar
        document.getElementById('cantidad-producto').focus();
        document.getElementById('cantidad-producto').select();
        
    } catch (error) {
        console.error('Error cargando producto:', error);
        showNotification('Error cargando producto', 'error');
    }
}

// ==================== GESTIÓN DE CAJA ====================
async function verificarCajaActiva() {
    try {
        const { data: caja, error } = await supabaseClient
            .from('caja')
            .select('*')
            .is('fecha_cierre', null)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        appState.cajaActiva = caja || null;
        actualizarUIEstadoCaja();
        
        return caja;
    } catch (error) {
        console.error('Error verificando caja activa:', error);
        return null;
    }
}

function actualizarUIEstadoCaja() {
    const statusElement = document.getElementById('caja-status');
    const statusDetalle = document.getElementById('caja-detalle-status');
    const operaciones = document.getElementById('caja-operaciones');
    
    if (appState.cajaActiva) {
        // Caja abierta
        statusElement.innerHTML = `<i class="fas fa-circle"></i> Caja: Abierta`;
        statusElement.classList.add('abierta');
        
        statusDetalle.innerHTML = `
            <div class="caja-abierta">
                <i class="fas fa-unlock fa-3x text-success"></i>
                <h3>Caja Abierta</h3>
                <p>Abierta por: ${appState.usuario?.username || 'Usuario'}</p>
                <p>Monto inicial: S/ ${parseFloat(appState.cajaActiva.monto_inicial).toFixed(2)}</p>
                <p>Hora apertura: ${new Date(appState.cajaActiva.fecha_apertura).toLocaleTimeString()}</p>
            </div>
        `;
        
        operaciones.style.display = 'block';
        
        // Cargar resumen de caja
        cargarResumenCaja();
        
    } else {
        // Caja cerrada
        statusElement.innerHTML = `<i class="fas fa-circle"></i> Caja: Cerrada`;
        statusElement.classList.remove('abierta');
        
        statusDetalle.innerHTML = `
            <div class="caja-cerrada">
                <i class="fas fa-lock fa-3x"></i>
                <h3>Caja Cerrada</h3>
                <p>No hay caja activa en este momento</p>
                <button id="btn-abrir-caja" class="btn btn-primary">
                    <i class="fas fa-unlock"></i> Abrir Caja
                </button>
            </div>
        `;
        
        operaciones.style.display = 'none';
        
        // Reasignar evento al botón (por si se regeneró el HTML)
        const btn = document.getElementById('btn-abrir-caja');
        if (btn) {
            btn.onclick = mostrarModalAperturaCaja;
        }
    }
}

function mostrarModalAperturaCaja() {
    const modal = document.getElementById('modal-apertura-caja');
    modal.classList.add('active');
    document.getElementById('apertura-monto').focus();
}

async function abrirCaja(e) {
    e.preventDefault();
    
    const monto = parseFloat(document.getElementById('apertura-monto').value);
    
    if (!monto || monto < 0) {
        showNotification('Ingrese un monto inicial válido', 'warning');
        return;
    }
    
    try {
        // Verificar que no hay caja activa
        const cajaActiva = await verificarCajaActiva();
        if (cajaActiva) {
            showNotification('Ya hay una caja activa', 'error');
            return;
        }
        
        // Abrir caja
        const cajaData = {
            usuario_id: appState.usuario.id,
            monto_inicial: monto
        };
        
        const { data: caja, error } = await supabaseClient
            .from('caja')
            .insert([cajaData])
            .select()
            .single();
        
        if (error) throw error;
        
        appState.cajaActiva = caja;
        actualizarUIEstadoCaja();
        
        document.getElementById('modal-apertura-caja').classList.remove('active');
        showNotification('Caja abierta correctamente', 'success');
        
    } catch (error) {
        console.error('Error abriendo caja:', error);
        
        if (error.code === '23505') {
            showNotification('Ya hay una caja activa', 'error');
        } else {
            showNotification('Error abriendo caja', 'error');
        }
    }
}

async function cargarResumenCaja() {
    if (!appState.cajaActiva) return;
    
    try {
        // Calcular ventas por medio de pago
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                total,
                pagos_venta (
                    medio_pago,
                    monto
                )
            `)
            .eq('caja_id', appState.cajaActiva.id)
            .eq('anulada', false);
        
        if (error) throw error;
        
        // Calcular totales por medio de pago
        let totalEfectivo = 0;
        let totalTarjeta = 0;
        let totalTransferencia = 0;
        
        ventas.forEach(venta => {
            if (venta.pagos_venta && venta.pagos_venta.length > 0) {
                venta.pagos_venta.forEach(pago => {
                    if (pago.medio_pago === 'EFECTIVO') {
                        totalEfectivo += parseFloat(pago.monto);
                    } else if (pago.medio_pago === 'TARJETA') {
                        totalTarjeta += parseFloat(pago.monto);
                    } else if (pago.medio_pago === 'TRANSFERENCIA/QR') {
                        totalTransferencia += parseFloat(pago.monto);
                    }
                });
            }
        });
        
        // Actualizar UI
        document.getElementById('caja-monto-inicial').textContent = 
            `S/ ${parseFloat(appState.cajaActiva.monto_inicial).toFixed(2)}`;
        document.getElementById('caja-ventas-efectivo').textContent = 
            `S/ ${totalEfectivo.toFixed(2)}`;
        document.getElementById('caja-ventas-tarjeta').textContent = 
            `S/ ${totalTarjeta.toFixed(2)}`;
        document.getElementById('caja-ventas-transferencia').textContent = 
            `S/ ${totalTransferencia.toFixed(2)}`;
        
        const totalEstimado = parseFloat(appState.cajaActiva.monto_inicial) + 
            totalEfectivo + totalTarjeta + totalTransferencia;
        document.getElementById('caja-total-estimado').textContent = 
            `S/ ${totalEstimado.toFixed(2)}`;
        
        // Establecer monto real sugerido
        document.getElementById('cierre-monto-real').value = totalEstimado.toFixed(2);
        
    } catch (error) {
        console.error('Error cargando resumen de caja:', error);
    }
}

async function cerrarCaja() {
    const montoReal = parseFloat(document.getElementById('cierre-monto-real').value);
    const observaciones = document.getElementById('cierre-observaciones').value;
    
    if (!montoReal || montoReal < 0) {
        showNotification('Ingrese un monto real válido', 'warning');
        return;
    }
    
    if (!confirm('¿Está seguro de cerrar la caja? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        // Calcular ventas por medio de pago
        const { data: ventas, error: ventasError } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                pagos_venta (
                    medio_pago,
                    monto
                )
            `)
            .eq('caja_id', appState.cajaActiva.id)
            .eq('anulada', false);
        
        if (ventasError) throw ventasError;
        
        // Calcular totales
        let totalEfectivo = 0;
        let totalTarjeta = 0;
        let totalTransferencia = 0;
        
        ventas.forEach(venta => {
            if (venta.pagos_venta && venta.pagos_venta.length > 0) {
                venta.pagos_venta.forEach(pago => {
                    if (pago.medio_pago === 'EFECTIVO') {
                        totalEfectivo += parseFloat(pago.monto);
                    } else if (pago.medio_pago === 'TARJETA') {
                        totalTarjeta += parseFloat(pago.monto);
                    } else if (pago.medio_pago === 'TRANSFERENCIA/QR') {
                        totalTransferencia += parseFloat(pago.monto);
                    }
                });
            }
        });
        
        // Actualizar registro de caja
        const { error: updateError } = await supabaseClient
            .from('caja')
            .update({
                fecha_cierre: new Date().toISOString(),
                total_ventas_efectivo: totalEfectivo,
                total_ventas_tarjeta: totalTarjeta,
                total_ventas_transferencia: totalTransferencia,
                observaciones: observaciones || null
            })
            .eq('id', appState.cajaActiva.id);
        
        if (updateError) throw updateError;
        
        // Actualizar estado local
        appState.cajaActiva = null;
        actualizarUIEstadoCaja();
        
        showNotification('Caja cerrada correctamente', 'success');
        
        // Resetear formulario
        document.getElementById('cierre-observaciones').value = '';
        
    } catch (error) {
        console.error('Error cerrando caja:', error);
        showNotification('Error cerrando caja', 'error');
    }
}

// ==================== HISTORIAL Y ANULACIONES ====================
async function cargarVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('filtro-fecha-inicio').value = hoy;
    document.getElementById('filtro-fecha-fin').value = hoy;
    
    await cargarHistorial();
}

async function cargarHistorial() {
    try {
        const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
        const fechaFin = document.getElementById('filtro-fecha-fin').value;
        
        if (!fechaInicio || !fechaFin) {
            showNotification('Seleccione un rango de fechas', 'warning');
            return;
        }
        
        // Ajustar fecha fin para incluir todo el día
        const fechaFinAjustada = new Date(fechaFin);
        fechaFinAjustada.setHours(23, 59, 59, 999);
        
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                ticket_id,
                fecha,
                total,
                anulada,
                pagos_venta (
                    medio_pago,
                    monto
                )
            `)
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFinAjustada.toISOString())
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('historial-body');
        tbody.innerHTML = '';
        
        if (ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay ventas en este período</td></tr>';
            return;
        }
        
        ventas.forEach(venta => {
            // Agrupar medios de pago
            const medios = {};
            if (venta.pagos_venta && venta.pagos_venta.length > 0) {
                venta.pagos_venta.forEach(pago => {
                    if (!medios[pago.medio_pago]) {
                        medios[pago.medio_pago] = 0;
                    }
                    medios[pago.medio_pago] += parseFloat(pago.monto);
                });
            }
            
            const mediosTexto = Object.entries(medios)
                .map(([medio, monto]) => `${medio}: S/ ${monto.toFixed(2)}`)
                .join('<br>');
            
            const fecha = new Date(venta.fecha).toLocaleString('es-ES');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${venta.ticket_id}</td>
                <td>${fecha}</td>
                <td>S/ ${parseFloat(venta.total).toFixed(2)}</td>
                <td>${mediosTexto || 'Sin pagos'}</td>
                <td>
                    <span class="${venta.anulada ? 'text-danger' : 'text-success'}">
                        ${venta.anulada ? 'ANULADA' : 'ACTIVA'}
                    </span>
                </td>
                <td class="acciones">
                    <button class="btn btn-sm" onclick="verDetalleVenta('${venta.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${!venta.anulada ? `
                        <button class="btn btn-sm btn-danger" onclick="anularVenta('${venta.id}')">
                            <i class="fas fa-ban"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        showNotification('Error cargando historial', 'error');
    }
}

async function verDetalleVenta(ventaId) {
    try {
        const { data: venta, error } = await supabaseClient
            .from('ventas')
            .select(`
                *,
                detalle_ventas (
                    cantidad,
                    precio_unitario,
                    subtotal,
                    productos (
                        nombre,
                        codigo_barra
                    )
                ),
                pagos_venta (
                    medio_pago,
                    monto
                )
            `)
            .eq('id', ventaId)
            .single();
        
        if (error) throw error;
        
        const modal = document.getElementById('modal-detalle-venta');
        const titulo = document.getElementById('modal-venta-titulo');
        const contenido = document.getElementById('detalle-venta-contenido');
        
        titulo.innerHTML = `<i class="fas fa-receipt"></i> Detalle de Venta: ${venta.ticket_id}`;
        
        let detalleHTML = `
            <div class="venta-info">
                <p><strong>Ticket:</strong> ${venta.ticket_id}</p>
                <p><strong>Fecha:</strong> ${new Date(venta.fecha).toLocaleString('es-ES')}</p>
                <p><strong>Estado:</strong> ${venta.anulada ? 'ANULADA' : 'ACTIVA'}</p>
                <p><strong>Subtotal:</strong> S/ ${parseFloat(venta.subtotal).toFixed(2)}</p>
                <p><strong>Descuento:</strong> S/ ${parseFloat(venta.descuento).toFixed(2)}</p>
                <p><strong>Total:</strong> S/ ${parseFloat(venta.total).toFixed(2)}</p>
            </div>
            
            <h4>Productos:</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Código</th>
                        <th>Cantidad</th>
                        <th>Precio Unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        venta.detalle_ventas.forEach(detalle => {
            detalleHTML += `
                <tr>
                    <td>${detalle.productos.nombre}</td>
                    <td>${detalle.productos.codigo_barra}</td>
                    <td>${detalle.cantidad}</td>
                    <td>S/ ${parseFloat(detalle.precio_unitario).toFixed(2)}</td>
                    <td>S/ ${parseFloat(detalle.subtotal).toFixed(2)}</td>
                </tr>
            `;
        });
        
        detalleHTML += `
                </tbody>
            </table>
            
            <h4>Pagos:</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Medio de Pago</th>
                        <th>Monto</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        venta.pagos_venta.forEach(pago => {
            detalleHTML += `
                <tr>
                    <td>${pago.medio_pago}</td>
                    <td>S/ ${parseFloat(pago.monto).toFixed(2)}</td>
                </tr>
            `;
        });
        
        detalleHTML += `
                </tbody>
            </table>
        `;
        
        contenido.innerHTML = detalleHTML;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error cargando detalle de venta:', error);
        showNotification('Error cargando detalle de venta', 'error');
    }
}

async function anularVenta(ventaId) {
    // Verificar permiso
    const tienePermiso = await hasPermission('anular_ventas');
    if (!tienePermiso) {
        showNotification('No tiene permisos para anular ventas', 'error');
        return;
    }
    
    if (!confirm('¿Está seguro de anular esta venta? Esta acción revertirá el stock y no se podrá deshacer.')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('ventas')
            .update({
                anulada: true,
                usuario_anulacion_id: appState.usuario.id,
                fecha_anulacion: new Date().toISOString()
            })
            .eq('id', ventaId);
        
        if (error) throw error;
        
        showNotification('Venta anulada correctamente', 'success');
        cargarHistorial();
        
        // Recargar estado de caja si está abierta
        if (appState.cajaActiva) {
            cargarResumenCaja();
        }
        
    } catch (error) {
        console.error('Error anulando venta:', error);
        showNotification('Error anulando venta', 'error');
    }
}

// ==================== REPORTES ====================
async function generarReporte() {
    try {
        const fechaInicio = document.getElementById('reporte-fecha-inicio').value;
        const fechaFin = document.getElementById('reporte-fecha-fin').value;
        
        if (!fechaInicio || !fechaFin) {
            showNotification('Seleccione un rango de fechas', 'warning');
            return;
        }
        
        // Ajustar fecha fin para incluir todo el día
        const fechaFinAjustada = new Date(fechaFin);
        fechaFinAjustada.setHours(23, 59, 59, 999);
        
        // Obtener ventas del período
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                total,
                descuento,
                anulada,
                detalle_ventas (
                    cantidad,
                    precio_unitario,
                    productos (
                        precio_costo
                    )
                ),
                pagos_venta (
                    medio_pago,
                    monto
                )
            `)
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFinAjustada.toISOString())
            .eq('anulada', false);
        
        if (error) throw error;
        
        // Calcular métricas
        let totalVentas = 0;
        let totalDescuentos = 0;
        let totalGanancias = 0;
        let cantidadVentas = ventas.length;
        
        const mediosPago = {
            'EFECTIVO': 0,
            'TARJETA': 0,
            'TRANSFERENCIA/QR': 0
        };
        
        ventas.forEach(venta => {
            totalVentas += parseFloat(venta.total);
            totalDescuentos += parseFloat(venta.descuento);
            
            // Calcular ganancias
            if (venta.detalle_ventas && venta.detalle_ventas.length > 0) {
                venta.detalle_ventas.forEach(detalle => {
                    const costo = parseFloat(detalle.productos.precio_costo) || 0;
                    const ganancia = (detalle.precio_unitario - costo) * detalle.cantidad;
                    totalGanancias += ganancia;
                });
            }
            
            // Acumular medios de pago
            if (venta.pagos_venta && venta.pagos_venta.length > 0) {
                venta.pagos_venta.forEach(pago => {
                    if (mediosPago[pago.medio_pago] !== undefined) {
                        mediosPago[pago.medio_pago] += parseFloat(pago.monto);
                    }
                });
            }
        });
        
        // Calcular ticket promedio
        const ticketPromedio = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;
        
        // Generar HTML del reporte
        const resultados = document.getElementById('reportes-resultados');
        resultados.innerHTML = `
            <div class="reporte-resumen">
                <div class="reporte-item">
                    <h4>VENTAS TOTALES</h4>
                    <div class="reporte-valor">S/ ${totalVentas.toFixed(2)}</div>
                </div>
                <div class="reporte-item">
                    <h4>GANANCIAS</h4>
                    <div class="reporte-valor">S/ ${totalGanancias.toFixed(2)}</div>
                </div>
                <div class="reporte-item">
                    <h4>CANT. VENTAS</h4>
                    <div class="reporte-valor">${cantidadVentas}</div>
                </div>
                <div class="reporte-item">
                    <h4>TICKET PROMEDIO</h4>
                    <div class="reporte-valor">S/ ${ticketPromedio.toFixed(2)}</div>
                </div>
                <div class="reporte-item">
                    <h4>DESCUENTOS</h4>
                    <div class="reporte-valor">S/ ${totalDescuentos.toFixed(2)}</div>
                </div>
            </div>
            
            <div class="reporte-desglose">
                <h3>Desglose por Medio de Pago</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Medio de Pago</th>
                            <th>Total</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(mediosPago).map(([medio, total]) => {
                            const porcentaje = totalVentas > 0 ? (total / totalVentas * 100) : 0;
                            return `
                                <tr>
                                    <td>${medio}</td>
                                    <td>S/ ${total.toFixed(2)}</td>
                                    <td>${porcentaje.toFixed(1)}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        showNotification('Error generando reporte', 'error');
    }
}

// ==================== CONFIGURACIÓN ====================
async function cargarConfiguracion() {
    try {
        const { data: config, error } = await supabaseClient
            .from('configuracion')
            .select('*');
        
        if (error) throw error;
        
        // Guardar configuración en estado si es necesario
        return config;
    } catch (error) {
        console.error('Error cargando configuración:', error);
        return [];
    }
}

async function cargarConfiguracionTicket() {
    try {
        const config = await cargarConfiguracion();
        
        const form = document.getElementById('config-ticket-form');
        form.innerHTML = '';
        
        // Agrupar configuraciones relacionadas con ticket
        const ticketConfigs = config.filter(item => 
            item.clave.startsWith('ticket_') || 
            item.clave.startsWith('empresa_')
        );
        
        ticketConfigs.forEach(item => {
            const div = document.createElement('div');
            div.className = 'config-form-group';
            
            const isTextarea = item.clave.includes('mensaje') || 
                              item.clave.includes('legal') || 
                              item.clave.includes('pie');
            
            div.innerHTML = `
                <label for="config-${item.clave}">${item.descripcion || item.clave}:</label>
                ${isTextarea ? 
                    `<textarea id="config-${item.clave}" rows="3">${item.valor}</textarea>` :
                    `<input type="text" id="config-${item.clave}" value="${item.valor}">`
                }
            `;
            
            form.appendChild(div);
        });
        
        // Agregar botón guardar
        const btnDiv = document.createElement('div');
        btnDiv.className = 'form-actions';
        btnDiv.innerHTML = `
            <button id="btn-guardar-config" class="btn btn-primary">
                <i class="fas fa-save"></i> Guardar Configuración
            </button>
        `;
        
        form.appendChild(btnDiv);
        
        // Asignar evento
        document.getElementById('btn-guardar-config').addEventListener('click', guardarConfiguracionTicket);
        
    } catch (error) {
        console.error('Error cargando configuración de ticket:', error);
        showNotification('Error cargando configuración', 'error');
    }
}

async function guardarConfiguracionTicket() {
    try {
        const configElements = document.querySelectorAll('#config-ticket-form [id^="config-"]');
        const updates = [];
        
        configElements.forEach(element => {
            const clave = element.id.replace('config-', '');
            const valor = element.value.trim();
            
            updates.push({
                clave,
                valor
            });
        });
        
        // Actualizar cada configuración
        for (const config of updates) {
            const { error } = await supabaseClient
                .from('configuracion')
                .update({ valor: config.valor })
                .eq('clave', config.clave);
            
            if (error) throw error;
        }
        
        showNotification('Configuración guardada correctamente', 'success');
        
    } catch (error) {
        console.error('Error guardando configuración:', error);
        showNotification('Error guardando configuración', 'error');
    }
}

function mostrarTabConfiguracion(tabId) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar tab seleccionado
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    
    // Cargar contenido según tab
    if (tabId === 'config-permisos') {
        cargarConfiguracionPermisos();
    } else if (tabId === 'config-usuarios') {
        cargarConfiguracionUsuarios();
    }
}

async function cargarConfiguracionPermisos() {
    try {
        const { data: usuarios, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('activo', true)
            .neq('rol', 'Administrador');
        
        if (error) throw error;
        
        const permisosList = document.getElementById('config-permisos-list');
        
        if (usuarios.length === 0) {
            permisosList.innerHTML = '<p>No hay cajeros registrados</p>';
            return;
        }
        
        let html = '<div class="permisos-grid">';
        
        for (const usuario of usuarios) {
            // Obtener permisos actuales del usuario
            const { data: permisosUsuario, error: permisosError } = await supabaseClient
                .from('permisos')
                .select('*')
                .eq('usuario_id', usuario.id);
            
            if (permisosError) throw permisosError;
            
            const permisosActivos = permisosUsuario
                .filter(p => p.activo)
                .map(p => p.permiso);
            
            html += `
                <div class="usuario-permisos">
                    <h4>${usuario.username}</h4>
                    <div class="permisos-lista">
                        <div class="permiso-item">
                            <label>
                                <input type="checkbox" 
                                       data-usuario="${usuario.id}" 
                                       data-permiso="cargar_productos"
                                       ${permisosActivos.includes('cargar_productos') ? 'checked' : ''}>
                                Cargar Productos
                            </label>
                        </div>
                        <div class="permiso-item">
                            <label>
                                <input type="checkbox" 
                                       data-usuario="${usuario.id}" 
                                       data-permiso="modificar_productos"
                                       ${permisosActivos.includes('modificar_productos') ? 'checked' : ''}>
                                Modificar Productos
                            </label>
                        </div>
                        <div class="permiso-item">
                            <label>
                                <input type="checkbox" 
                                       data-usuario="${usuario.id}" 
                                       data-permiso="anular_ventas"
                                       ${permisosActivos.includes('anular_ventas') ? 'checked' : ''}>
                                Anular Ventas
                            </label>
                        </div>
                        <div class="permiso-item">
                            <label>
                                <input type="checkbox" 
                                       data-usuario="${usuario.id}" 
                                       data-permiso="ver_reportes"
                                       ${permisosActivos.includes('ver_reportes') ? 'checked' : ''}>
                                Ver Reportes
                            </label>
                        </div>
                        <div class="permiso-item">
                            <label>
                                <input type="checkbox" 
                                       data-usuario="${usuario.id}" 
                                       data-permiso="acceder_caja"
                                       ${permisosActivos.includes('acceder_caja') ? 'checked' : ''}>
                                Acceder a Caja
                            </label>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="guardarPermisosUsuario('${usuario.id}')">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
        permisosList.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando permisos:', error);
        showNotification('Error cargando permisos', 'error');
    }
}

async function guardarPermisosUsuario(usuarioId) {
    try {
        const checkboxes = document.querySelectorAll(`input[data-usuario="${usuarioId}"]`);
        const permisosSeleccionados = [];
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                permisosSeleccionados.push({
                    usuario_id: usuarioId,
                    permiso: checkbox.dataset.permiso,
                    activo: true
                });
            }
        });
        
        // Primero, desactivar todos los permisos del usuario
        const { error: deleteError } = await supabaseClient
            .from('permisos')
            .update({ activo: false })
            .eq('usuario_id', usuarioId);
        
        if (deleteError) throw deleteError;
        
        // Luego, insertar/actualizar los permisos seleccionados
        if (permisosSeleccionados.length > 0) {
            for (const permiso of permisosSeleccionados) {
                const { error: upsertError } = await supabaseClient
                    .from('permisos')
                    .upsert(permiso, { onConflict: 'usuario_id,permiso' });
                
                if (upsertError) throw upsertError;
            }
        }
        
        showNotification('Permisos actualizados correctamente', 'success');
        
    } catch (error) {
        console.error('Error guardando permisos:', error);
        showNotification('Error guardando permisos', 'error');
    }
}

async function cargarConfiguracionUsuarios() {
    // Implementar según necesidades
    document.getElementById('config-usuarios-list').innerHTML = `
        <p>Gestión de usuarios disponible para administradores.</p>
        <p>Para agregar usuarios, utilice la consola de autenticación de Supabase.</p>
    `;
}

// ==================== UTILIDADES ====================
function showNotification(mensaje, tipo = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.innerHTML = `
        <i class="fas fa-${tipo === 'success' ? 'check-circle' : 
                           tipo === 'error' ? 'exclamation-circle' : 
                           tipo === 'warning' ? 'exclamation-triangle' : 
                           'info-circle'}"></i>
        <span>${mensaje}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ==================== INICIALIZACIÓN ADICIONAL ====================
// Detectar cambio de modo claro/oscuro
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    appState.modoOscuro = e.matches;
    // Podríamos añadir lógica para cambiar temas dinámicamente
});

// Manejar redimensionamiento de ventana
window.addEventListener('resize', function() {
    // Cerrar menú en móvil al cambiar a desktop
    if (window.innerWidth >= 768) {
        document.getElementById('main-nav').classList.remove('active');
    }
});

// Prevenir recarga accidental con F5
window.addEventListener('keydown', function(e) {
    if (e.key === 'F5') {
        e.preventDefault();
        // Nuestra lógica de F5 ya está manejada en setupKeyboardShortcuts
    }
});

// Exportar funciones globales para uso en HTML
window.editarProducto = editarProducto;
window.eliminarProducto = eliminarProducto;
window.actualizarCantidadCarrito = actualizarCantidadCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.eliminarPago = eliminarPago;
window.agregarDesdeBuscador = agregarDesdeBuscador;
window.verDetalleVenta = verDetalleVenta;
window.anularVenta = anularVenta;
window.guardarPermisosUsuario = guardarPermisosUsuario;

console.log('Sistema POS cargado correctamente');
