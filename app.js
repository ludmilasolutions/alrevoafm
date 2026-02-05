// ============================================
// CONFIGURACIÓN SUPABASE Y CONSTANTES
// ====================================================

// Configuración de Supabase - REEMPLAZAR CON TUS DATOS REALES
const SUPABASE_URL = 'https://nptthngcshkbuavkjujf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdHRobmdjc2hrYnVhdmtqdWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTAyMTcsImV4cCI6MjA4NTgyNjIxN30.0P2Yf-wHtNzgoIFLEN-DYME85NFEjKtmz2cyIkyuZfg';

// Crear cliente Supabase - usamos la variable global del CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let currentPermissions = [];
let currentRole = null;
let carrito = [];
let cajaActiva = null;
let productosCache = new Map();
let modoOscuro = localStorage.getItem('theme') === 'dark';
let currentSection = 'venta';
let proximoTicketId = 'T-YYYYMMDD-0000';
let selectedPagos = [];
let descuentoAplicado = 0;

// Medios de pago fijos
const MEDIOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA/QR'];

// Elementos DOM principales
const elementos = {
    // Modales
    loginModal: document.getElementById('login-modal'),
    mainApp: document.getElementById('main-app'),
    
    // Header y navegación
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.getElementById('sidebar'),
    username: document.getElementById('username'),
    userRole: document.getElementById('user-role'),
    logoutBtn: document.getElementById('logout-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    liveClock: document.getElementById('live-clock'),
    
    // Navegación
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.section'),
    
    // Scanner y venta
    scannerInput: document.getElementById('scanner-input'),
    btnBuscarManual: document.getElementById('btn-buscar-manual'),
    btnLimpiarCarrito: document.getElementById('btn-limpiar-carrito'),
    carritoBody: document.getElementById('carrito-body'),
    carritoVacio: document.getElementById('carrito-vacio'),
    carritoCount: document.getElementById('carrito-count'),
    subtotal: document.getElementById('subtotal'),
    descuentoAplicadoElement: document.getElementById('descuento-aplicado'),
    total: document.getElementById('total'),
    descuentoInput: document.getElementById('descuento-input'),
    btnAplicarDescuento: document.getElementById('btn-aplicar-descuento'),
    btnFinalizarVenta: document.getElementById('btn-finalizar-venta'),
    pagosSeleccionados: document.getElementById('pagos-seleccionados'),
    nextTicketId: document.getElementById('next-ticket-id'),
    currentCajaId: document.getElementById('current-caja-id'),
    statusCaja: document.getElementById('status-caja'),
    
    // Modales
    modalBuscarProducto: document.getElementById('modal-buscar-producto'),
    modalProducto: document.getElementById('modal-producto'),
    modalPagos: document.getElementById('modal-pagos'),
    modalDetalleVenta: document.getElementById('modal-detalle-venta'),
    
    // Productos
    btnNuevoProducto: document.getElementById('btn-nuevo-producto'),
    btnRefreshProductos: document.getElementById('btn-refresh-productos'),
    productosBody: document.getElementById('productos-body'),
    filtroProductos: document.getElementById('filtro-productos'),
    filtroActivo: document.getElementById('filtro-activo'),
    btnAplicarFiltros: document.getElementById('btn-aplicar-filtros'),
    
    // Historial
    btnVentasHoy: document.getElementById('btn-ventas-hoy'),
    fechaInicio: document.getElementById('fecha-inicio'),
    fechaFin: document.getElementById('fecha-fin'),
    btnFiltrarHistorial: document.getElementById('btn-filtrar-historial'),
    historialBody: document.getElementById('historial-body'),
    btnAnularVenta: document.getElementById('btn-anular-venta'),
    
    // Caja
    cajaInfo: document.getElementById('caja-info'),
    cajaFormContainer: document.getElementById('caja-form-container'),
    cajaMovimientos: document.getElementById('caja-movimientos'),
    btnRefreshCaja: document.getElementById('btn-refresh-caja'),
    
    // Reportes
    reporteFechaInicio: document.getElementById('reporte-fecha-inicio'),
    reporteFechaFin: document.getElementById('reporte-fecha-fin'),
    reporteTipo: document.getElementById('reporte-tipo'),
    btnGenerarReporte: document.getElementById('btn-generar-reporte'),
    reporteResultados: document.getElementById('reporte-resultados'),
    
    // Configuración
    configEncabezado: document.getElementById('config-encabezado'),
    configPie: document.getElementById('config-pie'),
    configMensaje: document.getElementById('config-mensaje'),
    btnGuardarConfig: document.getElementById('btn-guardar-config'),
    permisosContainer: document.getElementById('permisos-container'),
    
    // Toast container
    toastContainer: document.getElementById('toast-container')
};

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar la aplicación
async function init() {
    console.log('Inicializando sistema POS AFMSOLUTIONS...');
    
    // Configurar tema
    configurarTema();
    
    // Configurar reloj
    actualizarReloj();
    setInterval(actualizarReloj, 1000);
    
    // Configurar eventos
    configurarEventos();
    
    // Configurar atajos de teclado
    configurarAtajosTeclado();
    
    // Verificar sesión
    await checkSession();
    
    console.log('Sistema POS inicializado correctamente');
}

// Configurar eventos
function configurarEventos() {
    // Login
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    
    // Navegación
    elementos.menuToggle?.addEventListener('click', toggleSidebar);
    elementos.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            mostrarSeccion(section);
            if (window.innerWidth < 768) {
                toggleSidebar();
            }
        });
    });
    
    // Cerrar sesión
    elementos.logoutBtn?.addEventListener('click', handleLogout);
    
    // Toggle tema
    elementos.themeToggle?.addEventListener('click', toggleTema);
    
    // Scanner y venta
    elementos.scannerInput?.addEventListener('keypress', handleScanner);
    elementos.btnBuscarManual?.addEventListener('click', () => mostrarModal('modal-buscar-producto'));
    elementos.btnLimpiarCarrito?.addEventListener('click', limpiarCarrito);
    elementos.btnAplicarDescuento?.addEventListener('click', aplicarDescuento);
    elementos.btnFinalizarVenta?.addEventListener('click', iniciarProcesoPago);
    
    // Medios de pago
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const medio = e.currentTarget.dataset.medio;
            seleccionarMedioPago(medio);
        });
    });
    
    // Cerrar modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            ocultarModal(modal.id);
        });
    });
    
    // Cerrar modal al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                ocultarModal(modal.id);
            }
        });
    });
    
    // Productos
    elementos.btnNuevoProducto?.addEventListener('click', () => mostrarFormularioProducto());
    elementos.btnRefreshProductos?.addEventListener('click', cargarProductos);
    elementos.btnAplicarFiltros?.addEventListener('click', cargarProductos);
    
    // Historial
    elementos.btnVentasHoy?.addEventListener('click', cargarVentasHoy);
    elementos.btnFiltrarHistorial?.addEventListener('click', cargarHistorial);
    
    // Configuración
    elementos.btnGuardarConfig?.addEventListener('click', guardarConfiguracion);
    
    // Buscar productos
    document.getElementById('btn-buscar-productos')?.addEventListener('click', buscarProductos);
    
    // Reportes
    elementos.btnGenerarReporte?.addEventListener('click', generarReporte);
    
    // Caja
    elementos.btnRefreshCaja?.addEventListener('click', cargarCajaActiva);
    
    // Evento para enviar formulario de producto
    document.getElementById('form-producto')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarProducto();
    });
}

// Configurar atajos de teclado
function configurarAtajosTeclado() {
    document.addEventListener('keydown', (e) => {
        // Ignorar si está en input (excepto scanner)
        if (e.target.tagName === 'INPUT' && e.target.id !== 'scanner-input') {
            return;
        }
        
        switch(e.key) {
            case 'F1':
                e.preventDefault();
                if (currentSection === 'venta' && elementos.btnFinalizarVenta) {
                    elementos.btnFinalizarVenta.click();
                }
                break;
            case 'F2':
                e.preventDefault();
                if (currentSection === 'venta' && elementos.descuentoInput) {
                    elementos.descuentoInput.focus();
                }
                break;
            case 'F3':
                e.preventDefault();
                if (currentSection === 'venta' && carrito.length > 0) {
                    eliminarDelCarrito(carrito.length - 1);
                }
                break;
            case 'F4':
                e.preventDefault();
                mostrarSeccion('caja');
                break;
            case 'F5':
                e.preventDefault();
                mostrarSeccion('historial');
                cargarVentasHoy();
                break;
            case 'F6':
                e.preventDefault();
                if (currentSection === 'venta') {
                    mostrarModal('modal-buscar-producto');
                }
                break;
            case 'Escape':
                e.preventDefault();
                document.querySelectorAll('.modal.active').forEach(modal => {
                    ocultarModal(modal.id);
                });
                break;
            case '1':
                if (currentSection === 'venta') {
                    seleccionarMedioPago('EFECTIVO');
                }
                break;
            case '2':
                if (currentSection === 'venta') {
                    seleccionarMedioPago('TARJETA');
                }
                break;
            case '3':
                if (currentSection === 'venta') {
                    seleccionarMedioPago('TRANSFERENCIA/QR');
                }
                break;
        }
    });
}

// ============================================
// UTILIDADES
// ============================================

// Mostrar notificación toast
function mostrarToast(titulo, mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${titulo}</div>
            <div class="toast-message">${mensaje}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    elementos.toastContainer.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Mostrar modal
function mostrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Ocultar modal
function ocultarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Mostrar sección
function mostrarSeccion(seccionId) {
    elementos.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === seccionId) {
            link.classList.add('active');
        }
    });
    
    elementos.sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `seccion-${seccionId}`) {
            section.classList.add('active');
        }
    });
    
    currentSection = seccionId;
    
    if (seccionId === 'venta' && elementos.scannerInput) {
        setTimeout(() => {
            elementos.scannerInput.focus();
        }, 100);
    }
}

// Configurar tema
function configurarTema() {
    if (modoOscuro) {
        document.documentElement.setAttribute('data-theme', 'dark');
        elementos.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        elementos.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// Toggle tema
function toggleTema() {
    modoOscuro = !modoOscuro;
    localStorage.setItem('theme', modoOscuro ? 'dark' : 'light');
    configurarTema();
}

// Toggle sidebar
function toggleSidebar() {
    elementos.sidebar.classList.toggle('active');
}

// Actualizar reloj
function actualizarReloj() {
    if (elementos.liveClock) {
        const ahora = new Date();
        elementos.liveClock.textContent = ahora.toLocaleTimeString();
    }
}

// Formatear moneda
function formatoMoneda(valor) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(valor);
}

// ============================================
// AUTENTICACIÓN
// ============================================

// Verificar sesión
async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            mostrarToast('Error', 'No se pudo verificar la sesión', 'error');
            return;
        }
        
        if (session) {
            currentUser = session.user;
            await cargarUsuarioInfo();
            await cargarPermisos();
            
            if (elementos.loginModal && elementos.mainApp) {
                elementos.loginModal.classList.remove('active');
                elementos.mainApp.classList.remove('hidden');
            }
            
            await inicializarSistema();
        } else {
            if (elementos.loginModal && elementos.mainApp) {
                elementos.loginModal.classList.add('active');
                elementos.mainApp.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error en checkSession:', error);
        mostrarToast('Error', 'Error al verificar sesión', 'error');
    }
}

// Manejar login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    
    if (!email || !password) {
        mostrarToast('Error', 'Email y contraseña requeridos', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await cargarUsuarioInfo();
        await cargarPermisos();
        
        elementos.loginModal.classList.remove('active');
        elementos.mainApp.classList.remove('hidden');
        
        await inicializarSistema();
        
        mostrarToast('¡Bienvenido!', 'Sesión iniciada correctamente', 'success');
    } catch (error) {
        console.error('Error en login:', error);
        mostrarToast('Error de inicio de sesión', error.message, 'error');
    }
}

// Cargar información del usuario
async function cargarUsuarioInfo() {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('username, rol')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;
        
        elementos.username.textContent = data.username;
        elementos.userRole.textContent = data.rol;
        currentRole = data.rol;
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }
}

// Cargar permisos
async function cargarPermisos() {
    try {
        const { data, error } = await supabase
            .from('permisos')
            .select('permiso')
            .eq('usuario_id', currentUser.id)
            .eq('activo', true);
        
        if (error) throw error;
        
        currentPermissions = data.map(p => p.permiso);
    } catch (error) {
        console.error('Error cargando permisos:', error);
    }
}

// Verificar permiso
async function tienePermiso(permiso) {
    if (currentRole === 'Administrador') return true;
    
    try {
        const { data, error } = await supabase
            .from('permisos')
            .select('permiso')
            .eq('usuario_id', currentUser.id)
            .eq('permiso', permiso)
            .eq('activo', true)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        return !!data;
    } catch (error) {
        console.error('Error verificando permiso:', error);
        return false;
    }
}

// Cerrar sesión
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        currentPermissions = [];
        carrito = [];
        cajaActiva = null;
        
        elementos.mainApp.classList.add('hidden');
        elementos.loginModal.classList.add('active');
        
        document.getElementById('login-form')?.reset();
        
        mostrarToast('Sesión cerrada', 'Has cerrado sesión correctamente', 'info');
    } catch (error) {
        console.error('Error en logout:', error);
        mostrarToast('Error', 'No se pudo cerrar sesión', 'error');
    }
}

// ============================================
// INICIALIZACIÓN DEL SISTEMA
// ============================================

async function inicializarSistema() {
    try {
        await cargarCajaActiva();
        await cargarProductos();
        await cargarConfiguracion();
        await actualizarProximoTicketId();
        
        mostrarSeccion('venta');
        
        if (elementos.scannerInput) {
            elementos.scannerInput.focus();
        }
        
        console.log('Sistema inicializado correctamente');
    } catch (error) {
        console.error('Error inicializando sistema:', error);
        mostrarToast('Error', 'Error al inicializar sistema', 'error');
    }
}

// ============================================
// GESTIÓN DE PRODUCTOS
// ============================================

// Cargar productos
async function cargarProductos() {
    try {
        let query = supabase
            .from('productos')
            .select('*');
        
        const filtroTexto = elementos.filtroProductos?.value;
        const filtroActivo = elementos.filtroActivo?.value;
        
        if (filtroTexto) {
            query = query.or(`codigo_barra.ilike.%${filtroTexto}%,nombre.ilike.%${filtroTexto}%,proveedor.ilike.%${filtroTexto}%`);
        }
        
        if (filtroActivo && filtroActivo !== 'all') {
            query = query.eq('activo', filtroActivo === 'true');
        }
        
        const { data: productos, error } = await query.order('nombre');
        
        if (error) throw error;
        
        productosCache.clear();
        productos.forEach(p => productosCache.set(p.id, p));
        
        renderizarProductos(productos);
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarToast('Error', 'No se pudieron cargar los productos', 'error');
    }
}

// Renderizar productos
function renderizarProductos(productos) {
    if (!elementos.productosBody) return;
    
    elementos.productosBody.innerHTML = '';
    
    if (!productos || productos.length === 0) {
        elementos.productosBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>No hay productos registrados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    productos.forEach(producto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${producto.codigo_barra}</code></td>
            <td><strong>${producto.nombre}</strong></td>
            <td>$${producto.precio_costo.toFixed(2)}</td>
            <td>$${producto.precio_venta.toFixed(2)}</td>
            <td>${producto.margen_ganancia ? producto.margen_ganancia.toFixed(1) + '%' : '-'}</td>
            <td>
                <span class="${producto.stock < 10 ? 'text-danger' : 'text-success'}">
                    ${producto.stock}
                </span>
            </td>
            <td>${producto.proveedor || '-'}</td>
            <td>
                <span class="badge ${producto.activo ? 'bg-success' : 'bg-danger'}">
                    ${producto.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button class="btn btn-small btn-secondary btn-editar-producto" data-id="${producto.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-small btn-danger btn-eliminar-producto" data-id="${producto.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        elementos.productosBody.appendChild(tr);
    });
    
    // Eventos para botones
    document.querySelectorAll('.btn-editar-producto').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            mostrarFormularioProducto(id);
        });
    });
    
    document.querySelectorAll('.btn-eliminar-producto').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (await tienePermiso('modificar_productos')) {
                await eliminarProducto(id);
            } else {
                mostrarToast('Permiso denegado', 'No tienes permiso para eliminar productos', 'error');
            }
        });
    });
}

// Mostrar formulario de producto
async function mostrarFormularioProducto(id = null) {
    const esNuevo = !id;
    const titulo = esNuevo ? 'Nuevo Producto' : 'Editar Producto';
    const producto = id ? productosCache.get(id) : null;
    
    document.getElementById('modal-producto-titulo').textContent = titulo;
    
    const form = document.getElementById('form-producto');
    form.dataset.id = id || '';
    
    if (producto) {
        document.getElementById('producto-codigo').value = producto.codigo_barra;
        document.getElementById('producto-nombre').value = producto.nombre;
        document.getElementById('producto-precio-costo').value = producto.precio_costo;
        document.getElementById('producto-margen').value = producto.margen_ganancia || '';
        document.getElementById('producto-precio-venta').value = producto.precio_venta;
        document.getElementById('producto-stock').value = producto.stock;
        document.getElementById('producto-proveedor').value = producto.proveedor || '';
        document.getElementById('producto-activo').checked = producto.activo;
    } else {
        form.reset();
        document.getElementById('producto-activo').checked = true;
    }
    
    // Configurar eventos para cálculo automático
    const precioCostoInput = document.getElementById('producto-precio-costo');
    const margenInput = document.getElementById('producto-margen');
    const precioVentaInput = document.getElementById('producto-precio-venta');
    
    const calcularPrecioVenta = () => {
        const costo = parseFloat(precioCostoInput.value) || 0;
        const margen = parseFloat(margenInput.value) || 0;
        
        if (costo > 0 && margen > 0) {
            const precioVenta = costo * (1 + margen / 100);
            precioVentaInput.value = precioVenta.toFixed(2);
        }
    };
    
    const calcularMargen = () => {
        const costo = parseFloat(precioCostoInput.value) || 0;
        const venta = parseFloat(precioVentaInput.value) || 0;
        
        if (costo > 0 && venta > 0) {
            const margen = ((venta - costo) / costo) * 100;
            margenInput.value = margen.toFixed(2);
        }
    };
    
    // Limpiar eventos anteriores
    precioCostoInput.removeEventListener('input', calcularPrecioVenta);
    margenInput.removeEventListener('input', calcularPrecioVenta);
    precioVentaInput.removeEventListener('input', calcularMargen);
    
    // Agregar nuevos eventos
    precioCostoInput.addEventListener('input', calcularPrecioVenta);
    margenInput.addEventListener('input', calcularPrecioVenta);
    precioVentaInput.addEventListener('input', calcularMargen);
    
    mostrarModal('modal-producto');
}

// Guardar producto
async function guardarProducto() {
    try {
        const form = document.getElementById('form-producto');
        const id = form.dataset.id;
        const esNuevo = !id;
        
        if (esNuevo && !(await tienePermiso('cargar_productos'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para crear productos', 'error');
            return;
        }
        
        if (!esNuevo && !(await tienePermiso('modificar_productos'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para modificar productos', 'error');
            return;
        }
        
        const producto = {
            codigo_barra: document.getElementById('producto-codigo').value.trim(),
            nombre: document.getElementById('producto-nombre').value.trim(),
            precio_costo: parseFloat(document.getElementById('producto-precio-costo').value),
            margen_ganancia: parseFloat(document.getElementById('producto-margen').value) || null,
            precio_venta: parseFloat(document.getElementById('producto-precio-venta').value),
            stock: parseInt(document.getElementById('producto-stock').value),
            proveedor: document.getElementById('producto-proveedor').value.trim() || null,
            activo: document.getElementById('producto-activo').checked
        };
        
        // Validaciones
        if (!producto.codigo_barra) throw new Error('El código de barras es obligatorio');
        if (!producto.nombre) throw new Error('El nombre es obligatorio');
        if (producto.precio_costo <= 0) throw new Error('El precio costo debe ser mayor a 0');
        if (producto.precio_venta <= 0) throw new Error('El precio de venta debe ser mayor a 0');
        if (producto.stock < 0) throw new Error('El stock no puede ser negativo');
        
        let result;
        if (esNuevo) {
            // Verificar que el código no exista
            const { data: existe } = await supabase
                .from('productos')
                .select('id')
                .eq('codigo_barra', producto.codigo_barra)
                .single();
            
            if (existe) throw new Error('El código de barras ya existe');
            
            const { data, error } = await supabase
                .from('productos')
                .insert([producto])
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            
            mostrarToast('Producto creado', 'El producto se creó correctamente', 'success');
        } else {
            const { data, error } = await supabase
                .from('productos')
                .update(producto)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            
            mostrarToast('Producto actualizado', 'El producto se actualizó correctamente', 'success');
        }
        
        productosCache.set(result.id, result);
        await cargarProductos();
        ocultarModal('modal-producto');
        
    } catch (error) {
        console.error('Error guardando producto:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// Eliminar producto
async function eliminarProducto(id) {
    try {
        if (!confirm('¿Estás seguro de desactivar este producto?')) return;
        
        const { error } = await supabase
            .from('productos')
            .update({ activo: false })
            .eq('id', id);
        
        if (error) throw error;
        
        const producto = productosCache.get(id);
        if (producto) {
            producto.activo = false;
            productosCache.set(id, producto);
        }
        
        await cargarProductos();
        
        mostrarToast('Producto desactivado', 'El producto se desactivó correctamente', 'success');
    } catch (error) {
        console.error('Error eliminando producto:', error);
        mostrarToast('Error', 'No se pudo desactivar el producto', 'error');
    }
}

// Buscar productos
async function buscarProductos() {
    try {
        let query = supabase
            .from('productos')
            .select('*')
            .eq('activo', true);
        
        const codigo = document.getElementById('busqueda-codigo')?.value;
        const nombre = document.getElementById('busqueda-nombre')?.value;
        const proveedor = document.getElementById('busqueda-proveedor')?.value;
        const precioMin = document.getElementById('busqueda-precio-min')?.value;
        const precioMax = document.getElementById('busqueda-precio-max')?.value;
        
        if (codigo) {
            query = query.ilike('codigo_barra', `%${codigo}%`);
        }
        
        if (nombre) {
            query = query.ilike('nombre', `%${nombre}%`);
        }
        
        if (proveedor) {
            query = query.ilike('proveedor', `%${proveedor}%`);
        }
        
        if (precioMin) {
            query = query.gte('precio_venta', parseFloat(precioMin));
        }
        
        if (precioMax) {
            query = query.lte('precio_venta', parseFloat(precioMax));
        }
        
        const { data: productos, error } = await query.order('nombre').limit(20);
        
        if (error) throw error;
        
        const tbody = document.getElementById('busqueda-resultados');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!productos || productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>No se encontraron productos</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${producto.codigo_barra}</code></td>
                <td><strong>${producto.nombre}</strong></td>
                <td>$${producto.precio_venta.toFixed(2)}</td>
                <td>
                    <span class="${producto.stock < 10 ? 'text-danger' : 'text-success'}">
                        ${producto.stock}
                    </span>
                </td>
                <td>
                    <button class="btn btn-small btn-primary btn-agregar-busqueda" 
                            data-id="${producto.id}">
                        <i class="fas fa-cart-plus"></i> Agregar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-agregar-busqueda').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const producto = productos.find(p => p.id === id);
                
                if (producto) {
                    agregarAlCarrito(producto);
                    ocultarModal('modal-buscar-producto');
                }
            });
        });
        
    } catch (error) {
        console.error('Error buscando productos:', error);
        mostrarToast('Error', 'No se pudo realizar la búsqueda', 'error');
    }
}

// ============================================
// PROCESO DE VENTA
// ============================================

// Manejar scanner
async function handleScanner(e) {
    if (e.key !== 'Enter') return;
    
    const codigo = elementos.scannerInput.value.trim();
    if (!codigo) return;
    
    try {
        const { data: producto, error } = await supabase
            .from('productos')
            .select('*')
            .eq('codigo_barra', codigo)
            .eq('activo', true)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                mostrarToast('Producto no encontrado', 'Escanea otro código o usa búsqueda manual', 'warning');
            } else {
                throw error;
            }
            return;
        }
        
        if (producto.stock <= 0) {
            mostrarToast('Sin stock', `No hay stock disponible de ${producto.nombre}`, 'error');
            return;
        }
        
        agregarAlCarrito(producto);
        
        elementos.scannerInput.value = '';
        elementos.scannerInput.focus();
        
    } catch (error) {
        console.error('Error procesando scanner:', error);
        mostrarToast('Error', 'No se pudo procesar el código escaneado', 'error');
    }
}

// Agregar al carrito
function agregarAlCarrito(producto, cantidad = 1) {
    const index = carrito.findIndex(item => item.producto.id === producto.id);
    
    if (index >= 0) {
        carrito[index].cantidad += cantidad;
        
        if (carrito[index].cantidad > producto.stock) {
            carrito[index].cantidad = producto.stock;
            mostrarToast('Stock limitado', `Solo hay ${producto.stock} unidades disponibles`, 'warning');
        }
    } else {
        if (cantidad > producto.stock) {
            cantidad = producto.stock;
            mostrarToast('Stock limitado', `Solo hay ${producto.stock} unidades disponibles', 'warning`);
        }
        
        carrito.push({
            producto,
            cantidad,
            precio_unitario: producto.precio_venta,
            subtotal: producto.precio_venta * cantidad
        });
    }
    
    renderizarCarrito();
    calcularTotales();
    
    mostrarToast('Producto agregado', `${producto.nombre} agregado al carrito`, 'success');
}

// Renderizar carrito
function renderizarCarrito() {
    if (!elementos.carritoBody || !elementos.carritoVacio) return;
    
    elementos.carritoBody.innerHTML = '';
    
    if (carrito.length === 0) {
        elementos.carritoVacio.classList.remove('hidden');
        if (elementos.carritoCount) {
            elementos.carritoCount.textContent = '0 items';
        }
        return;
    }
    
    elementos.carritoVacio.classList.add('hidden');
    if (elementos.carritoCount) {
        elementos.carritoCount.textContent = `${carrito.length} ${carrito.length === 1 ? 'item' : 'items'}`;
    }
    
    carrito.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <strong>${item.producto.nombre}</strong><br>
                <small class="text-muted">${item.producto.codigo_barra}</small>
            </td>
            <td>$${item.precio_unitario.toFixed(2)}</td>
            <td>
                <div class="cantidad-control">
                    <button class="btn-cantidad btn-cantidad-restar" data-index="${index}">
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="input-cantidad" 
                           value="${item.cantidad}" min="1" max="${item.producto.stock}"
                           data-index="${index}">
                    <button class="btn-cantidad btn-cantidad-sumar" data-index="${index}">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </td>
            <td>$${item.subtotal.toFixed(2)}</td>
            <td>
                <button class="btn btn-small btn-danger btn-eliminar-item" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        elementos.carritoBody.appendChild(tr);
    });
    
    // Eventos de cantidad
    document.querySelectorAll('.btn-cantidad-restar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            actualizarCantidadCarrito(index, -1);
        });
    });
    
    document.querySelectorAll('.btn-cantidad-sumar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            actualizarCantidadCarrito(index, 1);
        });
    });
    
    document.querySelectorAll('.input-cantidad').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const nuevaCantidad = parseInt(e.target.value);
            if (nuevaCantidad > 0) {
                actualizarCantidadCarrito(index, nuevaCantidad - carrito[index].cantidad);
            }
        });
    });
    
    document.querySelectorAll('.btn-eliminar-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            eliminarDelCarrito(index);
        });
    });
}

// Actualizar cantidad en carrito
function actualizarCantidadCarrito(index, delta) {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + delta;
    
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(index);
        return;
    }
    
    if (nuevaCantidad > item.producto.stock) {
        mostrarToast('Stock limitado', `Solo hay ${item.producto.stock} unidades disponibles`, 'warning');
        return;
    }
    
    item.cantidad = nuevaCantidad;
    item.subtotal = item.precio_unitario * nuevaCantidad;
    
    renderizarCarrito();
    calcularTotales();
}

// Eliminar del carrito
function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    renderizarCarrito();
    calcularTotales();
    
    if (carrito.length === 0) {
        mostrarToast('Carrito vacío', 'El carrito está vacío', 'info');
    }
}

// Limpiar carrito
function limpiarCarrito() {
    if (carrito.length === 0) return;
    
    if (!confirm('¿Estás seguro de limpiar el carrito?')) return;
    
    carrito = [];
    descuentoAplicado = 0;
    renderizarCarrito();
    calcularTotales();
    
    if (elementos.pagosSeleccionados) {
        elementos.pagosSeleccionados.innerHTML = '';
    }
    
    mostrarToast('Carrito limpiado', 'Todos los productos fueron removidos', 'info');
}

// Calcular totales
function calcularTotales() {
    let subtotal = 0;
    
    carrito.forEach(item => {
        subtotal += item.subtotal;
    });
    
    const total = subtotal - descuentoAplicado;
    
    if (elementos.subtotal) {
        elementos.subtotal.textContent = `$${subtotal.toFixed(2)}`;
    }
    
    if (elementos.descuentoAplicadoElement) {
        elementos.descuentoAplicadoElement.textContent = `-$${descuentoAplicado.toFixed(2)}`;
    }
    
    if (elementos.total) {
        elementos.total.textContent = `$${total.toFixed(2)}`;
    }
}

// Aplicar descuento
function aplicarDescuento() {
    const descuentoStr = elementos.descuentoInput?.value.trim();
    
    if (!descuentoStr) {
        mostrarToast('Error', 'Ingresa un valor de descuento', 'error');
        return;
    }
    
    let descuento = 0;
    const subtotal = parseFloat(elementos.subtotal?.textContent.replace('$', '')) || 0;
    
    if (subtotal === 0) {
        mostrarToast('Error', 'No hay productos en el carrito', 'error');
        return;
    }
    
    if (descuentoStr.endsWith('%')) {
        const porcentaje = parseFloat(descuentoStr.slice(0, -1));
        if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
            mostrarToast('Error', 'Porcentaje inválido (0-100%)', 'error');
            return;
        }
        descuento = subtotal * (porcentaje / 100);
    } else {
        descuento = parseFloat(descuentoStr);
        if (isNaN(descuento) || descuento < 0 || descuento > subtotal) {
            mostrarToast('Error', `Descuento inválido (máx: $${subtotal.toFixed(2)})`, 'error');
            return;
        }
    }
    
    descuentoAplicado = descuento;
    
    if (elementos.descuentoAplicadoElement) {
        elementos.descuentoAplicadoElement.textContent = `-$${descuento.toFixed(2)}`;
    }
    
    if (elementos.descuentoInput) {
        elementos.descuentoInput.value = '';
    }
    
    calcularTotales();
    mostrarToast('Descuento aplicado', `Descuento de $${descuento.toFixed(2)} aplicado`, 'success');
}

// ============================================
// PAGOS Y FINALIZACIÓN DE VENTA
// ============================================

// Seleccionar medio de pago
function seleccionarMedioPago(medio) {
    if (carrito.length === 0) {
        mostrarToast('Error', 'No hay productos en el carrito', 'error');
        return;
    }
    
    // Agregar o actualizar pago
    const index = selectedPagos.findIndex(p => p.medio === medio);
    const total = parseFloat(elementos.total?.textContent.replace('$', '')) || 0;
    
    if (index >= 0) {
        // Ya existe, preguntar monto
        const montoActual = selectedPagos[index].monto;
        const nuevoMonto = prompt(`Monto actual: $${montoActual.toFixed(2)}\n\nIngrese nuevo monto para ${medio}:`, montoActual.toFixed(2));
        
        if (nuevoMonto !== null) {
            const monto = parseFloat(nuevoMonto);
            if (isNaN(monto) || monto < 0) {
                mostrarToast('Error', 'Monto inválido', 'error');
                return;
            }
            
            selectedPagos[index].monto = monto;
            mostrarPagosSeleccionados();
        }
    } else {
        // Nuevo pago, preguntar monto
        const monto = prompt(`Ingrese monto para ${medio}:`, total.toFixed(2));
        
        if (monto !== null) {
            const montoNum = parseFloat(monto);
            if (isNaN(montoNum) || montoNum < 0) {
                mostrarToast('Error', 'Monto inválido', 'error');
                return;
            }
            
            selectedPagos.push({
                medio: medio,
                monto: montoNum
            });
            mostrarPagosSeleccionados();
        }
    }
}

// Mostrar pagos seleccionados
function mostrarPagosSeleccionados() {
    if (!elementos.pagosSeleccionados) return;
    
    let html = '<h4>Pagos Seleccionados:</h4>';
    let totalPagado = 0;
    
    selectedPagos.forEach((pago, index) => {
        totalPagado += pago.monto;
        html += `
            <div class="pago-item">
                <span>${pago.medio}: $${pago.monto.toFixed(2)}</span>
                <button class="btn btn-small btn-danger btn-eliminar-pago" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    const total = parseFloat(elementos.total?.textContent.replace('$', '')) || 0;
    const saldo = total - totalPagado;
    
    html += `
        <div class="pago-resumen">
            <strong>Total a pagar: $${total.toFixed(2)}</strong><br>
            <strong>Total pagado: $${totalPagado.toFixed(2)}</strong><br>
            <strong class="${Math.abs(saldo) < 0.01 ? 'text-success' : saldo > 0 ? 'text-danger' : 'text-warning'}">
                Saldo: $${saldo.toFixed(2)}
            </strong>
        </div>
    `;
    
    elementos.pagosSeleccionados.innerHTML = html;
    
    // Eventos para eliminar pagos
    document.querySelectorAll('.btn-eliminar-pago').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            selectedPagos.splice(index, 1);
            mostrarPagosSeleccionados();
        });
    });
}

// Iniciar proceso de pago
function iniciarProcesoPago() {
    if (carrito.length === 0) {
        mostrarToast('Error', 'No hay productos en el carrito', 'error');
        return;
    }
    
    const total = parseFloat(elementos.total?.textContent.replace('$', '')) || 0;
    
    // Si no hay pagos seleccionados, mostrar alerta
    if (selectedPagos.length === 0) {
        mostrarToast('Atención', 'Selecciona al menos un medio de pago', 'warning');
        return;
    }
    
    // Verificar que el total pagado coincida con el total
    const totalPagado = selectedPagos.reduce((sum, p) => sum + p.monto, 0);
    
    if (Math.abs(totalPagado - total) > 0.01) {
        const confirmar = confirm(`El total pagado ($${totalPagado.toFixed(2)}) no coincide con el total ($${total.toFixed(2)}). ¿Deseas continuar de todas formas?`);
        if (!confirmar) return;
    }
    
    // Proceder con la venta
    finalizarVenta();
}

// ============================================
// FINALIZAR VENTA - TRANSACCIÓN
// ============================================

// Finalizar venta
async function finalizarVenta() {
    try {
        // Validar permisos
        if (!(await tienePermiso('acceder_caja'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para acceder a caja', 'error');
            return;
        }
        
        // Validar caja activa
        if (!cajaActiva) {
            mostrarToast('Error', 'No hay una caja abierta', 'error');
            mostrarSeccion('caja');
            return;
        }
        
        // Revalidar stock
        for (const item of carrito) {
            const { data: productoActual, error } = await supabase
                .from('productos')
                .select('stock')
                .eq('id', item.producto.id)
                .single();
            
            if (error) throw error;
            
            if (productoActual.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para ${item.producto.nombre}. Stock actual: ${productoActual.stock}`);
            }
        }
        
        // Generar Ticket ID
        const ticketId = await generarTicketId();
        
        // Calcular totales
        const subtotal = parseFloat(elementos.subtotal?.textContent.replace('$', '')) || 0;
        const descuento = descuentoAplicado;
        const total = parseFloat(elementos.total?.textContent.replace('$', '')) || 0;
        
        // Insertar venta
        const ventaData = {
            ticket_id: ticketId,
            caja_id: cajaActiva.id,
            usuario_id: currentUser.id,
            subtotal: subtotal,
            descuento: descuento,
            total: total,
            anulada: false
        };
        
        const { data: venta, error: errorVenta } = await supabase
            .from('ventas')
            .insert([ventaData])
            .select()
            .single();
        
        if (errorVenta) throw errorVenta;
        
        // Insertar detalles y actualizar stock
        for (const item of carrito) {
            // Insertar detalle
            const detalleData = {
                venta_id: venta.id,
                producto_id: item.producto.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal
            };
            
            const { error: errorDetalle } = await supabase
                .from('detalle_ventas')
                .insert([detalleData]);
            
            if (errorDetalle) throw errorDetalle;
            
            // Actualizar stock usando RPC
            const { error: errorStock } = await supabase.rpc('decrementar_stock', {
                producto_id: item.producto.id,
                cantidad: item.cantidad
            });
            
            if (errorStock) {
                // Si falla el RPC, usar actualización directa
                const { error: errorUpdate } = await supabase
                    .from('productos')
                    .update({ 
                        stock: item.producto.stock - item.cantidad,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.producto.id);
                
                if (errorUpdate) throw errorUpdate;
            }
        }
        
        // Insertar pagos
        for (const pago of selectedPagos) {
            const pagoData = {
                venta_id: venta.id,
                medio_pago: pago.medio,
                monto: pago.monto
            };
            
            const { error: errorPago } = await supabase
                .from('pagos_venta')
                .insert([pagoData]);
            
            if (errorPago) throw errorPago;
        }
        
        // Generar ticket
        await generarTicket(venta);
        
        // Recargar estado
        await recargarEstadoPostVenta();
        
        // Resetear carrito
        carrito = [];
        selectedPagos = [];
        descuentoAplicado = 0;
        
        renderizarCarrito();
        calcularTotales();
        
        if (elementos.pagosSeleccionados) {
            elementos.pagosSeleccionados.innerHTML = '';
        }
        
        // Actualizar próximo ticket ID
        await actualizarProximoTicketId();
        
        // Enfocar scanner
        if (elementos.scannerInput) {
            elementos.scannerInput.focus();
        }
        
        mostrarToast('¡Venta exitosa!', `Ticket ${ticketId} generado`, 'success');
        
    } catch (error) {
        console.error('Error finalizando venta:', error);
        mostrarToast('Error en venta', error.message, 'error');
    }
}

// Generar Ticket ID
async function generarTicketId() {
    try {
        const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `T-${hoy}-`;
        
        const { data: ultimoTicket, error } = await supabase
            .from('ventas')
            .select('ticket_id')
            .like('ticket_id', `${prefix}%`)
            .order('ticket_id', { ascending: false })
            .limit(1)
            .single();
        
        let numero = 1;
        if (!error && ultimoTicket) {
            const ultimoNumero = parseInt(ultimoTicket.ticket_id.slice(-4));
            numero = ultimoNumero + 1;
        }
        
        return `${prefix}${numero.toString().padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generando ticket ID:', error);
        return `T-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-9999`;
    }
}

// Actualizar próximo ticket ID
async function actualizarProximoTicketId() {
    try {
        const ticketId = await generarTicketId();
        if (elementos.nextTicketId) {
            elementos.nextTicketId.textContent = ticketId;
        }
    } catch (error) {
        console.error('Error actualizando próximo ticket:', error);
    }
}

// Generar ticket
async function generarTicket(venta) {
    try {
        // Obtener configuración
        const { data: config, error: errorConfig } = await supabase
            .from('configuracion')
            .select('clave, valor');
        
        if (errorConfig) throw errorConfig;
        
        const configMap = {};
        config.forEach(item => {
            configMap[item.clave] = item.valor;
        });
        
        // Obtener detalles
        const { data: detalles, error: errorDetalles } = await supabase
            .from('detalle_ventas')
            .select(`
                cantidad,
                precio_unitario,
                subtotal,
                productos (nombre, codigo_barra)
            `)
            .eq('venta_id', venta.id);
        
        if (errorDetalles) throw errorDetalles;
        
        // Obtener pagos
        const { data: pagos, error: errorPagos } = await supabase
            .from('pagos_venta')
            .select('medio_pago, monto')
            .eq('venta_id', venta.id);
        
        if (errorPagos) throw errorPagos;
        
        // Construir ticket
        const contenido = document.getElementById('ticket-contenido');
        if (!contenido) return;
        
        contenido.innerHTML = '';
        
        // Marca AFMSOLUTIONS
        const marca = document.createElement('div');
        marca.className = 'ticket-header';
        marca.innerHTML = `
            <h1>AFMSOLUTIONS</h1>
            <p>Sistema de Punto de Venta</p>
        `;
        contenido.appendChild(marca);
        
        // Encabezado configurable
        if (configMap['ticket_encabezado']) {
            const encabezado = document.createElement('div');
            encabezado.className = 'ticket-encabezado';
            encabezado.textContent = configMap['ticket_encabezado'];
            contenido.appendChild(encabezado);
        }
        
        // Información de la venta
        const info = document.createElement('div');
        info.className = 'ticket-info';
        info.innerHTML = `
            <p><strong>Ticket:</strong> ${venta.ticket_id}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Cajero:</strong> ${elementos.username.textContent}</p>
            <hr>
        `;
        contenido.appendChild(info);
        
        // Detalles de productos
        const detalleDiv = document.createElement('div');
        detalleDiv.className = 'ticket-body';
        
        detalles.forEach(det => {
            const item = document.createElement('div');
            item.className = 'ticket-item';
            item.innerHTML = `
                <div>
                    <strong>${det.productos.nombre}</strong><br>
                    <small>${det.productos.codigo_barra}</small>
                </div>
                <div style="text-align: right;">
                    ${det.cantidad} x $${det.precio_unitario.toFixed(2)}<br>
                    <strong>$${det.subtotal.toFixed(2)}</strong>
                </div>
            `;
            detalleDiv.appendChild(item);
        });
        
        contenido.appendChild(detalleDiv);
        
        // Totales
        const totales = document.createElement('div');
        totales.className = 'ticket-totales';
        totales.innerHTML = `
            <p><strong>Subtotal:</strong> $${venta.subtotal.toFixed(2)}</p>
            <p><strong>Descuento:</strong> $${venta.descuento.toFixed(2)}</p>
            <p><strong>TOTAL:</strong> $${venta.total.toFixed(2)}</p>
        `;
        contenido.appendChild(totales);
        
        // Pagos
        const pagosDiv = document.createElement('div');
        pagosDiv.className = 'ticket-pagos';
        pagosDiv.innerHTML = '<hr><strong>PAGOS:</strong>';
        
        pagos.forEach(pago => {
            const pagoItem = document.createElement('p');
            pagoItem.innerHTML = `${pago.medio_pago}: $${pago.monto.toFixed(2)}`;
            pagosDiv.appendChild(pagoItem);
        });
        
        contenido.appendChild(pagosDiv);
        
        // Pie configurable
        if (configMap['ticket_pie']) {
            const pie = document.createElement('div');
            pie.className = 'ticket-pie';
            pie.textContent = configMap['ticket_pie'];
            contenido.appendChild(pie);
        }
        
        // Mensaje configurable
        if (configMap['ticket_mensaje']) {
            const mensaje = document.createElement('div');
            mensaje.className = 'ticket-footer';
            mensaje.textContent = configMap['ticket_mensaje'];
            contenido.appendChild(mensaje);
        }
        
        // Imprimir
        const ventanaImpresion = window.open('', '_blank');
        ventanaImpresion.document.write(`
            <html>
                <head>
                    <title>Ticket ${venta.ticket_id}</title>
                    <style>
                        body { 
                            font-family: 'Courier New', monospace; 
                            font-size: 12px; 
                            width: 80mm; 
                            margin: 0; 
                            padding: 10px; 
                            line-height: 1.2;
                        }
                        h1 { 
                            text-align: center; 
                            font-size: 18px; 
                            font-weight: bold; 
                            margin: 0 0 10px 0;
                        }
                        hr { 
                            border: none; 
                            border-top: 1px dashed #000; 
                            margin: 10px 0;
                        }
                        .ticket-item { 
                            display: flex; 
                            justify-content: space-between; 
                            margin-bottom: 5px;
                        }
                        .ticket-totales { 
                            border-top: 2px solid #000; 
                            padding-top: 10px; 
                            margin-top: 10px;
                        }
                        .ticket-footer { 
                            text-align: center; 
                            margin-top: 15px; 
                            font-size: 10px;
                        }
                        @media print {
                            body { margin: 0; padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${contenido.innerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 1000);
                        };
                    </script>
                </body>
            </html>
        `);
        ventanaImpresion.document.close();
        
    } catch (error) {
        console.error('Error generando ticket:', error);
        // No mostramos toast para no interrumpir el flujo de venta
    }
}

// Recargar estado post-venta
async function recargarEstadoPostVenta() {
    try {
        await cargarProductos();
        await cargarCajaActiva();
        productosCache.clear();
    } catch (error) {
        console.error('Error recargando estado:', error);
    }
}

// ============================================
// GESTIÓN DE CAJA
// ============================================

// Cargar caja activa
async function cargarCajaActiva() {
    try {
        const { data: cajas, error } = await supabase
            .from('caja')
            .select('*')
            .is('fecha_cierre', null)
            .order('fecha_apertura', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        
        if (cajas && cajas.length > 0) {
            cajaActiva = cajas[0];
            renderizarCajaInfo();
            
            const statusDot = elementos.statusCaja?.querySelector('.status-dot');
            const statusText = elementos.statusCaja?.querySelector('.status-text');
            
            if (statusDot && statusText) {
                statusDot.className = 'status-dot';
                statusText.textContent = 'Caja abierta';
            }
            
            if (elementos.currentCajaId) {
                elementos.currentCajaId.textContent = `#${cajaActiva.id}`;
            }
        } else {
            cajaActiva = null;
            renderizarCajaInfo();
            
            const statusDot = elementos.statusCaja?.querySelector('.status-dot');
            const statusText = elementos.statusCaja?.querySelector('.status-text');
            
            if (statusDot && statusText) {
                statusDot.className = 'status-dot cerrada';
                statusText.textContent = 'Caja cerrada';
            }
            
            if (elementos.currentCajaId) {
                elementos.currentCajaId.textContent = 'Sin caja';
            }
        }
    } catch (error) {
        console.error('Error cargando caja activa:', error);
        cajaActiva = null;
        if (elementos.statusCaja) {
            elementos.statusCaja.querySelector('.status-text').textContent = 'Error';
        }
    }
}

// Renderizar información de caja
function renderizarCajaInfo() {
    if (!elementos.cajaInfo || !elementos.cajaFormContainer) return;
    
    if (!cajaActiva) {
        elementos.cajaInfo.innerHTML = `
            <div class="alert alert-warning">
                <h3><i class="fas fa-exclamation-triangle"></i> Caja Cerrada</h3>
                <p>No hay una caja abierta. Debes abrir una caja para poder realizar ventas.</p>
            </div>
        `;
        
        elementos.cajaFormContainer.innerHTML = `
            <form id="form-abrir-caja" class="form-container">
                <h3><i class="fas fa-cash-register"></i> Abrir Caja</h3>
                <div class="form-group">
                    <label for="monto-inicial">Monto Inicial *</label>
                    <input type="number" id="monto-inicial" step="0.01" min="0" required 
                           placeholder="Ej: 1000.00">
                </div>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-lock-open"></i> Abrir Caja
                </button>
            </form>
        `;
        
        const form = document.getElementById('form-abrir-caja');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await abrirCaja();
            };
        }
        
        return;
    }
    
    // Caja está abierta
    elementos.cajaInfo.innerHTML = `
        <div class="alert alert-success">
            <h3><i class="fas fa-cash-register"></i> Caja Abierta</h3>
            <div class="caja-detalle">
                <p><strong>ID:</strong> #${cajaActiva.id}</p>
                <p><strong>Abierta por:</strong> ${elementos.username.textContent}</p>
                <p><strong>Fecha apertura:</strong> ${new Date(cajaActiva.fecha_apertura).toLocaleString()}</p>
                <p><strong>Monto inicial:</strong> $${cajaActiva.monto_inicial.toFixed(2)}</p>
            </div>
        </div>
    `;
    
    elementos.cajaFormContainer.innerHTML = `
        <form id="form-cerrar-caja" class="form-container">
            <h3><i class="fas fa-lock"></i> Cerrar Caja</h3>
            <div class="form-group">
                <label for="observaciones">Observaciones</label>
                <textarea id="observaciones" rows="3" 
                          placeholder="Observaciones del cierre de caja"></textarea>
            </div>
            <div class="form-group">
                <label for="monto-real">Monto Real en Caja *</label>
                <input type="number" id="monto-real" step="0.01" min="0" required 
                       placeholder="Total físico contado">
            </div>
            <button type="submit" class="btn btn-danger">
                <i class="fas fa-lock"></i> Cerrar Caja
            </button>
        </form>
    `;
    
    const form = document.getElementById('form-cerrar-caja');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await cerrarCaja();
        };
    }
    
    cargarMovimientosCaja();
}

// Abrir caja
async function abrirCaja() {
    try {
        if (!(await tienePermiso('acceder_caja'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para abrir caja', 'error');
            return;
        }
        
        const montoInicial = parseFloat(document.getElementById('monto-inicial').value);
        
        if (isNaN(montoInicial) || montoInicial < 0) {
            throw new Error('Monto inicial inválido');
        }
        
        const { data: caja, error } = await supabase
            .from('caja')
            .insert([{
                usuario_id: currentUser.id,
                monto_inicial: montoInicial,
                fecha_apertura: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        cajaActiva = caja;
        await cargarCajaActiva();
        
        mostrarToast('Caja abierta', `Caja #${caja.id} abierta con $${montoInicial.toFixed(2)}`, 'success');
        
        mostrarSeccion('venta');
        
    } catch (error) {
        console.error('Error abriendo caja:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// Cerrar caja
async function cerrarCaja() {
    try {
        if (!(await tienePermiso('acceder_caja'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para cerrar caja', 'error');
            return;
        }
        
        const observaciones = document.getElementById('observaciones').value.trim();
        const montoReal = parseFloat(document.getElementById('monto-real').value);
        
        if (isNaN(montoReal) || montoReal < 0) {
            throw new Error('Monto real inválido');
        }
        
        // Calcular totales de ventas no anuladas
        const { data: ventas, error: errorVentas } = await supabase
            .from('ventas')
            .select('id, total')
            .eq('caja_id', cajaActiva.id)
            .eq('anulada', false);
        
        if (errorVentas) throw errorVentas;
        
        // Calcular totales por medio de pago
        const ventasIds = ventas.map(v => v.id);
        let totalEfectivo = 0;
        let totalTarjeta = 0;
        let totalTransferencia = 0;
        
        if (ventasIds.length > 0) {
            const { data: pagos, error: errorPagos } = await supabase
                .from('pagos_venta')
                .select('medio_pago, monto')
                .in('venta_id', ventasIds);
            
            if (errorPagos) throw errorPagos;
            
            pagos.forEach(pago => {
                switch(pago.medio_pago) {
                    case 'EFECTIVO':
                        totalEfectivo += pago.monto;
                        break;
                    case 'TARJETA':
                        totalTarjeta += pago.monto;
                        break;
                    case 'TRANSFERENCIA/QR':
                        totalTransferencia += pago.monto;
                        break;
                }
            });
        }
        
        // Calcular diferencia
        const totalVentasEfectivo = totalEfectivo;
        const totalEsperado = cajaActiva.monto_inicial + totalVentasEfectivo;
        const diferencia = montoReal - totalEsperado;
        
        // Actualizar caja
        const { error } = await supabase
            .from('caja')
            .update({
                fecha_cierre: new Date().toISOString(),
                observaciones: observaciones || null,
                total_ventas_efectivo: totalEfectivo,
                total_ventas_tarjeta: totalTarjeta,
                total_ventas_transferencia: totalTransferencia,
                monto_real: montoReal,
                diferencia: diferencia
            })
            .eq('id', cajaActiva.id);
        
        if (error) throw error;
        
        mostrarToast('Caja cerrada', `Caja #${cajaActiva.id} cerrada correctamente`, 'success');
        
        cajaActiva = null;
        await cargarCajaActiva();
        
    } catch (error) {
        console.error('Error cerrando caja:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// Cargar movimientos de caja
async function cargarMovimientosCaja() {
    if (!cajaActiva || !elementos.cajaMovimientos) return;
    
    try {
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select(`
                id,
                ticket_id,
                fecha,
                total,
                anulada,
                pagos_venta (medio_pago, monto)
            `)
            .eq('caja_id', cajaActiva.id)
            .order('fecha', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        if (!ventas || ventas.length === 0) {
            elementos.cajaMovimientos.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>No hay ventas registradas en esta caja</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <h3><i class="fas fa-history"></i> Movimientos de Caja</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>Ticket</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Medios de Pago</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        ventas.forEach(venta => {
            const medios = venta.pagos_venta.map(p => `
                <span class="badge bg-secondary">${p.medio_pago}: $${p.monto.toFixed(2)}</span>
            `).join(' ');
            
            html += `
                <tr class="${venta.anulada ? 'table-danger' : ''}">
                    <td><code>${venta.ticket_id}</code></td>
                    <td>${new Date(venta.fecha).toLocaleTimeString()}</td>
                    <td>$${venta.total.toFixed(2)}</td>
                    <td>${medios}</td>
                    <td>
                        <span class="badge ${venta.anulada ? 'bg-danger' : 'bg-success'}">
                            ${venta.anulada ? 'ANULADA' : 'ACTIVA'}
                        </span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        elementos.cajaMovimientos.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        elementos.cajaMovimientos.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                Error cargando movimientos
            </div>
        `;
    }
}

// ============================================
// HISTORIAL
// ============================================

// Cargar ventas del día
async function cargarVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    if (elementos.fechaInicio && elementos.fechaFin) {
        elementos.fechaInicio.value = hoy;
        elementos.fechaFin.value = hoy;
    }
    await cargarHistorial();
}

// Cargar historial
async function cargarHistorial() {
    try {
        const fechaInicio = elementos.fechaInicio?.value;
        const fechaFin = elementos.fechaFin?.value;
        
        if (!fechaInicio || !fechaFin) {
            mostrarToast('Error', 'Selecciona un rango de fechas', 'error');
            return;
        }
        
        const inicio = new Date(fechaInicio + 'T00:00:00');
        const fin = new Date(fechaFin + 'T23:59:59');
        
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select(`
                *,
                usuario:usuarios(username),
                pagos_venta (medio_pago, monto)
            `)
            .gte('fecha', inicio.toISOString())
            .lte('fecha', fin.toISOString())
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        renderizarHistorial(ventas);
        calcularTotalesPeriodo(ventas);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        mostrarToast('Error', 'No se pudo cargar el historial', 'error');
    }
}

// Renderizar historial
function renderizarHistorial(ventas) {
    if (!elementos.historialBody) return;
    
    elementos.historialBody.innerHTML = '';
    
    if (!ventas || ventas.length === 0) {
        elementos.historialBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>No hay ventas en el período seleccionado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    ventas.forEach(venta => {
        const tr = document.createElement('tr');
        tr.className = venta.anulada ? 'table-danger' : '';
        
        const pagosAgrupados = {};
        venta.pagos_venta.forEach(pago => {
            if (!pagosAgrupados[pago.medio_pago]) {
                pagosAgrupados[pago.medio_pago] = 0;
            }
            pagosAgrupados[pago.medio_pago] += pago.monto;
        });
        
        const mediosPago = Object.entries(pagosAgrupados).map(([medio, monto]) => 
            `<span class="badge bg-secondary">${medio}: $${monto.toFixed(2)}</span>`
        ).join(' ');
        
        tr.innerHTML = `
            <td><code>${venta.ticket_id}</code></td>
            <td>${new Date(venta.fecha).toLocaleString()}</td>
            <td>$${venta.total.toFixed(2)}</td>
            <td>${mediosPago}</td>
            <td>
                <span class="badge ${venta.anulada ? 'bg-danger' : 'bg-success'}">
                    ${venta.anulada ? 'ANULADA' : 'ACTIVA'}
                </span>
            </td>
            <td>
                <button class="btn btn-small btn-secondary btn-ver-detalle" data-id="${venta.id}">
                    <i class="fas fa-eye"></i>
                </button>
                ${!venta.anulada ? `
                    <button class="btn btn-small btn-danger btn-anular-venta" data-id="${venta.id}">
                        <i class="fas fa-ban"></i>
                    </button>
                ` : ''}
            </td>
        `;
        
        elementos.historialBody.appendChild(tr);
    });
    
    // Eventos
    document.querySelectorAll('.btn-ver-detalle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            await verDetalleVenta(id);
        });
    });
    
    document.querySelectorAll('.btn-anular-venta').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (await tienePermiso('anular_ventas')) {
                await anularVenta(id);
            } else {
                mostrarToast('Permiso denegado', 'No tienes permiso para anular ventas', 'error');
            }
        });
    });
}

// Calcular totales del período
function calcularTotalesPeriodo(ventas) {
    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    
    const ventasValidas = ventas.filter(v => !v.anulada);
    
    ventasValidas.forEach(venta => {
        totalVentas += venta.total;
        
        venta.pagos_venta.forEach(pago => {
            switch(pago.medio_pago) {
                case 'EFECTIVO':
                    totalEfectivo += pago.monto;
                    break;
                case 'TARJETA':
                    totalTarjeta += pago.monto;
                    break;
                case 'TRANSFERENCIA/QR':
                    totalTransferencia += pago.monto;
                    break;
            }
        });
    });
    
    // Actualizar elementos si existen
    const elementosIds = [
        'total-ventas-periodo',
        'total-efectivo-periodo',
        'total-tarjeta-periodo',
        'total-transferencia-periodo'
    ];
    
    elementosIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            switch(id) {
                case 'total-ventas-periodo':
                    element.textContent = `$${totalVentas.toFixed(2)}`;
                    break;
                case 'total-efectivo-periodo':
                    element.textContent = `$${totalEfectivo.toFixed(2)}`;
                    break;
                case 'total-tarjeta-periodo':
                    element.textContent = `$${totalTarjeta.toFixed(2)}`;
                    break;
                case 'total-transferencia-periodo':
                    element.textContent = `$${totalTransferencia.toFixed(2)}`;
                    break;
            }
        }
    });
}

// Ver detalle de venta
async function verDetalleVenta(id) {
    try {
        const { data: venta, error } = await supabase
            .from('ventas')
            .select(`
                *,
                usuario:usuarios(username),
                detalle_ventas (
                    cantidad,
                    precio_unitario,
                    subtotal,
                    productos (nombre, codigo_barra)
                ),
                pagos_venta (medio_pago, monto)
            `)
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        document.getElementById('detalle-venta-titulo').textContent = `Detalles: ${venta.ticket_id}`;
        
        let html = `
            <div class="detalle-venta">
                <div class="detalle-header">
                    <p><strong>Ticket:</strong> ${venta.ticket_id}</p>
                    <p><strong>Fecha:</strong> ${new Date(venta.fecha).toLocaleString()}</p>
                    <p><strong>Cajero:</strong> ${venta.usuario.username}</p>
                    <p><strong>Estado:</strong> 
                        <span class="badge ${venta.anulada ? 'bg-danger' : 'bg-success'}">
                            ${venta.anulada ? 'ANULADA' : 'ACTIVA'}
                        </span>
                    </p>
                </div>
                
                <div class="detalle-productos">
                    <h4>Productos:</h4>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        venta.detalle_ventas.forEach(detalle => {
            html += `
                <tr>
                    <td>
                        <strong>${detalle.productos.nombre}</strong><br>
                        <small>${detalle.productos.codigo_barra}</small>
                    </td>
                    <td>${detalle.cantidad}</td>
                    <td>$${detalle.precio_unitario.toFixed(2)}</td>
                    <td>$${detalle.subtotal.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                
                <div class="detalle-totales">
                    <p><strong>Subtotal:</strong> $${venta.subtotal.toFixed(2)}</p>
                    <p><strong>Descuento:</strong> $${venta.descuento.toFixed(2)}</p>
                    <p><strong>Total:</strong> $${venta.total.toFixed(2)}</p>
                </div>
                
                <div class="detalle-pagos">
                    <h4>Pagos:</h4>
        `;
        
        venta.pagos_venta.forEach(pago => {
            html += `
                <p>${pago.medio_pago}: $${pago.monto.toFixed(2)}</p>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        document.getElementById('detalle-venta-contenido').innerHTML = html;
        
        const btnAnular = document.getElementById('btn-anular-venta');
        if (btnAnular) {
            btnAnular.onclick = () => anularVenta(id);
            btnAnular.style.display = venta.anulada ? 'none' : 'block';
        }
        
        mostrarModal('modal-detalle-venta');
        
    } catch (error) {
        console.error('Error cargando detalle:', error);
        mostrarToast('Error', 'No se pudo cargar el detalle de la venta', 'error');
    }
}

// Anular venta
async function anularVenta(id) {
    try {
        if (!confirm('¿Estás seguro de anular esta venta? Esta acción no se puede deshacer.')) {
            return;
        }
        
        const { data: venta, error: errorVenta } = await supabase
            .from('ventas')
            .select(`
                *,
                detalle_ventas (producto_id, cantidad)
            `)
            .eq('id', id)
            .single();
        
        if (errorVenta) throw errorVenta;
        
        if (venta.anulada) {
            throw new Error('Esta venta ya está anulada');
        }
        
        // Verificar que la caja aún esté abierta
        if (cajaActiva && venta.caja_id !== cajaActiva.id) {
            const confirmar = confirm('Esta venta pertenece a una caja ya cerrada. ¿Deseas continuar con la anulación?');
            if (!confirmar) return;
        }
        
        // Marcar venta como anulada
        const { error: errorAnular } = await supabase
            .from('ventas')
            .update({
                anulada: true,
                usuario_anulacion_id: currentUser.id,
                fecha_anulacion: new Date().toISOString()
            })
            .eq('id', id);
        
        if (errorAnular) throw errorAnular;
        
        // Revertir stock
        const revertirPromises = venta.detalle_ventas.map(async (detalle) => {
            // Usar RPC si existe
            try {
                const { error } = await supabase.rpc('incrementar_stock', {
                    producto_id: detalle.producto_id,
                    cantidad: detalle.cantidad
                });
                
                if (error) throw error;
            } catch (rpcError) {
                // Fallback a actualización directa
                const producto = productosCache.get(detalle.producto_id);
                if (producto) {
                    const nuevoStock = producto.stock + detalle.cantidad;
                    await supabase
                        .from('productos')
                        .update({ 
                            stock: nuevoStock,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', detalle.producto_id);
                }
            }
        });
        
        await Promise.all(revertirPromises);
        
        await cargarHistorial();
        await cargarProductos();
        if (cajaActiva && venta.caja_id === cajaActiva.id) {
            await cargarCajaActiva();
        }
        
        mostrarToast('Venta anulada', 'La venta fue anulada correctamente', 'success');
        
        ocultarModal('modal-detalle-venta');
        
    } catch (error) {
        console.error('Error anulando venta:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// ============================================
// CONFIGURACIÓN
// ============================================

// Cargar configuración
async function cargarConfiguracion() {
    try {
        const { data: config, error } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .in('clave', ['ticket_encabezado', 'ticket_pie', 'ticket_mensaje']);
        
        if (error) throw error;
        
        const configMap = {
            'ticket_encabezado': '',
            'ticket_pie': '',
            'ticket_mensaje': ''
        };
        
        config.forEach(item => {
            configMap[item.clave] = item.valor;
        });
        
        if (elementos.configEncabezado) {
            elementos.configEncabezado.value = configMap['ticket_encabezado'];
        }
        
        if (elementos.configPie) {
            elementos.configPie.value = configMap['ticket_pie'];
        }
        
        if (elementos.configMensaje) {
            elementos.configMensaje.value = configMap['ticket_mensaje'];
        }
        
        if (currentRole === 'Administrador') {
            await cargarUsuariosPermisos();
        } else if (elementos.permisosContainer) {
            elementos.permisosContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    Solo los administradores pueden gestionar permisos
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

// Cargar usuarios y permisos
async function cargarUsuariosPermisos() {
    try {
        const { data: usuarios, error } = await supabase
            .from('usuarios')
            .select('id, username, rol, activo')
            .neq('rol', 'Administrador')
            .order('username');
        
        if (error) throw error;
        
        if (!usuarios || usuarios.length === 0) {
            if (elementos.permisosContainer) {
                elementos.permisosContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>No hay usuarios registrados</p>
                    </div>
                `;
            }
            return;
        }
        
        const permisosUsuarios = await Promise.all(
            usuarios.map(async (usuario) => {
                const { data: permisos } = await supabase
                    .from('permisos')
                    .select('permiso')
                    .eq('usuario_id', usuario.id)
                    .eq('activo', true);
                
                return {
                    ...usuario,
                    permisos: permisos ? permisos.map(p => p.permiso) : []
                };
            })
        );
        
        let html = `
            <div class="permisos-grid">
                <div class="permisos-header">
                    <div>Usuario</div>
                    <div>Cargar Productos</div>
                    <div>Modificar Productos</div>
                    <div>Anular Ventas</div>
                    <div>Ver Reportes</div>
                    <div>Acceder Caja</div>
                </div>
        `;
        
        permisosUsuarios.forEach(usuario => {
            html += `
                <div class="permisos-row" data-user-id="${usuario.id}">
                    <div class="user-info">
                        <strong>${usuario.username}</strong><br>
                        <small>${usuario.rol}</small>
                    </div>
                    ${['cargar_productos', 'modificar_productos', 'anular_ventas', 'ver_reportes', 'acceder_caja']
                        .map(permiso => `
                            <div>
                                <input type="checkbox" 
                                       class="permiso-checkbox" 
                                       data-user="${usuario.id}" 
                                       data-permiso="${permiso}"
                                       ${usuario.permisos.includes(permiso) ? 'checked' : ''}
                                       ${!usuario.activo ? 'disabled' : ''}>
                            </div>
                        `).join('')}
                </div>
            `;
        });
        
        html += `</div>`;
        
        if (elementos.permisosContainer) {
            elementos.permisosContainer.innerHTML = html;
        }
        
        document.querySelectorAll('.permiso-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                await actualizarPermiso(
                    e.target.dataset.user,
                    e.target.dataset.permiso,
                    e.target.checked
                );
            });
        });
        
    } catch (error) {
        console.error('Error cargando permisos:', error);
        if (elementos.permisosContainer) {
            elementos.permisosContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i>
                    Error cargando permisos
                </div>
            `;
        }
    }
}

// Actualizar permiso
async function actualizarPermiso(usuarioId, permiso, activo) {
    try {
        if (!(await tienePermiso('modificar_permisos'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para modificar permisos', 'error');
            return;
        }
        
        if (activo) {
            const { error } = await supabase
                .from('permisos')
                .upsert({
                    usuario_id: usuarioId,
                    permiso: permiso,
                    activo: true,
                    fecha_asignacion: new Date().toISOString()
                }, {
                    onConflict: 'usuario_id,permiso'
                });
            
            if (error) throw error;
            
            mostrarToast('Permiso asignado', 'Permiso actualizado correctamente', 'success');
        } else {
            const { error } = await supabase
                .from('permisos')
                .update({ activo: false })
                .eq('usuario_id', usuarioId)
                .eq('permiso', permiso);
            
            if (error) throw error;
            
            mostrarToast('Permiso removido', 'Permiso actualizado correctamente', 'success');
        }
        
    } catch (error) {
        console.error('Error actualizando permiso:', error);
        mostrarToast('Error', 'No se pudo actualizar el permiso', 'error');
    }
}

// Guardar configuración
async function guardarConfiguracion() {
    try {
        if (currentRole !== 'Administrador') {
            mostrarToast('Permiso denegado', 'Solo administradores pueden modificar la configuración', 'error');
            return;
        }
        
        const configuraciones = [
            { clave: 'ticket_encabezado', valor: elementos.configEncabezado?.value || '' },
            { clave: 'ticket_pie', valor: elementos.configPie?.value || '' },
            { clave: 'ticket_mensaje', valor: elementos.configMensaje?.value || '' }
        ];
        
        const promises = configuraciones.map(config => 
            supabase
                .from('configuracion')
                .upsert(config, { onConflict: 'clave' })
        );
        
        await Promise.all(promises);
        
        mostrarToast('Configuración guardada', 'Los cambios se guardaron correctamente', 'success');
        
    } catch (error) {
        console.error('Error guardando configuración:', error);
        mostrarToast('Error', 'No se pudo guardar la configuración', 'error');
    }
}

// ============================================
// REPORTES
// ============================================

// Generar reporte
async function generarReporte() {
    try {
        if (!(await tienePermiso('ver_reportes'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para ver reportes', 'error');
            return;
        }
        
        const fechaInicio = elementos.reporteFechaInicio?.value;
        const fechaFin = elementos.reporteFechaFin?.value;
        const tipo = elementos.reporteTipo?.value || 'ventas';
        
        if (!fechaInicio || !fechaFin) {
            mostrarToast('Error', 'Selecciona un rango de fechas', 'error');
            return;
        }
        
        const inicio = new Date(fechaInicio + 'T00:00:00');
        const fin = new Date(fechaFin + 'T23:59:59');
        
        let html = '';
        
        switch(tipo) {
            case 'ventas':
                html = await generarReporteVentas(inicio, fin);
                break;
            case 'ganancias':
                html = await generarReporteGanancias(inicio, fin);
                break;
            case 'productos':
                html = await generarReporteProductos(inicio, fin);
                break;
        }
        
        if (elementos.reporteResultados) {
            elementos.reporteResultados.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        mostrarToast('Error', 'No se pudo generar el reporte', 'error');
    }
}

// Reporte de ventas
async function generarReporteVentas(inicio, fin) {
    const { data: ventas, error } = await supabase
        .from('ventas')
        .select(`
            *,
            pagos_venta (medio_pago, monto)
        `)
        .gte('fecha', inicio.toISOString())
        .lte('fecha', fin.toISOString())
        .eq('anulada', false)
        .order('fecha');
    
    if (error) throw error;
    
    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    
    ventas.forEach(venta => {
        totalVentas += venta.total;
        venta.pagos_venta.forEach(pago => {
            switch(pago.medio_pago) {
                case 'EFECTIVO': totalEfectivo += pago.monto; break;
                case 'TARJETA': totalTarjeta += pago.monto; break;
                case 'TRANSFERENCIA/QR': totalTransferencia += pago.monto; break;
            }
        });
    });
    
    return `
        <div class="reporte-ventas">
            <h3>Reporte de Ventas</h3>
            <p>Período: ${inicio.toLocaleDateString()} - ${fin.toLocaleDateString()}</p>
            
            <div class="resumen-grid">
                <div class="resumen-item">
                    <span class="resumen-label">Total Ventas:</span>
                    <span class="resumen-value">$${totalVentas.toFixed(2)}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Efectivo:</span>
                    <span class="resumen-value">$${totalEfectivo.toFixed(2)}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Tarjeta:</span>
                    <span class="resumen-value">$${totalTarjeta.toFixed(2)}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Transferencia:</span>
                    <span class="resumen-value">$${totalTransferencia.toFixed(2)}</span>
                </div>
            </div>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Ticket</th>
                        <th>Total</th>
                        <th>Medios de Pago</th>
                    </tr>
                </thead>
                <tbody>
                    ${ventas.map(venta => {
                        const medios = venta.pagos_venta.map(p => 
                            `${p.medio_pago}: $${p.monto.toFixed(2)}`
                        ).join(', ');
                        
                        return `
                            <tr>
                                <td>${new Date(venta.fecha).toLocaleDateString()}</td>
                                <td>${venta.ticket_id}</td>
                                <td>$${venta.total.toFixed(2)}</td>
                                <td>${medios}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Reporte de ganancias
async function generarReporteGanancias(inicio, fin) {
    const { data: detalles, error } = await supabase
        .from('detalle_ventas')
        .select(`
            cantidad,
            precio_unitario,
            productos (precio_costo),
            ventas (fecha, anulada)
        `)
        .gte('ventas.fecha', inicio.toISOString())
        .lte('ventas.fecha', fin.toISOString())
        .eq('ventas.anulada', false);
    
    if (error) throw error;
    
    let totalVentas = 0;
    let totalCosto = 0;
    let totalGanancia = 0;
    
    detalles.forEach(detalle => {
        const venta = detalle.precio_unitario * detalle.cantidad;
        const costo = detalle.productos.precio_costo * detalle.cantidad;
        
        totalVentas += venta;
        totalCosto += costo;
        totalGanancia += (venta - costo);
    });
    
    const margen = totalVentas > 0 ? (totalGanancia / totalVentas) * 100 : 0;
    
    return `
        <div class="reporte-ganancias">
            <h3>Reporte de Ganancias</h3>
            <p>Período: ${inicio.toLocaleDateString()} - ${fin.toLocaleDateString()}</p>
            
            <div class="resumen-grid">
                <div class="resumen-item">
                    <span class="resumen-label">Total Ventas:</span>
                    <span class="resumen-value">$${totalVentas.toFixed(2)}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Total Costo:</span>
                    <span class="resumen-value">$${totalCosto.toFixed(2)}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Ganancia Bruta:</span>
                    <span class="resumen-value text-success">$${totalGanancia.toFixed(2)}</span>
                </div>
                <div class="resumen-item">
                    <span class="resumen-label">Margen:</span>
                    <span class="resumen-value">${margen.toFixed(2)}%</span>
                </div>
            </div>
        </div>
    `;
}

// Reporte de productos más vendidos
async function generarReporteProductos(inicio, fin) {
    const { data: detalles, error } = await supabase
        .from('detalle_ventas')
        .select(`
            producto_id,
            cantidad,
            precio_unitario,
            productos (nombre, codigo_barra),
            ventas (fecha, anulada)
        `)
        .gte('ventas.fecha', inicio.toISOString())
        .lte('ventas.fecha', fin.toISOString())
        .eq('ventas.anulada', false);
    
    if (error) throw error;
    
    const productosMap = new Map();
    
    detalles.forEach(detalle => {
        const productoId = detalle.producto_id;
        if (!productosMap.has(productoId)) {
            productosMap.set(productoId, {
                nombre: detalle.productos.nombre,
                codigo: detalle.productos.codigo_barra,
                cantidad: 0,
                total: 0
            });
        }
        
        const producto = productosMap.get(productoId);
        producto.cantidad += detalle.cantidad;
        producto.total += detalle.cantidad * detalle.precio_unitario;
    });
    
    const productosArray = Array.from(productosMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);
    
    return `
        <div class="reporte-productos">
            <h3>Productos Más Vendidos</h3>
            <p>Período: ${inicio.toLocaleDateString()} - ${fin.toLocaleDateString()}</p>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Producto</th>
                        <th>Cantidad Vendida</th>
                        <th>Total Ventas</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosArray.map((producto, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                <strong>${producto.nombre}</strong><br>
                                <small>${producto.codigo}</small>
                            </td>
                            <td>${producto.cantidad}</td>
                            <td>$${producto.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================
// INICIALIZAR APLICACIÓN
// ============================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

// Exportar funciones globales si es necesario
window.mostrarSeccion = mostrarSeccion;
window.mostrarToast = mostrarToast;
