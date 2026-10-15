const { crearRutasCatalogo } = require('./catalogo.routes');

module.exports = crearRutasCatalogo(require('../controllers/etiquetas.controller'));
