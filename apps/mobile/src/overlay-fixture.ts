// Network-free fictional fixture. Native HTML validation is deliberately intact.
export const overlayFixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>
*{box-sizing:border-box}body{margin:0;padding:14px;background:#f5f6f1;color:#183b31;font:16px -apple-system,sans-serif}h1{font-size:22px;margin:0 0 8px}p{line-height:1.4}label{display:block;margin:12px 0}input,button{font:inherit;min-height:48px;width:100%;border:1px solid #abb5ae;border-radius:10px;padding:10px;background:white;color:#183b31}button{background:#205747;color:white}section{padding:16px;background:white;border-radius:16px;margin:12px 0}#error{display:none;padding:12px;background:#fff0e7;border:1px solid #a84d31}#menu{display:none;background:#dce9df;padding:20px}small{font-size:13px}
</style></head><body><h1>Local tooltip fixture</h1><small>Fictional data · No network or uploads</small>
<p>Leave Goal name empty and tap Create goal. Do not touch the validation bubble while the pair is captured automatically.</p>
<section><form id="goal"><label>Goal name<input id="name" required autocomplete="off" placeholder="Leave empty for the bubble"></label><label>Target amount ($)<input id="amount" required inputmode="decimal" autocomplete="off" value="0"></label><p id="error" role="alert">Enter a goal between $1 and $1,000,000, with up to two decimal places.</p><button>Create goal</button></form></section>
<button type="button" id="toggle">Open/close sample menu</button><div id="menu">Fictional customer menu</div><p>For an inline error, type Test as the name and leave the amount at 0.</p>
${Array.from({ length: 8 }, (_, i) => `<section>Fictional activity ${i + 1}<p>Sample purchase · $${i + 10}.00</p></section>`).join('')}
<script>
const send=kind=>window.ReactNativeWebView?.postMessage(JSON.stringify({type:'softek-overlay-check',kind}));
document.addEventListener('invalid',()=>send('invalid'),true);
document.getElementById('goal').addEventListener('submit',e=>{e.preventDefault();document.getElementById('error').style.display='block';send('invalid')});
document.getElementById('toggle').onclick=()=>{const m=document.getElementById('menu');m.style.display=m.style.display==='block'?'none':'block';send('ui')};
let inputTimer,scrollTimer;document.addEventListener('input',()=>{clearTimeout(inputTimer);inputTimer=setTimeout(()=>send('content'),300)});
document.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>send('scroll'),180)},{passive:true});
window.visualViewport?.addEventListener('resize',()=>send('viewport'));
document.addEventListener('click',e=>{if(e.target.tagName!=='BUTTON')send('ui')},{passive:true});
</script></body></html>`;
