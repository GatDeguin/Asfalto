// Authored beats, in travel order. End stations refer to the canonical route;
// return stations come from its existing chapters. Labels describe this game
// world, not real signage, an advisory speed, or an invitation to leave the road.
// [endM, intent, local label, anchor fraction, why]
const outbound = {
  dos_lagos: [
    [1250,'place','Espejo Villarino',.20,'Presentar el agua y el ritmo de entrada antes del bosque.'],
    [3100,'curve','Túnel de Coihues',.58,'Anticipar el cierre del bosque; sostener el giro de menor radio.'],
    [4850,'curve','Cornisa del Buque',.30,'Dar una referencia exterior donde el camino gira sobre el lago.'],
    [6050,'place','Istmo de Dos Aguas',.34,'Nombrar la transición entre las dos orillas sin competir con el agua.'],
    [8550,'quiet','Descenso Falkner',.60,'Dejar que la pendiente y la apertura expliquen el tramo rápido.'],
    [10250,'curve','Playa de Piedra',.40,'Leer la última curva cerrada antes de la bahía de llegada.'],
  ],
  aconcagua_horcones: [
    [2200,'place','Valle de Horcones',.20,'Marcar el comienzo del ascenso sobre el fondo abierto.'],
    [5000,'quiet','Corredor bajo',.50,'Dejar larga la mirada y dejar visible la escala del valle.'],
    [7600,'place','Piedemonte',.39,'Dar una referencia de avance en la transición de llanura a faldeo.'],
    [10400,'quiet','Aproximación alta',.50,'Reservar el primer plano para el relieve y la profundidad.'],
    [12800,'place','Quebrada de Horcones',.24,'Preparar la primera compresión del camino sin simular un giro brusco.'],
    [15100,'quiet','Faldeo alto',.50,'Dejar leer la pendiente y la serie de curvas largas.'],
    [18400,'place','Valle alto',.31,'Recuperar una referencia humana después del faldeo.'],
    [21000,'quiet','Abra de llegada',.50,'Reservar la apertura final para el perfil de montaña.'],
  ],
  cuesta_lipan: [
    [1700,'place','Cuesta de Lipán',.24,'Poner nombre a la entrada de la subida, todavía espaciosa.'],
    [4200,'quiet','Laderas bajas',.50,'Dejar espacio entre la bienvenida y la primera horquilla.'],
    [7700,'curve','Caracoles de Lipán',.45,'Hacer legible la horquilla dominante y su salida hacia la ladera siguiente.'],
    [10100,'place','Terrazas de la cuesta',.38,'Dar referencia de altura al salir del grupo de horquillas.'],
    [12600,'curve','Repisas de piedra',.30,'Apoyar la contracurva más cerrada sin repetir placas de aviso.'],
    [16000,'quiet','Puna abierta',.50,'Cambiar de ritmo con una pausa visual en la recta alta.'],
    [18500,'place','Camino del abra',.44,'Enmarcar el último cambio de exposición antes del llano alto.'],
    [20000,'quiet','Abra alta',.50,'Entregar la llegada al cielo y la topografía.'],
  ],
  paso_garibaldi: [
    [2500,'curve','Entrada al bosque',.34,'Hacer visible el primer giro que cierra la vista.'],
    [5200,'quiet','Bosque húmedo',.50,'Dejar un tramo de adaptación antes de la subida.'],
    [7900,'curve','Ladera de lenga',.76,'Sostener el primer giro fuerte de la subida, sobre la margen exterior.'],
    [10500,'place','Subida del paso',.58,'Orientar después de la curva sin repetir su aviso.'],
    [13200,'curve','Repisas del paso',.54,'Guiar el giro que corta la vista a media subida.'],
    [16000,'curve','Alto del paso',.53,'Anclar el cambio de sentido más cerrado antes de abrir la vista.'],
    [18800,'curve','Bajada fueguina',.41,'Dar apoyo exterior en la primera curva crítica de bajada.'],
    [21500,'place','Bajo del valle',.37,'Recuperar orientación con una placa baja cuando vuelve a abrir el camino.'],
    [24000,'quiet','Fondo del valle',.50,'Dejar que el bosque y el camino cierren la ida.'],
  ],
  cataratas_iguazu: [
    [1150,'place','Portal Verde',.25,'Dar escala a la entrada y dejar abierto el primer túnel vegetal.'],
    [2300,'curve','Lomo Colorado',.78,'Advertir el giro cerrado que sigue al lomo de laterita.'],
    [3450,'place','Arroyo Negro',.31,'Nombrar el cruce sin poner mobiliario junto al agua.'],
    [4550,'quiet','Caracol Basáltico',.50,'Dejar que la piedra guíe la curva larga sin más señales.'],
    [5850,'quiet','Túnel Verde',.50,'Conservar el paso estrecho de selva como transición.'],
    [7000,'place','Puente del Vapor',.33,'Preparar el cruce y retirar la señalización del puente.'],
    [8100,'curve','Eses del Guatambú',.72,'Guiar sólo la ese de mayor cambio de rumbo.'],
    [9350,'quiet','Balcón del Salto',.50,'Reservar la vista central para la catarata.'],
    [10600,'curve','Garganta Roja',.30,'Marcar el giro bajo del corte rojo antes del enlace.'],
  ],
};

// [intent, anchor fraction, why] for the five existing return landscapes.
const returning = {
  dos_lagos: [
    ['curve',.23,'Leer la salida de la bahía antes de perder el lago.'],
    ['curve',.54,'Guiar sólo la contracurva que cierra la vista entre coihues.'],
    ['place',.24,'Dar nombre al abra antes de dejar el panorama libre.'],
    ['quiet',.50,'Dejar que el corte boscoso lleve la mirada sin carteles.'],
    ['curve',.58,'Avisar el último cambio de rumbo antes del tramo de ribera.'],
  ],
  aconcagua_horcones: [
    ['curve',.83,'Sostener el giro exterior al bajar de la quebrada.'],
    ['place',.28,'Dar escala al tramo largo de acarreo; mantener el horizonte libre.'],
    ['quiet',.50,'Dejar que los depósitos y el camino expliquen el abanico.'],
    ['curve',.88,'Señalar el cambio de rumbo en el pie de monte.'],
    ['curve',.73,'Avisar el último giro cerrado antes del enlace a largada.'],
  ],
  cuesta_lipan: [
    ['curve',.22,'Preparar la primera curva de bajada desde las repisas.'],
    ['curve',.26,'Marcar el giro dominante del grupo de contracurvas.'],
    ['place',.24,'Ofrecer una referencia donde se abren las capas de roca.'],
    ['curve',.38,'Ayudar a leer la bajada antes del punto más cerrado.'],
    ['quiet',.50,'Dejar descansar la vista en la entrada al abra baja.'],
  ],
  paso_garibaldi: [
    ['curve',.27,'Volver a leer el camino al cerrarse el bosque.'],
    ['place',.30,'Identificar la turbera antes de dejar su plano bajo abierto.'],
    ['curve',.63,'Guiar el cambio brusco de rumbo sin bloquear el mirador.'],
    ['quiet',.50,'Dejar que el bosque de lenga marque la transición.'],
    ['curve',.58,'Sostener el giro final antes del arroyo y la entrada.'],
  ],
  cataratas_iguazu: [
    ['curve',.65,'Anticipar el giro que queda cubierto por la selva.'],
    ['place',.27,'Nombrar el basalto antes de pasar cerca del corte.'],
    ['quiet',.50,'Dejar que el agua y la vegetación sostengan el tramo.'],
    ['curve',.63,'Separar el giro de la mancha de suelo húmedo.'],
    ['place',.27,'Cerrar la vuelta con una referencia al reabrirse la selva.'],
  ],
};

export function directionSectors(id,leg,chapters,lengthM){
  if(leg==='return')return chapters.flatMap((chapter,i)=>{
    const row=returning[id]?.[i];
    return row?[{...chapter,intent:row[0],anchor:row[1],reason:row[2]}]:[];
  });
  let startM=0;
  return (outbound[id]||[]).flatMap(([endM,intent,name,anchor,reason],i)=>{
    const start=startM;startM=endM;
    return start<lengthM?[{id:id==='cataratas_iguazu'?`igz_0${i+1}`:`s0${i+1}`,startM:start,endM:Math.min(endM,lengthM),intent,name,anchor,reason}]:[];
  });
}
