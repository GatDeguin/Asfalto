// Pure draft catalog: deliberately not imported by the live menu until host review.
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const CATALOG_VERSION=1;
export const CHAMPIONSHIPS=freeze([
 {id:'cinco_horizontes',title:'Cinco horizontes',length:'Corta',iterations:1,requires:null,story:'Primera carpeta de ruta: conocer cada paisaje y regresar con una llegada válida.'},
 {id:'oficio_ruta',title:'Oficio de ruta',length:'Media',iterations:2,requires:'cinco_horizontes',story:'La misma ruta exige otras decisiones al caer la luz o mojarse el asfalto.'},
 {id:'gran_nacional',title:'Gran Nacional',length:'Larga',iterations:3,requires:'oficio_ruta',story:'Cerrar el archivo del taller reuniendo conducción diurna, noche y tiempo adverso.'},
]);
const ROUTES=freeze([
 {id:'dos_lagos',title:'Dos Lagos',conditions:[['clear','clear'],['golden-hour','cloudy'],['moonrise','clear']],shape:'twin-water-arches-pine',material:'patinated-bronze-turquoise-enamel',heightM:.24},
 {id:'aconcagua_horcones',title:'Horcones',conditions:[['golden-hour','clear'],['overcast','fog'],['night','clear']],shape:'angular-summit-u-valley',material:'brushed-aluminium-grey-stone',heightM:.26},
 {id:'cuesta_lipan',title:'Lipán',conditions:[['clear','clear'],['sunset','cloudy'],['moonrise','clear']],shape:'three-hairpin-ribbon',material:'copper-terracotta',heightM:.25},
 {id:'paso_garibaldi',title:'Garibaldi',conditions:[['overcast','cloudy'],['golden-hour','rain'],['night','fog']],shape:'mountain-pass-austral-leaf',material:'satin-nickel-green-enamel',heightM:.24},
 {id:'cataratas_iguazu',title:'Iguazú',conditions:[['clear','clear'],['overcast','rain'],['night','storm']],shape:'horseshoe-water-curtain',material:'brass-matte-green-glass',heightM:.26},
]);
const MEDALS=[['vmax','Aguja al extremo','needle-limit'],['accel100','0–100','dual-ring-100'],['accel160','0–160','extended-ring-160'],['m500','500 metros','straight-five-markers'],['m1000','1.000 metros','straight-ten-markers'],['recovery','Recuperación','fourth-gear-80-120-arc'],['brake100','Frenada','disc-decreasing-marks'],['slalom','Slalom','alternating-gates'],['turn','Diámetro de giro','turning-circle'],['wet','Ruta húmeda','drop-tread'],['speedo','Error de velocímetro','two-comparison-needles'],['consumption','Consumo constante','measuring-vial-leaf']];
export const AWARDS=freeze([
 ...ROUTES.map(r=>({id:'route:'+r.id,kind:'route-trophy',trackId:r.id,title:r.title,shape:r.shape,material:r.material,heightM:r.heightM,slot:'routes/'+r.id,requires:'valid-authoritative-race-win'})),
 ...MEDALS.map(([id,title,shape])=>({id:'test:'+id,kind:'test-medal',testId:id,title,shape,material:'antique-bronze',heightM:.065,slot:'medals/'+id,requires:'valid-physical-objective'})),
 ...CHAMPIONSHIPS.map((c,i)=>({id:'cup:'+c.id,kind:'cup',championshipId:c.id,title:c.title,shape:['five-window-low-cup','double-ribbon-twin-handle','three-ribbon-five-route-crown'][i],material:['bronze','silver','golden-brass'][i],heightM:[.38,.45,.54][i],slot:'cups/'+c.id,requires:'completed-season-champion'})),
]);
export function createSchedule(championshipId){const c=CHAMPIONSHIPS.find(x=>x.id===championshipId);if(!c)throw new RangeError('Unknown championship');return Array.from({length:c.iterations},(_,iteration)=>ROUTES.map(r=>({id:`${c.id}:${iteration+1}:${r.id}`,iteration:iteration+1,trackId:r.id,skyId:r.conditions[iteration][0],weather:r.conditions[iteration][1],mode:'race',laps:1,difficulty:'normal'}))).flat();}
