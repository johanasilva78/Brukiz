# Brukiz AMS

Sistema de gestión de agencias de seguros para Ficohsa Seguros. El repositorio está asociado a [johanasilva78/Brukiz](https://github.com/johanasilva78/Brukiz) y adopta la identidad visual de la aplicación corporativa de referencia.

## Primera entrega: propuesta de arquitectura

### Arquitectura

- **Web:** Next.js App Router, React, TypeScript y diseño responsive con exportación estática para la app de Amplify existente.
- **Hosting:** AWS Amplify Hosting.
- **API:** Función AWS Lambda independiente escrita en Python, detrás de API Gateway REST.
- **Autenticación:** Amazon Cognito User Pool creado y administrado desde la consola AWS; API Gateway protege las rutas con el User Pool.
- **Persistencia:** Amazon DynamoDB mediante `boto3`, el SDK oficial de AWS para Python. DynamoDB no es compatible con Prisma ni requiere un ORM relacional.
- **Aislamiento:** tabla con clave compuesta `tenantId` (partition key) + `entityKey` (sort key). El backend obtiene el tenant exclusivamente del claim verificado `custom:tenantId` del token Cognito; nunca acepta el tenant enviado por el cliente.
- **Documentos:** el MVP registra metadatos en DynamoDB; el almacenamiento de archivos en Amazon S3 queda para un incremento posterior.
- **Integraciones e IA:** adaptadores independientes para REST/MCP de aseguradoras y orquestación agnóstica de proveedor LLM. No se simula que una operación real de aseguradora haya sido completada.

### Modelo de datos inicial

La tabla `BrukizAmsData` usa un único patrón de acceso multi-tenant y tipos de entidad en `entityKey`: `CONTACT#`, `INSURER#`, `PRODUCT#`, `OPPORTUNITY#`, `QUOTE#`, `POLICY#`, `RENEWAL#`, `CLAIM#`, `TASK#`, `DOCUMENT#`, `AGENCY#`, `USER#` y `AUDIT#`. Las entidades se relacionan por ID y cada registro de negocio conserva su `tenantId`.

### Estructura

```text
backend/                 Handler Python de Lambda y pruebas automatizadas
src/app/                 Rutas Next.js y estilos globales
src/components/          Acceso de demostración e interfaz AMS
amplify.yml              Pipeline de Amplify Hosting
```

### Menú principal

Inicio; Contactos; Oportunidades; Cotizaciones; Pólizas; Renovaciones; Siniestros; Aseguradoras; Productos; Tareas; Documentos; Reportes; Administración.

### Pantallas MVP

Inicio de sesión; dashboard; directorio y formulario de contactos; pipeline; solicitudes y propuestas; pólizas; renovaciones; siniestros; catálogos de aseguradoras y productos; tareas; documentos; reportes; administración de usuarios y agencia.

### Contratos REST iniciales

- Cada recurso (`contacts`, `insurers`, `products`, `opportunities`, `quotes`, `policies`, `renewals`, `claims`, `tasks`, `documents`, `agencies`, `users`) tiene `GET` para listar, `POST` para crear, `GET /{id}` para consultar, `PATCH /{id}` para actualizar y `DELETE /{id}` para archivar con auditoría.
- `GET /v1/reports` — conteos activos por recurso; no calcula primas ni métricas financieras.
- `GET /v1/docs` — descriptor JSON básico de rutas.

Los flujos de emisión, cancelación, pagos y modificaciones sensibles serán comandos separados que requieran confirmación explícita.

### Backlog priorizado

1. Crear shell responsive, experiencia visual de acceso y backend inicial independiente con Lambda, API Gateway, Cognito y DynamoDB.
2. Completar sesiones reales, membresía de agencia, RBAC granular, auditoría y pruebas de aislamiento entre tenants.
3. Implementar flujos de contactos, aseguradoras, productos, oportunidades, cotizaciones, pólizas, renovaciones, siniestros, tareas y documentos.
4. Añadir conectores API/MCP, notificaciones y procesamiento asíncrono con reintentos.
5. Incorporar asistente IA con herramientas autorizadas y aprobación humana para acciones sensibles.
6. Ampliar comisiones, cobranza, servicio al cliente, portal de asegurados y analítica avanzada.

### Decisiones y aceptación

- Antes de compartir datos entre compañeros de la misma agencia, definir el aprovisionamiento del claim `custom:tenantId`, grupos Cognito y permisos RBAC. La tabla y la API ya aíslan por tenant; aún no se habilita acceso compartido entre usuarios.
- Configurar MFA, retención y cifrado de S3, países/monedas, requisitos regulatorios, credenciales de aseguradoras y eventual integración con DANAconnect en el despliegue.
- El criterio funcional del MVP sigue el documento: cliente → aseguradora/producto → oportunidad → cotización/propuesta → póliza → ficha de cliente → siniestro → renovaciones y tareas. Las pruebas deberán demostrar que un tenant no puede leer ni modificar los registros de otro.

## Estado actual

La rama de producción actualmente publica una interfaz estática de demostración. La versión local del proyecto incluye pantallas funcionales de lista, búsqueda, creación, edición y archivo lógico para los módulos del MVP, conteos operativos en el dashboard, formularios relacionados y reportes básicos. Si `NEXT_PUBLIC_BRUKIZ_API_URL` no se configura, los cambios de la UI se guardan en `localStorage`; al configurarla, las pantallas llaman a la Lambda y persisten en DynamoDB. Los archivos adjuntos no se suben a S3, y las primas/comisiones no se calculan. El ZIP de Lambda se crea localmente para desplegarlo desde la consola AWS.

## Ejecución local

```sh
npm install
npm run dev
```

La interfaz inicia con login simulado. Las pantallas usan almacenamiento local hasta que se configure el endpoint de API Gateway.

## Backend independiente en AWS

El frontend continúa alojado en Amplify Hosting. El backend inicial se puede desplegar por separado como una función Lambda, conectada a DynamoDB mediante API Gateway y Cognito; no requiere ejecutar el despliegue de infraestructura CDK de Amplify.

### Generar el paquete de Lambda

Con Python 3 instalado:

```sh
npm run build:lambda
```

El comando genera `dist/brukiz-contacts-lambda.zip`, con `handler.py` en la raíz del ZIP. Carga ese archivo en Lambda y configura:

- Runtime: **Python 3.12**.
- Arquitectura: **x86_64**.
- Handler: **handler.lambda_handler**.
- Variable `TABLE_NAME`: nombre exacto de la tabla DynamoDB.
- Variable `TENANT_CLAIM`: `custom:tenantId`.
- Variable `DEMO_MODE`: `true` solo para API temporal con datos ficticios; omítela o usa `false` para exigir claims Cognito.
- Timeout sugerido: **10 segundos**. Mantén la memoria en **128 MB** para esta demo.

### Recursos y permisos

1. En DynamoDB crea una tabla con partition key `tenantId` (String) y sort key `entityKey` (String). Se recomienda facturación bajo demanda, cifrado administrado por AWS y recuperación a un punto en el tiempo.
2. En Cognito crea un User Pool con inicio de sesión por correo y un atributo personalizado `tenantId`. Cada usuario debe tener asignado el tenant correcto antes de autenticarse; el token debe incluir el claim `custom:tenantId`.
3. Asigna a la función un rol de ejecución con permisos de escritura de logs y `dynamodb:Query`, `GetItem`, `PutItem`, `UpdateItem` y `TransactWriteItems`, restringidos al ARN de la tabla creada.
4. Para la demo sin login real, crea una API **HTTP** (más económica que una API REST) en API Gateway, con integración Lambda proxy formato **1.0**, rutas `ANY /{proxy+}` y `ANY /`, y un stage como `demo` con despliegue automático. Deja la autorización en **NONE** solo en este entorno temporal, limita el throttling (por ejemplo, 2 solicitudes por segundo y burst 5), y habilita CORS solo para el origen de la rama de Amplify (por ejemplo, `https://main.<app-id>.amplifyapp.com`) y los métodos `GET`, `POST`, `PATCH`, `DELETE` y `OPTIONS`. Configura `CORS_ORIGIN` en Lambda con ese origen exacto y `DEMO_MODE=true`. Para salir de demo, desactiva `DEMO_MODE`, configura Cognito User Pool como autorizador en las rutas y conserva `OPTIONS` sin autorización.
5. La API expone las rutas bajo `/v1` (por ejemplo, `GET /v1/contacts` y `POST /v1/contacts`). En modo autenticado, las solicitudes deben incluir el token Cognito en `Authorization`; en modo demo no se requiere token. El runtime Python de Lambda incluye `boto3`; no necesitas cargar librerías adicionales en el ZIP.
6. Para conectar el frontend servido por Amplify, agrega `NEXT_PUBLIC_BRUKIZ_API_URL` a las variables de entorno de Amplify con la URL base del stage, por ejemplo `https://<api-id>.execute-api.us-east-1.amazonaws.com/demo` (incluye el stage y no agregues `/v1`). Vuelve a desplegar Amplify: Next.js incorpora esta variable durante la compilación estática. La API pública con `DEMO_MODE=true` usa un único tenant fijo para todos los visitantes.

### Pruebas locales

```sh
npm test
```

Con `DEMO_MODE=true`, todas las solicitudes públicas se guardan bajo el tenant fijo `demo` y el actor `demo-user`; el cliente nunca puede elegir otro tenant. Es un modo temporal y público, por lo que solo admite datos ficticios: no ingreses datos personales, clientes, pólizas ni secretos. El throttling reduce abuso accidental, pero no sustituye autenticación. Antes de usar información real, desactiva `DEMO_MODE` y protege la API con Cognito.

El MVP gestiona registros y sus estados básicos, no reemplaza la validación operativa de una aseguradora ni emite, cancela o paga pólizas/siniestros. Los metadatos de documentos no incluyen carga/descarga de archivos. La administración de usuarios es un catálogo de demostración y no crea cuentas Cognito.
