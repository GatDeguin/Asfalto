/** A fault stops simulation/render work, not the owner's single scheduling loop.
 * Recovery is an explicit user action; there is no automatic per-frame retry. */
export function createFrameFailureBoundary({onFault=()=>{}}={}) {
  let fault=null, reports=0, recoveries=0, reportingFailure=null;
  function fail(error) {
    fault=error instanceof Error?error:new Error(String(error));
    reports++;
    try { onFault(fault); } catch(secondary) { reportingFailure=String(secondary?.message||secondary); }
    return false;
  }
  return Object.freeze({
    run(frame) {
      if(fault)return false;
      try { frame();return true; } catch(error) { return fail(error); }
    },
    recover(verify) {
      if(!fault)return true;
      try { verify();fault=null;reportingFailure=null;recoveries++;return true; }
      catch(error) { return fail(error); }
    },
    diagnostics:()=>({fault:fault?{name:fault.name,message:fault.message}:null,reports,recoveries,reportingFailure}),
  });
}
