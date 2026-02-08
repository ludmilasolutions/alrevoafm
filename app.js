// ==================== CONFIGURACIÓN SUPABASE ====================
const SUPABASE_URL = 'https://nptthngcshkbuavkjujf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdHRobmdjc2hrYnVhdmtqdWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTAyMTcsImV4cCI6MjA4NTgyNjIxN30.0P2Yf-wHtNzgoIFLEN-DYME85NFEjKtmz2cyIkyuZfg';

// Inicialización única de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== ESTADO GLOBAL ====================
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

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    try {
        await checkSession();
        setupEventListeners();
        setupKeyboardShortcuts();
        await verificarCajaActiva();
        console.log('Sistema POS inicializado correctamente');
        
        // Verificar que todos los elementos críticos estén disponibles
        setTimeout(() => {
            verifyCriticalElements();
        }, 1000);
    } catch (error) {
        console.error('Error inicializando aplicación:', error);
        showNotification('Error al inicializar la aplicación', 'error');
    }
}

function verifyCriticalElements() {
    const criticalElements = [
        'scanner-input',
        'carrito-items',
        'producto-info',
        'form-producto',
        'btn-finalizar-venta'
    ];
    
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Elemento crítico no encontrado: ${id}`);
        }
    });
}

// ==================== AUTENTICACIÓN ====================
async function checkSession() {
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('Error de sesión:', sessionError);
            return;
        }
        
        if (session && session.user) {
            // Usuario básico primero
            appState.usuario = {
                id: session.user.id,
                username: session.user.email || 'Usuario',
                rol: 'Cajero',
                activo: true
            };
            appState.permisos = ['cargar_productos', 'acceder_caja'];
            
            // Intentar cargar usuario real desde BD con timeout
            try {
                const { data: usuarioReal, error: usuarioError } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (!usuarioError && usuarioReal) {
                    appState.usuario = usuarioReal;
                    
                    // Cargar permisos
                    if (usuarioReal.rol === 'Cajero') {
                        try {
                            const { data: permisosData } = await supabaseClient
                                .from('permisos')
                                .select('permiso')
                                .eq('usuario_id', session.user.id)
                                .eq('activo', true);
                            
                            if (permisosData) {
                                appState.permisos = permisosData.map(p => p.permiso);
                            }
                        } catch (permisosError) {
                            console.warn('Error cargando permisos, usando permisos básicos:', permisosError);
                        }
                    } else if (usuarioReal.rol === 'Administrador') {
                        appState.permisos = [
                            'cargar_productos',
                            'modificar_productos',
                            'anular_ventas',
                            'ver_reportes',
                            'acceder_caja'
                        ];
                    }
                }
            } catch (bdError) {
                console.warn('Error cargando datos de BD, usando datos básicos:', bdError);
            }
            
            // Mostrar aplicación
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            document.getElementById('user-name').textContent = appState.usuario.username;
            
            // Actualizar navegación
            setTimeout(() => {
                updateNavigationPermissions();
            }, 100);
            
            // Enfocar campo scanner si está en venta
            if (document.getElementById('seccion-venta').classList.contains('active')) {
                setTimeout(() => {
                    const scanner = document.getElementById('scanner-input');
                    if (scanner) scanner.focus();
                }, 200);
            }
            
            // Verificar caja activa después de login
            setTimeout(() => verificarCajaActiva(), 500);
        }
    } catch (error) {
        console.error('Error verificando sesión:', error);
    }
}

// Login
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const loginBtn = document.getElementById('login-btn');
    
    if (!email || !password) {
        showNotification('Por favor ingrese email y contraseña', 'warning');
        return;
    }
    
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        if (data.user) {
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
            
            // Recargar sesión
            await checkSession();
            showNotification('Sesión iniciada correctamente', 'success');
        }
    } catch (error) {
        console.error('Error en login:', error);
        document.getElementById('login-error').textContent = error.message;
        document.getElementById('login-error').style.display = 'block';
        showNotification('Error en inicio de sesión', 'error');
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
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
        
        // Limpiar UI
        document.getElementById('carrito-items').innerHTML = `
            <div class="empty-carrito">
                <i class="fas fa-shopping-cart fa-2x"></i>
                <p>El carrito está vacío</p>
                <p>Escanee un producto o use F6 para buscar</p>
            </div>
        `;
        
        document.getElementById('pagos-lista').innerHTML = `
            <div class="empty-pagos">
                <i class="fas fa-receipt fa-2x"></i>
                <p>No hay pagos registrados</p>
            </div>
        `;
        
        // Resetear valores
        document.getElementById('carrito-subtotal').textContent = 'S/ 0.00';
        document.getElementById('carrito-descuento').textContent = 'S/ 0.00';
        document.getElementById('carrito-total').textContent = 'S/ 0.00';
        document.getElementById('total-a-pagar').textContent = 'S/ 0.00';
        document.getElementById('total-pagado').textContent = 'S/ 0.00';
        document.getElementById('total-cambio').textContent = 'S/ 0.00';
        document.getElementById('btn-finalizar-venta').disabled = true;
        
        // Mostrar login
        document.getElementById('app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-form').reset();
        
        showNotification('Sesión cerrada correctamente', 'success');
    } catch (error) {
        console.error('Error en logout:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
});

// ==================== PERMISOS ====================
async function hasPermission(permiso) {
    // Administradores tienen todos los permisos
    if (appState.usuario?.rol === 'Administrador') {
        return true;
    }
    
    // Cajeros verifican permisos en estado local
    return appState.permisos.includes(permiso);
}

function updateNavigationPermissions() {
    const navLinks = document.querySelectorAll('.nav-link');
    const isAdmin = appState.usuario?.rol === 'Administrador';
    
    navLinks.forEach(link => {
        const section = link.dataset.section;
        
        switch(section) {
            case 'caja':
                link.style.display = (isAdmin || appState.permisos.includes('acceder_caja')) ? 'flex' : 'none';
                break;
            case 'reportes':
                link.style.display = (isAdmin || appState.permisos.includes('ver_reportes')) ? 'flex' : 'none';
                break;
            case 'configuracion':
                link.style.display = isAdmin ? 'flex' : 'none';
                break;
            default:
                link.style.display = 'flex';
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
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            const nav = document.getElementById('main-nav');
            if (nav) nav.classList.toggle('active');
        });
    }
    
    // Cerrar menú al hacer clic fuera (en móvil)
    document.addEventListener('click', function(e) {
        const nav = document.getElementById('main-nav');
        const toggle = document.getElementById('menu-toggle');
        
        if (window.innerWidth < 768 && 
            nav && nav.classList.contains('active') && 
            !nav.contains(e.target) && 
            toggle && !toggle.contains(e.target)) {
            nav.classList.remove('active');
        }
    });
    
    // Scanner - verificar que exista
    const scannerInput = document.getElementById('scanner-input');
    if (scannerInput) {
        scannerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const codigo = this.value.trim();
                if (codigo) {
                    buscarProductoPorCodigo(codigo);
                    this.value = '';
                }
            }
        });
    }
    
    // Buscador manual
    const btnBuscarManual = document.getElementById('btn-buscar-manual');
    if (btnBuscarManual) {
        btnBuscarManual.addEventListener('click', showBuscadorManual);
    }
    
    // Carrito - verificar que existan los botones
    const btnAgregarCarrito = document.getElementById('btn-agregar-carrito');
    if (btnAgregarCarrito) {
        btnAgregarCarrito.addEventListener('click', agregarAlCarrito);
    }
    
    const btnLimpiarCarrito = document.getElementById('btn-limpiar-carrito');
    if (btnLimpiarCarrito) {
        btnLimpiarCarrito.addEventListener('click', limpiarCarrito);
    }
    
    // Cantidad
    const btnCantidadMenos = document.getElementById('btn-cantidad-menos');
    if (btnCantidadMenos) {
        btnCantidadMenos.addEventListener('click', () => cambiarCantidad(-1));
    }
    
    const btnCantidadMas = document.getElementById('btn-cantidad-mas');
    if (btnCantidadMas) {
        btnCantidadMas.addEventListener('click', () => cambiarCantidad(1));
    }
    
    const cantidadProducto = document.getElementById('cantidad-producto');
    if (cantidadProducto) {
        cantidadProducto.addEventListener('change', actualizarCantidad);
    }
    
    // Descuento
    const btnAplicarDescuento = document.getElementById('btn-aplicar-descuento');
    if (btnAplicarDescuento) {
        btnAplicarDescuento.addEventListener('click', aplicarDescuento);
    }
    
    // Pagos
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.addEventListener('click', function() {
            seleccionarMedioPago(this.dataset.medio);
        });
    });
    
    const btnAgregarPago = document.getElementById('btn-agregar-pago');
    if (btnAgregarPago) {
        btnAgregarPago.addEventListener('click', agregarPago);
    }
    
    const btnFinalizarVenta = document.getElementById('btn-finalizar-venta');
    if (btnFinalizarVenta) {
        btnFinalizarVenta.addEventListener('click', finalizarVenta);
    }
    
    const btnCancelarVenta = document.getElementById('btn-cancelar-venta');
    if (btnCancelarVenta) {
        btnCancelarVenta.addEventListener('click', cancelarVenta);
    }
    
    // Productos
    const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
    if (btnNuevoProducto) {
        btnNuevoProducto.addEventListener('click', () => mostrarModalProducto());
    }
    
    const btnRefrescarProductos = document.getElementById('btn-refrescar-productos');
    if (btnRefrescarProductos) {
        btnRefrescarProductos.addEventListener('click', cargarProductos);
    }
    
    const btnFiltrarProductos = document.getElementById('btn-filtrar-productos');
    if (btnFiltrarProductos) {
        btnFiltrarProductos.addEventListener('click', cargarProductos);
    }
    
    const filtroProductos = document.getElementById('filtro-productos');
    if (filtroProductos) {
        filtroProductos.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') cargarProductos();
        });
    }
    
    // Historial
    const btnVentasHoy = document.getElementById('btn-ventas-hoy');
    if (btnVentasHoy) {
        btnVentasHoy.addEventListener('click', cargarVentasHoy);
    }
    
    const btnFiltrarHistorial = document.getElementById('btn-filtrar-historial');
    if (btnFiltrarHistorial) {
        btnFiltrarHistorial.addEventListener('click', cargarHistorial);
    }
    
    // Caja
    const btnAbrirCaja = document.getElementById('btn-abrir-caja');
    if (btnAbrirCaja) {
        btnAbrirCaja.addEventListener('click', mostrarModalAperturaCaja);
    }
    
    const btnCerrarCaja = document.getElementById('btn-cerrar-caja');
    if (btnCerrarCaja) {
        btnCerrarCaja.addEventListener('click', cerrarCaja);
    }
    
    // Reportes
    const btnGenerarReporte = document.getElementById('btn-generar-reporte');
    if (btnGenerarReporte) {
        btnGenerarReporte.addEventListener('click', generarReporte);
    }
    
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
            const modal = this.closest('.modal');
            if (modal) modal.classList.remove('active');
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
    const btnBuscarProductos = document.getElementById('btn-buscar-productos');
    if (btnBuscarProductos) {
        btnBuscarProductos.addEventListener('click', buscarProductosManual);
    }
    
    // Formulario producto - IMPORTANTE: verificar que exista
    const formProducto = document.getElementById('form-producto');
    if (formProducto) {
        console.log('Formulario producto encontrado, agregando listener');
        formProducto.addEventListener('submit', guardarProducto);
    } else {
        console.warn('Formulario producto NO encontrado');
    }
    
    // Cálculo automático de precio
    const precioCostoInput = document.getElementById('producto-precio-costo');
    if (precioCostoInput) {
        precioCostoInput.addEventListener('input', calcularPrecioVenta);
    }
    
    const margenInput = document.getElementById('producto-margen');
    if (margenInput) {
        margenInput.addEventListener('input', calcularPrecioVenta);
    }
    
    const precioVentaInput = document.getElementById('producto-precio-venta');
    if (precioVentaInput) {
        precioVentaInput.addEventListener('input', calcularMargen);
    }
    
    // Apertura caja
    const formAperturaCaja = document.getElementById('form-apertura-caja');
    if (formAperturaCaja) {
        formAperturaCaja.addEventListener('submit', abrirCaja);
    }
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
    const section = document.getElementById(`seccion-${sectionId}`);
    if (section) {
        section.classList.add('active');
    }
    
    // Activar enlace correspondiente
    const link = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
    if (link) {
        link.classList.add('active');
    }
    
    // Actualizar título
    const currentSection = document.getElementById('current-section');
    if (currentSection) {
        currentSection.textContent = sectionId.toUpperCase();
    }
    
    // Enfocar scanner si es sección venta
    if (sectionId === 'venta') {
        setTimeout(() => {
            const scanner = document.getElementById('scanner-input');
            if (scanner) scanner.focus();
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
            const fechaInicio = document.getElementById('reporte-fecha-inicio');
            const fechaFin = document.getElementById('reporte-fecha-fin');
            if (fechaInicio) fechaInicio.value = hoy;
            if (fechaFin) fechaFin.value = hoy;
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
                const btnFinalizar = document.getElementById('btn-finalizar-venta');
                if (btnFinalizar && !btnFinalizar.disabled) {
                    finalizarVenta();
                }
                break;
            case 'F2':
                e.preventDefault();
                const descuentoInput = document.getElementById('descuento-input');
                if (descuentoInput) descuentoInput.focus();
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
                if (document.getElementById('seccion-venta')?.classList.contains('active')) {
                    seleccionarMedioPago('EFECTIVO');
                }
                break;
            case '2':
                if (document.getElementById('seccion-venta')?.classList.contains('active')) {
                    seleccionarMedioPago('TARJETA');
                }
                break;
            case '3':
                if (document.getElementById('seccion-venta')?.classList.contains('active')) {
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
        
        if (error) {
            if (error.code === 'PGRST116') {
                showNotification('Producto no encontrado', 'warning');
            } else {
                throw error;
            }
            return;
        }
        
        if (producto) {
            mostrarProductoEncontrado(producto);
        }
    } catch (error) {
        console.error('Error buscando producto:', error);
        showNotification('Error buscando producto', 'error');
    }
}

function mostrarProductoEncontrado(producto) {
    appState.productoActual = producto;
    
    const productoInfo = document.getElementById('producto-info');
    const productoNombre = document.getElementById('producto-nombre');
    const productoPrecio = document.getElementById('producto-precio');
    const productoStock = document.getElementById('producto-stock');
    const cantidadProducto = document.getElementById('cantidad-producto');
    
    if (!productoInfo || !productoNombre || !productoPrecio || !productoStock || !cantidadProducto) {
        console.error('Elementos de producto no encontrados');
        return;
    }
    
    productoNombre.textContent = producto.nombre;
    productoPrecio.textContent = `S/ ${parseFloat(producto.precio_venta).toFixed(2)}`;
    productoStock.textContent = producto.stock;
    cantidadProducto.value = 1;
    cantidadProducto.max = producto.stock;
    
    productoInfo.style.display = 'block';
    
    // Resaltar visualmente
    productoInfo.style.animation = 'none';
    setTimeout(() => {
        productoInfo.style.animation = 'fadeIn 0.5s ease';
    }, 10);
}

function cambiarCantidad(delta) {
    const input = document.getElementById('cantidad-producto');
    if (!input) return;
    
    let nuevaCantidad = parseInt(input.value) + delta;
    
    if (isNaN(nuevaCantidad)) nuevaCantidad = 1;
    if (nuevaCantidad < 1) nuevaCantidad = 1;
    if (nuevaCantidad > parseInt(input.max)) nuevaCantidad = parseInt(input.max);
    
    input.value = nuevaCantidad;
}

function actualizarCantidad() {
    const input = document.getElementById('cantidad-producto');
    if (!input) return;
    
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
    
    const cantidadInput = document.getElementById('cantidad-producto');
    if (!cantidadInput) return;
    
    const cantidad = parseInt(cantidadInput.value);
    
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
    const productoInfo = document.getElementById('producto-info');
    if (productoInfo) productoInfo.style.display = 'none';
    
    const scannerInput = document.getElementById('scanner-input');
    if (scannerInput) {
        scannerInput.value = '';
        scannerInput.focus();
    }
    
    showNotification('Producto agregado al carrito', 'success');
}

function actualizarCarritoUI() {
    const container = document.getElementById('carrito-items');
    const subtotalEl = document.getElementById('carrito-subtotal');
    const totalEl = document.getElementById('carrito-total');
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    
    if (!container || !subtotalEl || !totalEl || !btnFinalizar) return;
    
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
    const descuentoEl = document.getElementById('carrito-descuento');
    if (descuentoEl) descuentoEl.textContent = `S/ ${descuento.toFixed(2)}`;
    totalEl.textContent = `S/ ${total.toFixed(2)}`;
    
    // Actualizar total a pagar
    const totalAPagarEl = document.getElementById('total-a-pagar');
    if (totalAPagarEl) totalAPagarEl.textContent = `S/ ${total.toFixed(2)}`;
    
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
    
    const descuentoInput = document.getElementById('descuento-input');
    const descuentoTipo = document.getElementById('descuento-tipo');
    
    if (descuentoInput) descuentoInput.value = '';
    if (descuentoTipo) descuentoTipo.value = 'porcentaje';
    
    actualizarCarritoUI();
    actualizarPagosUI();
    showNotification('Carrito vaciado', 'info');
}

function aplicarDescuento() {
    const descuentoInput = document.getElementById('descuento-input');
    const descuentoTipo = document.getElementById('descuento-tipo');
    
    if (!descuentoInput || !descuentoTipo) return;
    
    const valor = parseFloat(descuentoInput.value) || 0;
    const tipo = descuentoTipo.value;
    
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
    const pagoMonto = document.getElementById('pago-monto');
    if (pagoMonto) {
        pagoMonto.placeholder = `Monto en ${medio}`;
        pagoMonto.focus();
    }
}

function agregarPago() {
    const medioElement = document.querySelector('.btn-pago.active');
    if (!medioElement) {
        showNotification('Seleccione un medio de pago primero', 'warning');
        return;
    }
    
    const medio = medioElement.dataset.medio;
    const pagoMonto = document.getElementById('pago-monto');
    if (!pagoMonto) return;
    
    const monto = parseFloat(pagoMonto.value);
    
    if (!monto || monto <= 0) {
        showNotification('Ingrese un monto válido', 'warning');
        return;
    }
    
    // Verificar que no exceda el total
    const totalAPagarEl = document.getElementById('carrito-total');
    if (!totalAPagarEl) return;
    
    const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('S/ ', ''));
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
    pagoMonto.value = '';
    showNotification('Pago agregado correctamente', 'success');
}

function actualizarPagosUI() {
    const container = document.getElementById('pagos-lista');
    const totalPagadoEl = document.getElementById('total-pagado');
    const cambioEl = document.getElementById('total-cambio');
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    
    if (!container || !totalPagadoEl || !cambioEl || !btnFinalizar) return;
    
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
    const totalAPagarEl = document.getElementById('carrito-total');
    if (!totalAPagarEl) return;
    
    const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('S/ ', ''));
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

// ==================== FINALIZACIÓN DE VENTA ====================
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
    const totalAPagarEl = document.getElementById('carrito-total');
    if (!totalAPagarEl) return;
    
    const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('S/ ', ''));
    const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    
    if (totalPagado < totalAPagar) {
        showNotification('El pago no cubre el total de la venta', 'error');
        return;
    }
    
    // Deshabilitar botón para evitar múltiples clics
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    if (!btnFinalizar) return;
    
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
        
        // PASO 2: Calcular subtotal y total
        const subtotal = appState.carrito.reduce((sum, item) => 
            sum + (item.cantidad * item.precioUnitario), 0);
        
        const descuento = appState.descuento.valor > 0 ? 
            (appState.descuento.tipo === 'porcentaje' ? 
                subtotal * (appState.descuento.valor / 100) : 
                appState.descuento.valor) : 0;
        
        const total = subtotal - descuento;
        
        // PASO 3: Generar ticket ID
        const hoy = new Date();
        const fechaStr = hoy.toISOString().split('T')[0].replace(/-/g, '');
        
        // Obtener secuencia para hoy
        const { data: secuencia, error: secError } = await supabaseClient
            .from('secuencia_tickets')
            .select('siguiente_numero')
            .eq('fecha', fechaStr)
            .single();
        
        let numero = 1;
        if (secError) {
            // Crear nueva secuencia
            const { error: insertError } = await supabaseClient
                .from('secuencia_tickets')
                .insert([{ fecha: fechaStr, siguiente_numero: 2 }]);
            
            if (insertError) throw insertError;
        } else {
            numero = secuencia.siguiente_numero;
            // Incrementar secuencia
            const { error: updateError } = await supabaseClient
                .from('secuencia_tickets')
                .update({ siguiente_numero: numero + 1 })
                .eq('fecha', fechaStr);
            
            if (updateError) throw updateError;
        }
        
        const ticketId = `T-${fechaStr}-${numero.toString().padStart(4, '0')}`;
        
        // PASO 4: Crear venta
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
        for (const item of appState.carrito) {
            const detalleData = {
                venta_id: venta.id,
                producto_id: item.producto.id,
                cantidad: item.cantidad,
                precio_unitario: item.precioUnitario,
                subtotal: item.cantidad * item.precioUnitario
            };
            
            const { error: detalleError } = await supabaseClient
                .from('detalle_ventas')
                .insert([detalleData]);
            
            if (detalleError) throw detalleError;
            
            // Actualizar stock
            const { error: stockError } = await supabaseClient
                .from('productos')
                .update({ stock: item.producto.stock - item.cantidad })
                .eq('id', item.producto.id);
            
            if (stockError) throw stockError;
        }
        
        // Insertar pagos
        for (const pago of appState.pagos) {
            const pagoData = {
                venta_id: venta.id,
                medio_pago: pago.medio,
                monto: pago.monto
            };
            
            const { error: pagoError } = await supabaseClient
                .from('pagos_venta')
                .insert([pagoData]);
            
            if (pagoError) throw pagoError;
        }
        
        // PASO 5: Generar ticket
        await generarTicket(venta);
        
        // PASO 6: Resetear venta actual
        appState.carrito = [];
        appState.pagos = [];
        appState.descuento = { tipo: 'porcentaje', valor: 0 };
        
        const descuentoInput = document.getElementById('descuento-input');
        const descuentoTipo = document.getElementById('descuento-tipo');
        
        if (descuentoInput) descuentoInput.value = '';
        if (descuentoTipo) descuentoTipo.value = 'porcentaje';
        
        actualizarCarritoUI();
        actualizarPagosUI();
        
        // Actualizar estado de caja
        await verificarCajaActiva();
        
        showNotification(`Venta finalizada: ${ticketId}`, 'success');
        
        // Enfocar scanner para próxima venta
        const scannerInput = document.getElementById('scanner-input');
        if (scannerInput) scannerInput.focus();
        
    } catch (error) {
        console.error('Error finalizando venta:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        if (btnFinalizar) {
            btnFinalizar.disabled = false;
            btnFinalizar.classList.remove('loading');
        }
    }
}

async function generarTicket(venta) {
    try {
        // Cargar configuración
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
        if (!ticketContent) return;
        
        const fecha = new Date(venta.fecha).toLocaleString('es-ES');
        
        let itemsHTML = '';
        appState.carrito.forEach(item => {
            const totalItem = item.cantidad * item.precioUnitario;
            itemsHTML += `
                <div class="ticket-item">
                    <div>${item.producto.nombre} x${item.cantidad}</div>
                    <div>S/ ${totalItem.toFixed(2)}</div>
                </div>
            `;
        });
        
        const cambio = appState.pagos.reduce((s, p) => s + p.monto, 0) - venta.total;
        
        ticketContent.innerHTML = `
            <div class="ticket-header">
                <h1>${configMap.ticket_encabezado || 'AFMSOLUTIONS'}</h1>
                <div>${configMap.ticket_encabezado_extra || ''}</div>
                <div>${configMap.empresa_direccion || ''}</div>
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
                    
                    ${cambio > 0 ? `
                        <div class="ticket-item">
                            <div>Cambio:</div>
                            <div>S/ ${cambio.toFixed(2)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="ticket-footer">
                <div>${configMap.ticket_pie || '¡Gracias por su compra!'}</div>
                <div>${configMap.ticket_legal || ''}</div>
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
        printWindow.document.close();
        
    } catch (error) {
        console.error('Error generando ticket:', error);
        // No fallar la venta si hay error en el ticket
        showNotification('Venta registrada pero error generando ticket', 'warning');
    }
}

function cancelarVenta() {
    if (appState.carrito.length === 0) return;
    
    if (!confirm('¿Está seguro de cancelar esta venta?')) {
        return;
    }
    
    limpiarCarrito();
}

// ==================== GESTIÓN DE CAJA ====================
async function verificarCajaActiva() {
    try {
        const { data: caja, error } = await supabaseClient
            .from('caja')
            .select('*')
            .is('fecha_cierre', null)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.warn('Error verificando caja activa:', error);
        }
        
        appState.cajaActiva = caja || null;
        actualizarUIEstadoCaja();
        
        return caja;
    } catch (error) {
        console.error('Error en verificarCajaActiva:', error);
        appState.cajaActiva = null;
        actualizarUIEstadoCaja();
        return null;
    }
}

async function cargarEstadoCaja() {
    await verificarCajaActiva();
}

function actualizarUIEstadoCaja() {
    const statusElement = document.getElementById('caja-status');
    const statusDetalle = document.getElementById('caja-detalle-status');
    const operaciones = document.getElementById('caja-operaciones');
    
    if (!statusElement || !statusDetalle || !operaciones) return;
    
    if (appState.cajaActiva) {
        // Caja abierta
        statusElement.innerHTML = `<i class="fas fa-circle"></i> Caja: Abierta`;
        statusElement.classList.add('abierta');
        
        statusDetalle.innerHTML = `
            <div class="caja-abierta">
                <i class="fas fa-unlock fa-3x text-success"></i>
                <h3>Caja Abierta</h3>
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
                ${appState.usuario?.rol === 'Administrador' ? 
                    `<button id="btn-abrir-caja" class="btn btn-primary">
                        <i class="fas fa-unlock"></i> Abrir Caja
                    </button>` : 
                    '<p class="text-warning">Solo administradores pueden abrir caja</p>'
                }
            </div>
        `;
        
        operaciones.style.display = 'none';
        
        // Reasignar evento al botón
        const btn = document.getElementById('btn-abrir-caja');
        if (btn) {
            btn.onclick = mostrarModalAperturaCaja;
        }
    }
}

function mostrarModalAperturaCaja() {
    if (appState.usuario?.rol !== 'Administrador') {
        showNotification('Solo administradores pueden abrir caja', 'error');
        return;
    }
    
    const modal = document.getElementById('modal-apertura-caja');
    if (modal) {
        modal.classList.add('active');
        const aperturaMonto = document.getElementById('apertura-monto');
        if (aperturaMonto) aperturaMonto.focus();
    }
}

async function abrirCaja(e) {
    e.preventDefault();
    
    // Verificar que el usuario sea administrador
    if (appState.usuario?.rol !== 'Administrador') {
        showNotification('Solo administradores pueden abrir caja', 'error');
        return;
    }
    
    const aperturaMonto = document.getElementById('apertura-monto');
    if (!aperturaMonto) return;
    
    const monto = parseFloat(aperturaMonto.value);
    
    if (!monto || monto < 0) {
        showNotification('Ingrese un monto inicial válido', 'warning');
        return;
    }
    
    const btn = e.target.querySelector('button[type="submit"]') || e.target;
    btn.classList.add('loading');
    btn.disabled = true;
    
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
        
        if (error) {
            if (error.code === '23505') {
                showNotification('Ya hay una caja activa', 'error');
            } else {
                throw error;
            }
        } else {
            appState.cajaActiva = caja;
            actualizarUIEstadoCaja();
            
            const modal = document.getElementById('modal-apertura-caja');
            if (modal) modal.classList.remove('active');
            
            const form = document.getElementById('form-apertura-caja');
            if (form) form.reset();
            
            showNotification('Caja abierta correctamente', 'success');
        }
        
    } catch (error) {
        console.error('Error abriendo caja:', error);
        showNotification('Error abriendo caja', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
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
        
        // Actualizar UI
        const montoInicialEl = document.getElementById('caja-monto-inicial');
        const ventasEfectivoEl = document.getElementById('caja-ventas-efectivo');
        const ventasTarjetaEl = document.getElementById('caja-ventas-tarjeta');
        const ventasTransferenciaEl = document.getElementById('caja-ventas-transferencia');
        const totalEstimadoEl = document.getElementById('caja-total-estimado');
        const cierreMontoReal = document.getElementById('cierre-monto-real');
        
        if (montoInicialEl) montoInicialEl.textContent = 
            `S/ ${parseFloat(appState.cajaActiva.monto_inicial).toFixed(2)}`;
        if (ventasEfectivoEl) ventasEfectivoEl.textContent = 
            `S/ ${totalEfectivo.toFixed(2)}`;
        if (ventasTarjetaEl) ventasTarjetaEl.textContent = 
            `S/ ${totalTarjeta.toFixed(2)}`;
        if (ventasTransferenciaEl) ventasTransferenciaEl.textContent = 
            `S/ ${totalTransferencia.toFixed(2)}`;
        
        const totalEstimado = parseFloat(appState.cajaActiva.monto_inicial) + 
            totalEfectivo + totalTarjeta + totalTransferencia;
        
        if (totalEstimadoEl) totalEstimadoEl.textContent = 
            `S/ ${totalEstimado.toFixed(2)}`;
        
        // Establecer monto real sugerido
        if (cierreMontoReal) cierreMontoReal.value = totalEstimado.toFixed(2);
        
    } catch (error) {
        console.error('Error cargando resumen de caja:', error);
    }
}

async function cerrarCaja() {
    const cierreMontoReal = document.getElementById('cierre-monto-real');
    const cierreObservaciones = document.getElementById('cierre-observaciones');
    
    if (!cierreMontoReal) return;
    
    const montoReal = parseFloat(cierreMontoReal.value);
    const observaciones = cierreObservaciones ? cierreObservaciones.value : '';
    
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
        if (cierreObservaciones) cierreObservaciones.value = '';
        
    } catch (error) {
        console.error('Error cerrando caja:', error);
        showNotification('Error cerrando caja', 'error');
    }
}

// ==================== PRODUCTOS ====================
async function cargarProductos() {
    try {
        const filtro = document.getElementById('filtro-productos');
        const proveedor = document.getElementById('filtro-proveedor');
        const estado = document.getElementById('filtro-estado');
        
        let query = supabaseClient
            .from('productos')
            .select('*')
            .order('nombre');
        
        // Aplicar filtros
        if (filtro && filtro.value) {
            query = query.or(`codigo_barra.ilike.%${filtro.value}%,nombre.ilike.%${filtro.value}%`);
        }
        
        if (proveedor && proveedor.value) {
            query = query.eq('proveedor', proveedor.value);
        }
        
        if (estado && estado.value) {
            if (estado.value === 'activos') {
                query = query.eq('activo', true);
            } else if (estado.value === 'inactivos') {
                query = query.eq('activo', false);
            }
            // 'todos' no aplica filtro
        }
        
        const { data: productos, error } = await query;
        
        if (error) throw error;
        
        const tbody = document.getElementById('productos-body');
        if (!tbody) return;
        
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
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos', 'error');
    }
}

function mostrarModalProducto(producto = null) {
    const modal = document.getElementById('modal-producto');
    const titulo = document.getElementById('modal-producto-titulo');
    const form = document.getElementById('form-producto');
    
    if (!modal || !titulo || !form) return;
    
    if (producto) {
        titulo.innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
        const codigoInput = document.getElementById('producto-codigo');
        const nombreInput = document.getElementById('producto-nombre');
        const precioCostoInput = document.getElementById('producto-precio-costo');
        const precioVentaInput = document.getElementById('producto-precio-venta');
        const stockInput = document.getElementById('producto-stock');
        const proveedorInput = document.getElementById('producto-proveedor');
        const activoSelect = document.getElementById('producto-activo');
        const margenInput = document.getElementById('producto-margen');
        
        if (codigoInput) codigoInput.value = producto.codigo_barra;
        if (nombreInput) nombreInput.value = producto.nombre;
        if (precioCostoInput) precioCostoInput.value = producto.precio_costo;
        if (precioVentaInput) precioVentaInput.value = producto.precio_venta;
        if (stockInput) stockInput.value = producto.stock;
        if (proveedorInput) proveedorInput.value = producto.proveedor || '';
        if (activoSelect) activoSelect.value = producto.activo;
        if (margenInput) margenInput.value = producto.margen_ganancia || '';
        
        form.dataset.productoId = producto.id;
    } else {
        titulo.innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
        form.reset();
        delete form.dataset.productoId;
    }
    
    modal.classList.add('active');
    const codigoInput = document.getElementById('producto-codigo');
    if (codigoInput) codigoInput.focus();
}

function calcularPrecioVenta() {
    const costoInput = document.getElementById('producto-precio-costo');
    const margenInput = document.getElementById('producto-margen');
    const ventaInput = document.getElementById('producto-precio-venta');
    
    if (!costoInput || !margenInput || !ventaInput) return;
    
    const costo = parseFloat(costoInput.value) || 0;
    const margen = parseFloat(margenInput.value) || 0;
    
    if (costo > 0 && margen > 0) {
        const precioVenta = costo * (1 + margen / 100);
        ventaInput.value = precioVenta.toFixed(2);
    }
}

function calcularMargen() {
    const costoInput = document.getElementById('producto-precio-costo');
    const ventaInput = document.getElementById('producto-precio-venta');
    const margenInput = document.getElementById('producto-margen');
    
    if (!costoInput || !ventaInput || !margenInput) return;
    
    const costo = parseFloat(costoInput.value) || 0;
    const venta = parseFloat(ventaInput.value) || 0;
    
    if (costo > 0 && venta > 0) {
        const margen = ((venta - costo) / costo) * 100;
        margenInput.value = margen.toFixed(2);
    }
}

async function guardarProducto(e) {
    e.preventDefault();
    
    console.log('Formulario enviado'); // Para debug
    
    // Verificar permiso
    const permiso = e.target.dataset.productoId ? 'modificar_productos' : 'cargar_productos';
    const tienePermiso = await hasPermission(permiso);
    
    if (!tienePermiso) {
        showNotification('No tiene permisos para esta acción', 'error');
        return;
    }
    
    // Obtener referencias a los elementos del formulario
    const codigoInput = document.getElementById('producto-codigo');
    const nombreInput = document.getElementById('producto-nombre');
    const precioCostoInput = document.getElementById('producto-precio-costo');
    const precioVentaInput = document.getElementById('producto-precio-venta');
    const stockInput = document.getElementById('producto-stock');
    const proveedorInput = document.getElementById('producto-proveedor');
    const activoSelect = document.getElementById('producto-activo');
    const margenInput = document.getElementById('producto-margen');
    
    // Verificar que todos los elementos existan
    if (!codigoInput || !nombreInput || !precioCostoInput || !precioVentaInput || 
        !stockInput || !activoSelect || !margenInput || !proveedorInput) {
        console.error('Elementos del formulario no encontrados:', {
            codigo: !!codigoInput,
            nombre: !!nombreInput,
            precioCosto: !!precioCostoInput,
            precioVenta: !!precioVentaInput,
            stock: !!stockInput,
            activo: !!activoSelect,
            margen: !!margenInput,
            proveedor: !!proveedorInput
        });
        showNotification('Error: formulario incompleto', 'error');
        return;
    }
    
    // Usar valores con validación
    const producto = {
        codigo_barra: codigoInput.value ? codigoInput.value.trim() : '',
        nombre: nombreInput.value ? nombreInput.value.trim() : '',
        precio_costo: parseFloat(precioCostoInput.value) || 0,
        precio_venta: parseFloat(precioVentaInput.value) || 0,
        stock: parseInt(stockInput.value) || 0,
        proveedor: proveedorInput.value ? proveedorInput.value.trim() : null,
        activo: activoSelect.value === 'true',
        margen_ganancia: margenInput.value ? parseFloat(margenInput.value) : null
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
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.classList.add('loading');
    btn.disabled = true;
    
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
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function editarProducto(productoId) {
    // Esta función se llama desde HTML, se define globalmente
    window.editarProducto = async function(id) {
        try {
            const { data: producto, error } = await supabaseClient
                .from('productos')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            mostrarModalProducto(producto);
        } catch (error) {
            console.error('Error cargando producto:', error);
            showNotification('Error cargando producto', 'error');
        }
    };
    
    window.editarProducto(productoId);
}

function eliminarProducto(productoId) {
    // Esta función se llama desde HTML, se define globalmente
    window.eliminarProducto = async function(id) {
        const tienePermiso = await hasPermission('modificar_productos');
        if (!tienePermiso) {
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
                .eq('id', id);
            
            if (error) throw error;
            
            showNotification('Producto eliminado correctamente', 'success');
            cargarProductos();
        } catch (error) {
            console.error('Error eliminando producto:', error);
            showNotification('Error eliminando producto', 'error');
        }
    };
    
    window.eliminarProducto(productoId);
}

// ==================== BUSCADOR MANUAL ====================
function showBuscadorManual() {
    const modal = document.getElementById('modal-buscador');
    if (modal) {
        modal.classList.add('active');
        // Enfocar primer campo
        const buscadorCodigo = document.getElementById('buscador-codigo');
        if (buscadorCodigo) buscadorCodigo.focus();
    }
}

async function buscarProductosManual() {
    try {
        const buscadorCodigo = document.getElementById('buscador-codigo');
        const buscadorNombre = document.getElementById('buscador-nombre');
        const buscadorProveedor = document.getElementById('buscador-proveedor');
        
        let query = supabaseClient
            .from('productos')
            .select('*')
            .eq('activo', true)
            .order('nombre');
        
        if (buscadorCodigo && buscadorCodigo.value) {
            query = query.ilike('codigo_barra', `%${buscadorCodigo.value}%`);
        }
        
        if (buscadorNombre && buscadorNombre.value) {
            query = query.ilike('nombre', `%${buscadorNombre.value}%`);
        }
        
        if (buscadorProveedor && buscadorProveedor.value) {
            query = query.eq('proveedor', buscadorProveedor.value);
        }
        
        const { data: productos, error } = await query.limit(50);
        
        if (error) throw error;
        
        const tbody = document.getElementById('buscador-body');
        if (!tbody) return;
        
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

function agregarDesdeBuscador(productoId) {
    // Esta función se llama desde HTML
    window.agregarDesdeBuscador = async function(id) {
        try {
            const { data: producto, error } = await supabaseClient
                .from('productos')
                .select('*')
                .eq('id', id)
                .eq('activo', true)
                .single();
            
            if (error) throw error;
            
            mostrarProductoEncontrado(producto);
            
            // Cerrar modal
            const modal = document.getElementById('modal-buscador');
            if (modal) modal.classList.remove('active');
            
            // Enfocar cantidad
            const cantidadProducto = document.getElementById('cantidad-producto');
            if (cantidadProducto) {
                cantidadProducto.focus();
                cantidadProducto.select();
            }
            
        } catch (error) {
            console.error('Error cargando producto:', error);
            showNotification('Error cargando producto', 'error');
        }
    };
    
    window.agregarDesdeBuscador(productoId);
}

// ==================== HISTORIAL ====================
async function cargarVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInicio = document.getElementById('filtro-fecha-inicio');
    const fechaFin = document.getElementById('filtro-fecha-fin');
    
    if (fechaInicio) fechaInicio.value = hoy;
    if (fechaFin) fechaFin.value = hoy;
    
    await cargarHistorial();
}

async function cargarHistorial() {
    try {
        const fechaInicio = document.getElementById('filtro-fecha-inicio');
        const fechaFin = document.getElementById('filtro-fecha-fin');
        
        if (!fechaInicio || !fechaFin || !fechaInicio.value || !fechaFin.value) {
            showNotification('Seleccione un rango de fechas', 'warning');
            return;
        }
        
        // Ajustar fecha fin para incluir todo el día
        const fechaFinAjustada = new Date(fechaFin.value);
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
            .gte('fecha', fechaInicio.value)
            .lte('fecha', fechaFinAjustada.toISOString())
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('historial-body');
        if (!tbody) return;
        
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

function verDetalleVenta(ventaId) {
    // Esta función se llama desde HTML
    window.verDetalleVenta = async function(id) {
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
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            const modal = document.getElementById('modal-detalle-venta');
            const titulo = document.getElementById('modal-venta-titulo');
            const contenido = document.getElementById('detalle-venta-contenido');
            
            if (!modal || !titulo || !contenido) return;
            
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
    };
    
    window.verDetalleVenta(ventaId);
}

function anularVenta(ventaId) {
    // Esta función se llama desde HTML
    window.anularVenta = async function(id) {
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
                .eq('id', id);
            
            if (error) throw error;
            
            showNotification('Venta anulada correctamente', 'success');
            cargarHistorial();
            
        } catch (error) {
            console.error('Error anulando venta:', error);
            showNotification('Error anulando venta', 'error');
        }
    };
    
    window.anularVenta(ventaId);
}

// ==================== REPORTES ====================
async function generarReporte() {
    try {
        const fechaInicio = document.getElementById('reporte-fecha-inicio');
        const fechaFin = document.getElementById('reporte-fecha-fin');
        
        if (!fechaInicio || !fechaFin || !fechaInicio.value || !fechaFin.value) {
            showNotification('Seleccione un rango de fechas', 'warning');
            return;
        }
        
        // Ajustar fecha fin para incluir todo el día
        const fechaFinAjustada = new Date(fechaFin.value);
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
            .gte('fecha', fechaInicio.value)
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
        if (!resultados) return;
        
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
async function cargarConfiguracionTicket() {
    try {
        const { data: config, error } = await supabaseClient
            .from('configuracion')
            .select('*');
        
        if (error) throw error;
        
        const form = document.getElementById('config-ticket-form');
        if (!form) return;
        
        form.innerHTML = '';
        
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
        const btnGuardar = document.getElementById('btn-guardar-config');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', guardarConfiguracionTicket);
        }
        
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
        
        // Verificar que el usuario es administrador
        if (appState.usuario?.rol !== 'Administrador') {
            showNotification('Solo administradores pueden modificar la configuración', 'error');
            return;
        }
        
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
    const tab = document.getElementById(tabId);
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    
    if (tab) tab.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');
    
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
        if (!permisosList) return;
        
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

function guardarPermisosUsuario(usuarioId) {
    // Esta función se llama desde HTML
    window.guardarPermisosUsuario = async function(id) {
        try {
            const checkboxes = document.querySelectorAll(`input[data-usuario="${id}"]`);
            const permisosSeleccionados = [];
            
            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    permisosSeleccionados.push({
                        usuario_id: id,
                        permiso: checkbox.dataset.permiso,
                        activo: true
                    });
                }
            });
            
            // Verificar que el usuario es administrador
            if (appState.usuario?.rol !== 'Administrador') {
                showNotification('Solo administradores pueden modificar permisos', 'error');
                return;
            }
            
            // Primero, desactivar todos los permisos del usuario
            const { error: deleteError } = await supabaseClient
                .from('permisos')
                .update({ activo: false })
                .eq('usuario_id', id);
            
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
    };
    
    window.guardarPermisosUsuario(usuarioId);
}

async function cargarConfiguracionUsuarios() {
    // Solo administradores pueden ver esta sección
    if (appState.usuario?.rol !== 'Administrador') {
        const usuariosList = document.getElementById('config-usuarios-list');
        if (usuariosList) {
            usuariosList.innerHTML = `
                <p class="text-warning">Solo administradores pueden acceder a esta sección</p>
            `;
        }
        return;
    }
    
    try {
        const { data: usuarios, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .order('username');
        
        if (error) throw error;
        
        const usuariosList = document.getElementById('config-usuarios-list');
        if (!usuariosList) return;
        
        if (usuarios.length === 0) {
            usuariosList.innerHTML = '<p>No hay usuarios registrados</p>';
            return;
        }
        
        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Fecha Creación</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        usuarios.forEach(usuario => {
            html += `
                <tr>
                    <td>${usuario.username}</td>
                    <td>${usuario.rol}</td>
                    <td>
                        <span class="${usuario.activo ? 'text-success' : 'text-danger'}">
                            ${usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td>${new Date(usuario.creado_en).toLocaleDateString('es-ES')}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
            <p class="mt-3"><small>Nota: Para agregar nuevos usuarios, utilice la consola de autenticación de Supabase.</small></p>
        `;
        
        usuariosList.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        const usuariosList = document.getElementById('config-usuarios-list');
        if (usuariosList) {
            usuariosList.innerHTML = `
                <p>Error cargando usuarios: ${error.message}</p>
            `;
        }
    }
}

// ==================== UTILIDADES ====================
function showNotification(mensaje, tipo = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    
    let icon = 'info-circle';
    if (tipo === 'success') icon = 'check-circle';
    else if (tipo === 'error') icon = 'exclamation-circle';
    else if (tipo === 'warning') icon = 'exclamation-triangle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${mensaje}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// ==================== FUNCIONES GLOBALES PARA HTML ====================
// Exportar funciones que se llaman desde HTML onclick
window.actualizarCantidadCarrito = actualizarCantidadCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.eliminarPago = eliminarPago;

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
        const nav = document.getElementById('main-nav');
        if (nav) nav.classList.remove('active');
    }
});

// Prevenir recarga accidental con F5
window.addEventListener('keydown', function(e) {
    if (e.key === 'F5') {
        e.preventDefault();
        // Nuestra lógica de F5 ya está manejada
    }
});

console.log('Sistema POS cargado correctamente');
