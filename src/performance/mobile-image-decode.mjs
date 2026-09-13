/** Phone-only image budget. Desktop callers keep their existing decoder. */
export async function decodeMobileBoundedImage(blob,maxDimension,{decode=globalThis.createImageBitmap,doc=globalThis.document}={}){
 const source=await decode(blob,{premultiplyAlpha:'none'}),limit=Math.max(1,Math.floor(maxDimension)),scale=Math.min(1,limit/Math.max(source.width,source.height));
 if(scale===1)return source;
 const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
 try{
  const resized=await decode(source,{resizeWidth:width,resizeHeight:height,resizeQuality:'high',premultiplyAlpha:'none'});
  if(resized.width>width||resized.height>height){if(resized!==source)resized.close?.();throw new Error('Image resize ignored');}
  if(resized!==source)source.close?.();return resized;
 }catch{
  try{const canvas=doc.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo reducir la textura');context.drawImage(source,0,0,width,height);source.close?.();return canvas;}
  catch(error){source.close?.();throw error;}
 }
}
