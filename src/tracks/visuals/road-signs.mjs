// Visual proportions from the Argentine Anexo L (P.2, P.7, I.9 and I.10).
const styles = {
  warning: {widthM: 1.13, heightM: 1.13, bottomM: 1.38, color: '#f4c331'},
  chevron: {widthM: .76, heightM: .76, bottomM: 1.25, color: '#f1f0e7'},
  place: {widthM: 2.75, heightM: .84, bottomM: 1.38, color: '#176144'},
  kilometre: {widthM: .38, heightM: .98, bottomM: -.12, color: '#e2e1d6'},
  delineator: {widthM: .13, heightM: .22, bottomM: .70, color: '#ecebe0'},
};
const ink = '#1d211e', white = '#fbfbf2', red = '#be292e', metal = '#858b87';
const thickness = .024, postDepth = .075;
const rect = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
const diamond = [[0,-.5],[.5,0],[0,.5],[-.5,0]];

/** The normal faces approaching traffic. Negative side is the driver's right. */
export function roadSignYaw([x,,z], side=0) {
  return Math.atan2(-x,-z) + side * Math.PI / 18;
}

function trace(ctx, corners, width, height, scale) {
  ctx.beginPath();
  corners.forEach(([x,y], index) => {
    ctx[index ? 'lineTo' : 'moveTo'](width * (.5 + x * scale), height * (.5 - y * scale));
  });
  ctx.closePath();
}

function drawCurve(ctx, turn, sharp) {
  ctx.scale(turn,1);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = .092;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-.16,.24);
  ctx.lineTo(-.16,.04);
  if (sharp) {
    ctx.quadraticCurveTo(-.16,-.13,-.005,-.13);
    ctx.lineTo(.135,-.13);
  } else {
    ctx.quadraticCurveTo(-.16,-.10,.11,-.17);
  }
  ctx.stroke();
  ctx.beginPath();
  if (sharp) {
    ctx.moveTo(.08,-.235);ctx.lineTo(.246,-.13);ctx.lineTo(.08,-.025);
  } else {
    ctx.moveTo(.042,-.253);ctx.lineTo(.232,-.214);ctx.lineTo(.118,-.052);
  }
  ctx.fill();
}

function drawFace(ctx, sign, w, h) {
  ctx.fillStyle = sign.color;
  ctx.fillRect(0,0,w,h);
  if (sign.kind === 'place') {
    ctx.lineWidth = .024 * h;
    ctx.strokeStyle = white;
    trace(ctx,rect,w,h,.92);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = white;
    const lines = sign.name.toLocaleUpperCase('es-AR').split('\n');
    ctx.font = 'bold ' + h * (lines.length === 1 ? .52 : .35) + 'px Arial, sans-serif';
    lines.forEach((line,i) => ctx.fillText(line,w/2,h * (.51 + (i - (lines.length-1)/2) * .39),w*.85));
  } else if (sign.kind === 'kilometre') {
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + w * .46 + 'px Arial, sans-serif';
    ctx.fillText('km',w/2,h*.20,w*.78);
    ctx.font = 'bold ' + w * .95 + 'px Arial, sans-serif';
    ctx.fillText(String(sign.km),w/2,h*.43,w*.83);
  } else if (sign.kind === 'delineator') {
    ctx.fillStyle = red;
    ctx.fillRect(w*.16,h*.16,w*.68,h*.29);
  } else {
    if (sign.kind === 'warning') {
      ctx.strokeStyle = ink;
      ctx.lineWidth = w * .026;
      ctx.lineJoin = 'round';
      trace(ctx,diamond,w,h,.87);
      ctx.stroke();
    }
    ctx.translate(w/2,h/2);
    ctx.scale(w,h);
    if (sign.kind === 'warning') drawCurve(ctx,sign.turn,sign.symbol === 'sharp');
    else {
      ctx.scale(sign.turn,1);
      ctx.strokeStyle = red;
      ctx.lineWidth = .22;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      ctx.moveTo(-.22,-.43);ctx.lineTo(.21,0);ctx.lineTo(-.22,.43);
      ctx.stroke();
    }
  }
}

function faceKey(sign) {
  return JSON.stringify([sign.kind,sign.name,sign.km,sign.turn,sign.symbol,sign.widthM,sign.heightM]);
}

function atlas(T, signs, name) {
  const unique = new Map(signs.map(sign => [faceKey(sign),sign]));
  const columns = Math.min(8,unique.size+1), rows = Math.ceil((unique.size+1)/columns);
  const cellW = 256, cellH = 128, cells = new Map();
  const canvas = globalThis.document?.createElement('canvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    canvas.width = cellW * columns;
    canvas.height = cellH * rows;
  }
  let i = 0;
  for (const [key,sign] of [['metal',null],...unique]) {
    const x = (i%columns)*cellW, y = Math.floor(i++/columns)*cellH;
    const width = cellW * columns, height = cellH * rows;
    cells.set(key,[(x+2)/width,1-(y+cellH-2)/height,(cellW-4)/width,(cellH-4)/height]);
    if (!ctx) continue;
    ctx.save();
    ctx.translate(x,y);
    if (sign) {
      // The atlas cells have a fixed aspect. Draw in physical plate proportions.
      const faceH = cellW * sign.heightM / sign.widthM;
      ctx.scale(1,cellH/faceH);
      drawFace(ctx,sign,cellW,faceH);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,cellW,cellH);
    }
    ctx.restore();
  }
  if (!ctx) return {map:null,cells};
  const map = new T.CanvasTexture(canvas);
  map.name = name + '_ATLAS';
  map.colorSpace = T.SRGBColorSpace;
  return {map,cells};
}

/** Cues are in world metres and position.y is the ground under the sign. */
export function addRoadSigns(T, root, cues, {name='ASFALTO_ROAD_SIGNS',heightAt}={}) {
  if (!cues.length) return null;
  const signs = cues.map(cue => ({...styles[cue.kind],...cue,
    turn: cue.turn < 0 ? -1 : 1, name: cue.name ?? ''}));
  const group = new T.Group();
  group.name = name;
  root.updateWorldMatrix(true,false);
  group.matrix.copy(root.matrixWorld).invert();
  group.matrixAutoUpdate = false;
  const {map,cells} = atlas(T,signs,name);
  const positions = [], uvs = [], colors = [], indices = [], supports = [];
  const color = new T.Color();

  function polygon(vertices, cell, tint) {
    const start = positions.length / 3;
    const [u,v,du,dv] = cell;
    color.set(tint);
    for (const [x,y,z,s=0,t=0] of vertices) {
      positions.push(x,y,z);uvs.push(u+s*du,v+t*dv);colors.push(color.r,color.g,color.b);
    }
    for (let i=1;i<vertices.length-1;i++) indices.push(start,start+i,start+i+1);
  }

  for (const sign of signs) {
    const {widthM:w,heightM:h,bottomM:bottom,yaw,kind} = sign;
    const [x,y,z] = sign.position;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const point = (u,v,d,s,t) => [x+u*cos+d*sin,y+v,z-u*sin+d*cos,s,t];
    const printed = cells.get(faceKey(sign)), plain = cells.get('metal');
    const frontColor = map ? '#ffffff' : sign.color;
    if (kind === 'kilometre') {
      const ground = bottom, shoulder = ground + h*.87, top = ground+h;
      const corner = w*.5, cap = corner*.62;
      const ring = [[-1,1],[1,1],[1,-1],[-1,-1]];
      for (let i=0;i<ring.length;i++) {
        const [a,b] = ring[i], [c,d] = ring[(i+1)%ring.length];
        polygon([point(a*corner,ground,b*corner,0,0),point(c*corner,ground,d*corner,1,0),
          point(c*corner,shoulder,d*corner,1,1),point(a*corner,shoulder,b*corner,0,1)],printed,frontColor);
        polygon([point(a*corner,shoulder,b*corner),point(c*corner,shoulder,d*corner),
          point(c*cap,top,d*cap),point(a*cap,top,b*cap)],plain,sign.color);
      }
      polygon(ring.map(([a,b])=>point(a*cap,top,b*cap)),plain,sign.color);
      continue;
    }
    const outline = kind === 'warning' ? diamond : rect;
    const postWidth = kind === 'delineator' ? w : postDepth;
    // The plate's back touches the post's forward surface. The sign and post
    // share the same local frame, including the 10 degree yaw at the shoulder.
    const rear = postDepth/2, front = rear + thickness, center = bottom+h/2;
    const surface = depth => outline.map(([a,b])=>point(a*w,center+b*h,depth,a+.5,b+.5));
    const face = surface(front), back = surface(rear);
    polygon(face,printed,frontColor);
    polygon(back.slice().reverse(),plain,metal);
    for (let i=0;i<outline.length;i++) {
      const next = (i+1)%outline.length;
      polygon([face[i],back[i],back[next],face[next]],plain,metal);
    }
    const top = y+bottom+h*(kind === 'warning' ? .81 : .93);
    const offsets = kind === 'place' && w>=2.2 ? [-w*.31,w*.31] : [0];
    for (const offset of offsets) {
      const px = x+offset*cos, pz = z-offset*sin;
      const ground = heightAt?.(px,pz);
      const foot = Math.min(Number.isFinite(ground) ? ground : y,top-.22)-.12;
      supports.push({px,pz,foot,top,postWidth,yaw,color:kind === 'delineator' ? sign.color : metal});
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const plates = new T.Mesh(geometry,new T.MeshStandardMaterial({map,vertexColors:true,roughness:.68}));
  plates.name = name + '_FACES';
  plates.userData.collision = false;
  group.add(plates);
  if (supports.length) {
    const posts = new T.InstancedMesh(new T.BoxGeometry(1,1,1),
      new T.MeshStandardMaterial({roughness:.79,metalness:.20}),supports.length);
    posts.name = name + '_SUPPORTS';
    posts.userData.collision = false;
    const pose = new T.Object3D();
    supports.forEach(({px,pz,foot,top,postWidth,yaw,color:tint},i) => {
      pose.position.set(px,(foot+top)/2,pz);
      pose.rotation.y = yaw;
      pose.scale.set(postWidth,top-foot,postDepth);
      pose.updateMatrix();
      posts.setMatrixAt(i,pose.matrix);
      posts.setColorAt(i,color.set(tint));
    });
    posts.instanceMatrix.needsUpdate = true;
    posts.instanceColor.needsUpdate = true;
    posts.computeBoundingSphere();
    group.add(posts);
  }
  group.userData.asfaltoRoadSigns = signs;
  root.add(group);
  return group;
}
