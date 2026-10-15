// Comprobación de compatibilidad SQL con filas simuladas; NO sustituye las pruebas con MySQL.
// Inyecta un driver simulado que retorna FILAS CON NOMBRES INGLESES como el esquema real.
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const originalLoad=Module._load;
const calls=[];
const mocks={
  'video_games':[{video_game_id:5,name:'Hollow Knight',image_url:null,description:'Juego',price:'100',age_rating:'TODOS',is_active:1,promedio_calificacion:null,total_resenas:0}],
  'video_game_genres':[{video_game_id:5,genre_id:2,name:'Acción'}],
  'users':[{user_id:2,name:'Usuario test',email:'test@example.org',password:'123456',role:'administrator',accepted_terms:1,registration_date:'2026-01-01'}],
  'purchases':[{purchase_id:3,user_id:2,video_game_id:5,purchase_date:'2026-01-01',price_paid:'100',status:'confirmed',videojuego_nombre:'Hollow Knight',usuario_nombre:'Usuario test'}],
  'reviews':[{review_id:7,user_id:2,usuario_nombre:'Usuario test',video_game_id:5,videojuego_nombre:'Hollow Knight',rating:5,comment:'Bien',hours_played:'5',review_date:'2026-01-01'}],
  'review_tags':[{review_id:7,tag_id:4,name:'Increíble'}],
  'achievements':[{achievement_id:8,video_game_id:5,name:'Primer paso',description:'Completa misión',type:'progress',target:10}],
  'achievement_progress':[{user_id:2,achievement_id:8,progress:3,is_unlocked:0,unlock_date:null,video_game_id:5,logro_nombre:'Primer paso',type:'progress',target:10}],
  'genres':[{genre_id:2,name:'Acción',total_videojuegos:1}],
  'tags':[{tag_id:4,name:'Increíble',total_resenas:1}]
};
const schema=new Set(Object.keys(mocks));
function validate(sql){
  for(const mt of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([\w]+)/gi)) {
    if (!schema.has(mt[1])) throw new Error('Tabla SQL inesperada: '+mt[1]+' SQL: '+sql);
  }
}
let updatedPurchase=[];
let insertedAchievement=[];
const mockPool={
 async execute(sql,params){return this.query(sql,params)},
 async query(sql,params){
    calls.push({sql,params});validate(sql);
    let tableMatch=sql.match(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([\w]+)/i);
    let table=tableMatch?.[1];
    if (/\bFROM video_games v\b/i.test(sql)) table = 'video_games';
    if(/^\s*SELECT COUNT\(/i.test(sql)) return [[{total:1}], []];
    if(/^\s*SELECT 1\b/i.test(sql))return [[{exists:1}], []];
    if(/^\s*SELECT\b/i.test(sql)){
       const rows=mocks[table] || [];
       if(/\bIN\s*\(\?\)/i.test(sql)) return [rows,[]];
       if(/\bWHERE\b/i.test(sql) && /id\s*=\s*\?/i.test(sql)) return [rows.slice(0,1),[]];
       return [rows,[]];
    }
    if(/UPDATE purchases SET status/i.test(sql))updatedPurchase=params;
    if(/INSERT INTO achievements/i.test(sql))insertedAchievement=params;
    return [{affectedRows:1,insertId:10}, []];
 }
};
Module._load=function(request,parent,isMain){
 if(request==='mysql2/promise') return {createPool:()=>mockPool};
 if(request==='dotenv')return {config:()=>{}};
 return originalLoad.apply(this,arguments);
};
async function run(){
 const root=path.resolve(__dirname, '..', 'src');
 const req=x=>require(path.join(root,'repositories',x+'.repository.js'));
 const users=req('usuarios');
 const u=await users.buscarPorCorreo('test@example.org');
 assert.equal(u.id_usuario,2);assert.equal(u.nombre,'Usuario test');assert.equal(u.rol,'administrador');assert.equal(u.contrasena,'123456');
 const g=req('generos');
 assert.equal((await g.listar())[0].id_genero,2);
 assert.deepEqual(await g.idsExistentes([2]),[2]);
 const e=req('etiquetas'); assert.deepEqual(await e.idsExistentes([4]),[4]);
 const games=req('videojuegos');
 const gamesResponse=await games.listar({activo:true,orden:'nombre',limite:20,offset:0});
 assert.equal(gamesResponse.videojuegos[0].id_videojuego,5);
 assert.equal(gamesResponse.videojuegos[0].nombre,'Hollow Knight');
 assert.equal(gamesResponse.videojuegos[0].generos[0].nombre,'Acción');
 const compras=req('compras');
 assert.equal((await compras.buscarPorId(3)).estado,'confirmada');
 await compras.cambiarEstado(3,'pendiente','confirmada');
 assert.deepEqual(updatedPurchase,['confirmed',3,'pending']);
 await compras.listar({estado:'confirmada',limite:20,offset:0});
 assert.ok(calls.some(x=>x.sql.includes('c.status = ?')&&x.params.includes('confirmed')));
 const logros=req('logros');
 assert.equal((await logros.buscarPorId(8)).tipo,'progreso');
 await logros.crear(5,{nombre:'Prueba',descripcion:'desc',tipo:'progreso',meta:10});
 assert.equal(insertedAchievement[3],'progress');
 const prog=req('progreso');
 assert.equal((await prog.buscar(2,8)).progreso,3);
 assert.equal((await prog.buscar(2,8)).tipo,'progreso');
 const reviews=req('resenas');
 const review=await reviews.buscarPorId(7);
 assert.equal(review.id_resena,7);
 assert.equal(review.etiquetas[0].id_etiqueta,4);
 console.log(`PASS: usuarios, catálogos, videojuegos, compras/estados, logros/tipos, progreso, reseñas; ${calls.length} consultas simuladas.`);
}
run().catch(err=>{console.error(err);process.exitCode=1});
