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

## Qué cuenta como evidencia

Un hallazgo o un “listo” sin comando pegado o sin ruta de archivo no cuenta.
Un número se copia de una salida, no se escribe de memoria.

## Qué no es este archivo

No es la lista de hooks, ni el plugin, ni el CI.
Es el acuerdo. Si algo de arriba se discute otra vez en el chat,
este archivo no se está usando.
