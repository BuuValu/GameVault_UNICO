/**
 * Controlador compartido por géneros y etiquetas. En Express 5 los errores
 * de los handlers async llegan solos al manejador global de app.js.
 */
function crearControladorCatalogo(servicio, mensajes) {
    return {
        async listar(req, res) {
            res.status(200).json(await servicio.listar());
        },

        async obtener(req, res) {
            res.status(200).json(await servicio.obtener(req.params.id));
        },

        async crear(req, res) {
            const registro = await servicio.crear(req.body);
            res.status(201).json({ mensaje: mensajes.creado, ...registro });
        },

        async actualizar(req, res) {
            const registro = await servicio.actualizar(req.params.id, req.body);
            res.status(200).json({ mensaje: mensajes.actualizado, ...registro });
        },

        async eliminar(req, res) {
            res.status(200).json(await servicio.eliminar(req.params.id));
        }
    };
}

module.exports = { crearControladorCatalogo };
