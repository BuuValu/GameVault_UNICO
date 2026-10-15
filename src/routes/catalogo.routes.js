const express = require('express');
const { autenticar, soloAdministrador } = require('../middleware/auth');

/** Lectura pública; escritura solo para administradores. */
function crearRutasCatalogo(controlador) {
    const router = express.Router();

    router.get('/', controlador.listar);
    router.get('/:id', controlador.obtener);

    router.post('/', autenticar, soloAdministrador, controlador.crear);
    router.put('/:id', autenticar, soloAdministrador, controlador.actualizar);
    router.delete('/:id', autenticar, soloAdministrador, controlador.eliminar);

    return router;
}

module.exports = { crearRutasCatalogo };
