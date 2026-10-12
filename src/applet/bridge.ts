// Script injected at the top of every applet page. It gives the applet
// window.conductor and speaks the postMessage protocol in contract.ts.
// Each update carries the seq of the last setState applied, so the host can
// drop updates the applet sent before it saw the host's latest push.
const BRIDGE = `<script>(function(){
var handlers=null,seq=0;
function send(m){parent.postMessage(m,"*");}
window.conductor={
connect:function(h){handlers=h;send({cc:"connect"});},
update:function(state,phase){send({cc:"update",state:JSON.parse(JSON.stringify(state===undefined?null:state)),phase:phase|0,seq:seq});},
filters:function(list){send({cc:"filters",filters:JSON.parse(JSON.stringify(list||[]))});},
tool:function(name,options){send({cc:"tool",tool:String(name),options:JSON.parse(JSON.stringify(options===undefined?{}:options))});}
};
window.addEventListener("message",function(e){
if(e.source!==parent||!handlers)return;
var m=e.data;
if(!m)return;
if(m.cc==="setState"){seq=m.seq;handlers.setState(m.state,m.phase);}
else if(m.cc==="phaseLimit"&&handlers.setPhaseLimit)handlers.setPhaseLimit(m.maxPhase);
else if(m.cc==="context"&&handlers.setContext)handlers.setContext(m.context);
});
window.addEventListener("keydown",function(e){
if((e.ctrlKey||e.metaKey)&&e.key==="."){e.preventDefault();send({cc:"shortcut"});}
},true);
})();</script>`;

/** Returns the applet page with the bridge running before any applet script. */
export function withBridge(html: string): string {
  for (const tag of [/<head[^>]*>/i, /<html[^>]*>/i]) {
    const m = tag.exec(html);
    if (m) {
      const at = m.index + m[0].length;
      return html.slice(0, at) + BRIDGE + html.slice(at);
    }
  }
  return BRIDGE + html;
}
