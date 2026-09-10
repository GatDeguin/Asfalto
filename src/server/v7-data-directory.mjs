import {mkdir,copyFile,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
export async function prepareV7DataDirectory({sourceDirectory,targetDirectory}){
 const source=path.resolve(sourceDirectory),target=path.resolve(targetDirectory);
 if(source===target)throw new RangeError('El destino v7 debe ser diferente del original.');
 await mkdir(target,{recursive:true});
 let sourceReal;try{sourceReal=await realpath(source);}catch(error){if(error.code!=='ENOENT')throw error;}
 const targetReal=await realpath(target);
 if(sourceReal===targetReal)throw new RangeError('El destino v7 debe ser diferente del original.');
 for(const file of ['cockpit-layout.json','iluminacion-carreras.json']){
  try{await copyFile(path.join(source,file),path.join(target,file),constants.COPYFILE_EXCL);}
  catch(error){if(error.code!=='EEXIST'&&error.code!=='ENOENT')throw error;}
 }
 return targetReal;
}
