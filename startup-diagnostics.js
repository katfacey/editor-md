// The native smoke-test command rejects reports outside its isolated profile.
// Capture early script failures too, before desktop bootstrap can install handlers.
(function(){
  const report=error=>window.__TAURI__?.core.invoke('smoke_result',{result:{ok:false,error:String(error?.stack||error)}}).catch(()=>{});
  window.addEventListener('error',event=>report(event.error||event.message));
  window.addEventListener('unhandledrejection',event=>report(event.reason));
})();
