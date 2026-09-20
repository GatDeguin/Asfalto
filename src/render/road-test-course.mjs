/** Visual markers share the exact committed gate positions used by the physical validator. */
export function createRoadTestCoursePresentation(T,{scene}={}) {
  if(!scene?.add)throw new TypeError('Road-test course needs a scene');
  let root=null,sessionSequence=null,referenceChart=0,disposed=false,triangles=0;
  const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  function validate(gates,sequence){
    if(!Number.isSafeInteger(sequence)||sequence<0||!Array.isArray(gates)||gates.length!==8)throw new TypeError('Eight physical gates and a session are required');
    for(const g of gates)if(!g?.id||!vector(g.center)||!vector(g.left)||!vector(g.forward)||!Number.isFinite(g.halfWidthM)||g.halfWidthM<=.93||Math.abs(Math.hypot(...g.left)-1)>.001||Math.abs(Math.hypot(...g.forward)-1)>.001||Math.abs(g.left.reduce((v,x,i)=>v+x*g.forward[i],0))>.001)throw new TypeError('Invalid physical gate');
  }
  function clear(){
    if(root){root.removeFromParent();for(const mesh of root.children){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}root.clear();root=null;}
    sessionSequence=null;referenceChart=0;triangles=0;
  }
  function set(gates,{sessionSequence:sequence,referenceChart:chart=0}={}){
    if(disposed)throw new Error('Road-test course disposed');validate(gates,sequence);
    const next=new T.Group();next.name='RoadTestCourse_Markers';next.userData.visualOnly=true;
    const specifications=[
      ['Base',new T.BoxGeometry(.39,.035,.39),new T.MeshStandardMaterial({color:'#30312c',roughness:.92}),.025],
      ['Cone',new T.CylinderGeometry(.038,.155,.62,12,1,false),new T.MeshStandardMaterial({color:'#da5c18',roughness:.72}),.3525],
      ['Band',new T.CylinderGeometry(.078,.107,.145,12,1,true),new T.MeshStandardMaterial({color:'#e0dfcd',roughness:.58}),.385],
    ];
    const matrix=new T.Matrix4(),basis=new T.Matrix4(),quaternion=new T.Quaternion(),one=new T.Vector3(1,1,1);
    for(const [name,geometry,material,height] of specifications){
      const mesh=new T.InstancedMesh(geometry,material,16);mesh.name='RoadTestCourse_'+name;mesh.castShadow=name!=='Band';mesh.receiveShadow=true;
      for(let i=0;i<8;i++){
        const g=gates[i],left=new T.Vector3().fromArray(g.left),forward=new T.Vector3().fromArray(g.forward),normal=new T.Vector3().crossVectors(left,forward).normalize();
        // Cylinder +Y follows the physical cross-section normal; bases stay on the same road plane.
        basis.makeBasis(left,normal,forward.clone().negate());quaternion.setFromRotationMatrix(basis);
        for(let side=0;side<2;side++){const position=new T.Vector3().fromArray(g.center).addScaledVector(left,(side?1:-1)*g.halfWidthM).addScaledVector(normal,height);matrix.compose(position,quaternion,one);mesh.setMatrixAt(i*2+side,matrix);}
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();next.add(mesh);
    }
    clear();root=next;sessionSequence=sequence;referenceChart=chart;triangles=root.children.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3*16,0);scene.add(root);return diagnostics();
  }
  function rebase({matrix,referenceChart:chart}){
    if(!root)return;
    if(!Array.isArray(matrix)||matrix.length!==16||!matrix.every(Number.isFinite)||matrix[3]!==0||matrix[7]!==0||matrix[11]!==0||matrix[15]!==1||!Number.isSafeInteger(chart))throw new TypeError('Rigid gate rebase required');
    const axes=[0,4,8].map(i=>new T.Vector3().fromArray(matrix,i));const determinant=axes[0].dot(new T.Vector3().crossVectors(axes[1],axes[2]));
    if(axes.some(v=>Math.abs(v.length()-1)>1e-6)||Math.abs(axes[0].dot(axes[1]))>1e-6||Math.abs(axes[0].dot(axes[2]))>1e-6||Math.abs(axes[1].dot(axes[2]))>1e-6||Math.abs(determinant-1)>1e-6)throw new TypeError('Rigid gate rebase required');
    root.updateMatrix();root.applyMatrix4(new T.Matrix4().fromArray(matrix));root.updateMatrixWorld(true);referenceChart=chart;
  }
  function diagnostics(){return Object.freeze({sessionSequence,referenceChart,gateCount:root?8:0,markerCount:root?16:0,drawCalls:root?3:0,triangles,colliders:0,disposed});}
  return Object.freeze({set,clear,rebase,diagnostics,dispose(){if(disposed)return;clear();disposed=true;}});
}
