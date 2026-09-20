/** The final cut carries its own logo from 35.4s; never stack an HTML logo on it. */
export function bindIntroBrand({intro,video,src}) {
 const logo=document.createElement('img');
 logo.className='an-intro-brand';logo.alt='Asfalto Nacional';logo.src=src;logo.hidden=true;
 intro.querySelector('.an-intro-top').prepend(logo);
 const sync=(time=video.currentTime)=>{logo.hidden=video.readyState<2 || !video.currentSrc || time>=35.4;};
 for(const event of ['loadeddata','seeked','timeupdate','playing','emptied','ended'])video.addEventListener(event,()=>sync());
 // Use presented media time at the handoff, including after seeking and replaying.
 if(video.requestVideoFrameCallback){const frame=(_,info)=>{sync(info.mediaTime);video.requestVideoFrameCallback(frame);};video.requestVideoFrameCallback(frame);}
 return logo;
}
