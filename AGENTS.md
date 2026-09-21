# AGENTS.md

Antes de implementar, leé `docs/harness/README.md`.

Ese archivo manda sobre este chat. No lo reabras ni lo “mejores” en un turno
de producto.

En este repo, verde significa, en este orden:

- npm run typecheck
- npm run lint
- npm test

No declares el trabajo terminado sin pegar esas salidas.
No commitees ni hagas push salvo que el humano lo pida.
No mezcles un change de producto con cambios de proceso.

En tareas de más de 2 pasos, el agente debe crear y mantener un archivo
`todo.md` en la raíz del workspace para registrar el plan de trabajo y
marcar el progreso antes de cada edición.

Uso obligatorio de herramientas de edición nativas: toda creación,
modificación o eliminación de archivos DEBE hacerse solo con `write`,
`edit` o `apply_patch`. Queda prohibido crear o reescribir archivos desde
la consola con redirecciones de shell (`echo >`, `echo >>`, `cat >`,
`cat >>`, `cat <<EOF >`, `tee`), `sed -i` o scripts ad-hoc. El plugin de
alcance no ve esos comandos.

Comandos de shell permitidos (inspección, diagnóstico y pruebas):
`git status`, `git diff`, `git log`, `ls`, `cat`, `rg`,
`npm run typecheck`, `npm run lint`, `npm test`, `npx vitest`.

Comandos de shell prohibidos: `rm -rf`, `git commit --no-verify`,
`git push --force`. `npm install <pkg>` y `npm uninstall <pkg>` solo si
la especificación de la tarea los aprobó antes.

Regla 12 — capas: respetar el grafo de dependencias. ESLint lo enforcea
con `no-restricted-imports`.
Permitido: `renderer → shared`, `main → shared`, `licensing-api` aislada.
Prohibido: `renderer → main` / `electron` / APIs Node; `shared → main`
o `shared → renderer`; dominio/servicios (`src/main`, `src/main/services`,
`src/licensing-api`) → React o UI de `renderer`.
