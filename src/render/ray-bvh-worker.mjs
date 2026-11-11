import {buildRayBvh} from './ray-bvh.mjs?v=700ea4faa3d0c8a6';
self.onmessage=({data})=>{try{const started=performance.now(),bvh=buildRayBvh(data.vertices,data.colors);self.postMessage({id:data.id,...bvh,buildMs:performance.now()-started},[bvh.bounds.buffer,bvh.triangles.buffer]);}catch(error){self.postMessage({id:data.id,error:String(error?.message||error)});}};
