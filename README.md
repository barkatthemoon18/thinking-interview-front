# Thinking · Frontend para Interview API

Angular **22.2.5**, CLI **22.2.6**, Node **26.13.0 LTS** y npm **11.20.0**. Proyecto exclusivamente frontend, adaptado al contrato de estos archivos del backend:

- `../interview/docs/postman/Interview.local.postman_environment.json`
- `../interview/docs/postman/Interview.postman_collection.json`
- `../interview/docs/PLAN_PRUEBAS_API.md`

La API local documentada usa **http://localhost:8080**. Este proyecto no inicia, implementa ni modifica el backend o H2.

## Ejecutar con tu servidor H2

1. Inicia tu backend con H2 y los usuarios semilla `reportante1`, `reportante2`, `revisor1`.
2. En este directorio ejecuta:

```powershell
npm.cmd start
```

3. Abre **http://localhost:4200**. La página inicial es **`/login`**, con un textbox de nombre de usuario. El modo inicial es **API real**, con `/api` reenviado mediante `proxy.conf.json` a `http://localhost:8080/api`.
4. Escribe el username y pulsa **Ingresar**. Ese formulario llama a `/api/login`, procesa el token y dirige al portal correspondiente al rol devuelto por la API.

El proxy también está declarado en `angular.json`, por lo que `ng.cmd serve` usa la misma conexión. Si el frontend ya estaba iniciado antes de cambiar esta configuración, hay que reiniciarlo; recargar solamente el navegador no vuelve a cargar el proxy.

No necesitas cambiar CORS para este flujo local: el navegador llama al servidor Angular y este reenvía las peticiones a la API. Si tu backend usa otro puerto, cambia `proxy.conf.json` y reinicia Angular. Si lo ejecutas en otra máquina, adapta también el destino del proxy.

Las dependencias ya están instaladas. Para reinstalarlas usa `npm.cmd ci`. En PowerShell utiliza `npm.cmd` y `ng.cmd` si Windows bloquea los scripts `.ps1`; no se modificó la política de ejecución.

## Endpoints extraídos

La URL base real es `http://localhost:8080/api`. Los parámetros `{eventId}` y `{actionId}` son IDs numéricos positivos de la base de datos.

| Operación        | Método y ruta                                             | Cuerpo JSON                                | Éxito                                   |
| ---------------- | --------------------------------------------------------- | ------------------------------------------ | --------------------------------------- |
| Login            | `POST /api/login`                                         | `{ "username": "reportante1" }`            | 200, `{ "token": "..." }`               |
| Listado          | `GET /api/events`                                         | Sin cuerpo                                 | 200, arreglo de resúmenes               |
| Crear evento     | `POST /api/create-event`                                  | `title`, `description`, `date`, `area`     | 201, texto `Event created successfully` |
| Detalle          | `GET /api/events/{eventId}`                               | Sin cuerpo                                 | 200, evento con `actions` e `history`   |
| Cambiar estado   | `PATCH /api/events/{eventId}/status`                      | `{ "status": "en revisión" }` o `cerrado`  | 204, sin cuerpo                         |
| Crear acción     | `POST /api/events/{eventId}/actions`                      | `description`, `responsible`, `targetDate` | 201, acción con `actionId`              |
| Completar acción | `PATCH /api/events/{eventId}/actions/{actionId}/complete` | **Sin cuerpo**                             | 204, sin cuerpo                         |

Todas las operaciones salvo login envían `Authorization: Bearer <token>`. Los cuerpos JSON usan `Content-Type: application/json`. El encabezado anterior `X-User-Id` ya no se utiliza.

### Login y portales por rol

El login envía `{ "username": "..." }`, sin contraseña. Su respuesta es un token mock Base64 emitido por la API; el frontend **no fabrica tokens**. Se comprueban su esquema, username y rol antes de abrir una sesión. No se decide el rol a partir del nombre escrito ni se limita el ingreso a la lista de usuarios de ejemplo: puede entrar cualquier usuario existente cuyo token tenga rol `reportante` o `revisor`.

| Usuario                      | Portal                               | Operaciones                                             |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `reportante1`, `reportante2` | `/eventos` — Mis eventos             | Crear eventos; listar y consultar sus propios registros |
| `revisor1`                   | `/revisiones` — Portal de revisiones | Ver todos; cambiar estado; crear y completar acciones   |

Las rutas `/eventos`, `/eventos/nuevo` y `/eventos/:id` admiten reportantes. `/revisiones` y `/revisiones/:id` admiten revisores. Los guards devuelven al login a quien no tiene sesión y al portal propio a quien intenta una ruta de otro rol. Los menús, enlaces de detalle y botones se adaptan al portal.

El encabezado muestra el usuario y su rol, con **Cerrar sesión**. Se eliminó el selector para cambiar de identidad durante una sesión. Para ingresar como otra persona, cierra sesión y vuelve al formulario. El token y la sesión se conservan solo en memoria: recargar la página requiere ingresar otra vez. Un HTTP 401 elimina la sesión y vuelve al login, sin repetir operaciones ni iniciar sesión automáticamente.

El servidor sigue resolviendo y autorizando los permisos desde su base de datos en cada petición. Los guards controlan la navegación de la interfaz; el login mock no es autenticación apta para producción.

### Cuerpos de creación

Evento:

```json
{
  "title": "Derrame de aceite en bodega",
  "description": "Se detectó aceite junto a la zona de carga.",
  "date": "2026-11-01",
  "area": "Bodega"
}
```

El servidor asigna el reportante y el estado. Como el POST devuelve texto sin ID, la interfaz vuelve al listado con una confirmación de éxito. Desde allí puedes abrir el registro. No se intenta identificarlo por el título porque este puede repetirse.

Acción:

```json
{
  "description": "Limpiar el área y revisar el origen del derrame",
  "responsible": "Persona QA",
  "targetDate": "2026-11-15T00:00:00"
}
```

El formulario recibe un día y lo envía a las `00:00:00`, sin zona horaria, como requiere el DTO. El responsable tiene entre **1 y 30 caracteres**. La fecha del evento no puede ser futura respecto al día **UTC**; la fecha objetivo no puede ser anterior al día del evento.

### Respuestas y adaptación a la interfaz

El listado solo incluye `eventId`, `title`, `date`, `area`, `status`, `reporter`. No se exigen descripción, acciones ni historial en ese endpoint.

El detalle agrega `description`, `actions` e `history`. Las acciones usan `actionId`, `description`, `responsible`, `targetDate`, `status`. El historial usa `changeHistoryId`, `changeDate`, `actor`, `description`.

`src/app/core/api.adapter.ts` transforma estos DTO a los modelos de las pantallas. El estado de API **`en revisión`**, con espacio y acento, se convierte internamente a `en_revision` y se transforma de vuelta al enviarlo. Los IDs numéricos se representan como cadenas en las rutas del frontend.

El historial se ordena de más reciente a más antiguo. `changeDate` no tiene zona en el contrato documentado y se muestra como hora local, sin añadirle una `Z` ni inventar una zona.

Los errores usan `application/problem+json` y las propiedades `title`, `status`, `detail`, `instance`. La interfaz muestra `detail` para los rechazos 4xx y un mensaje general para errores internos 5xx. Los registros ajenos devuelven **404**, roles insuficientes **403**, credenciales inválidas **401**, entradas inválidas **400** y conflictos de flujo **409**.

## Configurar o inspeccionar la conexión

En **Conexión API** puedes editar la URL base y los siete endpoints. En las rutas de configuración se utilizan los parámetros `:eventId` y `:actionId`. Guarda para aplicar los cambios.

- Los valores iniciales están en `src/app/core/api.config.ts`.
- La configuración se guarda en este navegador. Se usa una nueva clave de configuración para que las rutas del contrato anterior no sobrescriban este contrato.
- Para aplicar nuevos valores del archivo sobre una configuración ya guardada, usa **Cargar valores iniciales → Guardar configuración**.
- Puedes usar una URL absoluta como `http://localhost:8080/api`, pero en ese caso el backend debe permitir CORS para `http://localhost:4200`, `Authorization`, `Content-Type` y los métodos utilizados. El proxy predeterminado evita esa necesidad local.
- El inspector conserva hasta 12 solicitudes en memoria, con método, URL, actor, estado HTTP, duración y cuerpos. El token de login se oculta y no se guarda en `localStorage` ni se muestra en los registros.
- La configuración también es accesible desde **Configurar conexión**, en el login. Cambiar el modo o el destino del login elimina la sesión activa y requiere ingresar nuevamente.
- El timeout es de 15 segundos. Si una escritura falla por red, consulta el listado o el detalle antes de repetirla.

El modo **Demo local** sigue disponible para recorrer las pantallas sin servidor. Se configura desde la conexión y utiliza el mismo formulario con `reportante1`, `reportante2` o `revisor1`, sin realizar llamadas HTTP. Usa cuatro eventos ficticios y sus cambios se pierden al recargar. En modo API no se sustituye un error por datos de demo ni se filtra el listado para ocultar una autorización incorrecta del servidor.

## Recorrido funcional con H2

1. Ingresa como `reportante1` desde `/login`, registra un evento y abre su detalle desde el listado de **Mis eventos**.
2. Cierra sesión e ingresa como `reportante2`: el evento anterior no debe aparecer. Una consulta autenticada a la API con ese ID debe devolver 404, comprobado también por `test:api`.
3. Cierra sesión e ingresa como `revisor1`. Desde **Portal de revisiones**, abre el evento y pulsa **Pasar a revisión**.
4. Crea una acción. Comprueba el responsable, la fecha y su estado pendiente.
5. El botón de cierre permanece deshabilitado mientras haya pendientes. El comando de pruebas comprueba también que el **servidor** rechace un intento de cierre directo.
6. Completa la acción, cierra el evento y comprueba las cinco entradas de historial: creación, revisión, creación de acción, finalización de acción y cierre.
7. En **Conexión API**, revisa las solicitudes y respuestas reales.

## Pruebas

### Frontend, sin backend

```powershell
npm.cmd run test:ci
npm.cmd run build
```

Las 39 pruebas cubren el formulario de ingreso, procesamiento del token y roles, guards, separación de portales, logout, sesión rechazada, permisos y estados de la demo, Bearer, DTO de listado/detalle, respuesta de alta en texto, fechas UTC, límite del responsable, errores ProblemDetail y respuestas 204. El transporte HTTP se simula en estas pruebas: **no verifican tu servidor H2**.

### API real, una vez que la levantes

```powershell
npm.cmd run test:api
```

Destino inicial: `http://localhost:8080/api`. Para cambiarlo:

```powershell
$env:API_URL = 'http://localhost:8080/api'
npm.cmd run test:api
```

El comando realiza los logins de los usuarios semilla y **crea dos eventos ficticios y una acción**. No elimina registros y muestra sus IDs. Comprueba permisos, visibilidad, entradas inválidas, suplantación de reportante, transiciones, pertenencia de acciones, cierre con pendientes, cierre sin acciones, respuestas HTTP y el historial. Un fallo termina con código 1. Para H2 en memoria, el plan del backend indica que reiniciar la aplicación restaura los datos.

El script usa `api.config.ts` y una URL absoluta; no lee los ajustes guardados en el navegador. También puedes adaptar y pasar el ejemplo:

```powershell
npm.cmd run test:api -- api-test.config.example.json
```

Este recorrido acotado complementa la colección de **110 peticiones** de Postman, cuyo catálogo completo permanece en el backend. No reemplaza esa colección ni cubre persistencia, concurrencia o seguridad de producción.

**Estado de verificación:** la landing, los dos portales, rutas protegidas, errores de login, logout y sesión 401 se comprobaron en Edge con respuestas del contrato interceptadas, en móvil y escritorio, sin errores de JavaScript ni desborde. En esa revisión el backend de `localhost:8080` no estaba disponible, por lo que el nuevo ingreso explícito queda pendiente de probar contra H2 real. En la versión anterior sí se verificaron login y consultas reales durante la corrección del proxy. El recorrido completo de escrituras de `test:api` sigue pendiente. Los resultados de Newman mencionados en el plan pertenecen a ese documento, no a una ejecución realizada desde este frontend.

## Archivos principales

| Archivo                              | Propósito                                                 |
| ------------------------------------ | --------------------------------------------------------- |
| `src/app/core/api.config.ts`         | Rutas y configuración inicial                             |
| `src/app/core/api-client.service.ts` | Login, Bearer, sesiones, HTTP, errores e inspector        |
| `src/app/core/session.service.ts`    | Usuario y token de la sesión activa                       |
| `src/app/core/auth.guards.ts`        | Protección de las rutas por rol                           |
| `src/app/features/login.ts`          | Formulario inicial de username y redirección al portal    |
| `src/app/core/api.adapter.ts`        | Conversión entre DTO de la API y modelos de las pantallas |
| `src/app/core/events.service.ts`     | Operaciones de eventos y selección entre HTTP y demo      |
| `src/app/features/`                  | Listado, alta, detalle y configuración                    |
| `scripts/probar-api.mjs`             | Pruebas funcionales directas contra tu servidor           |
| `proxy.conf.json`                    | Reenvío local hacia el puerto 8080                        |

## Alcance y supuestos

Se mantiene el flujo `reportado → en revisión → cerrado`, sin reapertura, edición ni eliminación. Se puede cerrar sin acciones. Se recortan espacios exteriores antes de enviar los textos. La API debe validar todas las entradas y autorizar cada operación y registro; los controles de interfaz no garantizan seguridad.

Para producción se reemplazaría el login mock por identidad verificada mediante un proveedor OIDC/OAuth y una sesión segura. El servidor resolvería los roles y permisos sin confiar en campos arbitrarios enviados por el navegador. Antes de producción habría que acordar identidad y accesos, clasificación/retención de datos, uso autorizado de IA, alojamiento y conectividad, secretos, auditoría e incidentes, concurrencia y aprobación de dependencias/cambios.