# Brukiz AMS

Sistema de gestión de agencias de seguros para Ficohsa Seguros. El repositorio está asociado a [johanasilva78/Brukiz](https://github.com/johanasilva78/Brukiz) y adopta la identidad visual de la aplicación corporativa de referencia.

## Primera entrega: propuesta de arquitectura

### Arquitectura

- **Web:** Next.js App Router, React, TypeScript y diseño responsive con exportación estática para la app de Amplify existente.
- **Hosting:** AWS Amplify Hosting.
- **API:** NestJS sobre AWS Lambda y API Gateway REST, con OpenAPI/Swagger.
- **Autenticación:** Amazon Cognito User Pool; el API Gateway protege las rutas con el User Pool.
- **Persistencia:** Amazon DynamoDB mediante AWS SDK v3. DynamoDB no es compatible con Prisma; se utiliza una capa de repositorios tipados con AWS SDK en lugar de ORM relacional.
- **Aislamiento:** tabla con clave compuesta `tenantId` (partition key) + `entityKey` (sort key). El backend obtiene el tenant exclusivamente del claim verificado `custom:tenantId` del token Cognito; nunca acepta el tenant enviado por el cliente.
- **Documentos:** Amazon S3, con almacenamiento y permisos por tenant en un incremento posterior.
- **Integraciones e IA:** adaptadores independientes para REST/MCP de aseguradoras y orquestación agnóstica de proveedor LLM. No se simula que una operación real de aseguradora haya sido completada.

### Modelo de datos inicial

La tabla `BrukizAmsData` usa un único patrón de acceso multi-tenant y tipos de entidad en `entityKey`: `CONTACT#`, `INSURER#`, `PRODUCT#`, `OPPORTUNITY#`, `QUOTE_REQUEST#`, `QUOTE#`, `POLICY#`, `RENEWAL#`, `CLAIM#`, `TASK#`, `DOCUMENT#` y `AUDIT#`. Las entidades se relacionan por ID y cada registro de negocio conserva su `tenantId`.

### Estructura

```text
amplify/                 Cognito, tabla DynamoDB, Lambda y API Gateway
amplify/functions/api/   API NestJS, contratos REST y acceso a DynamoDB
src/app/                 Rutas Next.js y estilos globales
src/components/          Acceso de demostración e interfaz AMS
amplify.yml              Pipeline de Amplify Hosting
```

### Menú principal

Inicio; Contactos; Oportunidades; Cotizaciones; Pólizas; Renovaciones; Siniestros; Aseguradoras; Productos; Tareas; Documentos; Reportes; Administración.

### Pantallas MVP

Inicio de sesión; dashboard; directorio y formulario de contactos; pipeline; solicitudes y propuestas; pólizas; renovaciones; siniestros; catálogos de aseguradoras y productos; tareas; documentos; reportes; administración de usuarios y agencia.

### Contratos REST iniciales

- `GET /v1/contacts` — lista contactos del tenant del usuario autenticado.
- `POST /v1/contacts` — crea contacto y evento de auditoría de forma atómica.
- `GET /v1/contacts/{id}` — consulta un contacto del tenant autenticado.
- `PATCH /v1/contacts/{id}` — actualiza campos permitidos y registra auditoría.
- `DELETE /v1/contacts/{id}` — desactiva el contacto; no borra el historial.
- `GET /v1/docs` — documentación OpenAPI, detrás de Cognito.

Los flujos de emisión, cancelación, pagos y modificaciones sensibles serán comandos separados que requieran confirmación explícita.

### Backlog priorizado

1. Crear shell responsive, experiencia visual de acceso y backend Amplify con Cognito, API REST NestJS y DynamoDB.
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

La interfaz visual y el flujo de contactos del navegador son una demostración local etiquetada: los ejemplos y cambios locales no son datos operativos y todavía no se persisten en DynamoDB. El backend Amplify sí define Cognito, DynamoDB y una API REST NestJS con tenant derivado del token y CRUD inicial de contactos. Falta conectar la interfaz a ese API y completar los módulos del MVP, la política de agencia compartida y la verificación de producción.

## Ejecución local

```sh
npm install
npm run dev
```

La interfaz inicia en modo demostrativo. Para desplegar infraestructura se requiere una cuenta/perfil AWS y ejecutar `npm run sandbox`. Amplify Hosting despliega el backend y Next.js en cada rama conectada.
