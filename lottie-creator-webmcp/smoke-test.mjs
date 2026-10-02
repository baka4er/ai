import { spawn } from 'child_process';
import WebSocket from 'ws';
const p = spawn('node',[process.env.CREATOR_MCP_BIN ?? 'node_modules/@lottiefiles/creator-mcp/dist/index.mjs']);
let buf='', err='';
p.stderr.on('data',d=>err+=d);
const send=m=>p.stdin.write(JSON.stringify(m)+'\n');
const replies={};
p.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);const m=JSON.parse(l);replies[m.id]=m;}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'smoke',version:'0'}}});
await wait(800);
send({jsonrpc:'2.0',method:'notifications/initialized'});
send({jsonrpc:'2.0',id:2,method:'tools/list'});
send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'read_scene',arguments:{}}});
await wait(1500);
console.log('server:', replies[1]?.result?.serverInfo);
console.log('tools/list count:', replies[2]?.result?.tools?.length, ' export_lottie exposed:', replies[2]?.result?.tools?.some(t=>t.name==='export_lottie'));
console.log('read_scene with no tab:', JSON.stringify(replies[3]?.result).slice(0,250));
for (const origin of ['https://evil.example','https://creator.lottiefiles.com']) {
  await new Promise(res=>{const ws=new WebSocket('ws://127.0.0.1:3847',{origin});
    ws.on('open',()=>{console.log(origin,'-> open');ws.close();});
    ws.on('close',(c,r)=>{console.log(origin,'-> close',c,String(r));res();});
    ws.on('error',e=>{console.log(origin,'err',e.message);res();});});
}
console.log('stderr:\n'+err);
p.kill();
