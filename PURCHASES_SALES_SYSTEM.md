# Sistema de Compras y Ventas - MarketplaceCR

## Resumen de Cambios Implementados

Se ha implementado un sistema completo para registrar y gestionar tanto las compras como las ventas cuando se realiza una transacción en el marketplace. El sistema incluye nuevos modelos, controladores, rutas y componentes de frontend.

## Nuevos Modelos de Base de Datos

### 1. Purchase (Compra)
- **Archivo**: `src/models/Purchase.js`
- **Descripción**: Registra cada compra individual realizada por un usuario
- **Campos principales**:
  - `order`: Referencia a la orden original
  - `buyer`: Usuario que realiza la compra
  - `product`: Producto comprado
  - `store`: Tienda del producto
  - `quantity`: Cantidad comprada
  - `unitPrice`: Precio unitario
  - `totalAmount`: Monto total
  - `paymentMethod`: Método de pago
  - `status`: Estado de la compra (pending, confirmed, shipped, delivered, cancelled, refunded)
  - `shippingAddress`: Dirección de envío
  - `trackingNumber`: Número de seguimiento

### 2. Sale (Venta)
- **Archivo**: `src/models/Sale.js`
- **Descripción**: Registra cada venta individual realizada por una tienda
- **Campos principales**:
  - `order`: Referencia a la orden original
  - `store`: Tienda que realiza la venta
  - `seller`: Vendedor (propietario de la tienda)
  - `buyer`: Comprador
  - `product`: Producto vendido
  - `quantity`: Cantidad vendida
  - `unitPrice`: Precio unitario
  - `totalAmount`: Monto total de la venta
  - `platformCommission`: Comisión de la plataforma
  - `platformCommissionRate`: Tasa de comisión (5% por defecto)
  - `netAmount`: Monto neto para el vendedor
  - `paymentMethod`: Método de pago
  - `status`: Estado de la venta
  - `shippingCost`: Costo de envío

## Nuevos Controladores

### 1. PurchaseController
- **Archivo**: `src/controllers/purchaseController.js`
- **Funciones**:
  - `getMyPurchases`: Obtener todas las compras del usuario
  - `getPurchaseDetails`: Obtener detalles de una compra específica
  - `getPurchaseStats`: Obtener estadísticas de compras del usuario

### 2. SaleController
- **Archivo**: `src/controllers/saleController.js`
- **Funciones**:
  - `getMySales`: Obtener todas las ventas del usuario
  - `getSaleDetails`: Obtener detalles de una venta específica
  - `updateSaleStatus`: Actualizar estado de una venta
  - `getSalesStats`: Obtener estadísticas de ventas del usuario

## Nuevas Rutas de API

### Rutas de Compras (`/api/purchases`)
- `GET /my-purchases`: Obtener compras del usuario autenticado
- `GET /stats`: Obtener estadísticas de compras
- `GET /:id`: Obtener detalles de una compra específica

### Rutas de Ventas (`/api/sales`)
- `GET /my-sales`: Obtener ventas del usuario autenticado
- `GET /stats`: Obtener estadísticas de ventas
- `GET /:id`: Obtener detalles de una venta específica
- `PUT /:id/status`: Actualizar estado de una venta

## Modificaciones al Sistema Existente

### OrderController
Se modificó la función `createOrder` para que cuando se crea una orden:

1. **Se registra automáticamente cada compra** en la tabla `Purchase`
2. **Se registra automáticamente cada venta** en la tabla `Sale`
3. **Se calcula la comisión de la plataforma** (5% por defecto)
4. **Se distribuye el costo de envío** proporcionalmente entre los productos

### Flujo de Creación de Orden
```
1. Usuario crea orden
2. Se valida stock y productos
3. Se crea la orden en la tabla Order
4. Para cada producto en la orden:
   a. Se actualiza el stock del producto
   b. Se crea un registro en Purchase
   c. Se crea un registro en Sale
   d. Se calculan comisiones y ganancias netas
5. Se responde con la orden creada
```

## Nuevos Componentes de Frontend

### 1. PurchaseHistory.jsx
- **Descripción**: Componente para mostrar el historial de compras del usuario
- **Características**:
  - Lista paginada de compras
  - Filtrado por estado
  - Modal con detalles completos
  - Indicadores visuales de estado
  - Información de tracking

### 2. SalesHistory.jsx
- **Descripción**: Componente para mostrar el historial de ventas del vendedor
- **Características**:
  - Lista paginada de ventas
  - Filtrado por estado
  - Modal con detalles completos
  - Funcionalidad para actualizar estado de venta
  - Cálculo de ganancias netas

### 3. TransactionStats.jsx
- **Descripción**: Componente de estadísticas y métricas
- **Características**:
  - Gráficos de tendencias mensuales
  - Distribución por estados
  - Métricas de resumen
  - Productos más vendidos (para vendedores)
  - Cálculo de márgenes de ganancia

### 4. TransactionDashboard.jsx
- **Descripción**: Página principal que integra todos los componentes
- **Características**:
  - Navegación por pestañas
  - Vista unificada de compras y ventas
  - Responsive design
  - Acceso a estadísticas

## Estados de Transacciones

### Estados de Compras
- `pending`: Pendiente de confirmación
- `confirmed`: Confirmada
- `shipped`: Enviada
- `delivered`: Entregada
- `cancelled`: Cancelada
- `refunded`: Reembolsada

### Estados de Ventas
- `pending`: Pendiente
- `confirmed`: Confirmada
- `processing`: Procesando
- `shipped`: Enviada
- `delivered`: Entregada
- `cancelled`: Cancelada
- `refunded`: Reembolsada

## Características del Sistema

### Cálculo de Comisiones
- **Tasa por defecto**: 5% de la venta
- **Comisión calculada automáticamente** al crear la venta
- **Ganancia neta** = Precio total - Comisión de plataforma

### Seguimiento de Envíos
- Número de tracking
- Transportista
- Fechas de envío y entrega
- Actualizaciones de estado

### Estadísticas Avanzadas
- Totales por período
- Tendencias mensuales
- Productos más vendidos
- Márgenes de ganancia
- Distribución por estados

### Filtros y Búsquedas
- Filtrado por estado
- Paginación
- Búsqueda por fechas
- Ordenamiento

## Instalación de Dependencias

Se agregó la dependencia `recharts` para los gráficos:
```bash
npm install recharts
```

## Archivos Modificados

### Backend
- `app.js` - Registro de nuevas rutas
- `src/controllers/orderController.js` - Lógica de creación de compras/ventas
- `src/models/Purchase.js` - Nuevo modelo
- `src/models/Sale.js` - Nuevo modelo
- `src/controllers/purchaseController.js` - Nuevo controlador
- `src/controllers/saleController.js` - Nuevo controlador
- `src/routes/purchaseRoutes.js` - Nuevas rutas
- `src/routes/saleRoutes.js` - Nuevas rutas

### Frontend
- `src/components/PurchaseHistory.jsx` - Nuevo componente
- `src/components/SalesHistory.jsx` - Nuevo componente
- `src/components/TransactionStats.jsx` - Nuevo componente
- `src/pages/TransactionDashboard.jsx` - Nueva página
- `package.json` - Nueva dependencia recharts

## Cómo Usar el Sistema

### Para Compradores
1. Realizar una compra normalmente
2. Acceder al dashboard de transacciones
3. Ver historial de compras en la pestaña "Mis Compras"
4. Ver estadísticas en "Estadísticas de Compras"

### Para Vendedores
1. Las ventas se registran automáticamente cuando alguien compra sus productos
2. Acceder al dashboard de transacciones
3. Ver historial de ventas en "Mis Ventas"
4. Actualizar estado de ventas (enviado, entregado, etc.)
5. Ver estadísticas detalladas en "Estadísticas de Ventas"

## Próximas Mejoras Sugeridas

1. **Notificaciones automáticas** cuando cambie el estado de una venta/compra
2. **Integración con APIs de tracking** de transportistas
3. **Sistema de calificaciones** post-venta
4. **Reportes exportables** en PDF/Excel
5. **Dashboard administrativo** para la plataforma
6. **Análisis predictivo** de ventas
7. **Sistema de disputas** y devoluciones

Este sistema proporciona una base sólida para el manejo completo de transacciones en el marketplace, con capacidades de seguimiento, análisis y gestión tanto para compradores como vendedores.
