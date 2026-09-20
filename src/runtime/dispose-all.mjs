/** Finish every owner's cleanup even when one resource fails. */
export async function disposeAll(disposers,label='Resource cleanup'){
 const errors=[];
 for(const dispose of disposers)try{await dispose();}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(errors,label);
}

/** Synchronous scene teardown still retires every owner when one fails. */
export function disposeAllSync(disposers,label='Resource cleanup'){
 const errors=[];for(const dispose of disposers)try{dispose();}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(errors,label);
}
