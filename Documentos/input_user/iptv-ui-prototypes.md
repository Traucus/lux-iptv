# GUÍA MAESTRA DE MAQUETACIÓN UI/UX (PROTOTIPOS PANTALLA POR PANTALLA)
## INSTRUCCIONES PREMIUM PARA MAQUETADORES Y GENERADORES DE UI CON IA (v0.dev, Bolt.new, Tailwind/React)

Este documento contiene la especificación visual y de interacción detallada para **8 pantallas clave** de la aplicación de IPTV comercial de próxima generación. Está diseñado bajo los principios de la **experiencia de 10 pies (10-Foot UI)** de Smart TVs de 2025/2026, enfocado en legibilidad a distancia, control por D-Pad y transiciones fluidas estilo Netflix.

---

## 🎨 LINEAMIENTOS GENERALES DE DISEÑO (Para toda la App)
*   **Paleta de Colores (Tema Oscuro Premium):**
    *   Fondo Base: Negro absoluto (`#09090b` / `zinc-950`) para evitar fatiga visual nocturna.
    *   Fondo de Tarjetas/Paneles: Gris oscuro translúcido (`rgba(24, 24, 27, 0.7)` / `zinc-900/70`) con efecto de desenfoque de fondo (*Glassmorphism* - `backdrop-blur-md`).
    *   Color de Acento (Foco): Azul eléctrico de alto contraste (`#2563eb` / `blue-600`) o Amarillo Oro (`#f59e0b` / `amber-500`) para una visibilidad óptima con cualquier iluminación.
    *   Textos: Blanco puro (`#ffffff`) para títulos principales, y Gris claro (`#a1a1aa` / `zinc-400`) para textos secundarios.
*   **Tipografía y Legibilidad:**
    *   Fuente: Sans-serif sólida (como Roboto o Inter).
    *   Tamaño Mínimo: **22px** para cuerpos de texto; **28px-32px** para subtítulos; **40px-64px** para títulos principales.
    *   Interlineado: Incrementado en un **25%** (`leading-relaxed` / `leading-loose`).
*   **Márgenes de Seguridad (Safe Area):**
    *   Mantener un **margen interno del 5%** en todos los bordes de la pantalla (mínimo de 32px en ejes Y, 48px en ejes X) para evitar recortes por *overscan* en televisores.
*   **Indicador de Foco Activo:**
    *   Cualquier elemento enfocado debe reaccionar de inmediato con: escala de tamaño (`scale-105`), borde brillante (`border-2 border-blue-500`), sombra difuminada (*glow* - `shadow-blue-500/50`) y cambio de color de fondo.

---

## 💻 ESPECIFICACIÓN DETALLADA DE LAS 8 PANTALLAS

### PANTALLA 1: Selección de Perfil ("¿Quién está viendo?")
*   **Objetivo:** Permitir al usuario elegir o administrar su perfil de visualización personal de forma rápida al iniciar la app.
*   **Distribución de Layout (Flex/Grid):**
    *   Pantalla completa centrada vertical y horizontalmente (`flex flex-col items-center justify-center`).
    *   Contenedor principal con margen de seguridad del 5%.
*   **Componentes Clave:**
    *   **Título Principal:** "Quién está viendo" (Texto centrado, de 48px, peso *semibold*, color blanco).
    *   **Fila de Perfiles:** Grid horizontal de hasta 5 tarjetas de perfil (`grid grid-cols-5 gap-8 max-w-5xl mt-12`).
    *   **Tarjeta de Perfil (Foco Activo):**
        *   Avatar: Imagen cuadrada redondeada (`rounded-lg w-32 h-32 md:w-40 md:h-40 border-4 border-transparent hover:border-blue-500`).
        *   Nombre del perfil: Texto de 24px debajo del avatar, centrado.
    *   **Botón "Agregar Perfil":** Tarjeta estilizada con un icono de "+" de alta visibilidad.
    *   **Botón "Administrar Perfiles":** Ubicado en la parte inferior, centrado, con estilo de botón contorneado (`border border-zinc-600 px-6 py-3 text-lg rounded-full`).
    *   **Modal de Validación de PIN (Overlay):** Ventana emergente flotante en el centro de la pantalla si el perfil seleccionado tiene control parental/adulto. Contiene un teclado numérico virtual interactivo (filas de botones del 0 al 9, "Borrar" y "Confirmar") adaptado a D-Pad.
*   **Lógica de Navegación D-Pad:**
    *   `Izquierda` / `Derecha`: Navegar entre los avatares de perfil o el botón "+".
    *   `Abajo`: Ir al botón "Administrar Perfiles".
    *   `OK / Enter`: Acceder al perfil seleccionado o abrir el diálogo de PIN si está bloqueado.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Create a modern, high-end profile selection screen inspired by Netflix for a Smart TV app. Dark mode theme (zinc-950 background). Show a centered title "Who's watching?" in 48px bold white. Below, display a grid layout with 4 user profiles and 1 "Add Profile" button. Each profile has a rounded square avatar (160px size) and a name below. Include a "Manage Profiles" outlined button at the very bottom. Highlight the active focused profile with a 4px bright blue border, scale-105 animation, and blue outer glow. Add a responsive backdrop-blur modal overlay representing a parental control 4-digit PIN lock pad with buttons 0-9 for remote control input. Use Tailwind CSS, clean layouts, and polished glassmorphic UI elements.

---

### PANTALLA 2: Configuración Inicial e Ingesta de Listas
*   **Objetivo:** Permitir la entrada de credenciales Xtream Codes o la URL de la lista M3U, mostrando el proceso de indexación de forma clara y no bloqueante.
*   **Distribución de Layout:**
    *   Diseño dividido en dos columnas (`grid grid-cols-2 h-screen`):
        *   Columna Izquierda: Logo del reproductor en grande, fondo degradado azul/negro, y un breve resumen de los beneficios comerciales.
        *   Columna Derecha: Formulario interactivo de configuración y selección de método de ingesta.
*   **Componentes Clave:**
    *   **Selector de Tipo de Ingesta:** Pestañas superiores (`tabs`) de alto contraste: "Credenciales Xtream" y "Lista M3U / M3U8".
    *   **Formulario de Entrada:**
        *   Para Xtream: 4 campos de entrada grandes (`input` de alto de 56px con textos de 20px) para "Nombre del Servidor (URL)", "Nombre de Usuario", "Contraseña" y "Nombre de Lista".
        *   Para M3U: 1 campo para "URL de la Lista" y un botón de "Cargar Archivo Local" (.m3u/.m3u8).
    *   **Botón de Acción Principal:** "Iniciar Ingesta" (Botón de ancho completo, azul vibrante, escala aumentada al enfocarse).
    *   **Barra de Progreso de Ingesta (Overlay de Carga):** Panel translúcido superpuesto (`backdrop-blur-lg`) que aparece cuando el usuario pulsa "Iniciar Ingesta". Muestra:
        *   Título: "Procesando Lista de IPTV..."
        *   Texto Informativo Dinámico: "Indexando Películas: 4,500 / 12,000", "Buscando Canales en Vivo...", "Descargando Programas de EPG...".
        *   Barra de carga porcentual animada con degradado azul-celeste y un spinner circular de alto rendimiento.
*   **Lógica de Navegación D-Pad:**
    *   `Arriba` / `Abajo`: Navegar secuencialmente entre campos del formulario y el botón de acción principal.
    *   `Izquierda` / `Derecha`: Cambiar de pestaña (Xtream/M3U) o alternar en controles específicos.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Design a professional onboarding/setup screen for an IPTV application split into two columns. Left column: dark aesthetic gradient background with a glowing logo and key features. Right column: credentials setup form. At the top of the form, include a high-contrast Tab Selector for "Xtream Codes API" and "M3U Playlist URL". The input fields should be large (56px height, 20px text size, dark zinc-900 background, rounded borders). The main action button "Connect & Ingest" should be bright blue. When active/focused, it must scale and have a glowing blue shadow. Also, design the loading progress overlay that appears during ingestion: a centered blur-glass card with an animated gradient progress bar, loading spinner, and step-by-step progress metrics (e.g., "Indexing Live TV: 2,500 / 8,000" and "EPG Guide: 65% synced").

---

### PANTALLA 3: Home / Dashboard Principal (Live TV, VOD y Series)
*   **Objetivo:** El núcleo de la aplicación. Panel visualmente espectacular con barra lateral de navegación, héroe superior de contenido y carruseles de contenido recomendados.
*   **Distribución de Layout:**
    *   Estructura general de contenedor de pantalla completa (`flex h-screen overflow-hidden zinc-950`).
    *   **Barra Lateral de Navegación Estrecha (Sidebar):** Ancho colapsado de 80px que se expande a 260px al enfocarse.
    *   **Área de Contenido Principal:** Ocupa el espacio restante, con scroll vertical virtualizado para mantener los 60 FPS estables.
*   **Componentes Clave:**
    *   **Barra Lateral (Sidebar UI):**
        *   Elementos de menú verticales: Icono + Texto para: "Buscar", "Inicio", "Televisión en Vivo", "Películas (VOD)", "Series", "Favoritos", "Ajustes".
        *   Foco Activo: Fondo azul translúcido con barra vertical de 4px en el borde izquierdo.
    *   **Sección Héroe de Destacados (Top Hero Banner):**
        *   Ocupa el 45% superior de la pantalla. Imagen de fondo de gran impacto (Fanart de película/serie de moda) con un degradado lineal negro hacia abajo y hacia la izquierda.
        *   Superpuestos: Título gigante de la película/serie, sinopsis corta, duración, año, género, botón de "Reproducir" y botón de "Ver Detalles".
    *   **Fila de Categorías / Carruseles (Rows):**
        *   Fila 1: "Continuar Viendo" (Muestra películas o capítulos de series con una barra de progreso inferior que indica los minutos reproducidos).
        *   Fila 2: "Canales Favoritos en Vivo" (Tarjetas de canales de televisión con logotipo, nombre de canal y programa que se transmite actualmente con barra de progreso de tiempo real de EPG).
        *   Fila 3: "Películas Agregadas Recientemente" (Posters verticales de películas de alta definición con escala de 105% al enfocarse).
*   **Lógica de Navegación D-Pad:**
    *   `Izquierda` desde el contenido principal: Mueve el foco a la barra lateral de navegación.
    *   `Derecha` desde la barra lateral: Regresa al área de contenido.
    *   `Arriba` / `Abajo`: Navegar verticalmente entre las distintas filas de carruseles de contenido y el banner Héroe.
    *   `Izquierda` / `Derecha` dentro de un carrusel: Desplazar horizontalmente las tarjetas de forma fluida (*smooth scroll*).
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Develop a premium Smart TV Home Dashboard (Netflix/Apple TV style) in dark theme (zinc-950). On the left, place a collapsible navigation sidebar (icons for Search, Home, Live TV, Movies, Series, Favorites, Settings) that expands on focus with a glassmorphism look. The main content area has a massive Hero Banner at the top displaying a movie fanart with a linear gradient mask to black at the bottom. The Hero section includes the title, meta-information, a short description, "Play" button, and "More Info" button. Below the hero, design 3 horizontal carousels: 1. "Continue Watching" cards with a bottom red progress bar showing playback percentage; 2. "Live Channels" cards displaying channel logos and the current live program with a EPG timeline; 3. "Recent VOD" cards with vertical high-quality poster images. Focused elements must scale up by 1.05 and display a distinct glowing blue border.

---

### PANTALLA 4: Vista de Detalles del Contenido (Ficha Técnica VOD/Serie)
*   **Objetivo:** Mostrar la información de metadatos completa de una película o serie seleccionada, junto con su lista de capítulos organizada si es una serie.
*   **Distribución de Layout:**
    *   Fondo de pantalla completa basado en la imagen Fanart de la película en tono oscuro y desenfocado (`backdrop-blur-xl bg-black/80`).
    *   Dos paneles bien definidos (`grid grid-cols-12 gap-8 p-12 h-screen overflow-hidden`):
        *   Panel Izquierdo (3 columnas): Póster vertical grande en alta resolución (`rounded-2xl border border-zinc-800`).
        *   Panel Derecho (9 columnas): Título, descripción y paneles interactivos de episodios.
*   **Componentes Clave:**
    *   **Ficha de Información:**
        *   Título de película/serie (Texto de 48px en negrita blanca).
        *   Fila de metadatos de 20px: Año (ej. `2025`), Calificación por edades (ej. `PG-13`), Duración total (`2h 14m` o `4 Temporadas`), Género (`Ciencia Ficción`), Calidad de video (etiqueta brillante de `4K HDR`).
        *   Sinopsis completa (Texto de 22px de alto contraste, espaciado amplio).
    *   **Grupo de Botones de Acción (Fila horizontal):**
        *   Botón "Reproducir / Reanudar en [Minuto Exacto]".
        *   Botón "Agregar a Favoritos" (icono de estrella/corazón).
        *   Botón "Bloquear Categoría" (PIN de control parental).
    *   **Selector de Episodios para Series (Sección Inferior):**
        *   Pestañas de Temporadas: Botones deslizables en horizontal para seleccionar "Temporada 1", "Temporada 2", etc.
        *   Carrusel o Grid de Episodios: Lista vertical o carrusel horizontal con tarjetas de episodios que muestran:
            *   Imagen en miniatura de alta resolución del episodio.
            *   Número y nombre del episodio (ej. "Ep. 1 - El Comienzo").
            *   Indicador visual de "Visto" (icono de check o barra de reproducción al 100%).
*   **Lógica de Navegación D-Pad:**
    *   `Izquierda` / `Derecha`: Alternar entre los botones principales ("Reproducir", "Favoritos").
    *   `Abajo`: Ir a la sección de selección de Temporadas.
    *   `OK / Enter` en Temporada: Cambia la lista de episodios que se muestra abajo.
    *   `Abajo` desde las temporadas: Entrar al grid de capítulos y usar flechas para navegar en él.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Create an immersive Movie/Series Detail Screen for a TV streaming app. The background should be a blurred, dimmed version of the show's fanart with a dark overlay. On the left column, display a large, beautifully styled vertical poster (rounded-2xl). On the right column, show the Title (48px bold), meta tags (Year, Rating, Duration, Genre, 4K HDR badge), and a detailed synopsys. Below the info, place a horizontal row of action buttons: a primary blue "Resume at 1h 22m" (or "Play" if unwatched) and a secondary "Add to Favorites" button. Below this, design a dedicated "Series Episode Selector": a horizontal slider for choosing "Season 1, Season 2, Season 3" as clean tabs, and below it, a row of episode cards showing thumbnail previews, episode numbers, titles, and a green checkmark icon for "Watched" episodes. Make focused items highly visible with blue ring animations and smooth scale changes.

---

### PANTALLA 5: OSD del Reproductor de Video (Controles en Pantalla)
*   **Objetivo:** Interfaz transparente superpuesta que aparece al interactuar en reproducción para controlar el estado del video, audio, subtítulos y saltar capítulos.
*   **Distribución de Layout:**
    *   Fondo de video en vivo o película reproduciéndose en pantalla completa.
    *   OSD transparente superpuesto que ocupa la parte inferior y superior de la pantalla (`flex flex-col justify-between h-screen p-12 bg-gradient-to-t from-black/90 via-black/40 to-black/80`).
*   **Componentes Clave:**
    *   **Barra Superior del OSD:**
        *   Botón "Atrás" (con icono de flecha grande).
        *   Título del canal/película/capítulo reproduciéndose y metadatos breves de resolución/pistas activas.
    *   **Barra de Progreso Central/Inferior (Para VOD):**
        *   Barra de progreso de ancho completo con indicador de búfer de red cargado.
        *   Tiempos de reproducción en los extremos (`01:24:55 / 02:15:00`).
    *   **Fila de Controles de Reproducción (Debajo de la barra de progreso):**
        *   Botones circulares grandes con iconos de alto contraste: "Retroceder 10s", "Play/Pausa" (el botón central, más grande), "Avanzar 10s", "Subtítulos/Audio", "Relación de Aspecto (Aspect Ratio)", "Bloqueo Parental".
    *   **Panel de Selección de Audio y Subtítulos (Menú Desplegable Flotante):**
        *   Menú superpuesto con dos listas verticales: "Pistas de Audio" (Español Latino, Inglés, Portugués) y "Subtítulos" (Apagado, Español, Inglés).
    *   **Notificación "Siguiente Episodio" (Al 95% de reproducción):**
        *   Tarjeta interactiva en la esquina inferior derecha que muestra una cuenta regresiva de 10 segundos y un botón enfocado para saltar de inmediato al próximo episodio.
*   **Lógica de Navegación D-Pad:**
    *   `Izquierda` / `Derecha`: Moverse entre los botones del reproductor o deslizarse por la barra de tiempo (Seek) si está enfocada.
    *   `Arriba` / `Abajo`: Alternar entre la barra de tiempo superior, controles inferiores o menú flotante de audio/subtítulos.
    *   **Ocultación Automática:** Los controles deben transicionar de opacidad (`opacity-0`) tras 4 segundos sin pulsaciones en el D-Pad.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Design an On-Screen Display (OSD) overlay player interface for an IPTV app. The background is a full-screen running video (mock with a beautiful image). Overlay a dark gradient overlay (black at the top and bottom, transparent in the middle). Top Bar: Left aligned back arrow, and centered movie/channel title. Bottom Area: Full-width interactive progress timeline (timeline thumb, loaded buffer area, current time vs total time). Under the timeline, place centered playback control buttons: Rewind 10s, Play/Pause (large center circle), Fast Forward 10s, Audio & Subtitle track selector, and Aspect Ratio toggle (16:9, 4:3, Zoom). To the right, include a floating card overlay representing a "Next Episode in 10s..." countdown prompt with a focused "Watch Now" button. Also mockup the "Audio & Subtitles" modal menu on top of the player, showing a dual-column list of audio tracks and subtitle options.

---

### PANTALLA 6: Guía EPG Interactiva / TV Guide (Zapping Overlay)
*   **Objetivo:** Permitir al usuario ver la parrilla de canales de TV y programación en tiempo real mientras se sigue reproduciendo la señal de video actual en miniatura o segundo plano.
*   **Distribución de Layout:**
    *   Diseño dividido en dos paneles principales:
        *   Panel Lateral Izquierdo (35% de ancho): **Mini-Player interactivo** que reproduce el canal actual en vivo, y debajo una tarjeta de detalles del programa seleccionado (Título, descripción del show, horario y porcentaje de emisión transcurrido).
        *   Panel Derecho (65% de ancho): Cuadrícula (EPG Grid) con la guía de programación interactiva.
*   **Componentes Clave:**
    *   **Mini-Player en Vivo:** Recuadro flotante de alta fidelidad que muestra la señal actual reducida de escala sin cortes.
    *   **Cuadrícula de Canales y Programación (EPG Grid):**
        *   Fila superior: Indicadores de tiempo horizontales (ej. `18:00`, `18:30`, `19:00`, `19:30`).
        *   Filas verticales de canales: Cada fila contiene:
            *   La cabecera del canal: Logotipo del canal y número en el extremo izquierdo.
            *   Bloques de programas: Cajas con el nombre del show cuyo ancho es proporcional a su duración en el tiempo de la EPG. El programa que se transmite *ahora* tiene un indicador visual del tiempo transcurrido.
    *   **Indicador de Foco:** El bloque de programa enfocado se resalta en azul eléctrico con bordes brillantes y expande una tooltip o tarjeta con la sinopsis del programa.
*   **Lógica de Navegación D-Pad:**
    *   `Arriba` / `Abajo`: Navegar verticalmente a través de la lista de canales.
    *   `Izquierda` / `Derecha`: Desplazarse horizontalmente en el tiempo para ver programas anteriores o futuros en la EPG.
    *   `OK / Enter`: Cambiar la señal del mini-player al canal seleccionado o expandir los detalles del programa.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Create a professional interactive EPG (Electronic Program Guide) grid screen for a Live TV app. Split-screen layout. Left Panel (35%): A sleek Mini-Player scaling and playing the active stream in real-time, with a program info card below it (showing Title, Description, Star rating, Time remaining, and progress bar). Right Panel (65%): A horizontal timeline showing hour markers (e.g., 8:00 PM, 8:30 PM, 9:00 PM) at the top, and a grid of channels. Each channel row starts with its Logo and channel number, followed by horizontal boxes representing TV programs with widths proportional to their duration. Highlight the currently selected program block with a bright glowing blue border and subtle scale-up effect. The overall aesthetic must be high-contrast, dark (zinc-950), clean, and optimized for remote control navigation.

---

### PANTALLA 7: Buscador Global
*   **Objetivo:** Permitir búsquedas predictivas rápidas de canales en vivo, series y películas utilizando un teclado virtual optimizado.
*   **Distribución de Layout:**
    *   Dividido en dos columnas principales (`grid grid-cols-12 gap-8 p-12 h-screen`):
        *   Panel de Teclado (5 columnas): Entrada de texto e interfaz del teclado virtual QWERTY.
        *   Panel de Resultados (7 columnas): Resultados de búsqueda categorizados en tiempo real con scroll virtualizado.
*   **Componentes Clave:**
    *   **Entrada de Búsqueda:** Caja de texto grande (`input` de 64px con lupa y placeholder "Buscar canales, películas o series...").
    *   **Teclado Virtual (QWERTY Layout):**
        *   Grid interactivo de botones cuadrados redondeados (`grid grid-cols-10 gap-2`).
        *   Incluye caracteres del abecedario, fila de números, espacio, barra espaciadora, botón de "Retroceso (Delete)" y botón de "Limpiar Todo".
        *   Teclas del teclado virtual con un indicador de foco claro al navegar por ellas con el D-Pad.
    *   **Panel de Resultados (Categorizado con Debounce):**
        *   Sección 1: "Televisión en Vivo" (Grid horizontal con tarjetas de canales con su logotipo).
        *   Sección 2: "Películas" (Posters verticales en miniatura).
        *   Sección 3: "Series" (Posters verticales).
        *   Si no hay resultados: Mensaje limpio con icono ilustrativo "No se encontraron coincidencias".
*   **Lógica de Navegación D-Pad:**
    *   `Arriba` / `Abajo` / `Izquierda` / `Derecha`: Moverse entre las teclas del teclado virtual.
    *   Al presionar `Derecha` desde el borde del teclado: Salta el foco directamente al panel de resultados para poder seleccionar un canal o película encontrada.
    *   Al presionar `Izquierda` desde los resultados: El foco vuelve a la última tecla activa del teclado.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Design a global Search Screen for a TV streaming application. Layout is split into two sections. Left section: A fully responsive virtual QWERTY keyboard grid designed for remote control use (large square keys, rounded-lg, clear letter labels, special keys for Space, Backspace, Clear). Above the keyboard, place a prominent search input field with a search icon and a pulsing placeholder text. Right section: Real-time search results organized in vertical categories: "Live TV (Channels)", "Movies (VOD)", and "Series". Show cards for each category (logos for live TV, vertical posters for VOD and series). Highlight the focused key on the keyboard with an orange/amber glow background and scale-105 effect, and ensure there is an easy visual pathway to navigate focus from the keyboard keys to the search results cards on the right.

---

### PANTALLA 8: Configuración / Ajustes (Settings)
*   **Objetivo:** Panel centralizado para administrar las preferencias del usuario, la seguridad parental, la calidad de transmisión y visualizar el estado del licenciamiento.
*   **Distribución de Layout:**
    *   Estructura clásica de dos columnas (`flex h-screen overflow-hidden p-12 zinc-950`):
        *   Menú de Ajustes Izquierdo (3 columnas): Lista vertical de categorías.
        *   Detalle de Ajustes Derecho (9 columnas): Formulario o listado de opciones de la categoría seleccionada.
*   **Componentes Clave:**
    *   **Menú Lateral de Ajustes:**
        *   Categorías: "Control Parental", "Calidad de Video", "Sincronización EPG", "Licencia y Activación", "Acerca de".
        *   Foco activo de categoría: Fondo gris con indicador de borde brillante.
    *   **Panel de Ajuste Derecho (Contenido Dinámico):**
        *   *Vista Control Parental:* Alternancia (*Switch toggle*) de "Ocultar contenido para adultos", botón de "Cambiar PIN maestro", y una lista de verificación de categorías específicas para ocultar completamente en la app.
        *   *Vista Calidad de Video:* Selector múltiple de calidad por defecto (`Bajo (SD)`, `Medio (HD)`, `Automático / Premium (4K HDR)`), y ajustes de códec con aceleración por hardware.
        *   *Vista Licencia y Activación (Basada en HWID):*
            *   Muestra el código único de identificación de hardware (*Hardware ID / HWID*): `HWID-WIN-XXXXXXXXXXXX` en una tarjeta de estilo tecnológico con botón de "Copiar al Portapapeles".
            *   Indicador de estado de la licencia: "Licencia de Prueba (3 días restantes)" en amarillo, o "Licencia Premium de por Vida" con un icono de verificación dorado en verde.
            *   Campo de entrada de texto grande para ingresar una nueva clave de licencia de activación.
*   **Lógica de Navegación D-Pad:**
    *   `Arriba` / `Abajo`: Navegar entre las categorías de ajustes en la columna izquierda.
    *   `Derecha` / `OK`: Mover el foco al panel de opciones de la derecha para modificar valores, presionar botones o escribir textos.
    *   `Izquierda` desde el panel derecho: Regresar al menú de categorías principal.
*   **Prompt para Maquetador de IA (v0.dev / Bolt.new):**
    > *English:* Build a clean TV Settings Interface in dark mode. On the left side, place a vertical category menu containing options: "Parental Control", "Playback Quality", "EPG Sychronization", "Licensing & Activation", and "About Us". On the right side, design the details panel based on the selected category. For "Licensing & Activation", display a sci-fi styled card containing the user's Hardware ID (HWID-WIN-A73B90FC) with a "Copy ID" button, a subscription status badge ("Premium Lifetime" in green or "Trial - 3 Days Left" in amber), and a text input field to "Enter License Key" with an activation action button. For "Parental Control", show switch toggles for hiding adult categories and a button to "Reset 4-Digit PIN". Ensure all focused UI components have a high-contrast glowing blue ring and scale animations.

---

## 🚀 CÓMO USAR ESTA GUÍA CON LA IA DE MAQUETACIÓN
1.  **Selecciona una pantalla:** Decide qué vista quieres maquetar primero.
2.  **Copia el Prompt de Copiado Directo:** Hemos optimizado los prompts en inglés porque los generadores de frontend con IA (como *v0.dev* de Vercel, *Bolt.new* o *Claude Sonnet*) interpretan con mayor precisión los detalles de diseño y las convenciones de Tailwind CSS cuando reciben las instrucciones en este idioma.
3.  **Genera la UI:** Pega el prompt en la herramienta de IA.
4.  **Refina la interactividad:** Utiliza las secciones de "Lógica de Navegación D-Pad" de esta guía para indicarle a la IA qué eventos de teclado de flechas (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`) debe interceptar en React para mover los estados de enfoque de forma nativa.
