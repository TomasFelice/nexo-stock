# **Product Requirements Document (PRD)**

**Nombre del Proyecto:** NexoStock \- Sistema de Centralización de Stock y Sincronización

**Fecha:** Febrero 2026

**Estado:** Revisión v3

## **1\. Resumen Ejecutivo**

**NexoStock** tiene como objetivo centralizar la gestión de inventario de una tienda de ropa, reemplazando el manejo actual dividido entre planillas de Excel (para múltiples depósitos) y la plataforma Tiendanube. Proveerá una única fuente de verdad para el stock, permitiendo la gestión de múltiples depósitos físicos y virtuales, transferencias internas, registro de ventas/cambios, y mantendrá una sincronización bidireccional y en tiempo real con Tiendanube.

## **2\. Objetivos del Producto**

* **Centralización:** Eliminar la dependencia de Excel y unificar el stock físico y digital bajo una misma plataforma.  
* **Visibilidad:** Conocer exactamente dónde está cada producto (en qué depósito físico o si es stock virtual) en tiempo real.  
* **Eficiencia Operativa:** Reducir demoras en el local físico al identificar rápidamente la ubicación real de un producto.  
* **Omnicanalidad Segura:** Mantener el stock sincronizado contemplando reglas de negocio específicas (depósitos excluidos de la web, stock imaginario).  
* **Toma de Decisiones:** Proveer reportes claros sobre ventas, rotación de inventario y alertas de escasez.

## **3\. Casos de Uso Principales (Historias de Usuario)**

* **Como Vendedor (Local Físico):** Quiero registrar una venta para que se descuente el stock automáticamente en NexoStock y se actualice en Tiendanube.  
* **Como Vendedor:** Quiero buscar un producto y ver en qué depósito se encuentra. Si no está en el local (Depósito Principal), quiero saberlo para avisarle al cliente sobre la pequeña demora.  
* **Como Encargado de Depósito:** Quiero registrar el movimiento de X cantidad de productos del "Depósito B" al "Depósito Principal".  
* **Como Administrador:** Quiero tener un "Depósito Imaginario" para cargar stock ficticio de productos que sé que puedo conseguir rápido, para que sigan a la venta en la web sin afectar mi conteo físico.  
* **Como Administrador:** Quiero que ciertos depósitos (ej. "Mercadería Fallada") no sumen su stock a Tiendanube para evitar vender algo que no está en condiciones.  
* **Como Administrador (Implementación):** Quiero sincronizar inicialmente SOLO el catálogo (nombres, talles, colores, precios) desde Tiendanube, sin pisar el stock actual, para poder auditar el físico primero.

## **4\. Requerimientos Funcionales**

### **Módulo 1: Gestión de Catálogo (Master Data)**

* **1.1. Origen de Datos:** El ABM (Alta, Baja y Modificación) de productos se realizará de forma primaria en Tiendanube.  
* **1.2. Soporte de Variantes:** NexoStock debe soportar productos simples y productos con múltiples variantes combinadas (Ej: Remera Básica \-\> Talle \-\> Color).  
* **1.3. Sincronización Inicial Restringida:** La primera sincronización con Tiendanube importará **únicamente el catálogo** (productos, variantes, SKUs, códigos de barras, precios). **NO importará ni sobrescribirá cantidades de stock** para preservar el esquema de "stock imaginario" que el cliente ya tiene funcionando en la web hasta que se configure el sistema local.

### **Módulo 2: Gestión de Depósitos**

* **2.1. Múltiples Depósitos:** Capacidad de crear, editar y eliminar depósitos (Ej: Local, Depósito Externo 1).  
* **2.2. Flag "Depósito Principal":** Un depósito debe poder marcarse como "Principal" (generalmente el local físico).  
* **2.3. Flag "Suma a Web":** Cada depósito tendrá un interruptor para definir si su stock se envía a Tiendanube o no. (Útil para depósitos de devoluciones, fallados o cuarentena).  
* **2.4. Depósito Virtual (Stock Imaginario):** Creación de un tipo de depósito especial (o depósito estándar con flag "Virtual"). Aquí se cargará el stock que el cliente no tiene físicamente pero quiere vender online (venta en verde / backorder).  
* **2.5. Transferencias Internas:** Interfaz para mover stock de un depósito a otro, registrando trazabilidad completa.  
* **2.6. Consulta Rápida:** Al buscar un producto, NexoStock debe mostrar el total global y el desglose. Si el stock está en el "Depósito Virtual", el vendedor sabrá inmediatamente que es un producto que debe conseguirse/pedirse.

### **Módulo 3: Punto de Venta y Cambios (POS Interno)**

* **3.1. Registro de Ventas:** Interfaz rápida para registrar ventas físicas. Se debe seleccionar de qué depósito se descuenta la mercadería.  
* **3.2. Venta de Stock Imaginario:** Si se vende físicamente un producto del "Depósito Virtual", el sistema debe permitirlo pero generar un aviso de que se está comprometiendo mercadería no física.  
* **3.3. Registro de Cambios:** Flujo específico donde se ingresa el producto devuelto y se descuenta el nuevo.  
* **3.4. Impacto Inmediato:** Cualquier venta o cambio debe actualizar el stock local y encolar la actualización hacia Tiendanube.

### **Módulo 4: Sincronización Bidireccional de Stock (El Motor Core)**

* **4.1. Local hacia Tiendanube:** \* Cuando ocurre una modificación en NexoStock, se dispara una petición (API PUT) a Tiendanube.  
  * **Regla de Cálculo de Stock Web:** Stock a enviar \= Suma(Stock en Depósitos Físicos con Flag "Suma a Web" en ON) \+ Suma(Stock en Depósito Virtual).  
* **4.2. Tiendanube hacia Local:** \* NexoStock recibirá Webhooks de Tiendanube al crearse/pagarse órdenes.  
  * **Regla de Descuento Online:** Se debe poder configurar una prioridad de descuento. Por ejemplo: 1° Descontar del Depósito Principal, 2° Si no alcanza, descontar del Depósito Externo, 3° Si no hay físico, descontar del Depósito Virtual.

### **Módulo 5: Reportes y Analítica**

* **5.1. Dashboard Principal:** KPIs de ventas del día, semana y mes.  
* **5.2. Reporte de Ventas y Facturación:** Filtrable por fechas.  
* **5.3. Reporte de Stock:** Valorización del inventario físico (excluyendo depósito virtual), productos más vendidos.  
* **5.4. Trazabilidad:** Historial de movimientos detallado por artículo.

### **Módulo 6: Sistema de Alertas**

* **6.1. Configuración de Mínimos:** Establecer "Stock Mínimo" por producto/variante, aplicable solo a depósitos físicos.  
* **6.2. Notificaciones:** Alerta visual cuando un producto alcance su stock mínimo físico.

## **5\. Requerimientos No Funcionales**

* **Plataforma:** Aplicación Web responsiva (PC, Tablet, Móvil).  
* **Disponibilidad:** 99.9% de Uptime.  
* **Concurrencia:** Manejo seguro de condiciones de carrera.  
* **Auditoría:** Registro de fecha, hora y usuario en todo movimiento.

## **6\. Arquitectura Sugerida (Alto Nivel)**

1. **Backend:** Node.js, Python o Java. Fundamental implementar un sistema de **Colas de Tareas (Job Queues, ej. BullMQ o Celery)** para procesar las llamadas a la API de Tiendanube y evitar bloqueos o superar los Rate Limits.  
2. **Base de Datos:** PostgreSQL o MySQL.  
3. **Frontend:** React o Angular.

## **7\. Fases de Desarrollo Sugeridas (Roadmap)**

### **Fase 1: MVP y Seteo Inicial**

* Importación **solo de catálogo** (sin stock) desde Tiendanube.  
* Creación de Depósitos Físicos, Depósito Virtual y configuración de Flags ("Suma a Web").  
* Módulo de carga de stock inicial local (Auditoría física).  
* Punto de venta básico físico.

### **Fase 2: Automatización Bidireccional**

* Activación del motor de cálculo y envío de stock hacia Tiendanube (Local \-\> Web).  
* Integración de Webhooks (Tiendanube \-\> Local) y lógicas de prioridad de descuento.  
* Módulo de Cambios y Transferencias.

### **Fase 3: Inteligencia de Negocio**

* Reportes avanzados.  
* Alertas de stock.