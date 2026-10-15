# GameVault — Corte 2 | ÚNICA CARPETA DE TRABAJO

Este directorio es la fuente única para continuar. No mezcles archivos de los ZIP anteriores.

## Qué contiene
- `src/`: API Node.js/Express por capas (rutas, controladores, servicios, repositorios), autenticación y Swagger.
- `src/docs/openapi.json`: especificación OpenAPI 3.0 (48 operaciones documentadas).
- `database/gamevault.sql`: esquema MySQL de **10 tablas en inglés**, con restricciones. Si tu `gamevault` ya existe, **NO lo ejecutes de nuevo**.
- `database/GameVault_modelo_ingles.mwb`: diagrama editable MySQL Workbench.
- `database/restricciones_existentes.sql`: ajustes opcionales para bases ya creadas, **revisar antes de aplicar**.
- `src/tests/`: pruebas automatizadas recibidas, todavía pendientes de comprobar en la integración.
- `scripts/comprobar_mapeo_mysql.js`: comprobación con MySQL simulado; **no reemplaza** las pruebas con la base real.
- `pruebas/`, `informe/`, `entrega/`: espacios claros para añadir los entregables, sin evidencias inventadas.

## Inicio en Windows / VS Code
1. Abre esta carpeta (`GameVault_UNICO`) en VS Code. Comprueba que ves aquí `package.json`.
2. Desde tu **carpeta antigua**, COPIA (no muevas) tu `.env` privado a la raíz de esta carpeta. No compartas su contenido ni lo subas a GitHub.
   Si no tienes `.env`, duplica `.env.example`, renombra a `.env` y coloca tus propias credenciales.
3. En terminal, escribe: `npm install` (esto instalará dependencias y regenerará `package-lock.json`, ausente aquí deliberadamente porque el ZIP anterior tenía uno desactualizado).
4. Ejecuta: `npm start`.
5. Abre: http://localhost:3000/api-docs/
6. Ejecuta primero `GET /api/health` y `GET /api/videojuegos`. Luego registro/login y el resto. Registra las respuestas reales.

### Comprobaciones opcionales
- `npm run check:sql-mapping` → prueba simulada de nombres SQL, útil pero insuficiente para acreditar endpoints reales.
- `npm test` → ejecutar una vez que las dependencias estén instaladas y el entorno de pruebas esté preparado.

## Importante
- Tu MySQL actual ya tiene `gamevault` con las 10 tablas en inglés: no lo borres ni vuelvas a crear indiscriminadamente.
- El SQL en inglés y la API con rutas/campos JSON en español pueden coexistir; lo importante es que las consultas internas coincidan con las tablas.
- En este corte las contraseñas se almacenan en texto plano **solo por instrucción académica**. Es inseguro para producción; no reutilices contraseñas reales.
- La documentación de `localhost` funciona solo en tu PC. Para entregar un enlace público a Swagger se deberá publicar la documentación o desplegar la API.
- La revisión estática y las 19 consultas simuladas pasaron, pero **no se ha comprobado todavía** toda la API con tu MySQL real.

Lee `ENTREGA_PASO_A_PASO.md` para saber qué se entrega y qué no.
