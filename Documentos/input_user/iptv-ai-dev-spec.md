# SUITE DE ESPECIFICACIONES TÉCNICAS Y DISEÑO (COMMERCIAL-READY)
## GUÍA MAESTRA PARA AGENTES DE DESARROLLO DE IA

Este documento compila de forma exhaustiva, modular y aislada la documentación profesional requerida para que los agentes de IA programen el **Reproductor IPTV de Próxima Generación**. Cada documento contiene definiciones precisas, estructuras de datos, diagramas lógicos, ejemplos de código e instrucciones paso a paso para evitar cualquier desviación en el desarrollo.

---

## ÍNDICE DE DOCUMENTOS

*   **DOC-1: PRD Técnico Consolidado y Casos de Uso Críticos**
*   **DOC-2: Guía de Arquitectura de Datos e Indexación Asíncrona**
*   **DOC-3: Especificación de Ingesta (M3U/M3U8 & XMLTV/EPG)**
*   **DOC-4: Especificación de Diseño UI/UX y Control de Foco (10-Foot UI)**
*   **DOC-5: Protocolo de Reproducción de Video y Resiliencia de Red**
*   **DOC-6: Módulo de Licenciamiento Comercial y Seguridad HWID**
*   **DOC-7: Matriz de Pruebas Automatizadas y Criterios de Aceptación**
*   **DOC-8: Especificación de Enriquecimiento de Metadatos con TMDB**

---

# DOC-1: PRD TÉCNICO CONSOLIDADO Y CASOS DE USO CRÍTICOS

Este documento define la visión, alcances, arquitectura multiplataforma y los flujos de interacción obligatorios para el MVP.

### 1.1 Visión del MVP e Identidad
*   **Producto:** Reproductor IPTV Comercial premium, estilizado y optimizado al nivel de gigantes OTT como Netflix.
*   **Enfoque Primario:** Eliminar por completo los bloqueos, fugas de memoria y congelamientos al procesar listas masivas (+20,000 canales/VOD).
*   **Fase 1 (MVP):** Aplicación de escritorio comercial para **Windows Desktop** utilizando el stack **Electron + React + TypeScript**.
*   **Fases Futuras:** Arquitectura preparada para migrar a Smart TVs (LG webOS, Samsung Tizen) y móviles (Android TV/Fire TV, iOS) usando Capacitor o React Native.

### 1.2 Reglas de Negocio (Ingesta de Contenido)
La aplicación debe admitir dos modalidades de configuración inicial:
1.  **Credenciales Xtream Codes:** `Servidor (URL)`, `Usuario`, `Password`.
2.  **Lista M3U / M3U8:** Por URL remota o archivo local `.m3u` / `.m3u8`.

El sistema gestionará de manera aislada y estructurada 3 categorías principales de ingesta de contenido:
*   **Televisión en Vivo (Live TV):** Canales con soporte para Guía Electrónica de Programación (EPG) con zapping de baja latencia (cambio de canal en < 2 segundos) y overlay dinámico.
*   **Películas (VOD):** Catálogo visual interactivo con carátulas, descripción, año, duración, género y sistema de reanudación automática de video en el minuto exacto donde el usuario pausó o detuvo la reproducción.
*   **Series (VOD Series):** Organización jerárquica obligatoria de tres niveles: `Serie > Temporadas > Episodios`. Ficha detallada con fanart, sinopsis, marcado de episodios vistos y botón de "Siguiente Episodio" automatizado cuando la reproducción del episodio actual alcance el 95% de su duración.

---

### 1.3 Casos de Uso Críticos y Flujos de Interacción

#### CU-01: Gestión Multi-Perfil ("¿Quién está viendo?")
*   **Flujo Principal:**
    1. Al iniciar la aplicación, se despliega una pantalla inicial similar a Netflix preguntando: *¿Quién está viendo?*
    2. El usuario puede crear, editar o seleccionar hasta 5 perfiles distintos.
    3. Cada perfil almacena sus propios datos de forma completamente aislada en la base de datos local:
        *   Lista de Favoritos (canales, películas y series).
        *   Historial de reproducción (incluyendo los minutos exactos de pausa en VOD).
        *   Preferencias de idioma de interfaz y subtítulos.
*   **Restricción para la IA:** No persistir configuraciones globales en texto plano o LocalStorage común. Utilizar base de datos relacional local indexada por `profile_id`.

#### CU-02: Configuración e Ingesta de Listas en Segundo Plano
*   **Flujo Principal:**
    1. El usuario introduce credenciales Xtream o URL de lista M3U.
    2. La aplicación lanza un *Web Worker* de fondo para descargar e indexar los datos en una base de datos local (SQLite o IndexedDB).
    3. Mientras la ingesta ocurre, la interfaz de usuario se mantiene 100% activa y fluida. Se muestra una barra de progreso no bloqueante e informativa con el número de elementos parseados e indexados (por ejemplo: `Indexando Películas: 4,500 / 12,000`).
*   **Restricción para la IA:** Cualquier bloqueo del hilo de renderizado principal (UI Thread) de más de 50ms durante la carga de la lista resultará en el rechazo de la prueba.

#### CU-03: Control Parental Avanzado y Categorías Invisibles
*   **Flujo Principal:**
    1. En el panel de Ajustes, el usuario puede configurar un PIN maestro de 4 dígitos.
    2. El usuario puede seleccionar qué categorías (por ejemplo, "Adultos", "Noticias") desea bloquear.
    3. Al activar el bloqueo, los canales y contenidos pertenecientes a esas categorías se vuelven **totalmente invisibles** en toda la aplicación (no aparecen en búsquedas, menús, carruseles ni guías).
    4. Para volverlas visibles o reproducir el canal, la aplicación debe solicitar la validación del PIN maestro a través de un diálogo superpuesto con teclado numérico adaptado a control remoto (D-Pad).
*   **Restricción para la IA:** Los datos protegidos no deben enviarse de forma visible al renderizador de UI. El filtrado debe ocurrir a nivel de base de datos (`WHERE is_locked = 0` por defecto en las consultas del perfil activo).

#### CU-04: Player OTT Comercial y Superposición (OSD)
*   **Flujo Principal:**
    1. Al reproducir VOD o Live TV, la barra de navegación y controles de reproducción (On-Screen Display - OSD) aparecen superpuestos con una animación suave y transparente.
    2. El OSD debe incluir:
        *   Barra de progreso de reproducción interactiva (para VOD).
        *   Botón para seleccionar pistas de Audio y Subtítulos disponibles en el flujo (HLS/TS).
        *   Selector de relación de aspecto en tiempo real: `16:9`, `4:3`, `Zoom`, `Ajustar a Pantalla`.
        *   Botón de "Siguiente Episodio" (para series) que se activa automáticamente al llegar al 95% de la duración del video actual.
*   **Restricción para la IA:** Los controles OSD deben ocultarse automáticamente tras 4 segundos de inactividad de las teclas físicas o del puntero.

#### CU-05: Navegación EPG y Zapping Ultrarrápido
*   **Flujo Principal:**
    1. Durante la reproducción de televisión en vivo (Live TV), al pulsar la tecla `OK` o `Enter` del control remoto o teclado, se despliega un overlay lateral semitransparente con la guía de canales y la programación de televisión en vivo actual y futura (EPG).
    2. El video en vivo actual se sigue reproduciendo en segundo plano o se escala de forma fluida a un cuadro miniatura lateral (*Mini-Player / Picture-in-Picture*).
    3. El usuario puede navegar de manera rápida (Zapping) usando las flechas `Arriba` y `Abajo` de su control. Al seleccionar un nuevo canal, la previsualización del video y audio debe iniciarse en menos de 2 segundos.
*   **Restricción para la IA:** No debe detenerse la reproducción del canal anterior hasta que se confirme la carga exitosa del nuevo segmento de video.

#### CU-06: Búsqueda Global en Tiempo Real
*   **Flujo Principal:**
    1. El usuario accede a la sección de Búsqueda.
    2. Se despliega un teclado virtual QWERTY optimizado para control remoto.
    3. A medida que el usuario ingresa caracteres, la aplicación realiza consultas inmediatas e indexadas sobre la base de datos local (Live TV, Películas y Series en simultáneo).
    4. Los resultados se muestran de inmediato organizados por secciones visuales.
*   **Restricción para la IA:** Aplicar obligatoriamente un *debounce* de 250ms antes de consultar la base de datos para no saturar las llamadas por cada pulsación de tecla.

---

# DOC-2: ARQUITECTURA DE DATOS E INDEXACIÓN ASÍNCRONA

Este documento especifica cómo procesar e indexar listas masivas de IPTV en segundo plano para evitar congelamientos en la UI.

### 2.1 Procesamiento Fuera del Hilo Principal (Web Workers)
Para asegurar que la interfaz del reproductor responda de forma instantánea a los comandos del usuario (manteniendo una tasa de refresco constante de 60 FPS), se prohíbe realizar operaciones de descarga, análisis de texto e inserción en base de datos en el hilo principal de React.

*   **Lógica de Ingesta:**
    1.  La UI de Electron recolecta los datos de configuración (URL de M3U o credenciales Xtream).
    2.  Se instancia un **Web Worker** en segundo plano enviando los parámetros de inicialización.
    3.  El Web Worker ejecuta la llamada de red (`fetch` o descarga por streams) para obtener el archivo M3U o consultar la API de Xtream.
    4.  El Web Worker procesa el texto en chunks (bloques), aplicando el parser para estructurar la información.
    5.  A medida que el worker genera objetos estructurados, los inserta de manera secuencial en la base de datos local.
    6.  El Web Worker emite eventos periódicos de progreso a la UI de React para actualizar la barra de progreso no bloqueante.

```
+------------------------------------+
|            Hilo de UI              | (React - 60 FPS fluidos)
+-----------------+------------------+
                  | (1. Iniciar)
                  v
+-----------------+------------------+
|           Web Worker               | (Descargas, Parsing, Procesamientos)
+-----------------+------------------+
                  | (2. Descarga de M3U/EPG por fragmentos)
                  | (3. Parsing en Chunks de texto)
                  v
+-----------------+------------------+
|   Base de Datos (IndexedDB/OPFS)   | (Inserción masiva asíncrona)
+------------------------------------+
```

### 2.2 Almacenamiento Local y Base de Datos (IndexedDB + OPFS)
Para garantizar búsquedas instantáneas y lecturas rápidas sin saturar la memoria RAM del sistema con archivos de 200MB de texto en bruto, utilizaremos **IndexedDB** como capa de almacenamiento local del navegador, combinado con el **Origin Private File System (OPFS)** para el caching de datos de rendimiento crítico (como imágenes de carátulas o archivos temporales de EPG).

*   **Pautas de Optimización:**
    *   **Utilizar transacciones masivas (*bulk transactions*):** Al escribir registros, agrupar las inserciones en lotes de 1,000 registros para optimizar el rendimiento de escritura de IndexedDB y evitar bloquear el hilo del motor de almacenamiento.
    *   **Indexación obligatoria:** Definir índices para las búsquedas frecuentes: `id`, `name` (para búsquedas globales), `group-title` (para filtrado de categorías), y `profile_id` (para aislamiento de perfiles).

### 2.3 Estrategia de Auto-Purga de Memoria y Caching
Para mitigar fugas de memoria causadas por la renderización de miles de carátulas de películas y logotipos de canales de TV, se debe programar un Worker de Telemetría interno:
1.  **Monitoreo Activo:** El Worker consulta periódicamente el uso de memoria RAM asignada a la aplicación Electron.
2.  **Criterio de Auto-Purga:** Si el uso de memoria del renderizador supera el 80% de la capacidad o 1.2 GB de RAM dedicados:
    *   Se disparará una purga automática del estado de React que mantenga en memoria únicamente las carátulas que están en la vista actual (Viewport).
    *   Se limpiará la caché temporal de imágenes cargadas dinámicamente y se forzará la recolección de basura (*Garbage Collection*).

### 2.4 Paginación y Virtualización de Listas de la Interfaz
No renderizar más componentes DOM de los que caben en la pantalla física. 
*   **Virtualización Obligatoria:** Utilizar librerías de virtualización de listas (como `react-window` o `react-virtualized`).
*   Esto garantiza que, independientemente de si la lista de canales contiene 30 o 30,000 elementos, la interfaz solo renderice en el DOM los ~10 elementos actualmente visibles para el usuario en la cuadrícula o carrusel, logrando transiciones instantáneas a un costo mínimo de CPU/GPU.

---

# DOC-3: ESPECIFICACIÓN TÉCNICA DE INGESTA (M3U & XMLTV/EPG)

Este documento especifica cómo realizar la integración de listas M3U y de las Guías de Programación (EPG) con alto rendimiento.

### 3.1 Integración del Parser M3U (`iptv-m3u-playlist-parser`)
Se requiere el uso de la librería especializada **`iptv-m3u-playlist-parser`** por su robustez, soporte de tags IPTV estándar de la industria, tipado estricto en TypeScript y bajo consumo de recursos.

#### Estructura del Objeto de Entrada Esperada por la IA:
```typescript
interface Entry {
  name: string;
  url: string;
  duration?: number;
  group?: string[];
  tvg?: {
    id?: string;
    name?: string;
    logo?: string;
    chno?: string;
  };
  http?: {
    userAgent?: string;
    referer?: string;
    cookie?: string;
    headers?: Record<string, string>;
  };
  attrs: Record<string, string>;
  kind?: 'live' | 'movie' | 'series' | 'radio';
  series?: {
    seriesName?: string;
    season?: number;
    episode?: number;
  };
}
```

### 3.2 Heurísticas de Clasificación de Contenido
Los agentes de IA deben programar un pipeline de clasificación de contenido de 6 etapas, heredado de las mejores prácticas de reproductores de producción, para determinar automáticamente si un canal de la lista M3U es televisión en vivo, película o serie:

1.  **Etapa 1: Análisis de Atributos del Tag M3U:** Identificar propiedades específicas como `streamType` o campos del tag que indiquen `vod` o `live`.
2.  **Etapa 2: Análisis del Grupo (`group-title` o `#EXTGRP`):** Búsqueda de palabras clave específicas multilingües (Inglés, Español, Alemán, Francés, Árabe, Turco):
    *   **Palabras clave de Películas/VOD:** `"películas"`, `"movies"`, `"cinema"`, `"vod"`, `"filme"`, `"filmler"`.
    *   **Palabras clave de Series:** `"series"`, `"diziler"`, `"temporadas"`, `"seasons"`, `"episodios"`.
    *   **Palabras clave de Radio:** `"radio"`, `"fm"`, `"podcasts"`.
3.  **Etapa 3: Patrones de Nombre:** Búsqueda en el nombre del elemento de patrones de temporadas y episodios (ej. `S01E02`, `1x02`, `Season 1 Episode 2`) para catalogarlo automáticamente como serie.
4.  **Etapa 4: Rutas y Estructuras del URL:** Analizar si el URL contiene `/movie/` o `/series/` (característico de servidores Xtream Codes).
5.  **Etapa 5: Detección de HLS y Extensiones de Archivo:** Tratar flujos finalizados en `.m3u8` o flujos en vivo adaptativos de manera conservadora como canales de TV en vivo (`live`), a menos que existan señales fuertes de que se trate de archivos de video estático.
6.  **Etapa 6: Fallback por Defecto:** Clasificar como televisión en vivo si ninguna de las etapas anteriores genera una coincidencia con VOD o series.

### 3.3 Procesamiento e Integración Ultra Rápida de EPG (`@iptv/xmltv`)
Para sincronizar las guías de programación sin impactar el zapping ni el rendimiento general, se utilizará el parser **`@iptv/xmltv`** en un Web Worker en segundo plano.

#### Características Clave del Parser XMLTV:
*   **Alta Velocidad:** Capaz de parsear guías pesadas con 100,000 programas programados en un promedio de **342 milisegundos**.
*   **Enriquecimiento en una sola llamada:** Mapear de manera automática el `tvg-id` de la lista M3U con el `channel id` del archivo de la guía XMLTV utilizando las utilidades de coincidencia inteligente de texto para asociar de forma directa la programación del canal en curso.

```typescript
import { parseXmltv } from '@iptv/xmltv';
import { linkEpgData } from 'iptv-m3u-playlist-parser';

// Flujo a programar por la IA en el Worker
const epgRawData = await fetchEpg(epgUrl);
const parsedEpg = parseXmltv(epgRawData); // Genera colecciones de canales y programas
const playlistWithEpg = linkEpgData(playlistParsedData, parsedEpg);
```

---

# DOC-4: ESPECIFICACIÓN DE DISEÑO UI/UX Y CONTROL DE FOCO (10-FOOT UI)

Este documento detalla los requerimientos ergonómicos de diseño para pantallas de televisión a distancia y la lógica de interacción del control remoto.

### 4.1 Principios del Enfoque 10-Foot UI (Diseño de 10 pies)
*   **Contexto:** El usuario se encuentra sentado cómodamente en un sofá a una distancia promedio de 3 metros (10 pies) de la pantalla.
*   **Legibilidad Tipográfica:**
    *   **Fuente por Defecto:** Roboto (optimizada por Google para Smart TVs) o fuentes sans-serif sólidas sin florituras ni adornos.
    *   **Tamaño Mínimo:** 22 píxeles para el texto del cuerpo de menor jerarquía; títulos y etiquetas principales entre 28px y 48px.
    *   **Espaciado de Línea:** Incrementar entre un 20% y un 30% respecto al estándar web convencional para evitar superposiciones.
*   **Simplicidad Visual:** Priorizar carátulas grandes e iconografía descriptiva sobre textos largos. Generar espacios en blanco abundantes para guiar visualmente al usuario.

### 4.2 Safe Areas (Márgenes de Seguridad contra Overscan)
Debido a que muchas pantallas de televisión antiguas o configuraciones predeterminadas recortan los bordes de la señal de video externa (fenómeno de *overscan*), es obligatorio mantener un margen de seguridad interno en el que no se ubique ningún elemento crítico de la interfaz (como menús, botones, textos informativos o estados de carga).

*   **Pauta Estricta para la IA:**
    *   **Márgen General:** Mantener un área de exclusión de al menos el **5% de margen** en los bordes totales de la pantalla.
    *   En resoluciones de TV estándar, esto equivale a mantener un mínimo de **27 píxeles** de resguardo desde los bordes superior/inferior, y **48 píxeles** desde los bordes izquierdo/derecho.
    *   Usar las zonas exteriores de *overscan* exclusivamente para fondos de pantalla o texturas decorativas secundarias que puedan recortarse sin afectar la experiencia de uso.

```
+-------------------------------------------------+
|  Overscan Zone (Fondo decorativo únicamente)    |
|   +-----------------------------------------+   |
|   |  Safe Area (Margen 5%)                  |   |
|   |  (Menús, textos, reproductor, botones)  |   |
|   |                                         |   |
|   |                                         |   |
|   |                                         |   |
|   |                                         |   |
|   |                                         |   |
|   +-----------------------------------------+   |
+-------------------------------------------------+
```

### 4.3 Navegación y Gestión del Foco Espacial (D-Pad)
El usuario interactúa exclusivamente con la cruceta del control remoto (flechas arriba, abajo, izquierda, derecha y selección de botón central / D-Pad). Es inadmisible requerir el movimiento libre de un puntero estilo mouse sobre la pantalla para operar la aplicación.

*   **Integración de Librería de Foco:** Utilizar de manera obligatoria la librería de código abierto **`Norigin Spatial Navigation`** (o `react-tv-space-navigation`).
*   **Lógica de Navegación de la IA:**
    1.  **Inicialización:** Registrar el contenedor raíz y definir el nodo interactivo con foco inicial por defecto (por ejemplo, el primer ícono del menú lateral al iniciar, o la primera carátula del carrusel).
    2.  **Hooks de Foco:** Envolver todos los elementos interactivos (botones, carátulas, categorías, canales) utilizando el hook declarativo correspondiente (`useFocusable`).
    3.  **Indicador de Foco Altamente Visible:** Definir estilos de foco en CSS acelerados por hardware (por ejemplo, transiciones de escala de 1.05x, bordes brillantes de color de contraste y sombras suaves) para que el usuario identifique al instante y sin dudas qué elemento tiene el foco actual en pantalla.
    4.  **Recuperación y Redirección del Foco:** Configurar directrices específicas para evitar "callejones sin salida" de navegación. Si se elimina un elemento de la vista (como al ocultar el overlay lateral de la guía de televisión), se debe re-direccionar el foco principal de forma inmediata al reproductor de video de fondo de manera programática.

---

# DOC-5: PROTOCOLO DE REPRODUCCIÓN DE VIDEO Y RESILIENCIA DE RED

Este documento detalla la configuración técnica del motor de reproducción de video y las políticas automáticas de recuperación de red.

### 5.1 Motor de Reproducción de Video
La reproducción de flujos en vivo de IPTV utiliza tecnologías web nativas embebidas dentro del motor de Chromium de Electron. El reproductor de video de la aplicación debe configurarse para soportar flujos adaptativos HLS, MPEG-DASH y flujos directos en formato HTTP TS.

*   **Librería Principal:** Utilizar **`hls.js`** en su versión estable y optimizada para producción.
*   **Configuración del Motor HLS:**
    *   **Aceleración por Hardware:** Forzar la decodificación por GPU configurando la propiedad correspondiente en el proceso principal de Electron.
    *   **Bajo Retraso:** Habilitar la propiedad `lowLatencyMode: true` y una configuración óptima de buffer de lectura intermedia (`backBufferLength: 30`) para acelerar la velocidad del zapping de canales de televisión en vivo.

### 5.2 Estrategia de Resiliencia "Anti-Freezing" (Silent Re-try)
Las señales de IPTV son propensas a experimentar inestabilidad temporal en la conexión, micro-cortes de red del proveedor o caídas de paquetes temporales. Para evitar que la aplicación se congele o muestre mensajes de error que requieran la intervención del usuario, los agentes de IA deben programar un bucle de resiliencia automatizado:

1.  **Monitoreo de Eventos de Error:** Escuchar activamente los eventos de error generados por el reproductor `hls.js`:
    ```typescript
    hls.on(Hls.Events.ERROR, (event, data) => {
       if (data.fatal) {
         handleFatalError(data);
       }
    });
    ```
2.  **Clasificación de Errores:**
    *   `NetworkErrors`: Problemas de carga de manifiesto o pérdida de conectividad HTTP.
    *   `MediaErrors`: Fallos de codificación, desincronización de audio/video o pérdida de chunks.
3.  **Bucle de Reintentos Silenciosos:**
    *   Si se detecta un error clasificado como recuperable, la aplicación debe ejecutar de forma transparente la instrucción `hls.recoverMediaError()`.
    *   Si el error es fatal o persiste la pérdida de paquetes, se iniciará una rutina de reintentos silenciosos de reconexión de red en segundo plano:
        *   **Límite de Reintentos:** Máximo **3 intentos silenciosos**.
        *   **Intervalo:** Aplicar un retraso controlado con un algoritmo de retroceso exponencial (ej. Intento 1: 1 segundo, Intento 2: 2 segundos, Intento 3: 4 segundos) para evitar saturar el servidor del proveedor.
        *   Durante esta ventana de recuperación, la interfaz del reproductor mostrará un discreto indicador visual de carga animado (*Spinner*) sobre el video actual, manteniendo los controles interactivos y el flujo normal de navegación activos.
        *   Si tras los 3 intentos es imposible restablecer el flujo, se procederá a destruir la instancia actual del reproductor, liberar los recursos asignados y notificar de manera limpia al usuario invitándole a verificar su conexión o intentar con otro canal.

---

# DOC-6: MÓDULO DE LICENCIAMIENTO COMERCIAL Y SEGURIDAD HWID

Este documento define el mecanismo de protección del software, la obtención de firmas del hardware y la validación de licencias.

### 6.1 Extracción Única de Hardware ID (HWID)
Para proteger el reproductor IPTV contra copias no autorizadas y habilitar un modelo comercial de pago único o suscripción, la aplicación debe vincular el estado de activación de cada usuario a su identificador de hardware (HWID) único de máquina.

*   **Librería Principal:** Utilizar **`node-machine-id`** dentro del proceso principal (*Main Process*) de Electron de forma segura.
*   **Mecanismo de Obtención:**
    *   La librería extrae de manera nativa y multiplataforma identificadores generados por el sistema operativo durante su instalación inicial.
    *   **En Windows:** Lee el valor de la clave `MachineGuid` dentro del registro del sistema en `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography`.
    *   **En macOS:** Consulta la propiedad `IOPlatformUUID` a través de los servicios de I/O Kit del sistema.
    *   **En Linux:** Consulta el archivo de registro en `/var/lib/dbus/machine-id`.
    *   **Ventajas de Seguridad:** El proceso se ejecuta de manera totalmente interna y transparente, no requiere privilegios de administración (elevados de Root o Administrator) y se mantiene inalterable ante el reemplazo de componentes comunes de hardware (como memoria RAM o disco secundario).

### 6.2 Flujo de Activación y Validación
La IA debe programar la comunicación asíncrona de licenciamiento de la siguiente manera:

```
+------------------+                   +--------------------+                   +--------------------+
| Electron Client  |                   |   Tu Backend API   |                   | Base de Datos Cloud|
| (Main Process)   |                   | (Supabase/Firebase)|                   | (Licencias / HWID) |
+--------+---------+                   +---------+----------+                   +---------+----------+
         |                                       |                                        |
         | --- 1. POST /activate (Key, HWID) --> |                                        |
         |                                       | --- 2. Verificar Key e ingresar HWID ->|
         |                                       | <--- 3. OK (Licencia Vinculada) ------ |
         | <-- 4. Licencia Guardada Localmente --|                                        |
         |                                       |                                        |
```

1.  **Validación Inicial:** Al iniciar, la aplicación lee de un archivo cifrado local la clave de licencia y el HWID del dispositivo actual.
2.  **Consulta API:** Realiza una petición REST de bajo consumo hacia tu backend en Supabase o Firebase enviando la firma del HWID y la licencia.
3.  **Aprobación/Rechazo:**
    *   Si la clave coincide con el HWID registrado en la base de datos cloud, el backend responde de manera afirmativa y la aplicación se inicia con acceso completo.
    *   Si la clave ya está registrada bajo otro HWID, la petición es rechazada e impide la reproducción redirigiendo al usuario a la vista de activación.

### 6.3 Lógica de Restricción del Modo Trial (Prueba)
Si el usuario no ha adquirido una licencia comercial válida, la aplicación debe alternar de manera estricta al **Modo Trial**:
*   **Limitación de Canales:** Desplegar e indexar únicamente una lista M3U con un límite máximo de **50 canales activos**. Intentar indexar más o reproducir un canal fuera del límite bloqueará el flujo llamando a la pantalla de activación.
*   **Límite de Tiempo:** Acceso completo por **7 días corridos** contados a partir del primer inicio verificado contra el sistema de tiempo del sistema y firmas seguras almacenadas localmente.

---

# DOC-7: MATRIZ DE PRUEBAS AUTOMATIZADAS Y CRITERIOS DE ACEPTACIÓN

Este documento proporciona los casos de prueba técnica e índices métricos para automatizar la evaluación del software desarrollado por la IA.

### 7.1 Frameworks de Prueba Recomendados para la IA
*   **Pruebas Unitarias y de Integración:** **Vitest** con simulación de servicios.
*   **Pruebas End-to-End (E2E) y Rendimiento:** **Playwright** con soporte de testing para Electron de forma nativa.

---

### 7.2 Casos de Prueba Críticos y Métricas de Rendimiento para la IA

A continuación se detalla la matriz de validación que los agentes de desarrollo de IA deben cumplir rigurosamente mediante el desarrollo de suites de pruebas automáticas:

| ID de Prueba | Módulo Relacionado | Acción de Entrada de la Prueba | Criterio de Aceptación Técnico (Verificación Automatizada) | Métrica / Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| **TEST-01** | Ingesta de Listas | Ingestar un archivo M3U simulado con **20,000 elementos** usando un Web Worker dedicado. | Medir la carga de CPU y la tasa de refresco del hilo de UI principal durante el análisis. | **Rendimiento UI:** Mantener un mínimo de **55 FPS** de animación estables; tiempo de bloqueo del hilo principal < 50ms. |
| **TEST-02** | Zapping Live TV | Simular pulsación de D-Pad 'Arriba' / 'Abajo' para cambiar de canal activo en televisión en vivo. | Verificar que la inicialización del stream de video e inicio de decodificación ocurran con rapidez. | **Velocidad de carga de video:** Audio y video activos en pantalla en menos de **2.0 segundos** de latencia. |
| **TEST-03** | Control Parental | Intentar acceder a un canal que posea una categoría marcada con la regla de bloqueo por PIN maestro. | Verificar que el reproductor intercepte el flujo y muestre el panel modal de bloqueo de PIN de forma obligatoria. | **Acceso restringido:** Interrupción absoluta de decodificación y flujo de red bloqueado hasta verificar PIN maestro de 4 dígitos. |
| **TEST-04** | Resiliencia de Red | Provocar una desconexión simulada del adaptador de red (micro-corte) durante la reproducción de un flujo. | Comprobar que el sistema intercepta el error de carga de HLS y ejecuta reintentos transparentes antes de emitir fallo. | **Reconexión Automática:** Ejecución de hasta **3 reintentos secuenciales** usando retroceso exponencial silencioso antes de arrojar error. |
| **TEST-05** | Navegación D-Pad | Simular eventos de navegación por teclado / control remoto con las teclas `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`. | Validar que la librería de foco espacial determine de manera lógica la siguiente celda y aplique los estilos CSS de foco. | **Foco del Sistema:** **100% de los elementos activos** de la pantalla visible deben ser alcanzables por cruceta; sin bloqueos de foco. |
| **TEST-06** | Licenciamiento | Iniciar la aplicación simulando que la clave local o respuesta de la base de datos REST reporta licencia inválida. | Corroborar que la lógica de Electron impide iniciar los reproductores de video de fondo y renderiza la UI de compra. | **Bloqueo Seguro:** Acceso denegado a Live TV, películas y series, redirigiendo de inmediato y de forma limpia a la vista de activación. |
| **TEST-07** | Procesamiento EPG | Parsear una guía de televisión en vivo (EPG) XMLTV con **100,000 programas** asignados en segundo plano. | Comprobar el rendimiento de parsing y mapeo dinámico del catálogo de canales mediante la librería de coincidencia de ID. | **Velocidad de EPG:** Parsing y enlace de guías completado en un lapso inferior a **500 milisegundos**. |
| **TEST-08** | Control de Memoria | Cargar una lista masiva con miles de enlaces a logotipos e imágenes e inducir la carga excesiva en caché de imágenes. | Forzar un consumo superior al 80% de RAM asignada para gatillar la sub-rutina de limpieza de memoria del worker. | **Consumo Controlado:** Purga asíncrona de caché de carátulas no visibles ejecutada con éxito; retorno automático por debajo del límite. |

---

##---

# DOC-8: ESPECIFICACIÓN DE ENRIQUECIMIENTO DE METADATOS CON TMDB

Este documento define la capa de enriquecimiento asíncrono de metadatos de películas y series, alimentada por la API pública de The Movie Database (TMDB). Su objetivo es cerrar la brecha entre los datos crudos de las listas M3U/Xtream y la calidad visual exigida por los flujos de UI (Pantallas 3, 4 y 7 del documento `iptv-ui-prototypes.md`).

### 8.1 Contexto y Gap Identificado

El PRD (DOC-1) y los prototipos de UI (`iptv-ui-prototypes.md`) describen una interfaz de calidad Netflix con pósters verticales, fanarts de fondo, sinopsis completas, año de estreno, género y duración. Sin embargo, las fuentes de datos definidas en DOC-3 son insuficientes para alimentar esa UI:

*   **Listas M3U estándar:** Solo proveen el `name`, `group-title` y, opcionalmente, `tvg-logo` (logotipo del canal). No contienen pósters de películas, fanarts, sinopsis ni año.
*   **API de Xtream Codes:** Expone endpoints de metadatos (`get_vod_info`, `get_series_info`), pero la calidad es responsabilidad exclusiva del proveedor IPTV. En la práctica, las sinopsis suelen estar vacías, los pósters apuntan a enlaces rotos o a servidores lentos, y los tiempos de respuesta degradan el zapping.

**TMDB (The Movie Database)** es la fuente estándar de la industria. Es gratuita, mantiene catálogos de películas y series en múltiples idiomas, expone una API REST estable, y sus activos gráficos se sirven desde CDN a tamaños optimizados.

### 8.2 Arquitectura del Pipeline de Enriquecimiento

El enriquecimiento se ejecuta **dentro del mismo Web Worker de ingesta** definido en DOC-2, como una fase posterior a la clasificación heurística de 6 etapas de DOC-3:

```
+----------------------------------------------------+
|           Hilo de UI (React - 60 FPS)              |
+------------------------+---------------------------+
                         | (1. Iniciar)
                         v
+------------------------+---------------------------+
|        Web Worker de Ingesta + Enriquecimiento     |
|                                                     |
|  [Fase 1] Descarga M3U/XMLTV                       |
|  [Fase 2] Parsing con iptv-m3u-playlist-parser     |
|  [Fase 3] Heurística de clasificación (DOC-3)      |
|  [Fase 4] --> Sanitización y extracción (8.3)      |
|  [Fase 5] --> Búsqueda en TMDB (8.4)              |
|  [Fase 6] --> Hidratación por lotes (8.5)          |
|                                                     |
+--------+-----------------------+-------------------+
         |                       |
         v                       v
+--------+-------+      +--------+-------+
| IndexedDB      |      | OPFS           |
| ContentEnrich. |      | ImageCache     |
+----------------+      +----------------+
```

**Reglas de oro del pipeline:**

*   La UI nunca espera a TMDB. La ingesta termina cuando los datos crudos están persistidos y los elementos ya tienen `enrichment_status: 'pending'`.
*   El enriquecimiento se ejecuta como un lote en segundo plano, controlado por una cola con concurrencia limitada.
*   Si el usuario no ha configurado una API Key de TMDB, las Fases 4-6 se omiten. La app continúa en modo degradado (ver 8.8).

### 8.3 Capa de Pre-Procesado de Nombres

Los nombres de películas y series en listas M3U son altamente irregulares. Antes de cualquier búsqueda en TMDB, el Web Worker debe ejecutar una tubería de normalización en este orden estricto:

1.  **Extracción de IMDb ID** (señal más fuerte de match exacto).
2.  **Detección de patrón de serie** (separar `serie`, `temporada`, `episodio` antes de continuar).
3.  **Extracción de año** (mejora dramáticamente la precisión de búsqueda).
4.  **Stripping de tags de calidad, códec, idioma y grupo de release**.

#### Interfaz TypeScript del Pre-Procesador

```typescript
type MediaType = 'live' | 'movie' | 'series' | 'radio';

interface PreprocessedName {
  raw: string;
  type: MediaType;             // Ya viene del clasificador DOC-3
  cleanTitle: string;          // Título listo para enviar a TMDB
  year?: number;
  imdbId?: string;
  series?: {
    seriesName: string;
    season: number;
    episode: number;
  };
  seasonEpisode?: {            // Series sin nombre de serie detectado
    season: number;
    episode: number;
  };
}

function preprocessName(raw: string, type: MediaType): PreprocessedName;
```

#### Patrones de Expresión Regular (Punto de Partida)

```typescript
// 1. IMDb ID: 'tt' seguido de 7-8 dígitos
const IMDB_RE = /(tt\d{7,8})/i;

// 2. Patrones de series: 'S01E02', '1x02', 'S01.E02'
const SERIES_RE = /(?:s(\d{1,2})e(\d{1,2}))|(?:(\d{1,2})x(\d{1,2}))/i;

// 3. Año: 4 dígitos entre paréntesis, corchetes o seguidos de separador
const YEAR_RE = /[\s.\(\[](19|20)\d{2}[\s.\)\]]/;

// 4. Tags de calidad/codec/idioma/grupo a eliminar
const NOISE_TAGS_RE = /\b(2160p|1080p|720p|480p|4k|uhd|hdr|blu-?ray|brrip|dvdrip|web-?dl|hdrip|cam|ts|x264|x265|h\.?264|h\.?265|hevc|aac(?:5\.1)?|ac3|dts|dual|audio|latino|sub|subs|subtitulado|dubbed|multi|yify|rarbg|ettv|horriblesubs|ntb|amzn|atmos|remux|proper|repack)\b/gi;
```

> ⚠️ Los agentes de implementación deben ajustar estos patrones iterativamente con casos reales del proveedor IPTV del usuario. Son un punto de partida robusto, no una versión final certificada.

### 8.4 Estrategia de Búsqueda en TMDB

TMDB expone tres endpoints de búsqueda relevantes. La cascada de fallback prioriza el match exacto sobre el ambiguo:

| Prioridad | Condición | Endpoint | Ventaja |
|:---:|---|---|---|
| **1** | `imdbId` presente | `GET /find/{imdb_id}?external_source=imdb_id` | Match exacto, sin ambigüedad |
| **2** | `type === 'movie'` y `year` presente | `GET /search/movie?query={title}&year={year}` | Reduce colisiones (ej. "It" 2017 vs "It" 1990) |
| **3** | `type === 'series'` y `year` presente | `GET /search/tv?query={title}&first_air_date_year={year}` | Mismo beneficio para series |
| **4** | Solo nombre limpio | `GET /search/multi?query={title}` | Fallback arriesgado, requiere filtro de confianza |

#### Interfaz de Llamada a TMDB

```typescript
interface TmdbClientConfig {
  apiKey: string;
  baseUrl: string;          // 'https://api.themoviedb.org/3'
  language: string;         // 'es-ES' para contenido en español
  timeoutMs: number;        // default 5000
  maxRetries: number;       // default 3
}

interface TmdbMatch {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string | null;
  year: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  posterPath: string | null;     // ej. '/abc123.jpg'
  backdropPath: string | null;   // ej. '/xyz789.jpg'
  matchConfidence: number;       // 0.0 a 1.0
}

async function enrichFromTmdb(
  pre: PreprocessedName,
  config: TmdbClientConfig
): Promise<TmdbMatch | null>;
```

**Regla de descarte por confianza:**

*   Si `vote_count < 5` en el resultado devuelto por TMDB, se descarta el match (probablemente contenido muy oscuro o error de matching).
*   Si la diferencia de `vote_count` entre el primer y segundo resultado de `/search/multi` es menor a 10x, se requiere validación manual (`enrichment_status: 'pending'`), no se persiste automáticamente.

### 8.5 Worker de Hidratación: Concurrencia y Resiliencia

La cola de hidratación se gestiona con concurrencia limitada para respetar los rate limits de TMDB (aproximadamente 50 req/seg con API key personal).

```typescript
interface HydrationJob {
  contentId: string;
  pre: PreprocessedName;
  attempts: number;
  lastError?: string;
}

const HYDRATION_CONCURRENCY = 5;                       // seguro bajo rate limits
const RETRY_BACKOFF_MS = [1000, 2000, 4000];           // backoff exponencial
const NEGATIVE_CACHE_TTL_DAYS = 30;                    // no re-buscar "no match"
const CONFIDENCE_AUTO_PERSIST = 0.85;                  // umbral mínimo de confianza
```

**Reglas de la cola:**

*   Concurrencia fija de 5 trabajos paralelos.
*   Si TMDB responde `429 Too Many Requests`, se aplica backoff exponencial de la tabla `RETRY_BACKOFF_MS` antes de reintentar (máximo 3 intentos por elemento).
*   Si tras 3 intentos no hay respuesta exitosa, se marca `enrichment_status: 'error'` y se abandona en esa sesión. Queda pendiente para hidratación en próxima apertura de la app.
*   **Cache negativo:** Si TMDB no devuelve coincidencias para un título, se persiste `enrichment_status: 'not_found'` con TTL de 30 días. No se vuelve a consultar dentro de ese período.
*   **Priorización:** Los elementos marcados como favoritos o con historial de reproducción previo se hidratan con prioridad alta antes que el resto del catálogo.

### 8.6 Schema IndexedDB para Enriquecimiento

La información enriquecida se almacena en una tabla separada, referenciada por `content_id`. No se modifican los registros originales de ingesta.

```typescript
// Tabla: content_enrichment
interface ContentEnrichment {
  content_id: string;              // PK, FK al item original (ID interno)
  tmdb_id: number | null;
  imdb_id: string | null;
  media_type: 'movie' | 'tv' | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  year: number | null;
  vote_average: number | null;
  vote_count: number | null;
  enrichment_status: 'pending' | 'enriched' | 'not_found' | 'error';
  match_confidence: number;        // 0.0 a 1.0
  fetched_at: number;              // timestamp de la última consulta exitosa
  ttl_expires_at: number;          // para cache negativo
}

// Índices obligatorios:
// - content_id (PK)
// - enrichment_status (para que el Worker de hidratación filtre los pendientes)
// - tmdb_id (para evitar duplicados)

// Tabla: image_cache (en OPFS, no IndexedDB)
interface CachedImage {
  remote_url: string;              // URL original de TMDB
  local_path: string;              // ruta dentro de OPFS
  size_variant: 'w300' | 'w500' | 'w780' | 'original';
  bytes: number;
  cached_at: number;
}
```

**Reglas de persistencia:**

*   Las inserciones en `content_enrichment` se realizan en transacciones masivas de hasta 1.000 registros (consistente con DOC-2).
*   La tabla se indexa por `enrichment_status` para permitir consultas eficientes del Worker de hidratación: *"dame todos los elementos pendientes o con error"*.

### 8.7 Gestión de la API Key de TMDB

**Decisión arquitectónica (validada con el equipo):** Para el MVP, el default es **API Key ingresada por el usuario en Ajustes**, NO un proxy backend propio.

#### Justificación

*   **Cero dependencia de backend propio** durante el MVP: menos infraestructura que construir, desplegar y mantener.
*   **Sin riesgo de cuota global:** cada usuario consume su propia cuota (TMDB permite ~40 req/seg por key gratuita personal, suficiente para catálogos típicos).
*   **Reutiliza el patrón de UI ya diseñado:** la Pantalla 8 de `iptv-ui-prototypes.md` ya incluye un campo "Ingresar clave de licencia" con input grande y botón de acción. El mismo componente se duplica para "Ingresar TMDB API Key".
*   **El proxy backend propio queda como feature premium futura**, cuando exista un modelo de negocio que justifique su mantenimiento y operación.

#### Almacenamiento Seguro

La API Key del usuario se almacena **cifrada** en IndexedDB, siguiendo el mismo principio que la licencia de DOC-6. NO se persiste en LocalStorage ni en archivos de texto plano.

```typescript
interface StoredApiKey {
  service: 'tmdb' | 'license';
  encrypted_value: string;         // AES-256 con clave derivada del HWID
  created_at: number;
  last_validated_at: number;
}
```

#### UI en Pantalla 8 (Ajustes)

Se agrega una nueva sub-sección dentro de la categoría "Calidad de Video" o como categoría propia llamada **"Metadatos"**:

*   Input de texto grande con placeholder "Ingresa tu API Key de TMDB (gratuita en themoviedb.org)".
*   Botón "Validar y Guardar" que hace una llamada de prueba (`GET /authentication/token/validate`) y muestra feedback inmediato.
*   Indicador de estado: "Configurada" (verde), "Inválida" (rojo), "Sin configurar" (gris).
*   Enlace directo a la página de registro de TMDB.

### 8.8 Modo Degradado (Sin API Key de TMDB)

La aplicación **debe funcionar completamente sin API Key de TMDB** configurada. En ese caso:

*   Las Fases 4-6 del pipeline de enriquecimiento se omiten por completo.
*   La UI consume únicamente los metadatos disponibles en la lista M3U: `name`, `group-title`, `tvg-logo`.
*   Para películas: se muestra el nombre limpio (post-sanitización), el grupo como pseudo-género, y un placeholder visual en lugar del póster.
*   Para series: se muestra el nombre de la serie extraído por el clasificador, agrupando episodios por temporada detectada.
*   El indicador de "Sin metadatos enriquecidos" se exhibe discretamente en Pantalla 3 (Home) y Pantalla 4 (Detalle).

### 8.9 Caching de Imágenes en OPFS

Las imágenes de TMDB se sirven desde `image.tmdb.org/t/p/{size}/{path}`. Se descargan y cachean en **OPFS (Origin Private File System)** según lo definido en DOC-2:

| Tamaño TMDB | Uso en la UI |
|---|---|
| `w300` | Posters verticales en grids de catálogo (Pantalla 3, 7) |
| `w500` | Posters verticales en vista de detalle (Pantalla 4) |
| `w780` | Fanarts de fondo en Hero (Pantalla 3) y detalle (Pantalla 4) |
| `original` | Fanarts de máxima resolución para TVs 4K |

**Reglas de caché:**

*   La primera vez que la UI solicita una imagen, se descarga de TMDB y se persiste en OPFS.
*   Las solicitudes subsiguientes leen desde OPFS sin volver a salir a la red.
*   El Worker de Telemetría definido en DOC-2 purga las imágenes que no han sido referenciadas por la UI en los últimos 30 días, bajo la política de auto-purga al 80% de RAM.

### 8.10 Matriz de Pruebas TMDB (Extiende DOC-7)

Las siguientes pruebas se suman a la matriz de DOC-7:

| ID de Prueba | Módulo | Acción de Entrada | Criterio de Aceptación | Métrica Esperada |
|:---:|---|---|---|---|
| **TEST-09** | Pre-Procesado de Nombres | Inyectar 1.000 nombres de películas/series con ruido realista (`Avatar (2009) [1080p BluRay x264 YIFY].mkv`). | Verificar que el preprocesador extraiga correctamente título limpio, año, IMDb ID y descarte todos los tags de ruido. | **100% de acierto** sobre dataset de fixtures. |
| **TEST-10** | Búsqueda en TMDB | Inyectar 100 títulos limpios, ejecutar el cascade de búsqueda. | Verificar que el match con `vote_count ≥ 5` se persista con `enrichment_status: 'enriched'`. | **≥ 85% de cobertura** sobre títulos populares. |
| **TEST-11** | Rate Limit y Resiliencia | Simular respuesta `429` en 20% de las llamadas. | Verificar backoff exponencial aplicado y persistencia final exitosa. | **0 elementos abandonados** tras 3 reintentos. |
| **TEST-12** | Modo Degradado | Iniciar la app sin API Key configurada. | La app debe cargar, mostrar la lista y renderizar UI con metadatos crudos M3U. | **Sin errores en consola**, UI navegable end-to-end. |
| **TEST-13** | Caching OPFS | Solicitar 100 pósters únicos dos veces consecutivas. | La segunda solicitud debe servirse desde OPFS sin tráfico de red. | **0 peticiones salientes** en segunda carga (verificable con DevTools Network). |
| **TEST-14** | Cache Negativo | Inyectar un título inexistente en TMDB, hidratarlo, esperar. | Debe persistirse `enrichment_status: 'not_found'` con TTL. | **0 re-consultas** dentro de los 30 días siguientes. |

---

# INSTRUCCIONES FINALES PARA LOS AGENTES DE DESARROLLO DE IA

1.  **Modularidad Absoluta:** No mezclen la lógica de parsing con los componentes visuales de React. Todo el análisis de datos pertenece a la capa de servicios y Workers independientes.
2.  **Validaciones de Tipos Fuertes:** Todo el código escrito en TypeScript debe pasar el validador estricto de compilación (`tsc --noImplicitAny --strict`).
3.  **Seguridad como Base:** Nunca expongan llamadas a funciones internas de Electron (`ipcRenderer`) directamente en el contexto del navegador de la UI sin usar un archivo `preload.js` con un puente de contexto seguro (`contextBridge`).
4.  **Enriquecimiento desacoplado:** Toda interacción con TMDB ocurre exclusivamente en el Web Worker de ingesta. Ningún componente de React debe llamar a TMDB directamente. La UI consume exclusivamente la tabla `content_enrichment` de IndexedDB.
5.  **Sanitización defensiva:** Asumir siempre que los nombres de películas/series en listas M3U contienen ruido. Nunca enviar el `name` crudo a TMDB.
6.  **Graceful degradation:** Si no hay API Key de TMDB, la aplicación debe seguir funcionando íntegramente con los metadatos disponibles en M3U/Xtream. La calidad visual disminuye, pero la funcionalidad nunca se rompe.
