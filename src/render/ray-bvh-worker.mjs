import {buildRayBvh} from './ray-bvh.mjs?v=21cf5c1ad552d81e';
self.onmessage=({data})=>{try{const started=performance.now(),bvh=buildRayBvh(data.vertices);self.postMessage({id:data.id,...bvh,buildMs:performance.now()-started},[bvh.bounds.buffer,bvh.triangles.buffer]);}catch(error){self.postMessage({id:data.id,error:String(error?.message||error)});}};
