// Exported sites opt into browser persistence explicitly; the local launcher
// keeps its file endpoints and existing storage behavior.
export function staticSeedUrl(filename,{document=globalThis.document,baseUrl=new URL('../../',import.meta.url)}={}){
 if(document?.querySelector?.('meta[name="asfalto-persistence"]')?.content!=='browser')return null;
 return new URL('assets/configuration/'+filename,baseUrl).href;
}
