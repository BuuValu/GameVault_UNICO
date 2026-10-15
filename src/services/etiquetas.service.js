const etiquetasRepository = require('../repositories/etiquetas.repository');
const { crearServicioCatalogo } = require('./catalogo.service');

module.exports = crearServicioCatalogo({
    repositorio: etiquetasRepository,
    maxNombre: 50,
    textos: {
        pk: 'id_etiqueta',
        campoUso: 'total_resenas',
        noEncontrado: 'Etiqueta no encontrada.',
        duplicado: 'Ya existe una etiqueta con ese nombre.',
        enUso: 'No se puede eliminar la etiqueta porque hay reseñas que la usan.',
        eliminado: 'Etiqueta eliminada correctamente.'
    }
});
