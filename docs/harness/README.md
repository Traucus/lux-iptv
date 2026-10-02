# Harness — cómo trabajamos

El agente propone e implementa.
El disco y los comandos del repo demuestran.
Nadie declara terminado en el chat.

Esto vale en cualquier proyecto. El comando de “verde” y el enchufe del agente
(OpenCode, Cursor, otro) se definen en cada repo, no aquí.

## Reglas

1. Un worktree, un trabajo, como máximo una spec viva.
   Si el árbol tiene basura de otra cosa, se limpia o esa basura *es* el trabajo.
   No se empieza un segundo tema encima.

2. Cada trabajo nombra qué puede tocar. Lo demás no se escribe
   y no entra en el commit.

3. “Verde” es lo que ese repo ya usa para validar (en Lux: typecheck, lint y test;
   en SSO: su verify). Rojo no se commitea.
   Si el chequeo no se pudo correr, no es verde.

4. Una spec que no coincide con el código no se implementa: se actualiza o se tira.

5. Secretos fuera de git y fuera de la config del agente.

6. Quien implementa no aprueba su propio trabajo ni commitea en silencio.

7. No se apaga un control para que pase el change. Si hay que cambiar un control,
   lo decide una persona y queda escrito.

8. Linux no firma lo que pide Windows (ni al revés).

9. Una excepción la da una persona y tiene fecha de vencimiento.
    No vale para las reglas 2, 3, 5 y 6.

10. Memoria persistente: en tareas de más de 2 pasos, el agente crea y
    mantiene `todo.md` en la raíz del workspace. Plan primero; marcar
    progreso antes de cada edición.

11. Terminal: crear, modificar o borrar archivos solo con las
    herramientas nativas (`write`, `edit`, `apply_patch`). Prohibido
    reescribir el disco con redirecciones de shell (`echo >`, `echo >>`,
    `cat >`, `cat >>`, `cat <<EOF >`, `tee`), `sed -i` o scripts ad-hoc.
    El plugin de alcance no intercepta bash.
    Permitidos: `git status`, `git diff`, `git log`, `ls`, `cat`, `rg`,
    `npm run typecheck`, `npm run lint`, `npm test`, `npx vitest`.
    Prohibidos: `rm -rf`, `git commit --no-verify`, `git push --force`.
    `npm install` / `npm uninstall` de un paquete solo si la spec de la
    tarea lo aprobó antes.

12. Capas: el grafo de imports lo enforcea ESLint (`no-restricted-imports`).
    Permitido: renderer → shared; main → shared; licensing-api aislada.
    Prohibido: renderer → main / electron / Node; shared → main o renderer;
    dominio/servicios (src/main, src/main/services, src/licensing-api) →
    React o UI de renderer. Aliases: @shared, @main, @renderer,
    @licensing-api.

13. Calidad: un change de producto no está terminado si baja la cobertura
    o introduce `any`. `no-explicit-any` es error; `max-lines` 300.
    El gate vigente de Vitest es líneas 65%, funciones 55% y sentencias
    65% (`test:coverage`). El 80% escrito es DOCUMENTED TARGET,
    NOT ENFORCED GATE.

14. Spec-first: la regla de governance prevista es que todo change de
    código de producto exige un change de OpenSpec aprobado antes de
    implementarlo. El enforcement por máquina de que esa spec exista NO
    está implementado. No se agregan paths de producto a `current.yml`
    hasta que esa spec exista y esté aprobada.

## Decisiones vigentes

Estas frases registran decisiones ya autorizadas. No agregan controles.

- Milestone de producto: "Stabilize the desktop player." El checkpoint
  concreto siguiente, dentro de ese milestone, es la interacción Windows
  HWND / OSD. El checklist de Windows es validación de apoyo. No redefine
  el milestone, y FA-17 tampoco lo es.
- Autoridad de modelos: `~/.config/opencode/opencode.json`, campo
  `agent.*.model`. La tabla inyectada en el prompt del orquestador es
  STALE y NON-AUTHORITATIVE.

## Qué cuenta como evidencia

Un hallazgo o un “listo” sin comando pegado o sin ruta de archivo no cuenta.
Un número se copia de una salida, no se escribe de memoria.

## Qué no es este archivo

No es la lista de hooks, ni el plugin, ni el CI.
Es el acuerdo. Si algo de arriba se discute otra vez en el chat,
este archivo no se está usando.
