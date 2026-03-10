# **Manual de Marca y Guía de Estilos UI**

**Producto:** NexoStock

**Concepto Visual:** Moderno, Minimalista, Eficiente y Confiable.

## **1\. Identidad y Concepto**

**NexoStock** es una herramienta de trabajo diario. Su interfaz no debe competir por la atención del usuario con adornos innecesarios; debe ser un lienzo limpio que resalte los datos críticos (stock, ventas, alertas). El minimalismo aquí es funcional: menos distracciones significa menos errores operativos.

## **2\. Paleta de Colores**

Nos basaremos en un sistema de colores principalmente neutral (grises y blancos) para la estructura, con un color primario tecnológico y colores semánticos claros para los estados del stock.

### **Colores Principales (Brand)**

* **Primario (Acentos y Botones Principales):** Azul Índigo **\#4F46E5**  
  * *Uso:* Botones de "Guardar", "Cobrar", links principales, elementos activos en el menú. Transmite tecnología y seguridad.  
* **Secundario (Superficies Oscuras/Textos Principales):** Pizarra Oscuro **\#0F172A**  
  * *Uso:* Texto principal, títulos, barra de navegación lateral (Sidebar).

### **Colores Neutrales (Estructura y Fondos)**

* **Fondo Base (App Background):** Gris Nube **\#F8FAFC**  
  * *Uso:* El fondo general de la aplicación. Ayuda a que las tarjetas blancas resalten suavemente.  
* **Superficies (Cards & Modales):** Blanco Puro **\#FFFFFF**  
  * *Uso:* Fondos de tablas, tarjetas de productos, formularios.  
* **Bordes y Divisores:** Gris Claro **\#E2E8F0**  
  * *Uso:* Líneas divisorias en tablas, bordes de inputs de texto.

### **Colores Semánticos (Estados y Alertas)**

* **Éxito (Success):** Verde Esmeralda **\#10B981**  
  * *Uso:* Venta completada, sincronización exitosa con Tiendanube, stock alto.  
* **Peligro / Error (Danger):** Rojo Carmesí **\#EF4444**  
  * *Uso:* Sin stock (Quiebre), errores de sincronización, botones de eliminar.  
* **Advertencia (Warning):** Naranja Ámbar **\#F59E0B**  
  * *Uso:* Alertas de stock mínimo, avisos de "Depósito Virtual / Demora".

## **3\. Tipografía**

Para un sistema de gestión de datos, la legibilidad de los números y textos pequeños es innegociable. Utilizaremos una sola familia tipográfica diseñada específicamente para interfaces digitales.

* **Fuente Principal:** **Inter** (Google Fonts)  
  * *Por qué:* Es minimalista, tiene excelente legibilidad en tamaños pequeños y los números tienen un ancho uniforme, ideal para tablas de stock y precios.

### **Jerarquía Tipográfica**

* **Títulos de Página (H1):** Inter SemiBold \- 24px (Color: \#0F172A)  
* **Subtítulos / Secciones (H2):** Inter Medium \- 18px (Color: \#334155)  
* **Cuerpo de Texto (Body):** Inter Regular \- 14px (Color: \#475569)  
* **Textos Pequeños (Labels/Metadatos):** Inter Medium \- 12px (Color: \#64748B)

## **4\. Estilo de UI (Interfaz de Usuario)**

Para lograr el aspecto minimalista y moderno, seguiremos estas reglas estrictas:

* **Esquinas Redondeadas (Border Radius):**  
  * *Botones y Campos de Texto:* 6px (Sutil, moderno pero no infantil).  
  * *Tarjetas (Cards) y Modales:* 12px (Sensación de bloque de información suave).  
* **Sombras (Drop Shadows):**  
  * Evitaremos las sombras pesadas. Usaremos sombras muy difusas y ligeras solo para separar capas (por ejemplo, para que una tarjeta resalte sobre el fondo gris, o para el menú desplegable).  
  * *Sombra estándar:* box-shadow: 0 4px 6px \-1px rgba(0, 0, 0, 0.05)  
* **Espaciado (Whitespace):**  
  * El espacio vacío es el mejor amigo del minimalismo. Las tablas no deben estar apretadas. Usaremos márgenes internos (paddings) generosos (ej. 16px o 24px dentro de las tarjetas).  
* **Botones (Jerarquía Visual):**  
  * *Primario:* Fondo Azul Índigo sólido con texto blanco.  
  * *Secundario:* Fondo transparente con borde Azul Índigo y texto Azul Índigo (Ghost button).  
  * *Terciario/Peligro:* Fondo transparente con texto Rojo Carmesí (para acciones destructivas).

## **5\. Iconografía**

* **Estilo:** Iconos de línea fina (Stroke 1.5px o 2px), sin relleno, de diseño geométrico.  
* **Librería Sugerida:** Lucide Icons o Phosphor Icons.  
* **Regla de uso:** Los iconos deben usarse siempre acompañados de un texto (label) si la acción no es universalmente obvia.

## **6\. Componentes Clave del Sistema**

* **Badges (Etiquetas de estado):** Serán pequeños "píldoras" con fondo de color muy suave y texto en color fuerte.  
  * Ej: \[Depósito Virtual\] \-\> Fondo Naranja clarito (\#FEF3C7) con texto Naranja oscuro (\#B45309).  
* **Tablas de Datos:** Sin bordes verticales. Solo líneas horizontales divisorias muy tenues. El "hover" (pasar el mouse por encima) resaltará la fila entera con un gris sutil (\#F1F5F9).