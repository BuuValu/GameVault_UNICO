const etiquetasService = require('../services/etiquetas.service');
const { crearControladorCatalogo } = require('./catalogo.controller');

module.exports = crearControladorCatalogo(etiquetasService, {
    creado: 'Etiqueta creada correctamente.',
    actualizado: 'Etiqueta actualizada correctamente.'
});
