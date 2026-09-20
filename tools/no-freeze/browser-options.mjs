export function browserOptions({heap=0}={}){
 const windows=process.platform==='win32',backend=process.env.AN_ANGLE||(windows?'d3d11':'swiftshader');
 return {headless:true,executablePath:process.env.CHROME_PATH||(windows?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),args:['--use-gl=angle','--use-angle='+backend,...(backend==='swiftshader'?['--enable-unsafe-swiftshader']:[]),...(backend==='d3d11-warp'?['--ignore-gpu-blocklist']:[]),...(heap?[`--js-flags=--max-old-space-size=${heap}`]:[])]};
}
