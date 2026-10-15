const generosService = require('../services/generos.service');
const { crearControladorCatalogo } = require('./catalogo.controller');

module.exports = crearControladorCatalogo(generosService, {
    creado: 'Género creado correctamente.',
    actualizado: 'Género actualizado correctamente.'
});
