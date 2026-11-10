const DRIVERS = [
  {skin:0xb98562, shirt:0x344650, trousers:0x3c3f43, hair:0x28211c, cap:null, width:.96},
  {skin:0x7f5542, shirt:0x777b51, trousers:0x414747, hair:0x1d1919, cap:0x4a4231, width:1.07},
  {skin:0xdbad8f, shirt:0x794b3e, trousers:0x3f4950, hair:0x493025, cap:null, width:.89},
  {skin:0xa7795d, shirt:0x687981, trousers:0x4f4640, hair:0x514841, cap:0x3f4c54, width:1.04},
  {skin:0x8d624f, shirt:0x6d4b54, trousers:0x353638, hair:0x251e1e, cap:null, width:.93},
  {skin:0xc7956c, shirt:0x64644f, trousers:0x47484b, hair:0x6d5e4a, cap:0x755039, width:1.01},
];

// All coordinates are in the car's real metre space. The hood is toward -X.
export function createTrafficDriver(T, {eye, wheel, roofM}) {
  const [ex,ey,ez]=eye, [wx,wy,wz]=wheel, headY=Math.min(ey+.018,roofM-.145);
  const root=new T.Group();
  root.name='TrafficDriver';
  root.userData.asfaltoPrewarm=true;
  const sphere=new T.SphereGeometry(1,12,8).toNonIndexed();
  const scalp=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI*.52).toNonIndexed();
  const up=new T.Vector3(0,1,0), a=new T.Vector3(), b=new T.Vector3(), delta=new T.Vector3();
  const matrix=new T.Matrix4(), q=new T.Quaternion(), p=new T.Vector3(), scale=new T.Vector3();
  const palette=['skin','shirt','trousers','hair','cap'];
  const blob=(point,axes,geometry=sphere)=>({point,axes,geometry});
  const limb=(start,end,radius)=>{
    a.fromArray(start);b.fromArray(end);delta.subVectors(b,a);
    const length=delta.length();
    return {point:a.addScaledVector(delta,.5).toArray(),axes:[radius,length*.54+radius*.27,radius],
      rotation:new T.Quaternion().setFromUnitVectors(up,delta.normalize()),geometry:sphere};
  };
  function pose(parked) {
    const shoulder=[ex+.11,headY-.235,ez], hips=[ex+.17,headY-.48,ez], kneeX=ex-.23;
    const skin=[blob([ex,headY,ez],[.104,.122,.086]),
      blob([ex-.095,headY-.006,ez],[.034,.026,.021]),
      blob([ex+.022,headY-.12,ez],[.052,.076,.050])];
    const shirt=[limb(shoulder,hips,.13),blob([ex+.116,headY-.26,ez],[.112,.115,.184])];
    const trousers=[blob(hips,[.14,.10,.17])];
    for(const side of [-1,1]){
      skin.push(blob([ex+.005,headY-.009,ez+side*.083],[.024,.037,.017]));
      const hip=[hips[0],hips[1],ez+side*.075], knee=[kneeX,hips[1]-.035,ez+side*.10];
      trousers.push(limb(hip,knee,.074),limb(knee,[kneeX-.075,hips[1]-.235,ez+side*.10],.055));
      const joint=[shoulder[0],shoulder[1]-.016,ez+side*.145];
      const elbow=[ex-.075,parked?headY-.38:wy-.105,ez+side*.18];
      const hand=parked?[ex-.17,headY-.41,ez+side*.10]:[wx,wy+.084,wz+side*.134];
      shirt.push(limb(joint,elbow,.052),limb(elbow,hand,.036));
      skin.push(blob(hand,[.039,.024,.022]));
    }
    const hair=[blob([ex+.008,headY+.009,ez],[.106,.123,.089],scalp),
      ...[-1,1].map(side=>blob([ex-.086,headY+.026,ez+side*.034],[.008,.008,.014]))];
    const cap=[blob([ex+.004,headY+.034,ez],[.114,.105,.093],scalp),
      blob([ex-.074,headY+.060,ez],[.097,.011,.085])];
    return [skin,shirt,trousers,hair,cap].map(parts=>{
      const size=parts.reduce((sum,part)=>sum+part.geometry.attributes.position.array.length,0);
      const positions=new Float32Array(size), normals=new Float32Array(size);
      let offset=0;
      for(const part of parts){
        const copy=part.geometry.clone();
        matrix.compose(p.fromArray(part.point),part.rotation||q.identity(),scale.fromArray(part.axes));
        copy.applyMatrix4(matrix);
        positions.set(copy.attributes.position.array,offset);
        normals.set(copy.attributes.normal.array,offset);
        offset+=copy.attributes.position.array.length;copy.dispose();
      }
      const baked=new T.BufferGeometry();
      baked.setAttribute('position',new T.BufferAttribute(positions,3));
      baked.setAttribute('normal',new T.BufferAttribute(normals,3));
      return baked;
    });
  }
  const driving=pose(false), parked=pose(true);
  sphere.dispose();scalp.dispose();
  const meshes=palette.map((part,i)=>{
    const mesh=new T.Mesh(driving[i],new T.MeshStandardMaterial({roughness:.86}));
    mesh.name='TrafficDriver_'+part;
    mesh.userData.asfaltoPrewarm=true;
    root.add(mesh);return mesh;
  });
  function setVariant(index) {
    const variant=DRIVERS[index]||DRIVERS[0];
    for(const [i,mesh] of meshes.entries())mesh.material.color.setHex(variant[palette[i]]??0x34312e);
    meshes[4].visible=variant.cap!==null;
    // Tailoring changes shoulder breadth within the seat's envelope.
    meshes[1].scale.z=variant.width;
    meshes[1].position.z=ez*(1-variant.width);
  }
  setVariant(0);
  return {
    root,setVariant,
    setParked(value) {const pose=value?parked:driving;meshes.forEach((mesh,i)=>{mesh.geometry=pose[i];});},
    dispose() {
      root.removeFromParent();root.clear();
      meshes.forEach(mesh=>mesh.material.dispose());
      [...driving,...parked].forEach(geometry=>geometry.dispose());
    },
  };
}
