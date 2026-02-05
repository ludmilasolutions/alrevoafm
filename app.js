// ============================================
// CONFIGURACIÓN SUPABASE Y CONSTANTES
// ============================================

// Configuración de Supabase (REEMPLAZAR CON TUS DATOS REALES)
const SUPABASE_URL = 'https://nptthngcshkbuavkjujf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdHRobmdjc2hrYnVhdmtqdWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTAyMTcsImV4cCI6MjA4NTgyNjIxN30.0P2Yf-wHtNzgoIFLEN-DYME85NFEjKtmz2cyIkyuZfg';

    // Crear cliente Supabase solo si no existe
    let supabase;
    if (typeof window.supabaseClient !== 'undefined') {
        supabase = window.supabaseClient;
        console.log('✅ Usando cliente Supabase existente');
    } else {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabase; // Guardar para reutilizar
        console.log('✅ Nuevo cliente Supabase creado');
    }

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
// INICIALIZACIÓN Y CONFIGURACIÓN
// ============================================

// Inicializar la aplicación
async function init() {
    console.log('Inicializando sistema POS AFMSOLUTIONS...');
    
    // Configurar tema
    configurarTema();
    
    // Configurar reloj en tiempo real
    actualizarReloj();
    setInterval(actualizarReloj, 1000);
    
    // Configurar eventos
    configurarEventos();
    
    // Verificar sesión activa
    await checkSession();
    
    // Configurar atajos de teclado
    configurarAtajosTeclado();
    
    console.log('Sistema POS inicializado correctamente');
}

// Configurar eventos de la interfaz
function configurarEventos() {
    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Navegación
    elementos.menuToggle.addEventListener('click', toggleSidebar);
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
    elementos.logoutBtn.addEventListener('click', handleLogout);
    
    // Toggle tema
    elementos.themeToggle.addEventListener('click', toggleTema);
    
    // Scanner y venta
    elementos.scannerInput.addEventListener('keypress', handleScanner);
    elementos.btnBuscarManual.addEventListener('click', () => mostrarModal('modal-buscar-producto'));
    elementos.btnLimpiarCarrito.addEventListener('click', limpiarCarrito);
    elementos.btnAplicarDescuento.addEventListener('click', aplicarDescuento);
    elementos.btnFinalizarVenta.addEventListener('click', iniciarProcesoPago);
    
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
    elementos.btnNuevoProducto.addEventListener('click', () => mostrarFormularioProducto());
    elementos.btnRefreshProductos.addEventListener('click', cargarProductos);
    elementos.btnAplicarFiltros.addEventListener('click', cargarProductos);
    
    // Historial
    elementos.btnVentasHoy.addEventListener('click', cargarVentasHoy);
    elementos.btnFiltrarHistorial.addEventListener('click', cargarHistorial);
    
    // Configuración
    elementos.btnGuardarConfig.addEventListener('click', guardarConfiguracion);
    
    // Eventos táctiles para móvil
    configurarEventosTactiles();
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
                if (currentSection === 'venta') {
                    elementos.btnFinalizarVenta.click();
                }
                break;
            case 'F2':
                e.preventDefault();
                if (currentSection === 'venta') {
                    elementos.descuentoInput.focus();
                }
                break;
            case 'F3':
                e.preventDefault();
                if (currentSection === 'venta' && carrito.length > 0) {
                    carrito.pop();
                    renderizarCarrito();
                    calcularTotales();
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
                // Cerrar modales activos
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
// AUTENTICACIÓN Y PERMISOS
// ============================================

// Verificar sesión activa
async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            mostrarToast('Error al verificar sesión', error.message, 'error');
            return;
        }
        
        if (session) {
            currentUser = session.user;
            await cargarUsuarioInfo();
            await cargarPermisos();
            elementos.loginModal.classList.remove('active');
            elementos.mainApp.classList.remove('hidden');
            await inicializarSistema();
        } else {
            elementos.loginModal.classList.add('active');
            elementos.mainApp.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error en checkSession:', error);
        mostrarToast('Error', 'No se pudo verificar la sesión', 'error');
    }
}

// Manejar login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
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

// Cargar permisos dinámicos desde BD
async function cargarPermisos() {
    try {
        const { data, error } = await supabase
            .from('permisos')
            .select('permiso')
            .eq('usuario_id', currentUser.id)
            .eq('activo', true);
        
        if (error) throw error;
        
        currentPermissions = data.map(p => p.permiso);
        console.log('Permisos cargados:', currentPermissions);
    } catch (error) {
        console.error('Error cargando permisos:', error);
    }
}

// Verificar permiso dinámicamente (consulta BD cada vez)
async function tienePermiso(permiso) {
    // Administrador siempre tiene todos los permisos
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

// Manejar logout
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
        
        // Limpiar formularios
        document.getElementById('login-form').reset();
        
        mostrarToast('Sesión cerrada', 'Has cerrado sesión correctamente', 'info');
    } catch (error) {
        console.error('Error en logout:', error);
        mostrarToast('Error', 'No se pudo cerrar sesión', 'error');
    }
}

// ============================================
// INICIALIZACIÓN DEL SISTEMA
// ============================================

// Inicializar sistema después de login
async function inicializarSistema() {
    try {
        // Cargar caja activa
        await cargarCajaActiva();
        
        // Cargar productos
        await cargarProductos();
        
        // Cargar configuración
        await cargarConfiguracion();
        
        // Actualizar ID de próximo ticket
        await actualizarProximoTicketId();
        
        // Configurar sección activa
        mostrarSeccion('venta');
        
        // Enfocar scanner
        elementos.scannerInput.focus();
        
        console.log('Sistema inicializado correctamente');
    } catch (error) {
        console.error('Error inicializando sistema:', error);
        mostrarToast('Error de inicialización', error.message, 'error');
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
            .select('*', { count: 'exact' });
        
        // Aplicar filtros
        const filtroTexto = elementos.filtroProductos.value;
        const filtroActivo = elementos.filtroActivo.value;
        
        if (filtroTexto) {
            query = query.or(`codigo_barra.ilike.%${filtroTexto}%,nombre.ilike.%${filtroTexto}%,proveedor.ilike.%${filtroTexto}%`);
        }
        
        if (filtroActivo !== 'all') {
            query = query.eq('activo', filtroActivo === 'true');
        }
        
        const { data: productos, error, count } = await query
            .order('nombre')
            .limit(50);
        
        if (error) throw error;
        
        // Actualizar cache
        productosCache.clear();
        productos.forEach(p => productosCache.set(p.id, p));
        
        // Renderizar productos
        renderizarProductos(productos);
        
        // Actualizar paginación
        // Nota: Implementar paginación completa según necesidades
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarToast('Error', 'No se pudieron cargar los productos', 'error');
    }
}

// Renderizar productos en tabla
function renderizarProductos(productos) {
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
    
    // Configurar eventos de botones
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
    
    // Actualizar título
    document.getElementById('modal-producto-titulo').textContent = titulo;
    
    // Configurar formulario
    const form = document.getElementById('form-producto');
    form.dataset.id = id || '';
    
    if (producto) {
        // Llenar formulario con datos existentes
        document.getElementById('producto-codigo').value = producto.codigo_barra;
        document.getElementById('producto-nombre').value = producto.nombre;
        document.getElementById('producto-precio-costo').value = producto.precio_costo;
        document.getElementById('producto-margen').value = producto.margen_ganancia || '';
        document.getElementById('producto-precio-venta').value = producto.precio_venta;
        document.getElementById('producto-stock').value = producto.stock;
        document.getElementById('producto-proveedor').value = producto.proveedor || '';
        document.getElementById('producto-activo').checked = producto.activo;
    } else {
        // Limpiar formulario
        form.reset();
        document.getElementById('producto-activo').checked = true;
    }
    
    // Configurar eventos para cálculo automático
    const precioCostoInput = document.getElementById('producto-precio-costo');
    const margenInput = document.getElementById('producto-margen');
    const precioVentaInput = document.getElementById('producto-precio-venta');
    
    // Función para calcular precio venta
    const calcularPrecioVenta = () => {
        const costo = parseFloat(precioCostoInput.value) || 0;
        const margen = parseFloat(margenInput.value) || 0;
        
        if (costo > 0 && margen > 0) {
            const precioVenta = costo * (1 + margen / 100);
            precioVentaInput.value = precioVenta.toFixed(2);
        }
    };
    
    // Función para calcular margen
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
    
    // Configurar submit del formulario
    form.onsubmit = async (e) => {
        e.preventDefault();
        await guardarProducto();
    };
    
    // Mostrar modal
    mostrarModal('modal-producto');
}

// Guardar producto
async function guardarProducto() {
    try {
        const form = document.getElementById('form-producto');
        const id = form.dataset.id;
        const esNuevo = !id;
        
        // Validar permisos
        if (esNuevo && !(await tienePermiso('cargar_productos'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para crear productos', 'error');
            return;
        }
        
        if (!esNuevo && !(await tienePermiso('modificar_productos'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para modificar productos', 'error');
            return;
        }
        
        // Obtener datos del formulario
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
            
            // Crear nuevo producto
            const { data, error } = await supabase
                .from('productos')
                .insert([producto])
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            
            mostrarToast('Producto creado', 'El producto se creó correctamente', 'success');
        } else {
            // Actualizar producto existente
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
        
        // Actualizar cache
        productosCache.set(result.id, result);
        
        // Recargar lista de productos
        await cargarProductos();
        
        // Cerrar modal
        ocultarModal('modal-producto');
        
    } catch (error) {
        console.error('Error guardando producto:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// Eliminar producto (baja lógica)
async function eliminarProducto(id) {
    try {
        if (!confirm('¿Estás seguro de desactivar este producto?')) return;
        
        const { error } = await supabase
            .from('productos')
            .update({ activo: false })
            .eq('id', id);
        
        if (error) throw error;
        
        // Actualizar cache
        const producto = productosCache.get(id);
        if (producto) {
            producto.activo = false;
            productosCache.set(id, producto);
        }
        
        // Recargar productos
        await cargarProductos();
        
        mostrarToast('Producto desactivado', 'El producto se desactivó correctamente', 'success');
    } catch (error) {
        console.error('Error eliminando producto:', error);
        mostrarToast('Error', 'No se pudo desactivar el producto', 'error');
    }
}

// ============================================
// PROCESO DE VENTA - LÓGICA CRÍTICA
// ============================================

// Manejar entrada del scanner
async function handleScanner(e) {
    if (e.key !== 'Enter') return;
    
    const codigo = elementos.scannerInput.value.trim();
    if (!codigo) return;
    
    try {
        // Buscar producto por código
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
        
        // Verificar stock
        if (producto.stock <= 0) {
            mostrarToast('Sin stock', `No hay stock disponible de ${producto.nombre}`, 'error');
            return;
        }
        
        // Agregar al carrito
        agregarAlCarrito(producto);
        
        // Limpiar scanner
        elementos.scannerInput.value = '';
        
        // Enfocar scanner nuevamente
        elementos.scannerInput.focus();
        
    } catch (error) {
        console.error('Error procesando scanner:', error);
        mostrarToast('Error', 'No se pudo procesar el código escaneado', 'error');
    }
}

// Agregar producto al carrito
function agregarAlCarrito(producto, cantidad = 1) {
    // Buscar si ya está en el carrito
    const index = carrito.findIndex(item => item.producto.id === producto.id);
    
    if (index >= 0) {
        // Actualizar cantidad
        carrito[index].cantidad += cantidad;
        
        // Verificar stock máximo
        if (carrito[index].cantidad > producto.stock) {
            carrito[index].cantidad = producto.stock;
            mostrarToast('Stock limitado', `Solo hay ${producto.stock} unidades disponibles`, 'warning');
        }
    } else {
        // Agregar nuevo item
        if (cantidad > producto.stock) {
            cantidad = producto.stock;
            mostrarToast('Stock limitado', `Solo hay ${producto.stock} unidades disponibles`, 'warning');
        }
        
        carrito.push({
            producto,
            cantidad,
            precio_unitario: producto.precio_venta,
            subtotal: producto.precio_venta * cantidad
        });
    }
    
    // Actualizar interfaz
    renderizarCarrito();
    calcularTotales();
    
    // Mostrar notificación
    mostrarToast('Producto agregado', `${producto.nombre} agregado al carrito`, 'success');
}

// Renderizar carrito
function renderizarCarrito() {
    elementos.carritoBody.innerHTML = '';
    
    if (carrito.length === 0) {
        elementos.carritoVacio.classList.remove('hidden');
        elementos.carritoCount.textContent = '0 items';
        return;
    }
    
    elementos.carritoVacio.classList.add('hidden');
    elementos.carritoCount.textContent = `${carrito.length} ${carrito.length === 1 ? 'item' : 'items'}`;
    
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
    
    // Configurar eventos de cantidad
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

// Eliminar item del carrito
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
    renderizarCarrito();
    calcularTotales();
    elementos.pagosSeleccionados.innerHTML = '';
    
    mostrarToast('Carrito limpiado', 'Todos los productos fueron removidos', 'info');
}

// Calcular totales del carrito
function calcularTotales() {
    let subtotal = 0;
    
    carrito.forEach(item => {
        subtotal += item.subtotal;
    });
    
    const descuento = parseFloat(elementos.descuentoAplicado.textContent.replace('-$', '')) || 0;
    const total = subtotal - descuento;
    
    elementos.subtotal.textContent = `$${subtotal.toFixed(2)}`;
    elementos.total.textContent = `$${total.toFixed(2)}`;
}

// Aplicar descuento
function aplicarDescuento() {
    const descuentoStr = elementos.descuentoInput.value.trim();
    
    if (!descuentoStr) {
        mostrarToast('Error', 'Ingresa un valor de descuento', 'error');
        return;
    }
    
    let descuento = 0;
    const subtotal = parseFloat(elementos.subtotal.textContent.replace('$', '')) || 0;
    
    if (subtotal === 0) {
        mostrarToast('Error', 'No hay productos en el carrito', 'error');
        return;
    }
    
    if (descuentoStr.endsWith('%')) {
        // Descuento porcentual
        const porcentaje = parseFloat(descuentoStr.slice(0, -1));
        if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
            mostrarToast('Error', 'Porcentaje inválido (0-100%)', 'error');
            return;
        }
        descuento = subtotal * (porcentaje / 100);
    } else {
        // Descuento fijo
        descuento = parseFloat(descuentoStr);
        if (isNaN(descuento) || descuento < 0 || descuento > subtotal) {
            mostrarToast('Error', `Descuento inválido (máx: $${subtotal.toFixed(2)})`, 'error');
            return;
        }
    }
    
    elementos.descuentoAplicado.textContent = `-$${descuento.toFixed(2)}`;
    elementos.descuentoInput.value = '';
    
    calcularTotales();
    mostrarToast('Descuento aplicado', `Descuento de $${descuento.toFixed(2)} aplicado`, 'success');
}

// ============================================
// MEDIOS DE PAGO Y FINALIZACIÓN DE VENTA
// ============================================

// Seleccionar medio de pago
function seleccionarMedioPago(medio) {
    // Verificar que haya productos en el carrito
    if (carrito.length === 0) {
        mostrarToast('Error', 'No hay productos en el carrito', 'error');
        return;
    }
    
    // Mostrar modal de pagos
    const total = parseFloat(elementos.total.textContent.replace('$', ''));
    document.getElementById('pago-total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('pago-saldo').textContent = `$${total.toFixed(2)}`;
    
    // Configurar eventos del formulario de pagos
    const formPagos = document.getElementById('form-pagos');
    const inputsPago = formPagos.querySelectorAll('input[type="number"]');
    
    inputsPago.forEach(input => {
        input.value = '';
        input.addEventListener('input', actualizarSaldoPendiente);
    });
    
    // Configurar botón de confirmar pagos
    const btnConfirmar = document.getElementById('btn-confirmar-pagos');
    btnConfirmar.onclick = () => procesarPagos();
    
    // Mostrar modal
    mostrarModal('modal-pagos');
}

// Actualizar saldo pendiente en modal de pagos
function actualizarSaldoPendiente() {
    const total = parseFloat(elementos.total.textContent.replace('$', ''));
    let pagado = 0;
    
    const inputs = document.querySelectorAll('#form-pagos input[type="number"]');
    inputs.forEach(input => {
        pagado += parseFloat(input.value) || 0;
    });
    
    const saldo = total - pagado;
    const saldoElement = document.getElementById('pago-saldo');
    
    saldoElement.textContent = `$${saldo.toFixed(2)}`;
    
    if (Math.abs(saldo) < 0.01) {
        saldoElement.className = 'text-success';
    } else if (saldo > 0) {
        saldoElement.className = 'text-danger';
    } else {
        saldoElement.className = 'text-warning';
    }
}

// Procesar pagos seleccionados
async function procesarPagos() {
    const total = parseFloat(elementos.total.textContent.replace('$', ''));
    let pagos = [];
    let pagado = 0;
    
    // Obtener montos de cada medio
    const efectivo = parseFloat(document.getElementById('pago-efectivo').value) || 0;
    const tarjeta = parseFloat(document.getElementById('pago-tarjeta').value) || 0;
    const transferencia = parseFloat(document.getElementById('pago-transferencia').value) || 0;
    
    if (efectivo > 0) pagos.push({ medio: 'EFECTIVO', monto: efectivo });
    if (tarjeta > 0) pagos.push({ medio: 'TARJETA', monto: tarjeta });
    if (transferencia > 0) pagos.push({ medio: 'TRANSFERENCIA/QR', monto: transferencia });
    
    // Calcular total pagado
    pagado = efectivo + tarjeta + transferencia;
    
    // Validar pagos
    if (pagos.length === 0) {
        mostrarToast('Error', 'Debes seleccionar al menos un medio de pago', 'error');
        return;
    }
    
    // Verificar que el total pagado sea igual al total (con tolerancia de centavos)
    if (Math.abs(pagado - total) > 0.01) {
        const confirmar = confirm(`El total pagado ($${pagado.toFixed(2)}) no coincide con el total ($${total.toFixed(2)}). ¿Deseas continuar de todas formas?`);
        if (!confirmar) return;
    }
    
    // Guardar pagos y proceder con la venta
    elementos.pagosSeleccionados.innerHTML = pagos.map(p => `
        <div class="pago-item">
            <span>${p.medio}:</span>
            <span>$${p.monto.toFixed(2)}</span>
        </div>
    `).join('');
    
    // Cerrar modal y proceder con la venta
    ocultarModal('modal-pagos');
    
    // Finalizar venta con los pagos
    await finalizarVenta(pagos);
}

// Iniciar proceso de pago
function iniciarProcesoPago() {
    if (carrito.length === 0) {
        mostrarToast('Error', 'No hay productos en el carrito', 'error');
        return;
    }
    
    // Mostrar modal de pagos
    seleccionarMedioPago();
}

// ============================================
// FINALIZAR VENTA - TRANSACCIÓN ATÓMICA
// ============================================

// Finalizar venta (transacción atómica)
async function finalizarVenta(pagos) {
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
        
        // Calcular totales
        const subtotal = parseFloat(elementos.subtotal.textContent.replace('$', ''));
        const descuento = parseFloat(elementos.descuentoAplicado.textContent.replace('-$', '')) || 0;
        const total = subtotal - descuento;
        
        // 1. Revalidar stock en tiempo real
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
        
        // 2. Generar Ticket ID correlativo y secuencial diario
        const ticketId = await generarTicketId();
        
        // 3. Registrar venta (transacción atómica)
        const ventaData = {
            ticket_id: ticketId,
            caja_id: cajaActiva.id,
            usuario_id: currentUser.id,
            subtotal: subtotal,
            descuento: descuento,
            total: total,
            anulada: false
        };
        
        // Insertar venta
        const { data: venta, error: errorVenta } = await supabase
            .from('ventas')
            .insert([ventaData])
            .select()
            .single();
        
        if (errorVenta) throw errorVenta;
        
        // 4. Insertar detalles de venta y actualizar stock
        const detallesPromises = carrito.map(async (item) => {
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
            
            // Actualizar stock (decremento atómico)
            const { error: errorStock } = await supabase.rpc('decrementar_stock', {
                producto_id: item.producto.id,
                cantidad: item.cantidad
            });
            
            if (errorStock) throw errorStock;
        });
        
        await Promise.all(detallesPromises);
        
        // 5. Insertar pagos
        const pagosPromises = pagos.map(async (pago) => {
            const pagoData = {
                venta_id: venta.id,
                medio_pago: pago.medio,
                monto: pago.monto
            };
            
            const { error: errorPago } = await supabase
                .from('pagos_venta')
                .insert([pagoData]);
            
            if (errorPago) throw errorPago;
        });
        
        await Promise.all(pagosPromises);
        
        // 6. Generar ticket imprimible
        await generarTicket(venta);
        
        // 7. Consistencia post-operación
        await recargarEstadoPostVenta();
        
        // 8. Resetear carrito y mostrar éxito
        carrito = [];
        renderizarCarrito();
        calcularTotales();
        elementos.pagosSeleccionados.innerHTML = '';
        elementos.descuentoAplicado.textContent = '-$0.00';
        
        // Actualizar próximo ticket ID
        await actualizarProximoTicketId();
        
        // Enfocar scanner para nueva venta
        elementos.scannerInput.focus();
        
        mostrarToast('¡Venta exitosa!', `Ticket ${ticketId} generado`, 'success');
        
    } catch (error) {
        console.error('Error finalizando venta:', error);
        mostrarToast('Error en venta', error.message, 'error');
    }
}

// Generar Ticket ID único y secuencial
async function generarTicketId() {
    try {
        const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `T-${hoy}-`;
        
        // Obtener el último ticket del día
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
        throw new Error('No se pudo generar el ID del ticket');
    }
}

// Actualizar próximo ticket ID
async function actualizarProximoTicketId() {
    try {
        const ticketId = await generarTicketId();
        elementos.nextTicketId.textContent = ticketId;
    } catch (error) {
        console.error('Error actualizando próximo ticket:', error);
        elementos.nextTicketId.textContent = 'ERROR';
    }
}

// Generar ticket imprimible
async function generarTicket(venta) {
    try {
        // Obtener configuración del ticket
        const { data: config, error: errorConfig } = await supabase
            .from('configuracion')
            .select('clave, valor');
        
        if (errorConfig) throw errorConfig;
        
        const configMap = {};
        config.forEach(item => {
            configMap[item.clave] = item.valor;
        });
        
        // Obtener detalles de la venta
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
        
        // Construir contenido del ticket
        const contenido = document.getElementById('ticket-contenido');
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
        
        // Imprimir ticket
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
        mostrarToast('Error', 'No se pudo generar el ticket', 'error');
    }
}

// Recargar estado post-venta
async function recargarEstadoPostVenta() {
    try {
        // Recargar productos vendidos
        await cargarProductos();
        
        // Recargar caja activa
        await cargarCajaActiva();
        
        // Recargar cache de productos
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
            
            // Actualizar estado en header
            const statusDot = elementos.statusCaja.querySelector('.status-dot');
            const statusText = elementos.statusCaja.querySelector('.status-text');
            
            statusDot.className = 'status-dot';
            statusText.textContent = 'Caja abierta';
            
            elementos.currentCajaId.textContent = `#${cajaActiva.id}`;
        } else {
            cajaActiva = null;
            renderizarCajaInfo();
            
            // Actualizar estado en header
            const statusDot = elementos.statusCaja.querySelector('.status-dot');
            const statusText = elementos.statusCaja.querySelector('.status-text');
            
            statusDot.className = 'status-dot cerrada';
            statusText.textContent = 'Caja cerrada';
            
            elementos.currentCajaId.textContent = 'Sin caja';
        }
    } catch (error) {
        console.error('Error cargando caja activa:', error);
        cajaActiva = null;
        elementos.statusCaja.querySelector('.status-text').textContent = 'Error';
    }
}

// Renderizar información de caja
function renderizarCajaInfo() {
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
        
        // Configurar evento para abrir caja
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
    
    // Configurar evento para cerrar caja
    const form = document.getElementById('form-cerrar-caja');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await cerrarCaja();
        };
    }
    
    // Cargar movimientos de la caja
    cargarMovimientosCaja();
}

// Abrir caja
async function abrirCaja() {
    try {
        // Validar permisos
        if (!(await tienePermiso('acceder_caja'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para abrir caja', 'error');
            return;
        }
        
        // Verificar que no exista caja activa
        const { data: cajasActivas, error: errorCheck } = await supabase
            .from('caja')
            .select('id')
            .is('fecha_cierre', null);
        
        if (errorCheck) throw errorCheck;
        
        if (cajasActivas && cajasActivas.length > 0) {
            throw new Error('Ya existe una caja abierta');
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
        
        // Regresar a venta
        mostrarSeccion('venta');
        
    } catch (error) {
        console.error('Error abriendo caja:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// Cerrar caja
async function cerrarCaja() {
    try {
        // Validar permisos
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
        
        // Calcular total ventas
        const totalVentas = totalEfectivo + totalTarjeta + totalTransferencia;
        const totalEsperado = cajaActiva.monto_inicial + totalEfectivo;
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
        
        // Actualizar estado
        cajaActiva = null;
        await cargarCajaActiva();
        
    } catch (error) {
        console.error('Error cerrando caja:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// Cargar movimientos de caja
async function cargarMovimientosCaja() {
    if (!cajaActiva) return;
    
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
// HISTORIAL Y ANULACIÓN DE VENTAS
// ============================================

// Cargar ventas del día
async function cargarVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    elementos.fechaInicio.value = hoy;
    elementos.fechaFin.value = hoy;
    await cargarHistorial();
}

// Cargar historial de ventas
async function cargarHistorial() {
    try {
        const fechaInicio = elementos.fechaInicio.value;
        const fechaFin = elementos.fechaFin.value;
        
        if (!fechaInicio || !fechaFin) {
            mostrarToast('Error', 'Selecciona un rango de fechas', 'error');
            return;
        }
        
        // Convertir fechas a formato ISO
        const inicio = new Date(fechaInicio + 'T00:00:00');
        const fin = new Date(fechaFin + 'T23:59:59');
        
        let query = supabase
            .from('ventas')
            .select(`
                *,
                usuario:usuarios(username),
                pagos_venta (medio_pago, monto)
            `)
            .gte('fecha', inicio.toISOString())
            .lte('fecha', fin.toISOString())
            .order('fecha', { ascending: false });
        
        const { data: ventas, error } = await query;
        
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
        
        // Agrupar pagos por medio
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
    
    // Configurar eventos
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
    
    // Solo ventas no anuladas
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
    
    document.getElementById('total-ventas-periodo').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('total-efectivo-periodo').textContent = `$${totalEfectivo.toFixed(2)}`;
    document.getElementById('total-tarjeta-periodo').textContent = `$${totalTarjeta.toFixed(2)}`;
    document.getElementById('total-transferencia-periodo').textContent = `$${totalTransferencia.toFixed(2)}`;
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
        
        // Actualizar título
        document.getElementById('detalle-venta-titulo').textContent = `Detalles: ${venta.ticket_id}`;
        
        // Construir contenido
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
        
        // Configurar botón de anulación
        elementos.btnAnularVenta.onclick = () => anularVenta(id);
        elementos.btnAnularVenta.style.display = venta.anulada ? 'none' : 'block';
        
        // Mostrar modal
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
        
        // Obtener venta y detalles
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
        
        // Iniciar transacción (usando RPC o múltiples operaciones)
        // 1. Marcar venta como anulada
        const { error: errorAnular } = await supabase
            .from('ventas')
            .update({
                anulada: true,
                usuario_anulacion_id: currentUser.id,
                fecha_anulacion: new Date().toISOString()
            })
            .eq('id', id);
        
        if (errorAnular) throw errorAnular;
        
        // 2. Revertir stock para cada producto
        const revertirPromises = venta.detalle_ventas.map(async (detalle) => {
            const { error: errorStock } = await supabase.rpc('incrementar_stock', {
                producto_id: detalle.producto_id,
                cantidad: detalle.cantidad
            });
            
            if (errorStock) throw errorStock;
        });
        
        await Promise.all(revertirPromises);
        
        // Recargar historial y estado
        await cargarHistorial();
        await cargarProductos();
        if (cajaActiva && venta.caja_id === cajaActiva.id) {
            await cargarCajaActiva();
        }
        
        mostrarToast('Venta anulada', 'La venta fue anulada correctamente', 'success');
        
        // Cerrar modal si está abierto
        ocultarModal('modal-detalle-venta');
        
    } catch (error) {
        console.error('Error anulando venta:', error);
        mostrarToast('Error', error.message, 'error');
    }
}

// ============================================
// CONFIGURACIÓN DEL SISTEMA
// ============================================

// Cargar configuración
async function cargarConfiguracion() {
    try {
        const { data: config, error } = await supabase
            .from('configuracion')
            .select('clave, valor')
            .in('clave', ['ticket_encabezado', 'ticket_pie', 'ticket_mensaje']);
        
        if (error) throw error;
        
        // Inicializar valores predeterminados
        const configMap = {
            'ticket_encabezado': '',
            'ticket_pie': '',
            'ticket_mensaje': ''
        };
        
        config.forEach(item => {
            configMap[item.clave] = item.valor;
        });
        
        // Actualizar formularios
        elementos.configEncabezado.value = configMap['ticket_encabezado'];
        elementos.configPie.value = configMap['ticket_pie'];
        elementos.configMensaje.value = configMap['ticket_mensaje'];
        
        // Cargar permisos si es administrador
        if (currentRole === 'Administrador') {
            await cargarUsuariosPermisos();
        } else {
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
            elementos.permisosContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No hay usuarios registrados</p>
                </div>
            `;
            return;
        }
        
        // Obtener permisos de cada usuario
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
        
        // Renderizar interfaz de permisos
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
        
        elementos.permisosContainer.innerHTML = html;
        
        // Configurar eventos de checkboxes
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
        elementos.permisosContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                Error cargando permisos
            </div>
        `;
    }
}

// Actualizar permiso de usuario
async function actualizarPermiso(usuarioId, permiso, activo) {
    try {
        if (!(await tienePermiso('modificar_permisos'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para modificar permisos', 'error');
            return;
        }
        
        if (activo) {
            // Insertar o activar permiso
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
            // Desactivar permiso
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
            { clave: 'ticket_encabezado', valor: elementos.configEncabezado.value },
            { clave: 'ticket_pie', valor: elementos.configPie.value },
            { clave: 'ticket_mensaje', valor: elementos.configMensaje.value }
        ];
        
        // Actualizar cada configuración
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
// UTILIDADES Y FUNCIONES AUXILIARES
// ============================================

// Mostrar/ocultar secciones
function mostrarSeccion(seccionId) {
    // Actualizar navegación
    elementos.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === seccionId) {
            link.classList.add('active');
        }
    });
    
    // Mostrar sección correspondiente
    elementos.sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `seccion-${seccionId}`) {
            section.classList.add('active');
        }
    });
    
    currentSection = seccionId;
    
    // Enfocar scanner si es sección de venta
    if (seccionId === 'venta') {
        setTimeout(() => {
            elementos.scannerInput.focus();
        }, 100);
    }
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

// Configurar tema claro/oscuro
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

// Toggle sidebar en móvil
function toggleSidebar() {
    elementos.sidebar.classList.toggle('active');
}

// Actualizar reloj en tiempo real
function actualizarReloj() {
    const ahora = new Date();
    elementos.liveClock.textContent = ahora.toLocaleTimeString();
}

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
    
    // Configurar botón cerrar
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Configurar eventos táctiles para móvil
function configurarEventosTactiles() {
    // Prevenir zoom en inputs en iOS
    document.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            e.target.style.fontSize = '16px'; // Previene zoom en iOS
        }
    });
    
    // Botones con feedback táctil
    document.querySelectorAll('.btn, .btn-pago, .nav-link').forEach(element => {
        element.addEventListener('touchstart', () => {
            element.style.opacity = '0.7';
        });
        
        element.addEventListener('touchend', () => {
            element.style.opacity = '1';
        });
    });
}

// ============================================
// FUNCIONES DE REPORTES (SIMPLIFICADAS)
// ============================================

// Generar reporte
async function generarReporte() {
    try {
        if (!(await tienePermiso('ver_reportes'))) {
            mostrarToast('Permiso denegado', 'No tienes permiso para ver reportes', 'error');
            return;
        }
        
        const fechaInicio = elementos.reporteFechaInicio.value;
        const fechaFin = elementos.reporteFechaFin.value;
        const tipo = elementos.reporteTipo.value;
        
        if (!fechaInicio || !fechaFin) {
            mostrarToast('Error', 'Selecciona un rango de fechas', 'error');
            return;
        }
        
        // Convertir fechas
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
        
        elementos.reporteResultados.innerHTML = html;
        
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
    
    // Calcular totales
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
    
    // Calcular ganancias
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
    
    // Agrupar por producto
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
    
    // Convertir a array y ordenar por cantidad
    const productosArray = Array.from(productosMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10); // Top 10
    
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

// Configurar botón de reportes
elementos.btnGenerarReporte.addEventListener('click', generarReporte);

// Configurar botón refresh caja
elementos.btnRefreshCaja.addEventListener('click', cargarCajaActiva);

// Configurar eventos de búsqueda de productos
document.getElementById('btn-buscar-productos')?.addEventListener('click', async () => {
    await buscarProductos();
});

// Función de búsqueda de productos
async function buscarProductos() {
    try {
        let query = supabase
            .from('productos')
            .select('*')
            .eq('activo', true);
        
        // Aplicar filtros
        const codigo = document.getElementById('busqueda-codigo').value;
        const nombre = document.getElementById('busqueda-nombre').value;
        const proveedor = document.getElementById('busqueda-proveedor').value;
        const precioMin = document.getElementById('busqueda-precio-min').value;
        const precioMax = document.getElementById('busqueda-precio-max').value;
        
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
        
        const { data: productos, error } = await query
            .order('nombre')
            .limit(20);
        
        if (error) throw error;
        
        // Mostrar resultados
        const tbody = document.getElementById('busqueda-resultados');
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
        
        // Configurar eventos de agregar
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
