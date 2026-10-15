const usuariosRepository = require('../repositories/usuarios.repository');
const { errorHttp } = require('../utils/errores');
const {
    cuerpo,
    idDeRuta,
    textoRequerido
} = require('../utils/validaciones');

const MAX_NOMBRE = 100;   // VARCHAR(100)
const MAX_CORREO = 150;   // VARCHAR(150)
const MIN_CONTRASENA = 6;
const MAX_CONTRASENA = 100;

function validarCorreo(valor) {
    const correo = textoRequerido(valor, 'El correo', MAX_CORREO).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw errorHttp('Debes ingresar un correo válido.');
    }

    return correo;
}

function validarContrasena(valor) {
    if (typeof valor !== 'string' || valor.length < MIN_CONTRASENA) {
        throw errorHttp(
            `La contraseña debe tener mínimo ${MIN_CONTRASENA} caracteres.`
        );
    }

    if (valor.length > MAX_CONTRASENA) {
        throw errorHttp(
            `La contraseña no puede superar ${MAX_CONTRASENA} caracteres.`
        );
    }

    return valor;
}

async function registrar(body) {
    const datos = cuerpo(body);

    const nombre = textoRequerido(datos.nombre, 'El nombre', MAX_NOMBRE);
    const correo = validarCorreo(datos.correo);
    const contrasena = validarContrasena(datos.contrasena);

    if (datos.acepto_terminos !== true) {
        throw errorHttp('Debes aceptar los términos y condiciones.');
    }

    if (await usuariosRepository.buscarPorCorreo(correo)) {
        throw errorHttp('El correo ya está registrado.', 409);
    }

    // Si dos registros compiten, MySQL lanza ER_DUP_ENTRY y app.js lo
    // convierte en 409
    return usuariosRepository.crear({
        nombre,
        correo,
        contrasena,
        acepto_terminos: true
    });
}

async function login(body) {
    const { correo, contrasena } = cuerpo(body);

    if (
        typeof correo !== 'string' ||
        typeof contrasena !== 'string' ||
        !correo.trim() ||
        !contrasena
    ) {
        throw errorHttp('Debes ingresar correo y contraseña.');
    }

    const usuario = await usuariosRepository.buscarPorCorreo(
        correo.trim().toLowerCase()
    );

    if (!usuario || usuario.contrasena !== contrasena) {
        throw errorHttp('Correo o contraseña incorrectos.', 401);
    }

    const { contrasena: omitida, ...usuarioPublico } = usuario;

    return usuarioPublico;
}

async function listar() {
    return usuariosRepository.listar();
}

async function obtener(id) {
    const usuario = await usuariosRepository.buscarPorId(idDeRuta(id));

    if (!usuario) {
        throw errorHttp('Usuario no encontrado.', 404);
    }

    return usuario;
}

async function actualizar(id, body) {
    const idValido = idDeRuta(id);
    const datos = cuerpo(body);

    const nombre = textoRequerido(datos.nombre, 'El nombre', MAX_NOMBRE);
    const correo = validarCorreo(datos.correo);

    if (!(await usuariosRepository.buscarPorId(idValido))) {
        throw errorHttp('Usuario no encontrado.', 404);
    }

    const usuarioConCorreo = await usuariosRepository.buscarPorCorreo(correo);

    if (usuarioConCorreo && usuarioConCorreo.id_usuario !== idValido) {
        throw errorHttp('Ese correo ya pertenece a otro usuario.', 409);
    }

    return usuariosRepository.actualizar(idValido, { nombre, correo });
}

async function cambiarContrasena(id, body) {
    const idValido = idDeRuta(id);
    const contrasena = validarContrasena(cuerpo(body).contrasena);

    if (!(await usuariosRepository.buscarPorId(idValido))) {
        throw errorHttp('Usuario no encontrado.', 404);
    }

    return usuariosRepository.actualizarContrasena(idValido, contrasena);
}

/**
 * Si el usuario tiene compras, reseñas, etc. MySQL lanza
 * ER_ROW_IS_REFERENCED_2 y app.js lo convierte en 409.
 */
async function eliminar(id) {
    const eliminado = await usuariosRepository.eliminar(idDeRuta(id));

    if (!eliminado) {
        throw errorHttp('Usuario no encontrado.', 404);
    }

    return { mensaje: 'Usuario eliminado correctamente.' };
}

module.exports = {
    registrar,
    login,
    listar,
    obtener,
    actualizar,
    cambiarContrasena,
    eliminar
};