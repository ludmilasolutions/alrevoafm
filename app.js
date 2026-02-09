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
            appState.usuario = {
                id: session.user.id,
                username: session.user.email || 'Usuario',
                rol: 'Cajero',
                activo: true
            };
            appState.permisos = ['cargar_productos', 'acceder_caja'];
            
            try {
                const { data: usuarioReal, error: usuarioError } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (!usuarioError && usuarioReal) {
                    appState.usuario = usuarioReal;
                    
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
            
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            document.getElementById('user-name').textContent = appState.usuario.username;
            
            setTimeout(() => {
                updateNavigationPermissions();
            }, 100);
            
            if (document.getElementById('seccion-venta').classList.contains('active')) {
                setTimeout(() => {
                    const scanner = document.getElementById('scanner-input');
                    if (scanner) scanner.focus();
                }, 200);
            }
            
            setTimeout(() => verificarCajaActiva(), 500);
        }
    } catch (error) {
        console.error('Error verificando sesión:', error);
    }
}

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
            appState = {
                usuario: null,
                permisos: [],
                carrito: [],
                pagos: [],
                descuento: { tipo: 'porcentaje', valor: 0 },
                productoActual: null,
                cajaActiva: null
            };
            
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

document.getElementById('logout-btn').addEventListener('click', async function() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        appState = {
            usuario: null,
            permisos: [],
            carrito: [],
            pagos: [],
            descuento: { tipo: 'porcentaje', valor: 0 },
            productoActual: null,
            cajaActiva: null
        };
        
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
        
        document.getElementById('carrito-subtotal').textContent = '$ 0.00';
        document.getElementById('carrito-descuento').textContent = '$ 0.00';
        document.getElementById('carrito-total').textContent = '$ 0.00';
        document.getElementById('total-a-pagar').textContent = '$ 0.00';
        document.getElementById('total-pagado').textContent = '$ 0.00';
        document.getElementById('total-cambio').textContent = '$ 0.00';
        document.getElementById('btn-finalizar-venta').disabled = true;
        
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
    if (appState.usuario?.rol === 'Administrador') {
        return true;
    }
    
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
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.dataset.section;
            showSection(targetSection);
            
            if (window.innerWidth < 768) {
                document.getElementById('main-nav').classList.remove('active');
            }
        });
    });
    
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            const nav = document.getElementById('main-nav');
            if (nav) nav.classList.toggle('active');
        });
    }
    
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
    
    // MODIFICACIÓN: Agregar producto automáticamente al escanear
    const scannerInput = document.getElementById('scanner-input');
    if (scannerInput) {
        scannerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const codigo = this.value.trim();
                if (codigo) {
                    buscarYAgregarProducto(codigo);
                    this.value = '';
                }
            }
        });
    }
    
    const btnBuscarManual = document.getElementById('btn-buscar-manual');
    if (btnBuscarManual) {
        btnBuscarManual.addEventListener('click', showBuscadorManual);
    }
    
    const btnAgregarCarrito = document.getElementById('btn-agregar-carrito');
    if (btnAgregarCarrito) {
        btnAgregarCarrito.addEventListener('click', agregarAlCarrito);
    }
    
    const btnLimpiarCarrito = document.getElementById('btn-limpiar-carrito');
    if (btnLimpiarCarrito) {
        btnLimpiarCarrito.addEventListener('click', limpiarCarrito);
    }
    
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
    
    const btnAplicarDescuento = document.getElementById('btn-aplicar-descuento');
    if (btnAplicarDescuento) {
        btnAplicarDescuento.addEventListener('click', aplicarDescuento);
    }
    
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.addEventListener('click', function() {
            seleccionarMedioPago(this.dataset.medio);
            setTimeout(() => {
                const totalAPagarEl = document.getElementById('carrito-total');
                const pagoMonto = document.getElementById('pago-monto');
                if (totalAPagarEl && pagoMonto) {
                    const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('$ ', ''));
                    const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
                    const falta = totalAPagar - totalPagado;
                    
                    if (falta > 0) {
                        pagoMonto.value = falta.toFixed(2);
                        pagoMonto.select();
                    }
                }
            }, 100);
        });
    });
    
    const btnAgregarPago = document.getElementById('btn-agregar-pago');
    if (btnAgregarPago) {
        btnAgregarPago.addEventListener('click', agregarPago);
    }
    
    document.getElementById('pago-monto')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            agregarPago();
        }
    });
    
    const btnFinalizarVenta = document.getElementById('btn-finalizar-venta');
    if (btnFinalizarVenta) {
        btnFinalizarVenta.addEventListener('click', finalizarVenta);
    }
    
    const btnCancelarVenta = document.getElementById('btn-cancelar-venta');
    if (btnCancelarVenta) {
        btnCancelarVenta.addEventListener('click', cancelarVenta);
    }
    
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
    
    const btnVentasHoy = document.getElementById('btn-ventas-hoy');
    if (btnVentasHoy) {
        btnVentasHoy.addEventListener('click', cargarVentasHoy);
    }
    
    const btnFiltrarHistorial = document.getElementById('btn-filtrar-historial');
    if (btnFiltrarHistorial) {
        btnFiltrarHistorial.addEventListener('click', cargarHistorial);
    }
    
    const btnCerrarCaja = document.getElementById('btn-cerrar-caja');
    if (btnCerrarCaja) {
        btnCerrarCaja.addEventListener('click', cerrarCaja);
    }
    
    document.getElementById('btn-filtrar-cajas')?.addEventListener('click', cargarHistorialCajas);
    document.getElementById('btn-cargar-detalles')?.addEventListener('click', cargarDetallesCajaDia);
    document.getElementById('btn-imprimir-resumen')?.addEventListener('click', imprimirResumenCaja);
    
    const btnGenerarReporte = document.getElementById('btn-generar-reporte');
    if (btnGenerarReporte) {
        btnGenerarReporte.addEventListener('click', generarReporte);
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            mostrarTabConfiguracion(tabId);
        });
    });
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    const btnBuscarProductos = document.getElementById('btn-buscar-productos');
    if (btnBuscarProductos) {
        btnBuscarProductos.addEventListener('click', buscarProductosManual);
    }
    
    const formProducto = document.getElementById('form-producto');
    if (formProducto) {
        formProducto.addEventListener('submit', guardarProducto);
    }
    
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
    
    const formAperturaCaja = document.getElementById('form-apertura-caja');
    if (formAperturaCaja) {
        formAperturaCaja.addEventListener('submit', abrirCaja);
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const section = document.getElementById(`seccion-${sectionId}`);
    if (section) {
        section.classList.add('active');
    }
    
    const link = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
    if (link) {
        link.classList.add('active');
    }
    
    const currentSection = document.getElementById('current-section');
    if (currentSection) {
        currentSection.textContent = sectionId.toUpperCase();
    }
    
    if (sectionId === 'venta') {
        setTimeout(() => {
            const scanner = document.getElementById('scanner-input');
            if (scanner) scanner.focus();
        }, 100);
    }
    
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
            const hoy = new Date().toISOString().split('T')[0];
            const fechaInicio = document.getElementById('reporte-fecha-inicio');
            const fechaFin = document.getElementById('reporte-fecha-fin');
            if (fechaInicio) fechaInicio.value = hoy;
            if (fechaFin) fechaFin.value = hoy;
            // Cargar reportes automáticamente
            setTimeout(() => generarReporte(), 500);
            break;
        case 'configuracion':
            cargarConfiguracionTicket();
            break;
    }
}

// ==================== ATAJOS DE TECLADO ====================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
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
// MODIFICACIÓN: Nueva función para buscar y agregar producto automáticamente
async function buscarYAgregarProducto(codigo) {
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
            // Verificar si el producto ya está en el carrito
            const index = appState.carrito.findIndex(item => 
                item.producto.id === producto.id);
            
            if (index !== -1) {
                // Si ya está en el carrito, incrementar cantidad
                appState.carrito[index].cantidad += 1;
                showNotification(`${producto.nombre} - Cantidad aumentada a ${appState.carrito[index].cantidad}`, 'success');
            } else {
                // Si no está, agregarlo al carrito
                appState.carrito.push({
                    producto: producto,
                    cantidad: 1,
                    precioUnitario: producto.precio_venta
                });
                showNotification(`${producto.nombre} agregado al carrito`, 'success');
            }
            
            actualizarCarritoUI();
            
            // Limpiar el input del scanner y mantener el foco
            const scannerInput = document.getElementById('scanner-input');
            if (scannerInput) {
                scannerInput.value = '';
                scannerInput.focus();
            }
        }
    } catch (error) {
        console.error('Error buscando producto:', error);
        showNotification('Error buscando producto', 'error');
    }
}

// Función original mantenida para búsqueda manual
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
    productoPrecio.textContent = `$ ${parseFloat(producto.precio_venta).toFixed(2)}`;
    productoStock.textContent = producto.stock;
    cantidadProducto.value = 1;
    cantidadProducto.max = producto.stock;
    
    productoInfo.style.display = 'block';
    
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
    
    const index = appState.carrito.findIndex(item => 
        item.producto.id === appState.productoActual.id);
    
    if (index !== -1) {
        appState.carrito[index].cantidad += cantidad;
    } else {
        appState.carrito.push({
            producto: appState.productoActual,
            cantidad: cantidad,
            precioUnitario: appState.productoActual.precio_venta
        });
    }
    
    actualizarCarritoUI();
    
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
            <div class="carrito-item-precio">$ ${item.precioUnitario.toFixed(2)}</div>
            <div class="carrito-item-cantidad">
                <button class="btn btn-sm" onclick="actualizarCantidadCarrito(${index}, -1)">
                    <i class="fas fa-minus"></i>
                </button>
                <span>${item.cantidad}</span>
                <button class="btn btn-sm" onclick="actualizarCantidadCarrito(${index}, 1)">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="carrito-item-total">$ ${itemTotal.toFixed(2)}</div>
            <button class="carrito-item-remove" onclick="eliminarDelCarrito(${index})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(div);
    });
    
    let descuento = 0;
    if (appState.descuento.valor > 0) {
        if (appState.descuento.tipo === 'porcentaje') {
            descuento = subtotal * (appState.descuento.valor / 100);
        } else {
            descuento = appState.descuento.valor;
        }
        
        if (descuento > subtotal) descuento = subtotal;
    }
    
    const total = subtotal - descuento;
    
    subtotalEl.textContent = `$ ${subtotal.toFixed(2)}`;
    const descuentoEl = document.getElementById('carrito-descuento');
    if (descuentoEl) descuentoEl.textContent = `$ ${descuento.toFixed(2)}`;
    totalEl.textContent = `$ ${total.toFixed(2)}`;
    
    const totalAPagarEl = document.getElementById('total-a-pagar');
    if (totalAPagarEl) totalAPagarEl.textContent = `$ ${total.toFixed(2)}`;
    
    btnFinalizar.disabled = appState.carrito.length === 0 || appState.pagos.length === 0;
}

window.actualizarCantidadCarrito = function(index, delta) {
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
};

window.eliminarDelCarrito = function(index) {
    appState.carrito.splice(index, 1);
    actualizarCarritoUI();
    showNotification('Producto eliminado del carrito', 'info');
};

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
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.medio === medio) {
            btn.classList.add('active');
        }
    });
    
    const pagoMonto = document.getElementById('pago-monto');
    if (pagoMonto) {
        pagoMonto.placeholder = `Monto en ${medio}`;
        pagoMonto.focus();
    }
}

function getMedioPagoIcon(medio) {
    switch(medio) {
        case 'EFECTIVO': return 'fas fa-money-bill-wave';
        case 'TARJETA': return 'fas fa-credit-card';
        case 'TRANSFERENCIA/QR': return 'fas fa-qrcode';
        default: return 'fas fa-money-check-alt';
    }
}

window.eliminarPagosPorMedio = function(medio) {
    if (!confirm(`¿Eliminar todos los pagos de ${medio}?`)) {
        return;
    }
    
    appState.pagos = appState.pagos.filter(pago => pago.medio !== medio);
    actualizarPagosUI();
    showNotification(`Pagos de ${medio} eliminados`, 'info');
};

function agregarPago() {
    const medioElement = document.querySelector('.btn-pago.active');
    if (!medioElement) {
        showNotification('Seleccione un medio de pago primero', 'warning');
        return;
    }
    
    const medio = medioElement.dataset.medio;
    const pagoMonto = document.getElementById('pago-monto');
    if (!pagoMonto) return;
    
    let monto = parseFloat(pagoMonto.value);
    
    if (!monto || monto <= 0) {
        const totalAPagarEl = document.getElementById('carrito-total');
        if (!totalAPagarEl) return;
        
        const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('$ ', ''));
        const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
        const falta = totalAPagar - totalPagado;
        
        if (falta <= 0) {
            showNotification('Ya se pagó el total completo', 'warning');
            return;
        }
        
        monto = falta;
    }
    
    if (monto <= 0) {
        showNotification('Ingrese un monto válido', 'warning');
        return;
    }
    
    appState.pagos.push({ medio, monto });
    
    actualizarPagosUI();
    
    pagoMonto.value = '';
    pagoMonto.focus();
    
    showNotification(`Pago de $ ${monto.toFixed(2)} agregado (${medio})`, 'success');
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
        
        totalPagadoEl.textContent = '$ 0.00';
        cambioEl.textContent = '$ 0.00';
        btnFinalizar.disabled = true;
        return;
    }
    
    const pagosAgrupados = {};
    let totalPagado = 0;
    
    appState.pagos.forEach(pago => {
        if (!pagosAgrupados[pago.medio]) {
            pagosAgrupados[pago.medio] = 0;
        }
        pagosAgrupados[pago.medio] += pago.monto;
        totalPagado += pago.monto;
    });
    
    const totalAPagarEl = document.getElementById('carrito-total');
    if (!totalAPagarEl) return;
    
    const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('$ ', ''));
    const cambio = totalPagado - totalAPagar;
    
    container.innerHTML = '';
    Object.entries(pagosAgrupados).forEach(([medio, monto], index) => {
        const div = document.createElement('div');
        div.className = 'pago-item';
        div.innerHTML = `
            <div class="pago-medio">
                <i class="${getMedioPagoIcon(medio)}"></i>
                <strong>${medio}</strong>
            </div>
            <div class="pago-monto">
                $ ${monto.toFixed(2)}
            </div>
            <button class="pago-item-remove" onclick="eliminarPagosPorMedio('${medio}')" title="Eliminar todos los pagos de ${medio}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(div);
    });
    
    totalPagadoEl.textContent = `$ ${totalPagado.toFixed(2)}`;
    
    if (cambio >= 0) {
        cambioEl.textContent = `$ ${cambio.toFixed(2)}`;
        cambioEl.className = 'cambio-positivo';
    } else {
        cambioEl.textContent = `$ ${Math.abs(cambio).toFixed(2)}`;
        cambioEl.className = 'cambio-negativo';
    }
    
    const puedeFinalizar = appState.carrito.length > 0 && totalPagado >= totalAPagar;
    btnFinalizar.disabled = !puedeFinalizar;
    
    const pagoMontoInput = document.getElementById('pago-monto');
    if (pagoMontoInput) {
        if (cambio < 0) {
            pagoMontoInput.placeholder = `Falta: $ ${Math.abs(cambio).toFixed(2)}`;
        } else if (cambio > 0) {
            pagoMontoInput.placeholder = `Vuelto: $ ${cambio.toFixed(2)}`;
        } else {
            const medioActivo = document.querySelector('.btn-pago.active');
            pagoMontoInput.placeholder = medioActivo ? `Monto en ${medioActivo.dataset.medio}` : 'Monto a pagar';
        }
    }
    
    if (puedeFinalizar) {
        setTimeout(() => btnFinalizar.focus(), 100);
    }
}

window.eliminarPago = function(index) {
    appState.pagos.splice(index, 1);
    actualizarPagosUI();
    showNotification('Pago eliminado', 'info');
};

// ==================== FINALIZACIÓN DE VENTA ====================
async function finalizarVenta() {
    if (!appState.cajaActiva) {
        showNotification('No hay caja activa. Abra una caja primero.', 'error');
        showSection('caja');
        return;
    }
    
    if (appState.carrito.length === 0) {
        showNotification('El carrito está vacío', 'warning');
        return;
    }
    
    const totalAPagarEl = document.getElementById('carrito-total');
    if (!totalAPagarEl) return;
    
    const totalAPagar = parseFloat(totalAPagarEl.textContent.replace('$ ', ''));
    const totalPagado = appState.pagos.reduce((sum, pago) => sum + pago.monto, 0);
    
    if (totalPagado < totalAPagar) {
        showNotification('El pago no cubre el total de la venta', 'error');
        return;
    }
    
    const btnFinalizar = document.getElementById('btn-finalizar-venta');
    if (!btnFinalizar) return;
    
    btnFinalizar.disabled = true;
    btnFinalizar.classList.add('loading');
    
    try {
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
        
        const subtotal = appState.carrito.reduce((sum, item) => 
            sum + (item.cantidad * item.precioUnitario), 0);
        
        const descuento = appState.descuento.valor > 0 ? 
            (appState.descuento.tipo === 'porcentaje' ? 
                subtotal * (appState.descuento.valor / 100) : 
                appState.descuento.valor) : 0;
        
        const total = subtotal - descuento;
        
        const hoy = new Date();
        const fechaStr = hoy.toISOString().split('T')[0].replace(/-/g, '');
        
        const { data: secuencia, error: secError } = await supabaseClient
            .from('secuencia_tickets')
            .select('siguiente_numero')
            .eq('fecha', fechaStr)
            .single();
        
        let numero = 1;
        if (secError) {
            const { error: insertError } = await supabaseClient
                .from('secuencia_tickets')
                .insert([{ fecha: fechaStr, siguiente_numero: 2 }]);
            
            if (insertError) throw insertError;
        } else {
            numero = secuencia.siguiente_numero;
            const { error: updateError } = await supabaseClient
                .from('secuencia_tickets')
                .update({ siguiente_numero: numero + 1 })
                .eq('fecha', fechaStr);
            
            if (updateError) throw updateError;
        }
        
        const ticketId = `T-${fechaStr}-${numero.toString().padStart(4, '0')}`;
        
        const ventaData = {
            ticket_id: ticketId,
            caja_id: appState.cajaActiva.id,
            usuario_id: appState.usuario.id,
            subtotal: subtotal,
            descuento: descuento,
            total: total
        };
        
        const { data: venta, error: ventaError } = await supabaseClient
            .from('ventas')
            .insert([ventaData])
            .select()
            .single();
        
        if (ventaError) throw ventaError;
        
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
            
            const { error: stockError } = await supabaseClient
                .from('productos')
                .update({ stock: item.producto.stock - item.cantidad })
                .eq('id', item.producto.id);
            
            if (stockError) throw stockError;
        }
        
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
        
        await generarTicket(venta);
        
        appState.carrito = [];
        appState.pagos = [];
        appState.descuento = { tipo: 'porcentaje', valor: 0 };
        
        const descuentoInput = document.getElementById('descuento-input');
        const descuentoTipo = document.getElementById('descuento-tipo');
        
        if (descuentoInput) descuentoInput.value = '';
        if (descuentoTipo) descuentoTipo.value = 'porcentaje';
        
        actualizarCarritoUI();
        actualizarPagosUI();
        
        await verificarCajaActiva();
        
        showNotification(`Venta finalizada: ${ticketId}`, 'success');
        
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
        const { data: config, error } = await supabaseClient
            .from('configuracion')
            .select('*');
        
        if (error) throw error;
        
        const configMap = {};
        config.forEach(item => {
            configMap[item.clave] = item.valor;
        });
        
        const ticketContent = document.getElementById('ticket-content');
        if (!ticketContent) return;
        
        const fecha = new Date(venta.fecha).toLocaleString('es-ES');
        
        let itemsHTML = '';
        appState.carrito.forEach(item => {
            const totalItem = item.cantidad * item.precioUnitario;
            itemsHTML += `
                <div class="ticket-item">
                    <div>${item.producto.nombre} x${item.cantidad}</div>
                    <div>$ ${totalItem.toFixed(2)}</div>
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
                    <div>$ ${venta.subtotal.toFixed(2)}</div>
                </div>
                <div class="ticket-item">
                    <div>Descuento:</div>
                    <div>$ ${venta.descuento.toFixed(2)}</div>
                </div>
                <div class="ticket-item">
                    <div><strong>TOTAL:</strong></div>
                    <div><strong>$ ${venta.total.toFixed(2)}</strong></div>
                </div>
                
                <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px;">
                    <strong>PAGOS:</strong>
                    ${appState.pagos.map(pago => `
                        <div class="ticket-item">
                            <div>${pago.medio}:</div>
                            <div>$ ${pago.monto.toFixed(2)}</div>
                        </div>
                    `).join('')}
                    
                    ${cambio > 0 ? `
                        <div class="ticket-item">
                            <div>Cambio:</div>
                            <div>$ ${cambio.toFixed(2)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="ticket-footer">
                <div>${configMap.ticket_pie || '¡Gracias por su compra!'}</div>
                <div>${configMap.ticket_legal || ''}</div>
            </div>
        `;
        
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
    await cargarVentasDelDiaEnCaja();
}

function actualizarUIEstadoCaja() {
    const statusElement = document.getElementById('caja-status');
    const statusDetalle = document.getElementById('caja-detalle-status');
    const operaciones = document.getElementById('caja-operaciones');
    
    if (!statusElement || !statusDetalle || !operaciones) return;
    
    if (appState.cajaActiva) {
        statusElement.innerHTML = `<i class="fas fa-circle"></i> Caja: Abierta`;
        statusElement.classList.add('abierta');
        
        statusDetalle.innerHTML = `
            <div class="caja-abierta">
                <i class="fas fa-unlock fa-3x text-success"></i>
                <h3>Caja Abierta</h3>
                <p>Monto inicial: $ ${parseFloat(appState.cajaActiva.monto_inicial).toFixed(2)}</p>
                <p>Hora apertura: ${new Date(appState.cajaActiva.fecha_apertura).toLocaleTimeString()}</p>
            </div>
        `;
        
        operaciones.style.display = 'block';
        
        cargarResumenCaja();
        
    } else {
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
        const cajaActiva = await verificarCajaActiva();
        if (cajaActiva) {
            showNotification('Ya hay una caja activa', 'error');
            return;
        }
        
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
        const { data: ventas, error } = await supabaseClient
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
        
        if (error) throw error;
        
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
        
        const montoInicialEl = document.getElementById('caja-monto-inicial');
        const ventasEfectivoEl = document.getElementById('caja-ventas-efectivo');
        const ventasTarjetaEl = document.getElementById('caja-ventas-tarjeta');
        const ventasTransferenciaEl = document.getElementById('caja-ventas-transferencia');
        const totalEstimadoEl = document.getElementById('caja-total-estimado');
        const cierreMontoReal = document.getElementById('cierre-monto-real');
        
        if (montoInicialEl) montoInicialEl.textContent = 
            `$ ${parseFloat(appState.cajaActiva.monto_inicial).toFixed(2)}`;
        if (ventasEfectivoEl) ventasEfectivoEl.textContent = 
            `$ ${totalEfectivo.toFixed(2)}`;
        if (ventasTarjetaEl) ventasTarjetaEl.textContent = 
            `$ ${totalTarjeta.toFixed(2)}`;
        if (ventasTransferenciaEl) ventasTransferenciaEl.textContent = 
            `$ ${totalTransferencia.toFixed(2)}`;
        
        const totalEstimado = parseFloat(appState.cajaActiva.monto_inicial) + 
            totalEfectivo + totalTarjeta + totalTransferencia;
        
        if (totalEstimadoEl) totalEstimadoEl.textContent = 
            `$ ${totalEstimado.toFixed(2)}`;
        
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
        
        appState.cajaActiva = null;
        actualizarUIEstadoCaja();
        
        showNotification('Caja cerrada correctamente', 'success');
        
        if (cierreObservaciones) cierreObservaciones.value = '';
        
    } catch (error) {
        console.error('Error cerrando caja:', error);
        showNotification('Error cerrando caja', 'error');
    }
}

// ==================== HISTORIAL DE CAJAS MEJORADO ====================
async function cargarHistorialCajas() {
    try {
        console.log('Cargando historial de cajas...');
        
        const fechaInicio = document.getElementById('caja-fecha-inicio');
        const fechaFin = document.getElementById('caja-fecha-fin');
        
        // Valores por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        const hace30DiasStr = hace30Dias.toISOString().split('T')[0];
        
        if (fechaInicio) fechaInicio.value = fechaInicio.value || hace30DiasStr;
        if (fechaFin) fechaFin.value = fechaFin.value || hoy;
        
        const fechaInicioVal = fechaInicio?.value || hace30DiasStr;
        const fechaFinVal = fechaFin?.value || hoy;
        
        console.log('Consultando desde:', fechaInicioVal, 'hasta:', fechaFinVal);
        
        // Consulta simple de cajas
        const { data: cajas, error } = await supabaseClient
            .from('caja')
            .select('*')
            .gte('fecha_apertura', fechaInicioVal + 'T00:00:00')
            .lte('fecha_apertura', fechaFinVal + 'T23:59:59')
            .order('fecha_apertura', { ascending: false });
        
        if (error) {
            console.error('Error en consulta de cajas:', error);
            throw error;
        }
        
        console.log('Cajas obtenidas:', cajas);
        
        const contenedor = document.getElementById('historial-cajas');
        if (!contenedor) {
            console.error('Contenedor de historial de cajas no encontrado');
            return;
        }
        
        if (!cajas || cajas.length === 0) {
            contenedor.innerHTML = `
                <div class="empty-reportes">
                    <i class="fas fa-cash-register fa-3x"></i>
                    <p>No hay cajas en este período</p>
                </div>
            `;
            return;
        }
        
        // Obtener usuarios en una sola consulta
        const userIds = [...new Set(cajas.map(c => c.usuario_id).filter(id => id))];
        let usuariosMap = {};
        
        if (userIds.length > 0) {
            const { data: usuarios, error: usuariosError } = await supabaseClient
                .from('usuarios')
                .select('id, username')
                .in('id', userIds);
            
            if (!usuariosError && usuarios) {
                usuarios.forEach(u => {
                    usuariosMap[u.id] = u.username;
                });
            }
        }
        
        let html = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Fecha Apertura</th>
                            <th>Fecha Cierre</th>
                            <th>Usuario</th>
                            <th>Monto Inicial</th>
                            <th>Total Efectivo</th>
                            <th>Total Tarjeta</th>
                            <th>Total Transferencia</th>
                            <th>Total Ventas</th>
                            <th>Total Estimado</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        cajas.forEach(caja => {
            const totalVentasEfectivo = parseFloat(caja.total_ventas_efectivo) || 0;
            const totalVentasTarjeta = parseFloat(caja.total_ventas_tarjeta) || 0;
            const totalVentasTransferencia = parseFloat(caja.total_ventas_transferencia) || 0;
            const totalVentas = totalVentasEfectivo + totalVentasTarjeta + totalVentasTransferencia;
            const totalEstimado = (parseFloat(caja.monto_inicial) || 0) + totalVentas;
            
            const estado = caja.fecha_cierre ? 'Cerrada' : 'Abierta';
            const estadoClase = caja.fecha_cierre ? 'text-success' : 'text-warning';
            const usuarioNombre = usuariosMap[caja.usuario_id] || 'N/A';
            
            html += `
                <tr>
                    <td>${caja.id}</td>
                    <td>${new Date(caja.fecha_apertura).toLocaleString('es-ES')}</td>
                    <td>${caja.fecha_cierre ? new Date(caja.fecha_cierre).toLocaleString('es-ES') : 'En curso'}</td>
                    <td>${usuarioNombre}</td>
                    <td>$ ${parseFloat(caja.monto_inicial).toFixed(2)}</td>
                    <td>$ ${totalVentasEfectivo.toFixed(2)}</td>
                    <td>$ ${totalVentasTarjeta.toFixed(2)}</td>
                    <td>$ ${totalVentasTransferencia.toFixed(2)}</td>
                    <td>$ ${totalVentas.toFixed(2)}</td>
                    <td>$ ${totalEstimado.toFixed(2)}</td>
                    <td><span class="${estadoClase}">${estado}</span></td>
                    <td class="acciones">
                        <button class="btn btn-sm" onclick="verDetalleCaja('${caja.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${!caja.fecha_cierre && appState.usuario?.rol === 'Administrador' ? `
                            <button class="btn btn-sm btn-danger" onclick="forzarCerrarCaja('${caja.id}')">
                                <i class="fas fa-lock"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="mt-4 p-3 bg-light rounded">
                <h5>Resumen del Período</h5>
                <div class="d-flex justify-content-between flex-wrap">
                    <span>Total Cajas: <strong>${cajas.length}</strong></span>
                    <span>Cajas Abiertas: <strong>${cajas.filter(c => !c.fecha_cierre).length}</strong></span>
                    <span>Cajas Cerradas: <strong>${cajas.filter(c => c.fecha_cierre).length}</strong></span>
                    <span>Total Ventas: <strong>$ ${cajas.reduce((sum, c) => {
                        const efectivo = parseFloat(c.total_ventas_efectivo) || 0;
                        const tarjeta = parseFloat(c.total_ventas_tarjeta) || 0;
                        const transferencia = parseFloat(c.total_ventas_transferencia) || 0;
                        return sum + efectivo + tarjeta + transferencia;
                    }, 0).toFixed(2)}</strong></span>
                </div>
            </div>
        `;
        
        contenedor.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando historial de cajas:', error);
        showNotification('Error cargando historial de cajas: ' + error.message, 'error');
    }
}

async function cargarDetallesCajaDia() {
    try {
        const fechaInput = document.getElementById('detalle-fecha');
        let fecha = fechaInput?.value;
        
        // Si no hay fecha seleccionada, usar hoy
        if (!fecha) {
            fecha = new Date().toISOString().split('T')[0];
            if (fechaInput) fechaInput.value = fecha;
        }
        
        console.log('Cargando detalles para fecha:', fecha);
        
        const fechaInicio = fecha + 'T00:00:00';
        const fechaFin = fecha + 'T23:59:59';
        
        // Obtener cajas del día
        const { data: cajas, error: cajasError } = await supabaseClient
            .from('caja')
            .select('*')
            .gte('fecha_apertura', fechaInicio)
            .lte('fecha_apertura', fechaFin);
        
        if (cajasError) {
            console.error('Error obteniendo cajas:', cajasError);
            throw cajasError;
        }
        
        // Obtener ventas del día
        const { data: ventas, error: ventasError } = await supabaseClient
            .from('ventas')
            .select('*')
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin)
            .eq('anulada', false);
        
        if (ventasError) {
            console.error('Error obteniendo ventas:', ventasError);
            throw ventasError;
        }
        
        console.log(`Cajas: ${cajas?.length || 0}, Ventas: ${ventas?.length || 0}`);
        
        const contenedor = document.getElementById('detalles-caja-dia');
        if (!contenedor) {
            console.error('Contenedor de detalles no encontrado');
            return;
        }
        
        if ((!cajas || cajas.length === 0) && (!ventas || ventas.length === 0)) {
            contenedor.innerHTML = `
                <div class="empty-reportes">
                    <i class="fas fa-calendar-day fa-3x"></i>
                    <p>No hay actividad registrada para esta fecha</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="row">';
        
        if (cajas && cajas.length > 0) {
            html += `
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-cash-register"></i> Cajas del Día (${cajas.length})</h5>
                        </div>
                        <div class="card-body">
                            <div class="list-group">
            `;
            
            for (const caja of cajas) {
                let nombreUsuario = 'N/A';
                if (caja.usuario_id) {
                    const { data: usuario } = await supabaseClient
                        .from('usuarios')
                        .select('username')
                        .eq('id', caja.usuario_id)
                        .maybeSingle();
                    if (usuario) nombreUsuario = usuario.username;
                }
                
                const totalVentas = (parseFloat(caja.total_ventas_efectivo) || 0) +
                                   (parseFloat(caja.total_ventas_tarjeta) || 0) +
                                   (parseFloat(caja.total_ventas_transferencia) || 0);
                
                html += `
                    <div class="list-item">
                        <div class="d-flex justify-content-between">
                            <strong>Caja ${caja.id}</strong>
                            <span class="${caja.fecha_cierre ? 'text-success' : 'text-warning'}">
                                ${caja.fecha_cierre ? 'Cerrada' : 'Abierta'}
                            </span>
                        </div>
                        <div class="text-muted small">Usuario: ${nombreUsuario}</div>
                        <div class="mt-2">
                            <div class="d-flex justify-content-between">
                                <span>Inicial:</span>
                                <span>$ ${parseFloat(caja.monto_inicial).toFixed(2)}</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span>Ventas:</span>
                                <span>$ ${totalVentas.toFixed(2)}</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span>Total:</span>
                                <span>$ ${(parseFloat(caja.monto_inicial) + totalVentas).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (ventas && ventas.length > 0) {
            // Obtener pagos para todas las ventas
            const ventaIds = ventas.map(v => v.id);
            const { data: pagos, error: pagosError } = await supabaseClient
                .from('pagos_venta')
                .select('*')
                .in('venta_id', ventaIds);
            
            let totalVentas = 0;
            let ventasEfectivo = 0;
            let ventasTarjeta = 0;
            let ventasTransferencia = 0;
            
            // Agrupar pagos por venta
            const pagosPorVenta = {};
            if (pagos && !pagosError) {
                pagos.forEach(pago => {
                    if (!pagosPorVenta[pago.venta_id]) {
                        pagosPorVenta[pago.venta_id] = [];
                    }
                    pagosPorVenta[pago.venta_id].push(pago);
                });
            }
            
            ventas.forEach(venta => {
                totalVentas += parseFloat(venta.total) || 0;
                
                const pagosVenta = pagosPorVenta[venta.id] || [];
                if (pagosVenta.length > 0) {
                    pagosVenta.forEach(pago => {
                        const monto = parseFloat(pago.monto) || 0;
                        if (pago.medio_pago === 'EFECTIVO') {
                            ventasEfectivo += monto;
                        } else if (pago.medio_pago === 'TARJETA') {
                            ventasTarjeta += monto;
                        } else if (pago.medio_pago === 'TRANSFERENCIA/QR') {
                            ventasTransferencia += monto;
                        }
                    });
                }
            });
            
            html += `
                <div class="col-md-6 mb-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-receipt"></i> Ventas del Día (${ventas.length})</h5>
                        </div>
                        <div class="card-body">
                            <div class="resumen-grid">
                                <div class="resumen-item">
                                    <span>Cantidad de Ventas:</span>
                                    <strong>${ventas.length}</strong>
                                </div>
                                <div class="resumen-item">
                                    <span>Total Ventas:</span>
                                    <strong>$ ${totalVentas.toFixed(2)}</strong>
                                </div>
                                <div class="resumen-item">
                                    <span>Efectivo:</span>
                                    <strong>$ ${ventasEfectivo.toFixed(2)}</strong>
                                </div>
                                <div class="resumen-item">
                                    <span>Tarjeta:</span>
                                    <strong>$ ${ventasTarjeta.toFixed(2)}</strong>
                                </div>
                                <div class="resumen-item">
                                    <span>Transferencia:</span>
                                    <strong>$ ${ventasTransferencia.toFixed(2)}</strong>
                                </div>
                            </div>
                            
                            <div class="mt-4">
                                <h6>Últimas Ventas</h6>
                                <div class="list-group" style="max-height: 300px; overflow-y: auto;">
            `;
            
            // Obtener usuarios para las ventas
            const userIds = [...new Set(ventas.map(v => v.usuario_id).filter(id => id))];
            let usuariosMap = {};
            
            if (userIds.length > 0) {
                const { data: usuarios } = await supabaseClient
                    .from('usuarios')
                    .select('id, username')
                    .in('id', userIds);
                
                if (usuarios) {
                    usuarios.forEach(u => {
                        usuariosMap[u.id] = u.username;
                    });
                }
            }
            
            // Mostrar solo las últimas 5 ventas
            const ultimasVentas = ventas.slice(0, 5);
            
            for (const venta of ultimasVentas) {
                const nombreUsuario = usuariosMap[venta.usuario_id] || 'N/A';
                
                html += `
                    <div class="list-item">
                        <div class="d-flex justify-content-between">
                            <strong>${venta.ticket_id}</strong>
                            <span>$ ${parseFloat(venta.total).toFixed(2)}</span>
                        </div>
                        <div class="text-muted small">
                            ${new Date(venta.fecha).toLocaleTimeString('es-ES')} - 
                            ${nombreUsuario}
                        </div>
                    </div>
                `;
            }
            
            html += `
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        contenedor.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando detalles del día:', error);
        showNotification('Error cargando detalles del día: ' + error.message, 'error');
    }
}

async function cargarVentasDelDiaEnCaja() {
    if (!appState.cajaActiva) return;
    
    try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const { data: ventas, error } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                total,
                fecha,
                pagos_venta (medio_pago, monto)
            `)
            .eq('caja_id', appState.cajaActiva.id)
            .gte('fecha', hoy.toISOString())
            .eq('anulada', false);
        
        if (error) throw error;
        
        const contenedor = document.getElementById('caja-ventas-dia');
        if (!contenedor) return;
        
        let totalVentas = 0;
        let cantidadVentas = ventas.length;
        
        ventas.forEach(venta => {
            totalVentas += parseFloat(venta.total) || 0;
        });
        
        const ticketPromedio = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;
        
        contenedor.innerHTML = `
            <div class="stats-item">
                <div class="stats-icon bg-primary">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <div class="stats-info">
                    <h4>${cantidadVentas}</h4>
                    <span>Ventas Realizadas</span>
                </div>
            </div>
            <div class="stats-item">
                <div class="stats-icon bg-success">
                    <i class="fas fa-money-bill-wave"></i>
                </div>
                <div class="stats-info">
                    <h4>$ ${totalVentas.toFixed(2)}</h4>
                    <span>Total del Día</span>
                </div>
            </div>
            <div class="stats-item">
                <div class="stats-icon bg-info">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="stats-info">
                    <h4>$ ${ticketPromedio.toFixed(2)}</h4>
                    <span>Ticket Promedio</span>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando ventas del día:', error);
    }
}

window.verDetalleCaja = async function(cajaId) {
    try {
        const { data: caja, error: cajaError } = await supabaseClient
            .from('caja')
            .select('*')
            .eq('id', cajaId)
            .single();
        
        if (cajaError) throw cajaError;
        
        const { data: ventas, error: ventasError } = await supabaseClient
            .from('ventas')
            .select(`
                ticket_id,
                total,
                fecha,
                pagos_venta (medio_pago, monto)
            `)
            .eq('caja_id', cajaId)
            .eq('anulada', false);
        
        if (ventasError) throw ventasError;
        
        let nombreUsuario = 'N/A';
        if (caja.usuario_id) {
            const { data: usuario } = await supabaseClient
                .from('usuarios')
                .select('username')
                .eq('id', caja.usuario_id)
                .maybeSingle();
            if (usuario) nombreUsuario = usuario.username;
        }
        
        let detalleHTML = `
            <div class="card">
                <div class="card-header">
                    <h4><i class="fas fa-cash-register"></i> Detalle de Caja ${cajaId}</h4>
                </div>
                <div class="card-body">
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <p><strong>Usuario:</strong> ${nombreUsuario}</p>
                            <p><strong>Fecha Apertura:</strong> ${new Date(caja.fecha_apertura).toLocaleString('es-ES')}</p>
                            <p><strong>Monto Inicial:</strong> $ ${parseFloat(caja.monto_inicial).toFixed(2)}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Fecha Cierre:</strong> ${caja.fecha_cierre ? new Date(caja.fecha_cierre).toLocaleString('es-ES') : 'En curso'}</p>
                            <p><strong>Total Ventas Efectivo:</strong> $ ${parseFloat(caja.total_ventas_efectivo || 0).toFixed(2)}</p>
                            <p><strong>Total Ventas Tarjeta:</strong> $ ${parseFloat(caja.total_ventas_tarjeta || 0).toFixed(2)}</p>
                            <p><strong>Total Ventas Transferencia:</strong> $ ${parseFloat(caja.total_ventas_transferencia || 0).toFixed(2)}</p>
                        </div>
                    </div>
        `;
        
        if (ventas.length > 0) {
            detalleHTML += `
                <h5>Ventas de esta caja (${ventas.length})</h5>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Fecha</th>
                                <th>Total</th>
                                <th>Medios de Pago</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            ventas.forEach(venta => {
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
                    .map(([medio, monto]) => `${medio}: $ ${monto.toFixed(2)}`)
                    .join(', ');
                
                detalleHTML += `
                    <tr>
                        <td>${venta.ticket_id}</td>
                        <td>${new Date(venta.fecha).toLocaleTimeString('es-ES')}</td>
                        <td>$ ${parseFloat(venta.total).toFixed(2)}</td>
                        <td>${mediosTexto || 'Sin pagos'}</td>
                    </tr>
                `;
            });
            
            detalleHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            detalleHTML += '<p>No hay ventas registradas para esta caja.</p>';
        }
        
        detalleHTML += `
                </div>
            </div>
        `;
        
        const modal = document.getElementById('modal-detalle-venta');
        const titulo = document.getElementById('modal-venta-titulo');
        const contenido = document.getElementById('detalle-venta-contenido');
        
        if (modal && titulo && contenido) {
            titulo.innerHTML = `<i class="fas fa-cash-register"></i> Detalle de Caja: ${cajaId}`;
            contenido.innerHTML = detalleHTML;
            modal.classList.add('active');
        } else {
            alert(detalleHTML.replace(/<[^>]*>/g, ''));
        }
        
    } catch (error) {
        console.error('Error cargando detalle de caja:', error);
        showNotification('Error cargando detalle de caja', 'error');
    }
};

window.forzarCerrarCaja = async function(cajaId) {
    if (!confirm('¿Está seguro de forzar el cierre de esta caja? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('caja')
            .update({
                fecha_cierre: new Date().toISOString(),
                observaciones: 'Cierre forzado por administrador'
            })
            .eq('id', cajaId);
        
        if (error) throw error;
        
        showNotification('Caja cerrada forzosamente', 'success');
        cargarHistorialCajas();
        
    } catch (error) {
        console.error('Error forzando cierre de caja:', error);
        showNotification('Error forzando cierre de caja', 'error');
    }
};

async function imprimirResumenCaja() {
    if (!appState.cajaActiva) {
        showNotification('No hay caja activa', 'warning');
        return;
    }
    
    try {
        const { data: caja, error: cajaError } = await supabaseClient
            .from('caja')
            .select('*')
            .eq('id', appState.cajaActiva.id)
            .single();
        
        if (cajaError) throw cajaError;
        
        const { data: ventas, error: ventasError } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                ticket_id,
                total,
                fecha,
                pagos_venta (medio_pago, monto)
            `)
            .eq('caja_id', appState.cajaActiva.id)
            .eq('anulada', false);
        
        if (ventasError) throw ventasError;
        
        let totalVentas = 0;
        let ventasEfectivo = 0;
        let ventasTarjeta = 0;
        let ventasTransferencia = 0;
        
        ventas.forEach(venta => {
            totalVentas += parseFloat(venta.total) || 0;
            
            if (venta.pagos_venta && venta.pagos_venta.length > 0) {
                venta.pagos_venta.forEach(pago => {
                    const monto = parseFloat(pago.monto) || 0;
                    if (pago.medio_pago === 'EFECTIVO') {
                        ventasEfectivo += monto;
                    } else if (pago.medio_pago === 'TARJETA') {
                        ventasTarjeta += monto;
                    } else if (pago.medio_pago === 'TRANSFERENCIA/QR') {
                        ventasTransferencia += monto;
                    }
                });
            }
        });
        
        const totalEstimado = (parseFloat(caja.monto_inicial) || 0) + totalVentas;
        const montoReal = parseFloat(document.getElementById('cierre-monto-real').value) || totalEstimado;
        const diferencia = montoReal - totalEstimado;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Resumen Caja ${caja.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { color: #333; margin-bottom: 5px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .info-item { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                    .info-item h3 { margin-top: 0; color: #666; font-size: 14px; }
                    .info-item .valor { font-size: 18px; font-weight: bold; color: #333; }
                    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .table th, .table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                    .table th { background: #f5f5f5; }
                    .totales { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 5px; }
                    .firma { margin-top: 50px; text-align: center; }
                    .firma-line { border-top: 1px solid #333; width: 300px; margin: 0 auto 10px; }
                    @media print { body { margin: 0; padding: 10px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>RESUMEN DE CAJA</h1>
                    <p>ID: ${caja.id} | Fecha: ${new Date(caja.fecha_apertura).toLocaleString('es-ES')}</p>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <h3>Monto Inicial</h3>
                        <div class="valor">$ ${parseFloat(caja.monto_inicial).toFixed(2)}</div>
                    </div>
                    <div class="info-item">
                        <h3>Ventas Totales</h3>
                        <div class="valor">$ ${totalVentas.toFixed(2)}</div>
                    </div>
                    <div class="info-item">
                        <h3>Total Estimado</h3>
                        <div class="valor">$ ${totalEstimado.toFixed(2)}</div>
                    </div>
                    <div class="info-item">
                        <h3>Monto Real</h3>
                        <div class="valor">$ ${montoReal.toFixed(2)}</div>
                    </div>
                </div>
                
                <h3>Desglose por Medio de Pago</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Medio de Pago</th>
                            <th>Total</th>
                            <th>Porcentaje</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>EFECTIVO</td>
                            <td>$ ${ventasEfectivo.toFixed(2)}</td>
                            <td>${totalVentas > 0 ? ((ventasEfectivo / totalVentas) * 100).toFixed(1) : '0'}%</td>
                        </tr>
                        <tr>
                            <td>TARJETA</td>
                            <td>$ ${ventasTarjeta.toFixed(2)}</td>
                            <td>${totalVentas > 0 ? ((ventasTarjeta / totalVentas) * 100).toFixed(1) : '0'}%</td>
                        </tr>
                        <tr>
                            <td>TRANSFERENCIA/QR</td>
                            <td>$ ${ventasTransferencia.toFixed(2)}</td>
                            <td>${totalVentas > 0 ? ((ventasTransferencia / totalVentas) * 100).toFixed(1) : '0'}%</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="totales">
                    <h3>Resumen Final</h3>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span>Total Estimado:</span>
                        <strong>$ ${totalEstimado.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span>Monto Real:</span>
                        <strong>$ ${montoReal.toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0; padding-top: 10px; border-top: 2px solid #333;">
                        <span>Diferencia:</span>
                        <strong class="${diferencia >= 0 ? 'text-success' : 'text-danger'}">
                            ${diferencia >= 0 ? '+' : ''}$ ${Math.abs(diferencia).toFixed(2)}
                        </strong>
                    </div>
                </div>
                
                <div class="firma">
                    <div class="firma-line"></div>
                    <p>Firma del Responsable</p>
                </div>
                
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
        console.error('Error generando resumen:', error);
        showNotification('Error generando resumen', 'error');
    }
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
        
        if (!fechaInicio || !fechaFin) {
            showNotification('Seleccione un rango de fechas', 'warning');
            return;
        }
        
        // Valores por defecto si están vacíos
        const hoy = new Date().toISOString().split('T')[0];
        if (!fechaInicio.value) fechaInicio.value = hoy;
        if (!fechaFin.value) fechaFin.value = hoy;
        
        console.log('Consultando ventas desde:', fechaInicio.value, 'hasta:', fechaFin.value);
        
        // Consulta principal de ventas
        const { data: ventas, error: ventasError } = await supabaseClient
            .from('ventas')
            .select('*')
            .gte('fecha', fechaInicio.value + 'T00:00:00')
            .lte('fecha', fechaFin.value + 'T23:59:59')
            .order('fecha', { ascending: false });
        
        if (ventasError) {
            console.error('Error en consulta de ventas:', ventasError);
            throw ventasError;
        }
        
        console.log('Ventas obtenidas:', ventas?.length || 0);
        
        const tbody = document.getElementById('historial-body');
        if (!tbody) {
            console.error('Elemento tbody no encontrado');
            return;
        }
        
        tbody.innerHTML = '';
        
        if (!ventas || ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay ventas en este período</td></tr>';
            return;
        }
        
        // Obtener IDs de ventas para consultas posteriores
        const ventaIds = ventas.map(v => v.id);
        
        // Obtener todos los pagos en una sola consulta
        const { data: pagos, error: pagosError } = await supabaseClient
            .from('pagos_venta')
            .select('*')
            .in('venta_id', ventaIds);
        
        if (pagosError) {
            console.error('Error obteniendo pagos:', pagosError);
        }
        
        // Agrupar pagos por venta_id
        const pagosPorVenta = {};
        if (pagos) {
            pagos.forEach(pago => {
                if (!pagosPorVenta[pago.venta_id]) {
                    pagosPorVenta[pago.venta_id] = [];
                }
                pagosPorVenta[pago.venta_id].push(pago);
            });
        }
        
        // Obtener usuarios si es necesario
        const userIds = [...new Set(ventas.map(v => v.usuario_id).filter(id => id))];
        let usuariosMap = {};
        
        if (userIds.length > 0) {
            const { data: usuarios, error: usuariosError } = await supabaseClient
                .from('usuarios')
                .select('id, username')
                .in('id', userIds);
            
            if (!usuariosError && usuarios) {
                usuarios.forEach(u => {
                    usuariosMap[u.id] = u.username;
                });
            }
        }
        
        // Renderizar cada venta
        ventas.forEach(venta => {
            const pagosVenta = pagosPorVenta[venta.id] || [];
            const medios = {};
            
            pagosVenta.forEach(pago => {
                if (!medios[pago.medio_pago]) {
                    medios[pago.medio_pago] = 0;
                }
                medios[pago.medio_pago] += parseFloat(pago.monto);
            });
            
            const mediosTexto = Object.entries(medios)
                .map(([medio, monto]) => `${medio}: $ ${monto.toFixed(2)}`)
                .join('<br>');
            
            const fecha = new Date(venta.fecha).toLocaleString('es-ES');
            const usuarioNombre = usuariosMap[venta.usuario_id] || 'N/A';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${venta.ticket_id}</td>
                <td>${fecha}</td>
                <td>${usuarioNombre}</td>
                <td>$ ${parseFloat(venta.total).toFixed(2)}</td>
                <td>${mediosTexto || 'Sin pagos registrados'}</td>
                <td>
                    <span class="${venta.anulada ? 'text-danger' : 'text-success'}">
                        ${venta.anulada ? 'ANULADA' : 'ACTIVA'}
                    </span>
                </td>
                <td class="acciones">
                    <button class="btn btn-sm" onclick="verDetalleVenta('${venta.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${!venta.anulada && appState.usuario?.rol === 'Administrador' ? `
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
        showNotification('Error cargando historial: ' + error.message, 'error');
    }
}

window.verDetalleVenta = async function(id) {
    try {
        console.log('Obteniendo detalle de venta:', id);
        
        // Obtener venta
        const { data: venta, error: ventaError } = await supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', id)
            .single();
        
        if (ventaError) {
            console.error('Error obteniendo venta:', ventaError);
            throw ventaError;
        }
        
        // Obtener detalles de la venta
        const { data: detalles, error: detallesError } = await supabaseClient
            .from('detalle_ventas')
            .select(`
                cantidad,
                precio_unitario,
                subtotal,
                productos (nombre, codigo_barra)
            `)
            .eq('venta_id', id);
        
        if (detallesError) {
            console.error('Error obteniendo detalles:', detallesError);
            throw detallesError;
        }
        
        // Obtener pagos
        const { data: pagos, error: pagosError } = await supabaseClient
            .from('pagos_venta')
            .select('medio_pago, monto')
            .eq('venta_id', id);
        
        if (pagosError) {
            console.error('Error obteniendo pagos:', pagosError);
            throw pagosError;
        }
        
        // Obtener usuario
        let nombreUsuario = 'N/A';
        if (venta.usuario_id) {
            const { data: usuario } = await supabaseClient
                .from('usuarios')
                .select('username')
                .eq('id', venta.usuario_id)
                .maybeSingle();
            if (usuario) nombreUsuario = usuario.username;
        }
        
        const modal = document.getElementById('modal-detalle-venta');
        const titulo = document.getElementById('modal-venta-titulo');
        const contenido = document.getElementById('detalle-venta-contenido');
        
        if (!modal || !titulo || !contenido) {
            console.error('Elementos del modal no encontrados');
            return;
        }
        
        titulo.innerHTML = `<i class="fas fa-receipt"></i> Detalle de Venta: ${venta.ticket_id}`;
        
        let detalleHTML = `
            <div class="venta-info">
                <p><strong>Ticket:</strong> ${venta.ticket_id}</p>
                <p><strong>Fecha:</strong> ${new Date(venta.fecha).toLocaleString('es-ES')}</p>
                <p><strong>Estado:</strong> ${venta.anulada ? 'ANULADA' : 'ACTIVA'}</p>
                <p><strong>Atendido por:</strong> ${nombreUsuario}</p>
                <p><strong>Subtotal:</strong> $ ${parseFloat(venta.subtotal).toFixed(2)}</p>
                <p><strong>Descuento:</strong> $ ${parseFloat(venta.descuento).toFixed(2)}</p>
                <p><strong>Total:</strong> $ ${parseFloat(venta.total).toFixed(2)}</p>
            </div>
        `;
        
        if (detalles && detalles.length > 0) {
            detalleHTML += `
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
            
            detalles.forEach(detalle => {
                detalleHTML += `
                    <tr>
                        <td>${detalle.productos?.nombre || 'N/A'}</td>
                        <td>${detalle.productos?.codigo_barra || 'N/A'}</td>
                        <td>${detalle.cantidad}</td>
                        <td>$ ${parseFloat(detalle.precio_unitario).toFixed(2)}</td>
                        <td>$ ${parseFloat(detalle.subtotal).toFixed(2)}</td>
                    </tr>
                `;
            });
            
            detalleHTML += `
                    </tbody>
                </table>
            `;
        }
        
        if (pagos && pagos.length > 0) {
            detalleHTML += `
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
            
            pagos.forEach(pago => {
                detalleHTML += `
                    <tr>
                        <td>${pago.medio_pago}</td>
                        <td>$ ${parseFloat(pago.monto).toFixed(2)}</td>
                    </tr>
                `;
            });
            
            detalleHTML += `
                    </tbody>
                </table>
            `;
        }
        
        contenido.innerHTML = detalleHTML;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error cargando detalle de venta:', error);
        showNotification('Error cargando detalle de venta: ' + error.message, 'error');
    }
};

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
                <td>$ ${parseFloat(producto.precio_venta).toFixed(2)}</td>
                <td>$ ${parseFloat(producto.precio_costo).toFixed(2)}</td>
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
    
    if (!modal || !titulo || !form) {
        console.error('Elementos del modal no encontrados');
        return;
    }
    
    if (producto) {
        titulo.innerHTML = '<i class="fas fa-edit"></i> Editar Producto';
        
        const codigoInput = form.querySelector('#producto-codigo');
        const nombreInput = form.querySelector('#producto-nombre');
        const precioCostoInput = form.querySelector('#producto-precio-costo');
        const precioVentaInput = form.querySelector('#producto-precio-venta');
        const stockInput = form.querySelector('#producto-stock');
        const proveedorInput = form.querySelector('#producto-proveedor');
        const activoSelect = form.querySelector('#producto-activo');
        const margenInput = form.querySelector('#producto-margen');
        
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
    const codigoInput = form.querySelector('#producto-codigo');
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
    
    console.log('Formulario enviado - Depuración:', {
        form: e.target,
        hasProductId: e.target.dataset.productoId
    });
    
    const permiso = e.target.dataset.productoId ? 'modificar_productos' : 'cargar_productos';
    const tienePermiso = await hasPermission(permiso);
    
    if (!tienePermiso) {
        showNotification('No tiene permisos para esta acción', 'error');
        return;
    }
    
    const form = e.target;
    const codigoInput = form.querySelector('#producto-codigo');
    const nombreInput = form.querySelector('#producto-nombre');
    const precioCostoInput = form.querySelector('#producto-precio-costo');
    const precioVentaInput = form.querySelector('#producto-precio-venta');
    const stockInput = form.querySelector('#producto-stock');
    const proveedorInput = form.querySelector('#producto-proveedor');
    const activoSelect = form.querySelector('#producto-activo');
    const margenInput = form.querySelector('#producto-margen');
    
    if (!codigoInput || !nombreInput || !precioCostoInput || !precioVentaInput || 
        !stockInput || !activoSelect || !margenInput || !proveedorInput) {
        console.error('Elementos del formulario no encontrados:', {
            codigoInput, nombreInput, precioCostoInput, precioVentaInput,
            stockInput, activoSelect, margenInput, proveedorInput
        });
        showNotification('Error: formulario incompleto', 'error');
        return;
    }
    
    const codigoValor = codigoInput.value ? codigoInput.value.trim() : '';
    const nombreValor = nombreInput.value ? nombreInput.value.trim() : '';
    
    console.log('Valores depurados:', {
        codigo: codigoValor,
        nombre: nombreValor,
        codigoLength: codigoValor.length,
        nombreLength: nombreValor.length
    });
    
    if (!codigoValor || codigoValor.length === 0) {
        showNotification('El código de barras es obligatorio', 'warning');
        codigoInput.focus();
        codigoInput.classList.add('input-error');
        return;
    } else {
        codigoInput.classList.remove('input-error');
    }
    
    if (!nombreValor || nombreValor.length === 0) {
        showNotification('El nombre del producto es obligatorio', 'warning');
        nombreInput.focus();
        nombreInput.classList.add('input-error');
        return;
    } else {
        nombreInput.classList.remove('input-error');
    }
    
    const producto = {
        codigo_barra: codigoValor,
        nombre: nombreValor,
        precio_costo: parseFloat(precioCostoInput.value) || 0,
        precio_venta: parseFloat(precioVentaInput.value) || 0,
        stock: parseInt(stockInput.value) || 0,
        proveedor: proveedorInput.value ? proveedorInput.value.trim() : null,
        activo: activoSelect.value === 'true',
        margen_ganancia: margenInput.value ? parseFloat(margenInput.value) : null
    };
    
    console.log('Producto a guardar:', producto);
    
    if (producto.precio_costo < 0 || producto.precio_venta < 0) {
        showNotification('Los precios deben ser positivos', 'warning');
        return;
    }
    
    if (producto.stock < 0) {
        showNotification('El stock no puede ser negativo', 'warning');
        return;
    }
    
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
    }
    
    try {
        let error;
        
        if (form.dataset.productoId) {
            const { error: updateError } = await supabaseClient
                .from('productos')
                .update(producto)
                .eq('id', form.dataset.productoId);
            
            error = updateError;
        } else {
            const { error: insertError } = await supabaseClient
                .from('productos')
                .insert([producto]);
            
            error = insertError;
        }
        
        if (error) {
            if (error.code === '23505') {
                throw new Error('El código de barras ya existe');
            }
            throw error;
        }
        
        showNotification('Producto guardado correctamente', 'success');
        
        const modal = document.getElementById('modal-producto');
        if (modal) modal.classList.remove('active');
        
        form.reset();
        delete form.dataset.productoId;
        
        cargarProductos();
        
    } catch (error) {
        console.error('Error guardando producto:', error);
        
        if (error.message === 'El código de barras ya existe') {
            showNotification(error.message, 'error');
            if (codigoInput) {
                codigoInput.focus();
                codigoInput.classList.add('input-error');
            }
        } else {
            showNotification('Error guardando producto: ' + error.message, 'error');
        }
    } finally {
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
}

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

// ==================== BUSCADOR MANUAL ====================
function showBuscadorManual() {
    const modal = document.getElementById('modal-buscador');
    if (modal) {
        modal.classList.add('active');
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
                <td>$ ${parseFloat(producto.precio_venta).toFixed(2)}</td>
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
        
        const modal = document.getElementById('modal-buscador');
        if (modal) modal.classList.remove('active');
        
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

// ==================== REPORTES ====================
async function generarReporte() {
    try {
        const fechaInicio = document.getElementById('reporte-fecha-inicio');
        const fechaFin = document.getElementById('reporte-fecha-fin');
        
        if (!fechaInicio || !fechaFin || !fechaInicio.value || !fechaFin.value) {
            showNotification('Seleccione un rango de fechas', 'warning');
            return;
        }
        
        const fechaFinAjustada = new Date(fechaFin.value);
        fechaFinAjustada.setHours(23, 59, 59, 999);
        
        // MODIFICACIÓN: Consulta mejorada para obtener reportes reales
        const { data: ventas, error: ventasError } = await supabaseClient
            .from('ventas')
            .select(`
                id,
                total,
                descuento,
                anulada,
                fecha,
                detalle_ventas (
                    cantidad,
                    precio_unitario,
                    subtotal,
                    productos (
                        precio_costo,
                        nombre
                    )
                ),
                pagos_venta (
                    medio_pago,
                    monto
                )
            `)
            .gte('fecha', fechaInicio.value + 'T00:00:00')
            .lte('fecha', fechaFinAjustada.toISOString())
            .eq('anulada', false)
            .order('fecha', { ascending: false });
        
        if (ventasError) {
            console.error('Error obteniendo ventas para reporte:', ventasError);
            throw ventasError;
        }
        
        console.log(`Ventas obtenidas para reporte: ${ventas?.length || 0}`);
        
        if (!ventas || ventas.length === 0) {
            const resultados = document.getElementById('reportes-resultados');
            if (resultados) {
                resultados.innerHTML = `
                    <div class="empty-reportes">
                        <i class="fas fa-chart-bar fa-3x"></i>
                        <p>No hay ventas en el período seleccionado</p>
                        <p>Fecha: ${fechaInicio.value} al ${fechaFin.value}</p>
                    </div>
                `;
            }
            return;
        }
        
        let totalVentas = 0;
        let totalDescuentos = 0;
        let totalGanancias = 0;
        let cantidadVentas = ventas.length;
        let totalCosto = 0;
        
        const mediosPago = {
            'EFECTIVO': 0,
            'TARJETA': 0,
            'TRANSFERENCIA/QR': 0
        };
        
        const productosVendidos = {};
        const ventasPorDia = {};
        
        // Procesar todas las ventas
        ventas.forEach(venta => {
            totalVentas += parseFloat(venta.total) || 0;
            totalDescuentos += parseFloat(venta.descuento) || 0;
            
            // Fecha para agrupación diaria
            const fecha = venta.fecha.split('T')[0];
            if (!ventasPorDia[fecha]) {
                ventasPorDia[fecha] = {
                    ventas: 0,
                    cantidad: 0
                };
            }
            ventasPorDia[fecha].ventas += parseFloat(venta.total) || 0;
            ventasPorDia[fecha].cantidad += 1;
            
            // Procesar detalles de venta para ganancias
            if (venta.detalle_ventas && venta.detalle_ventas.length > 0) {
                venta.detalle_ventas.forEach(detalle => {
                    const costo = parseFloat(detalle.productos?.precio_costo) || 0;
                    const ganancia = (parseFloat(detalle.precio_unitario) || 0) - costo;
                    const gananciaTotal = ganancia * (detalle.cantidad || 1);
                    totalGanancias += gananciaTotal;
                    totalCosto += costo * (detalle.cantidad || 1);
                    
                    // Contabilizar productos vendidos
                    const productoNombre = detalle.productos?.nombre || 'Desconocido';
                    if (!productosVendidos[productoNombre]) {
                        productosVendidos[productoNombre] = {
                            cantidad: 0,
                            total: 0
                        };
                    }
                    productosVendidos[productoNombre].cantidad += detalle.cantidad || 0;
                    productosVendidos[productoNombre].total += parseFloat(detalle.subtotal) || 0;
                });
            }
            
            // Procesar pagos
            if (venta.pagos_venta && venta.pagos_venta.length > 0) {
                venta.pagos_venta.forEach(pago => {
                    if (mediosPago[pago.medio_pago] !== undefined) {
                        mediosPago[pago.medio_pago] += parseFloat(pago.monto) || 0;
                    }
                });
            }
        });
        
        const ticketPromedio = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;
        const margenGanancia = totalCosto > 0 ? (totalGanancias / totalCosto) * 100 : 0;
        
        // Ordenar productos más vendidos
        const productosTop = Object.entries(productosVendidos)
            .sort((a, b) => b[1].cantidad - a[1].cantidad)
            .slice(0, 10);
        
        // Ordenar días por fecha
        const diasOrdenados = Object.entries(ventasPorDia)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]));
        
        const resultados = document.getElementById('reportes-resultados');
        if (!resultados) return;
        
        resultados.innerHTML = `
            <div class="reporte-resumen">
                <div class="reporte-item">
                    <h4>VENTAS TOTALES</h4>
                    <div class="reporte-valor">$ ${totalVentas.toFixed(2)}</div>
                    <small>${cantidadVentas} transacciones</small>
                </div>
                <div class="reporte-item">
                    <h4>GANANCIAS</h4>
                    <div class="reporte-valor">$ ${totalGanancias.toFixed(2)}</div>
                    <small>${margenGanancia.toFixed(1)}% de margen</small>
                </div>
                <div class="reporte-item">
                    <h4>TICKET PROMEDIO</h4>
                    <div class="reporte-valor">$ ${ticketPromedio.toFixed(2)}</div>
                    <small>Por venta</small>
                </div>
                <div class="reporte-item">
                    <h4>DESCUENTOS</h4>
                    <div class="reporte-valor">$ ${totalDescuentos.toFixed(2)}</div>
                    <small>${totalVentas > 0 ? ((totalDescuentos / totalVentas) * 100).toFixed(1) : '0'}% del total</small>
                </div>
            </div>
            
            <div class="reporte-desglose">
                <h3><i class="fas fa-money-check-alt"></i> Desglose por Medio de Pago</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Medio de Pago</th>
                            <th>Total</th>
                            <th>Porcentaje</th>
                            <th>Cant. Transacciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(mediosPago).map(([medio, total]) => {
                            const porcentaje = totalVentas > 0 ? (total / totalVentas * 100) : 0;
                            // Contar transacciones por medio de pago
                            let transacciones = 0;
                            ventas.forEach(venta => {
                                if (venta.pagos_venta && venta.pagos_venta.some(p => p.medio_pago === medio)) {
                                    transacciones++;
                                }
                            });
                            return `
                                <tr>
                                    <td>${medio}</td>
                                    <td>$ ${total.toFixed(2)}</td>
                                    <td>${porcentaje.toFixed(1)}%</td>
                                    <td>${transacciones}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="reporte-desglose">
                        <h3><i class="fas fa-chart-line"></i> Ventas por Día</h3>
                        <div style="height: 300px; overflow-y: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Cant. Ventas</th>
                                        <th>Total</th>
                                        <th>Promedio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${diasOrdenados.map(([fecha, datos]) => `
                                        <tr>
                                            <td>${fecha}</td>
                                            <td>${datos.cantidad}</td>
                                            <td>$ ${datos.ventas.toFixed(2)}</td>
                                            <td>$ ${(datos.ventas / datos.cantidad).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="reporte-desglose">
                        <h3><i class="fas fa-star"></i> Productos Más Vendidos</h3>
                        <div style="height: 300px; overflow-y: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Cantidad</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productosTop.map(([nombre, datos]) => `
                                        <tr>
                                            <td>${nombre}</td>
                                            <td>${datos.cantidad}</td>
                                            <td>$ ${datos.total.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mt-4 p-3 bg-light rounded">
                <h4><i class="fas fa-info-circle"></i> Resumen del Período</h4>
                <div class="row">
                    <div class="col-md-4">
                        <p><strong>Fecha Inicio:</strong> ${fechaInicio.value}</p>
                        <p><strong>Fecha Fin:</strong> ${fechaFin.value}</p>
                    </div>
                    <div class="col-md-4">
                        <p><strong>Total Días con Ventas:</strong> ${diasOrdenados.length}</p>
                        <p><strong>Productos Diferentes Vendidos:</strong> ${Object.keys(productosVendidos).length}</p>
                    </div>
                    <div class="col-md-4">
                        <p><strong>Margen de Ganancia:</strong> ${margenGanancia.toFixed(2)}%</p>
                        <p><strong>Eficiencia de Descuentos:</strong> ${totalVentas > 0 ? ((totalDescuentos / totalVentas) * 100).toFixed(2) : '0'}%</p>
                    </div>
                </div>
            </div>
        `;
        
        showNotification(`Reporte generado para ${cantidadVentas} ventas`, 'success');
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        showNotification('Error generando reporte: ' + error.message, 'error');
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
        
        const btnDiv = document.createElement('div');
        btnDiv.className = 'form-actions';
        btnDiv.innerHTML = `
            <button id="btn-guardar-config" class="btn btn-primary">
                <i class="fas fa-save"></i> Guardar Configuración
            </button>
        `;
        
        form.appendChild(btnDiv);
        
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
        
        if (appState.usuario?.rol !== 'Administrador') {
            showNotification('Solo administradores pueden modificar la configuración', 'error');
            return;
        }
        
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
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tab = document.getElementById(tabId);
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    
    if (tab) tab.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');
    
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
        
        if (appState.usuario?.rol !== 'Administrador') {
            showNotification('Solo administradores pueden modificar permisos', 'error');
            return;
        }
        
        const { error: deleteError } = await supabaseClient
            .from('permisos')
            .update({ activo: false })
            .eq('usuario_id', id);
        
        if (deleteError) throw deleteError;
        
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

async function cargarConfiguracionUsuarios() {
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
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// ==================== INICIALIZACIÓN ADICIONAL ====================
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    appState.modoOscuro = e.matches;
});

window.addEventListener('resize', function() {
    if (window.innerWidth >= 768) {
        const nav = document.getElementById('main-nav');
        if (nav) nav.classList.remove('active');
    }
});

window.addEventListener('keydown', function(e) {
    if (e.key === 'F5') {
        e.preventDefault();
    }
});

console.log('Sistema POS AFMSOLUTIONS cargado correctamente');
