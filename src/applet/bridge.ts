// Script injected at the top of every applet page. It gives the applet
// window.conductor and speaks the postMessage protocol in contract.ts.
// Each update carries the seq of the last setState applied, so the host can
// drop updates the applet sent before it saw the host's latest push.
// Ctrl+., Cmd+. and the middle button toggle the projection overlay. B, G, J, R, W and Escape go to the host as hotkeys once the event has run its course, unless the applet called preventDefault.
// Once the host sends a slideshow message (teacher's frame, applets with slides),
// S and, while on, the step keys and the wheel go to the host instead of the applet.
// The wheel rule matches wheelGesture in src/teacher/slides.ts: every wheel event steps once.
const BRIDGE = `<script>(function(){
var handlers=null,seq=0,slideshow=null;
function send(m){parent.postMessage(m,"*");}
function typing(t){return !!(t&&t.nodeType===1&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable||(t.closest&&t.closest('[role="textbox"]'))));}
function stop(e){e.preventDefault();e.stopImmediatePropagation();}
window.conductor={
connect:function(h){handlers=h;send({cc:"connect"});},
update:function(state,phase){send({cc:"update",state:JSON.parse(JSON.stringify(state===undefined?null:state)),phase:phase|0,seq:seq});},
filters:function(list){send({cc:"filters",filters:JSON.parse(JSON.stringify(list||[]))});},
timer:function(seconds,opts){send({cc:"timer",seconds:seconds==null?null:Number(seconds),shared:!(opts&&opts.shared===false)});},
wheel:function(options){send({cc:"wheel",options:JSON.parse(JSON.stringify(options===undefined?{}:options))});},
spotlight:function(student){send({cc:"spotlight",student:student==null?null:String(student)});},
controls:function(list){send({cc:"controls",controls:JSON.parse(JSON.stringify(list||[]))});}
};
window.addEventListener("message",function(e){
if(e.source!==parent||!handlers)return;
var m=e.data;
if(!m)return;
if(m.cc==="slideshow"){slideshow=!!m.on;return;}
if(m.cc==="setState"){seq=m.seq;handlers.setState(m.state,m.phase);}
else if(m.cc==="phaseLimit"&&handlers.setPhaseLimit)handlers.setPhaseLimit(m.maxPhase);
else if(m.cc==="context"&&handlers.setContext)handlers.setContext(m.context);
else if(m.cc==="wheelPicked"&&handlers.wheelPicked)handlers.wheelPicked(m.student);
else if(m.cc==="slide"&&handlers.slide)handlers.slide({phase:m.phase,cues:m.cues});
else if(m.cc==="control"&&handlers.control)handlers.control(m.value===undefined?{id:m.id}:{id:m.id,value:m.value});
});
window.addEventListener("mousedown",function(e){if(e.button===1){e.preventDefault();send({cc:"shortcut"});}},true);
window.addEventListener("keydown",function(e){
if((e.ctrlKey||e.metaKey)&&e.key==="."){e.preventDefault();send({cc:"shortcut"});return;}
if(e.ctrlKey||e.metaKey||e.altKey||!/^([bBgGjJrRwW]|Escape)$/.test(e.key)||typing(e.composedPath?e.composedPath()[0]:e.target))return;
setTimeout(function(){if(!e.defaultPrevented)send({cc:"hotkey",key:e.key.toLowerCase()});});
});
window.addEventListener("keydown",function(e){
if(slideshow===null||e.ctrlKey||e.metaKey||e.altKey||typing(e.composedPath?e.composedPath()[0]:e.target))return;
if(e.key==="s"||e.key==="S"){stop(e);send({cc:"slideshowToggle"});return;}
if(!slideshow)return;
if(e.key==="PageDown"||e.key==="ArrowDown"||e.key===" "){stop(e);send({cc:"step",dir:1});}
else if(e.key==="PageUp"||e.key==="ArrowUp"){stop(e);send({cc:"step",dir:-1});}
},true);
window.addEventListener("wheel",function(e){
if(!slideshow)return;
e.preventDefault();
var dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?800:1);
if(Math.abs(dy)<4)return;
send({cc:"step",dir:dy>0?1:-1});
},{passive:false,capture:true});
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
