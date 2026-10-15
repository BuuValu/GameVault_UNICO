/**
 * Crea un error con código HTTP. Los servicios lo lanzan y el manejador
 * global de app.js lo convierte en una respuesta JSON.
 */
function errorHttp(mensaje, status = 400, detalles) {
    const error = new Error(mensaje);
    error.status = status;

    if (detalles) {
        error.detalles = detalles;
    }

    return error;
}

module.exports = { errorHttp };
