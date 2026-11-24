(()=>{function wt(s="id"){return s+"_"+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4)}function js(s){return JSON.parse(JSON.stringify(s))}function v(s,e,...t){let n=document.createElement(s);if(e)for(let[i,r]of Object.entries(e))r==null||r===!1||(i==="class"?n.className=r:i==="style"&&typeof r=="object"?Object.assign(n.style,r):i.startsWith("on")&&typeof r=="function"?n.addEventListener(i.slice(2),r):i==="value"?n.value=r:i==="checked"?n.checked=!!r:i==="html"?n.innerHTML=r:n.setAttribute(i,r===!0?"":r));return fu(n,t),n}function fu(s,e){for(let t of e)t==null||t===!1||(Array.isArray(t)?fu(s,t):s.appendChild(t instanceof Node?t:document.createTextNode(String(t))))}function In(s){for(;s.firstChild;)s.removeChild(s.firstChild);return s}function zn(s,e,t="text/plain"){let n=e instanceof Blob?e:new Blob([e],{type:t}),i=document.createElement("a");i.href=URL.createObjectURL(n),i.download=s,document.body.appendChild(i),i.click(),setTimeout(()=>{URL.revokeObjectURL(i.href),i.remove()},1e3)}function Ui(s){return new Promise(e=>{let t=document.createElement("input");t.type="file",s&&(t.accept=s),t.onchange=()=>e(t.files[0]||null),t.click()})}function ns(s){return new Promise((e,t)=>{let n=new FileReader;n.onload=()=>e(n.result),n.onerror=t,n.readAsText(s)})}function pu(s){return new Promise((e,t)=>{let n=new FileReader;n.onload=()=>e(n.result),n.onerror=t,n.readAsDataURL(s)})}function Pn(s,e="untitled"){return String(s||"").trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^[.-]+|[.-]+$/g,"").slice(0,80)||e}function fi(s){let e=new Date(s),t=n=>String(n).padStart(2,"0");return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}`}function $t(s){let e=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());if(!e)return null;let t=e.slice(1).map(Number);return t.some(n=>n>255)?null:(t[0]<<24>>>0)+(t[1]<<16)+(t[2]<<8)+t[3]}function qt(s){return[s>>>24,s>>>16&255,s>>>8&255,s&255].join(".")}function Kr(s){let e=$t(s);if(e===null)return null;let t=0,n=!1;for(let i=31;i>=0;i--){let r=e>>>i&1;if(r&&n)return null;r?t++:n=!0}return t}function Zr(s){return s===0?0:4294967295<<32-s>>>0}function Dt(s){if(!s)return null;s=String(s).trim();let e,t;if(s.includes("/")){let[i,r]=s.split("/");e=$t(i),t=Number(r)}else if(/\s/.test(s)){let[i,r]=s.split(/\s+/);e=$t(i),t=Kr(r)}else e=$t(s),t=32;if(e===null||t===null||!Number.isInteger(t)||t<0||t>32)return null;let n=Zr(t);return{ip:e,prefix:t,mask:n,net:(e&n)>>>0}}function jr(s,e){return(s&e.mask)>>>0===e.net}function Va(s){let e=String(s??"all").trim().toLowerCase();if(!e||e==="all")return()=>!0;if(e==="none")return()=>!1;let t=[];for(let n of e.split(",")){let[i,r]=n.split("-").map(o=>parseInt(o,10));Number.isFinite(i)&&t.push([i,Number.isFinite(r)?r:i])}return n=>t.some(([i,r])=>n>=i&&n<=r)}var Jr={"Content-Type":"application/json","X-LabTracer":"1"},Hn="labtracer.";async function Oi(s){if(!s.ok){let e=s.statusText;try{e=(await s.json()).error||e}catch{}throw new Error(e)}return s.json()}var dt={mode:"local",dataPath:"",async init(){if(location.protocol.startsWith("http"))try{let s=await fetch("/api/ping",{cache:"no-store"});if(s.ok){let e=await s.json();this.mode="server",this.dataPath=e.data;return}}catch{}this.mode="local"},async listLabs(){if(this.mode==="server")return Oi(await fetch("/api/labs",{cache:"no-store"}));let s=[];for(let e=0;e<localStorage.length;e++){let t=localStorage.key(e);t.startsWith(Hn+"lab.")&&s.push({name:t.slice((Hn+"lab.").length),size:(localStorage.getItem(t)||"").length,modified:0})}return s.sort((e,t)=>e.name.localeCompare(t.name))},async loadLab(s){if(this.mode==="server")return Oi(await fetch("/api/labs/"+encodeURIComponent(s),{cache:"no-store"}));let e=localStorage.getItem(Hn+"lab."+s);if(!e)throw new Error("no such lab");return JSON.parse(e)},async saveLab(s,e){let t=JSON.stringify(e);if(this.mode==="server")return Oi(await fetch("/api/labs/"+encodeURIComponent(s),{method:"PUT",headers:Jr,body:t}));try{localStorage.setItem(Hn+"lab."+s,t)}catch{throw new Error("Browser storage is full. Export the lab to a file.")}return{ok:!0}},async deleteLab(s){return this.mode==="server"?Oi(await fetch("/api/delete/"+encodeURIComponent(s),{method:"POST",headers:Jr,body:"{}"})):(localStorage.removeItem(Hn+"lab."+s),{ok:!0})},async loadLibrary(){if(this.mode==="server")return Oi(await fetch("/api/library",{cache:"no-store"}));try{return JSON.parse(localStorage.getItem(Hn+"library")||'{"templates":[]}')}catch{return{templates:[]}}},async saveLibrary(s){let e=JSON.stringify(s);if(this.mode==="server")return Oi(await fetch("/api/library",{method:"PUT",headers:Jr,body:e}));try{localStorage.setItem(Hn+"library",e)}catch{throw new Error("Browser storage is full (large 3D models?).")}return{ok:!0}},async exportConfigs(s,e){return this.mode==="server"?Oi(await fetch("/api/export/"+encodeURIComponent(s),{method:"POST",headers:Jr,body:JSON.stringify({files:e})})):null},getPref(s,e){try{let t=localStorage.getItem(Hn+"pref."+s);return t===null?e:JSON.parse(t)}catch{return e}},setPref(s,e){try{localStorage.setItem(Hn+"pref."+s,JSON.stringify(e))}catch{}}};function mu(s){let e=new TextEncoder,t=[],n=(r,o,a,c)=>{let l=e.encode(c);r.set(l.slice(0,a),o)},i=(r,o)=>r.toString(8).padStart(o-1,"0")+"\0";for(let r of s){let o=e.encode(r.content),a=new Uint8Array(512),c=r.path,l="";if(c.length>99){let d=c.lastIndexOf("/",154);l=c.slice(0,d),c=c.slice(d+1)}n(a,0,100,c),n(a,100,8,i(420,8)),n(a,108,8,i(0,8)),n(a,116,8,i(0,8)),n(a,124,12,i(o.length,12)),n(a,136,12,i(Math.floor(Date.now()/1e3),12)),n(a,148,8,"        "),n(a,156,1,"0"),n(a,257,6,"ustar\0"),n(a,263,2,"00"),n(a,345,155,l);let h=0;for(let d of a)h+=d;n(a,148,8,i(h,7)+" "),t.push(a,o);let u=(512-o.length%512)%512;u&&t.push(new Uint8Array(u))}return t.push(new Uint8Array(1024)),new Blob(t,{type:"application/x-tar"})}function at(s,e,t,n="eth",i="1G"){let r=[];for(let o=0;o<t;o++)r.push({name:`${s}${e+o}`,kind:n,speed:i});return r}var gu=[["rackmount","Rack-mount chassis"],["box","Box"],["router","Router (with antennas)"],["ap","Access point (disc)"],["tower","Tower"],["nas","NAS"],["laptop","Laptop"],["phone","Phone / tablet"],["sbc","Single-board computer"],["camera","Camera"],["printer","Printer"],["cloud","Cloud / WAN"],["vm","Virtual (ghost box)"],["cylinder","Cylinder"],["rack","Rack frame"],["desk","Desk / table"],["shelf","Shelving unit"]],_u=[["plain","Plain"],["switch","Switch ports"],["server","Drive bays"],["router","Status LEDs"],["firewall","Firewall"],["tower","PC tower"],["nas","NAS bays"],["patch","Patch panel"],["ups","UPS display"],["pdu","PDU outlets"],["vents","Vent grille"]],Js=["eth","sfp","wifi","vport","tunnel","svi","sub","loop","console","usb","power"],Qr=[["auto","Auto"],["copper","Copper (RJ45)"],["fiber","Fibre / DAC"],["wireless","Wireless"],["tunnel","VPN tunnel"],["virtual","Virtual"],["console","Console"],["power","Power"]],Qs=[{id:"net-router-home",name:"Router (consumer / DD-WRT)",category:"Network",shape:"router",face:"router",dims:{w:.25,h:.05,d:.18},color:"#2b2f36",l2:!0,l3:!0,ports:[{name:"wan",kind:"eth",speed:"1G",mode:"routed"},...at("lan",1,4),{name:"wlan0",kind:"wifi",speed:"2.4GHz"},{name:"wlan1",kind:"wifi",speed:"5GHz"},{name:"pwr",kind:"power"}]},{id:"net-router-rack",name:"Router 1U (ISR class)",category:"Network",shape:"rackmount",face:"firewall",dims:{w:.44,h:.04445,d:.35},uHeight:1,color:"#3a4a5c",l3:!0,ports:[...at("Gi0/",0,3),{name:"console",kind:"console"},{name:"psu1",kind:"power"}]},{id:"net-firewall",name:"Firewall appliance 1U",category:"Network",shape:"rackmount",face:"firewall",dims:{w:.44,h:.04445,d:.3},uHeight:1,color:"#7a2b2b",l3:!0,ports:[{name:"wan",kind:"eth",speed:"1G"},{name:"lan",kind:"eth",speed:"1G"},...at("opt",1,6),{name:"psu1",kind:"power"}]},{id:"net-switch-8",name:"Desktop switch 8-port",category:"Network",shape:"box",face:"switch",dims:{w:.26,h:.035,d:.16},color:"#4b5563",l2:!0,ports:[...at("p",1,8),{name:"pwr",kind:"power"}]},{id:"net-switch-24",name:"Managed switch 24-port 1U",category:"Network",shape:"rackmount",face:"switch",dims:{w:.44,h:.04445,d:.3},uHeight:1,color:"#2f4f6f",l2:!0,ports:[...at("p",1,24),...at("sfp",1,4,"sfp","10G"),{name:"console",kind:"console"},{name:"psu1",kind:"power"}]},{id:"net-switch-48",name:"Managed switch 48-port 1U",category:"Network",shape:"rackmount",face:"switch",dims:{w:.44,h:.04445,d:.38},uHeight:1,color:"#2f4f6f",l2:!0,ports:[...at("p",1,48),...at("sfp",1,4,"sfp","10G"),{name:"console",kind:"console"},{name:"psu1",kind:"power"}]},{id:"net-switch-l3",name:"L3 switch 24 + 4 SFP 1U",category:"Network",shape:"rackmount",face:"switch",dims:{w:.44,h:.04445,d:.38},uHeight:1,color:"#22577a",l2:!0,l3:!0,ports:[...at("Gi0/",1,24),...at("Gi0/",25,4,"sfp","1G"),{name:"console",kind:"console"},{name:"psu1",kind:"power"}]},{id:"net-switch-l3-48",name:"L3 switch 48 + 4 SFP 1U",category:"Network",shape:"rackmount",face:"switch",dims:{w:.44,h:.04445,d:.38},uHeight:1,color:"#22577a",l2:!0,l3:!0,ports:[...at("Gi0/",1,48),...at("Gi0/",49,4,"sfp","1G"),{name:"console",kind:"console"},{name:"psu1",kind:"power"}]},{id:"net-ap",name:"Wireless access point",category:"Network",shape:"ap",face:"plain",dims:{w:.2,h:.04,d:.2},color:"#e8eaed",l2:!0,ports:[{name:"eth0",kind:"eth",speed:"1G",mode:"trunk"},{name:"wlan0",kind:"wifi",speed:"5GHz"}]},{id:"net-gateway",name:"ISP fibre gateway / modem",category:"Network",shape:"box",face:"router",dims:{w:.06,h:.24,d:.2},color:"#d9dde3",l2:!0,l3:!0,ports:[{name:"pon",kind:"sfp",speed:"GPON",mode:"routed"},...at("lan",1,4),{name:"wlan0",kind:"wifi"},{name:"pwr",kind:"power"}]},{id:"net-patch-24",name:"Patch panel 24-port 1U",category:"Network",shape:"rackmount",face:"patch",dims:{w:.44,h:.04445,d:.1},uHeight:1,color:"#1f2328",passthrough:!0,ports:[...at("",1,24).map(s=>({...s,name:s.name+"F"})),...at("",1,24).map(s=>({...s,name:s.name+"R"}))]},{id:"cmp-1u",name:"Rack server 1U (8 SFF)",category:"Compute",shape:"rackmount",face:"server",bays:8,dims:{w:.43,h:.04445,d:.7},uHeight:1,color:"#30343b",ports:[...at("eno",1,4),...at("ens1f",0,2,"sfp","10G"),{name:"ilo",kind:"eth",speed:"1G"},{name:"psu1",kind:"power"},{name:"psu2",kind:"power"}],attrs:{CPU:"",RAM:"",Storage:"",OS:""}},{id:"cmp-2u",name:"Rack server 2U (12 LFF)",category:"Compute",shape:"rackmount",face:"server",bays:12,dims:{w:.43,h:2*.04445,d:.72},uHeight:2,color:"#30343b",ports:[...at("eno",1,4),{name:"bmc",kind:"eth",speed:"1G"},{name:"psu1",kind:"power"},{name:"psu2",kind:"power"}],attrs:{CPU:"",RAM:"",Storage:"",OS:""}},{id:"cmp-tower",name:"Desktop tower PC",category:"Compute",shape:"tower",face:"tower",dims:{w:.21,h:.46,d:.45},color:"#1d1f24",ports:[{name:"eth0",kind:"eth",speed:"1G"},{name:"wlan0",kind:"wifi"},{name:"psu",kind:"power"}],attrs:{CPU:"",RAM:"",GPU:"",OS:""}},{id:"cmp-mini",name:"Mini PC (1L)",category:"Compute",shape:"box",face:"vents",dims:{w:.177,h:.034,d:.175},color:"#2a2d33",ports:[{name:"eth0",kind:"eth",speed:"1G"},{name:"wlan0",kind:"wifi"},{name:"pwr",kind:"power"}],attrs:{CPU:"",RAM:"",OS:""}},{id:"cmp-sff",name:"Small form factor desktop",category:"Compute",shape:"tower",face:"tower",dims:{w:.1,h:.29,d:.3},color:"#2a2d33",ports:[{name:"eth0",kind:"eth",speed:"1G"},{name:"pwr",kind:"power"}],attrs:{CPU:"",RAM:"",OS:""}},{id:"cmp-laptop",name:"Laptop",category:"Compute",shape:"laptop",face:"plain",dims:{w:.34,h:.022,d:.235},color:"#3b3f46",ports:[{name:"wlan0",kind:"wifi"},{name:"eth0",kind:"eth"},{name:"wg0",kind:"tunnel"}],attrs:{OS:""}},{id:"cmp-sbc",name:"Single-board computer (Pi class)",category:"Compute",shape:"sbc",face:"plain",dims:{w:.09,h:.03,d:.065},color:"#1b7a3e",ports:[{name:"eth0",kind:"eth",speed:"1G"},{name:"wlan0",kind:"wifi"},{name:"usb-c",kind:"power"}],attrs:{OS:""}},{id:"sto-nas2",name:"NAS 2-bay",category:"Storage",shape:"nas",face:"nas",bays:2,dims:{w:.105,h:.17,d:.23},color:"#2b2e33",ports:[{name:"eth0",kind:"eth"},{name:"eth1",kind:"eth"},{name:"pwr",kind:"power"}],attrs:{Drives:"",OS:""}},{id:"sto-nas4",name:"NAS 4-bay",category:"Storage",shape:"nas",face:"nas",bays:4,dims:{w:.17,h:.19,d:.23},color:"#2b2e33",ports:[{name:"eth0",kind:"eth"},{name:"eth1",kind:"eth"},{name:"pwr",kind:"power"}],attrs:{Drives:"",OS:""}},{id:"sto-rack",name:"Rack NAS 1U (4 LFF)",category:"Storage",shape:"rackmount",face:"server",bays:4,dims:{w:.43,h:.04445,d:.5},uHeight:1,color:"#2b2e33",ports:[...at("eth",0,2),...at("sfp",0,2,"sfp","10G"),{name:"psu1",kind:"power"}],attrs:{Drives:""}},{id:"vir-vm",name:"Virtual machine",category:"Virtual",shape:"vm",face:"plain",virtual:!0,dims:{w:.35,h:.35,d:.35},color:"#6d5dfc",ports:[{name:"eth0",kind:"vport"}],attrs:{Host:"",vCPU:"",RAM:"",OS:""}},{id:"vir-ct",name:"Container",category:"Virtual",shape:"vm",face:"plain",virtual:!0,dims:{w:.25,h:.25,d:.25},color:"#0ea5a5",ports:[{name:"eth0",kind:"vport"}],attrs:{Host:"",Image:""}},{id:"end-phone",name:"Phone / tablet",category:"Endpoints",shape:"phone",face:"plain",dims:{w:.075,h:.16,d:.009},color:"#111318",ports:[{name:"wlan0",kind:"wifi"},{name:"wg0",kind:"tunnel"}]},{id:"end-printer",name:"Printer",category:"Endpoints",shape:"printer",face:"plain",dims:{w:.42,h:.26,d:.4},color:"#d6d8dc",ports:[{name:"eth0",kind:"eth"},{name:"wlan0",kind:"wifi"}]},{id:"end-camera",name:"IP camera",category:"Endpoints",shape:"camera",face:"plain",dims:{w:.08,h:.09,d:.18},color:"#eceff1",ports:[{name:"eth0",kind:"eth",speed:"PoE"}]},{id:"end-iot",name:"IoT device",category:"Endpoints",shape:"box",face:"router",dims:{w:.08,h:.03,d:.08},color:"#f2f2f2",ports:[{name:"wlan0",kind:"wifi"}]},{id:"pwr-ups-tower",name:"UPS (tower)",category:"Power",shape:"box",face:"ups",dims:{w:.15,h:.24,d:.4},color:"#202226",ports:[{name:"in",kind:"power"},...at("out",1,6,"power",""),{name:"usb",kind:"usb"}],attrs:{VA:"",Battery:""}},{id:"pwr-ups-rack",name:"UPS 2U rack",category:"Power",shape:"rackmount",face:"ups",dims:{w:.43,h:2*.04445,d:.6},uHeight:2,color:"#202226",ports:[{name:"in",kind:"power"},...at("out",1,8,"power",""),{name:"nmc",kind:"eth"}],attrs:{VA:"",Battery:""}},{id:"pwr-pdu",name:"PDU 1U",category:"Power",shape:"rackmount",face:"pdu",dims:{w:.43,h:.04445,d:.2},uHeight:1,color:"#1a1a1a",ports:[{name:"in",kind:"power"},...at("out",1,8,"power","")]},{id:"wan-internet",name:"Internet / ISP cloud",category:"WAN",shape:"cloud",face:"plain",logical:!0,dims:{w:1.1,h:.55,d:.7},color:"#8ec5ff",l3:!0,ports:at("wan",1,4)},{id:"inf-rack-42",name:"Rack 42U",category:"Infrastructure",shape:"rack",face:"plain",physicalOnly:!0,dims:{w:.6,h:2,d:1},rackUnits:42,color:"#16181c",ports:[]},{id:"inf-rack-12",name:"Wall rack 12U",category:"Infrastructure",shape:"rack",face:"plain",physicalOnly:!0,dims:{w:.6,h:.64,d:.45},rackUnits:12,color:"#16181c",ports:[]},{id:"inf-desk",name:"Desk",category:"Infrastructure",shape:"desk",face:"plain",physicalOnly:!0,dims:{w:1.5,h:.75,d:.75},levels:[.75],color:"#8b6b4a",ports:[]},{id:"inf-shelf",name:"Wire shelving unit",category:"Infrastructure",shape:"shelf",face:"plain",physicalOnly:!0,dims:{w:.9,h:1.8,d:.45},levels:[.15,.6,1.05,1.5],color:"#a7adb5",ports:[]}],Ga=["Network","Compute","Storage","Virtual","Endpoints","Power","WAN","Infrastructure"],is=.04445;var vu=1,Vn=new Set(["eth","sfp","wifi","vport","tunnel","console","usb","power"]),Fi=new Set(["wifi","tunnel"]),er=new Set(["eth","sfp","wifi","vport","tunnel","svi","sub","loop"]);function tr(s="new-lab"){return{version:vu,name:s,notes:"",rooms:[{id:wt("room"),name:"Lab room",w:4,d:3.5,h:2.4}],devices:[],links:[],view:{}}}function Rt(s={}){return{id:wt("pt"),name:s.name||"eth0",kind:s.kind||"eth",speed:s.speed||"",mode:s.mode||"access",vlan:s.vlan??1,nativeVlan:s.nativeVlan??1,trunkVlans:s.trunkVlans||"all",ip:s.ip||"",mac:s.mac||"",enabled:s.enabled!==!1,desc:s.desc||"",parent:s.parent||null}}function ss(s,e={}){return{id:wt("dev"),name:e.name||s.name,templateId:s.id,category:s.category,shape:s.shape,face:s.face||"plain",bays:s.bays||0,dims:{...s.dims},uHeight:s.uHeight||0,rackUnits:s.rackUnits||0,levels:s.levels?[...s.levels]:null,color:s.color||"#555b66",virtual:!!s.virtual,logical:!!s.logical,physicalOnly:!!s.physicalOnly,passthrough:!!s.passthrough,l2:!!s.l2,l3:!!s.l3,vendor:s.vendor||"",model:s.model||"",serial:"",notes:"",topo:{x:e.x??0,z:e.z??0},phys:{roomId:e.roomId??null,x:e.px??0,z:e.pz??0,rot:0,elev:0,elevAuto:!0,mount:"floor",rackId:null,rackU:null},attrs:Object.entries(s.attrs||{}).map(([n,i])=>({k:n,v:i})),ports:(s.ports||[]).map(n=>Rt(n)),routes:[],vlans:s.l2?[{id:1,name:"default"}]:[],services:[],files:[]}}var eo=class{constructor(){this.custom=[]}setCustom(e){this.custom=Array.isArray(e)?e:[]}all(){return[...Qs,...this.custom]}get(e){return this.custom.find(t=>t.id===e)||Qs.find(t=>t.id===e)||null}isCustom(e){return this.custom.some(t=>t.id===e)}},He=(s,e)=>s.devices.find(t=>t.id===e)||null,Mt=(s,e)=>(s==null?void 0:s.ports.find(t=>t.id===e))||null,pi=(s,e)=>(s==null?void 0:s.ports.find(t=>t.name.toLowerCase()===String(e).toLowerCase()))||null,Wa=(s,e)=>s.links.find(t=>t.id===e)||null;function mi(s,e,t){return s.links.filter(n=>n.a.dev===e&&n.a.port===t||n.b.dev===e&&n.b.port===t)}function nr(s,e,t){return s.a.dev===e&&(t===void 0||s.a.port===t)?s.b:s.a}function yu(s,e){let t=new Set;for(let n of s.links)n.a.dev===e&&t.add(n.a.port),n.b.dev===e&&t.add(n.b.port);return t}function ir(s,e,t){return Vn.has(t.kind)?Fi.has(t.kind)?!0:mi(s,e.id,t.id).length===0:!1}function Xa(s,e){let t=He(s,e.dev),n=Mt(t,e.port);return`${t?t.name:"?"}:${n?n.name:"?"}`}var Yt=s=>s.shape==="rack",Gn=s=>s.shape==="desk"||s.shape==="shelf",xu=s=>!s.physicalOnly,bu=s=>!s.virtual&&!s.logical;function gi(s,e){if(e.phys.mount==="rack"&&e.phys.rackId){let t=He(s,e.phys.rackId);return t?t.phys.roomId:null}return e.phys.roomId}function $a(s,e){let t=new Set(s.devices.map(i=>i.name.toLowerCase()));if(!t.has(e.toLowerCase()))return e;let n=/^(.*?)(\d+)$/.exec(e);if(n){let i=n[2].length;for(let r=+n[2]+1;;r++){let o=n[1]+String(r).padStart(i,"0");if(!t.has(o.toLowerCase()))return o}}for(let i=2;;i++){let r=`${e}-${i}`;if(!t.has(r.toLowerCase()))return r}}function Mu(s,e){s.links=s.links.filter(t=>t.a.dev!==e&&t.b.dev!==e);for(let t of s.devices)t.phys.rackId===e&&(t.phys.mount="floor",t.phys.rackId=null,t.phys.rackU=null,t.phys.roomId=null);s.devices=s.devices.filter(t=>t.id!==e)}function Su(s,e,t){s.links=s.links.filter(n=>!(n.a.dev===e.id&&n.a.port===t||n.b.dev===e.id&&n.b.port===t));for(let n of e.ports)n.parent===t&&(n.parent=null);e.ports=e.ports.filter(n=>n.id!==t)}function wu(s,e){let t=js(e);t.id=wt("dev"),t.name=$a(s,e.name);let n={};for(let i of t.ports){let r=wt("pt");n[i.id]=r,i.id=r,i.ip=""}for(let i of t.ports)i.parent&&(i.parent=n[i.parent]||null);return t.topo.x+=1.5,t.topo.z+=1,t.phys.x+=.3,t.phys.z+=.3,t.phys.mount==="rack"&&(t.phys.mount="floor",t.phys.roomId=gi(s,e),t.phys.rackId=null,t.phys.rackU=null),s.devices.push(t),t}function qa(s,e){let t=new Map;for(let n of s.devices)if(n.phys.mount==="rack"&&n.phys.rackId===e.id&&n.phys.rackU)for(let i=n.phys.rackU;i<n.phys.rackU+Math.max(1,n.uHeight||1);i++)t.set(i,n);return t}function to(s,e,t,n){let i=Math.max(1,t.uHeight||1);if(n<1||n+i-1>e.rackUnits)return!1;let r=qa(s,e);for(let o=n;o<n+i;o++){let a=r.get(o);if(a&&a.id!==t.id)return!1}return!0}function sr(s,e,t){for(let n=e.rackUnits-Math.max(1,t.uHeight||1)+1;n>=1;n--)if(to(s,e,t,n))return n;return null}function Eu(s){s.version=vu,s.rooms||=[],s.devices||=[],s.links||=[],s.view||={};for(let t of s.devices){t.topo||={x:0,z:0},t.phys=Object.assign({roomId:null,x:0,z:0,rot:0,elev:0,elevAuto:!0,mount:"floor",rackId:null,rackU:null},t.phys||{}),t.dims||={w:.3,h:.1,d:.3},t.ports=(t.ports||[]).map(n=>Object.assign(Rt(n),n)),t.attrs||=[],t.routes||=[],t.vlans||=[],t.services||=[],t.files||=[];for(let n of t.files)n.snapshots||=[]}let e=new Set(s.devices.map(t=>t.id));return s.links=s.links.filter(t=>{var n,i;return e.has((n=t.a)==null?void 0:n.dev)&&e.has((i=t.b)==null?void 0:i.dev)}),s}var Zc="170",An={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},Ji={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},jf=0,Tu=1,Jf=2;var Yd=1,Qf=2,Zn=3,Nn=0,jt=1,Kt=2,Ti=0,Ms=1,Au=2,Ru=3,Cu=4,ep=5,$i=100,tp=101,np=102,ip=103,sp=104,rp=200,op=201,ap=202,lp=203,Il=204,Pl=205,cp=206,hp=207,up=208,dp=209,fp=210,pp=211,mp=212,gp=213,_p=214,Ll=0,Dl=1,Nl=2,As=3,kl=4,Ul=5,Ol=6,Fl=7,jc=0,vp=1,yp=2,Ai=0,xp=1,bp=2,Mp=3,Sp=4,wp=5,Ep=6,Tp=7,Iu="attached",Ap="detached",Kd=300,Rs=301,Cs=302,Bl=303,zl=304,ya=306,ei=1e3,jn=1001,xr=1002,zt=1003,Jc=1004;var xs=1005;var Zt=1006,mr=1007;var Dn=1008;var ti=1009,Zd=1010,jd=1011,br=1012,Qc=1013,Yi=1014,bn=1015,Or=1016,eh=1017,th=1018,Is=1020,Jd=35902,Qd=1021,ef=1022,un=1023,tf=1024,nf=1025,Ss=1026,Ps=1027,nh=1028,ih=1029,sf=1030,sh=1031;var rh=1033,ko=33776,Uo=33777,Oo=33778,Fo=33779,Hl=35840,Vl=35841,Gl=35842,Wl=35843,Xl=36196,$l=37492,ql=37496,Yl=37808,Kl=37809,Zl=37810,jl=37811,Jl=37812,Ql=37813,ec=37814,tc=37815,nc=37816,ic=37817,sc=37818,rc=37819,oc=37820,ac=37821,Bo=36492,lc=36494,cc=36495,rf=36283,hc=36284,uc=36285,dc=36286;var Ls=2300,Ds=2301,Ya=2302,Pu=2400,Lu=2401,Du=2402,Rp=2500;var of=0,xa=1,Fr=2,Cp=3200,Ip=3201;var oh=0,Pp=1,Si="",_t="srgb",Ht="srgb-linear",ba="linear",st="srgb";var rs=7680;var Nu=519,Lp=512,Dp=513,Np=514,af=515,kp=516,Up=517,Op=518,Fp=519,fc=35044;var ku="300 es",Jn=2e3,zo=2001,ni=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let i=this._listeners[e];if(i!==void 0){let r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let n=this._listeners[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,o=i.length;r<o;r++)i[r].call(this,e);e.target=null}}},Ft=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Uu=1234567,ws=Math.PI/180,Ns=180/Math.PI;function Mn(){let s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ft[s&255]+Ft[s>>8&255]+Ft[s>>16&255]+Ft[s>>24&255]+"-"+Ft[e&255]+Ft[e>>8&255]+"-"+Ft[e>>16&15|64]+Ft[e>>24&255]+"-"+Ft[t&63|128]+Ft[t>>8&255]+"-"+Ft[t>>16&255]+Ft[t>>24&255]+Ft[n&255]+Ft[n>>8&255]+Ft[n>>16&255]+Ft[n>>24&255]).toLowerCase()}function Ct(s,e,t){return Math.max(e,Math.min(t,s))}function ah(s,e){return(s%e+e)%e}function Bp(s,e,t,n,i){return n+(s-e)*(i-n)/(t-e)}function zp(s,e,t){return s!==e?(t-s)/(e-s):0}function gr(s,e,t){return(1-t)*s+t*e}function Hp(s,e,t,n){return gr(s,e,1-Math.exp(-t*n))}function Vp(s,e=1){return e-Math.abs(ah(s,e*2)-e)}function Gp(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*(3-2*s))}function Wp(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*s*(s*(s*6-15)+10))}function Xp(s,e){return s+Math.floor(Math.random()*(e-s+1))}function $p(s,e){return s+Math.random()*(e-s)}function qp(s){return s*(.5-Math.random())}function Yp(s){s!==void 0&&(Uu=s);let e=Uu+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Kp(s){return s*ws}function Zp(s){return s*Ns}function jp(s){return(s&s-1)===0&&s!==0}function Jp(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function Qp(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function em(s,e,t,n,i){let r=Math.cos,o=Math.sin,a=r(t/2),c=o(t/2),l=r((e+n)/2),h=o((e+n)/2),u=r((e-n)/2),d=o((e-n)/2),p=r((n-e)/2),m=o((n-e)/2);switch(i){case"XYX":s.set(a*h,c*u,c*d,a*l);break;case"YZY":s.set(c*d,a*h,c*u,a*l);break;case"ZXZ":s.set(c*u,c*d,a*h,a*l);break;case"XZX":s.set(a*h,c*m,c*p,a*l);break;case"YXY":s.set(c*p,a*h,c*m,a*l);break;case"ZYZ":s.set(c*m,c*p,a*h,a*l);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function xn(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function it(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}var Ma={DEG2RAD:ws,RAD2DEG:Ns,generateUUID:Mn,clamp:Ct,euclideanModulo:ah,mapLinear:Bp,inverseLerp:zp,lerp:gr,damp:Hp,pingpong:Vp,smoothstep:Gp,smootherstep:Wp,randInt:Xp,randFloat:$p,randFloatSpread:qp,seededRandom:Yp,degToRad:Kp,radToDeg:Zp,isPowerOfTwo:jp,ceilPowerOfTwo:Jp,floorPowerOfTwo:Qp,setQuaternionFromProperEuler:em,normalize:it,denormalize:xn},se=class s{constructor(e=0,t=0){s.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ct(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*i+e.x,this.y=r*i+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},ke=class s{constructor(e,t,n,i,r,o,a,c,l){s.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,c,l)}set(e,t,n,i,r,o,a,c,l){let h=this.elements;return h[0]=e,h[1]=i,h[2]=a,h[3]=t,h[4]=r,h[5]=c,h[6]=n,h[7]=o,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[3],c=n[6],l=n[1],h=n[4],u=n[7],d=n[2],p=n[5],m=n[8],_=i[0],g=i[3],f=i[6],y=i[1],b=i[4],S=i[7],P=i[2],C=i[5],I=i[8];return r[0]=o*_+a*y+c*P,r[3]=o*g+a*b+c*C,r[6]=o*f+a*S+c*I,r[1]=l*_+h*y+u*P,r[4]=l*g+h*b+u*C,r[7]=l*f+h*S+u*I,r[2]=d*_+p*y+m*P,r[5]=d*g+p*b+m*C,r[8]=d*f+p*S+m*I,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],h=e[8];return t*o*h-t*a*l-n*r*h+n*a*c+i*r*l-i*o*c}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],h=e[8],u=h*o-a*l,d=a*c-h*r,p=l*r-o*c,m=t*u+n*d+i*p;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/m;return e[0]=u*_,e[1]=(i*l-h*n)*_,e[2]=(a*n-i*o)*_,e[3]=d*_,e[4]=(h*t-i*c)*_,e[5]=(i*r-a*t)*_,e[6]=p*_,e[7]=(n*c-l*t)*_,e[8]=(o*t-n*r)*_,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,o,a){let c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*o+l*a)+o+e,-i*l,i*c,-i*(-l*o+c*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(Ka.makeScale(e,t)),this}rotate(e){return this.premultiply(Ka.makeRotation(-e)),this}translate(e,t){return this.premultiply(Ka.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Ka=new ke;function lf(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}function Mr(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function tm(){let s=Mr("canvas");return s.style.display="block",s}var Ou={};function fr(s){s in Ou||(Ou[s]=!0,console.warn(s))}function nm(s,e,t){return new Promise(function(n,i){function r(){switch(s.clientWaitSync(e,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:i();break;case s.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}function im(s){let e=s.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function sm(s){let e=s.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}var Ve={enabled:!0,workingColorSpace:Ht,spaces:{},convert:function(s,e,t){return this.enabled===!1||e===t||!e||!t||(this.spaces[e].transfer===st&&(s.r=Qn(s.r),s.g=Qn(s.g),s.b=Qn(s.b)),this.spaces[e].primaries!==this.spaces[t].primaries&&(s.applyMatrix3(this.spaces[e].toXYZ),s.applyMatrix3(this.spaces[t].fromXYZ)),this.spaces[t].transfer===st&&(s.r=Es(s.r),s.g=Es(s.g),s.b=Es(s.b))),s},fromWorkingColorSpace:function(s,e){return this.convert(s,this.workingColorSpace,e)},toWorkingColorSpace:function(s,e){return this.convert(s,e,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Si?ba:this.spaces[s].transfer},getLuminanceCoefficients:function(s,e=this.workingColorSpace){return s.fromArray(this.spaces[e].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,e,t){return s.copy(this.spaces[e].toXYZ).multiply(this.spaces[t].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}};function Qn(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Es(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Fu=[.64,.33,.3,.6,.15,.06],Bu=[.2126,.7152,.0722],zu=[.3127,.329],Hu=new ke().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Vu=new ke().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Ve.define({[Ht]:{primaries:Fu,whitePoint:zu,transfer:ba,toXYZ:Hu,fromXYZ:Vu,luminanceCoefficients:Bu,workingColorSpaceConfig:{unpackColorSpace:_t},outputColorSpaceConfig:{drawingBufferColorSpace:_t}},[_t]:{primaries:Fu,whitePoint:zu,transfer:st,toXYZ:Hu,fromXYZ:Vu,luminanceCoefficients:Bu,outputColorSpaceConfig:{drawingBufferColorSpace:_t}}});var os,pc=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{os===void 0&&(os=Mr("canvas")),os.width=e.width,os.height=e.height;let n=os.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=os}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Mr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let o=0;o<r.length;o++)r[o]=Qn(r[o]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Qn(t[n]/255)*255):t[n]=Qn(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},rm=0,Ho=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:rm++}),this.uuid=Mn(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?r.push(Za(i[o].image)):r.push(Za(i[o]))}else r=Za(i);n.url=r}return t||(e.images[this.uuid]=n),n}};function Za(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?pc.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var om=0,kt=class s extends ni{constructor(e=s.DEFAULT_IMAGE,t=s.DEFAULT_MAPPING,n=jn,i=jn,r=Zt,o=Dn,a=un,c=ti,l=s.DEFAULT_ANISOTROPY,h=Si){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:om++}),this.uuid=Mn(),this.name="",this.source=new Ho(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new se(0,0),this.repeat=new se(1,1),this.center=new se(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ke,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Kd)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ei:e.x=e.x-Math.floor(e.x);break;case jn:e.x=e.x<0?0:1;break;case xr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ei:e.y=e.y-Math.floor(e.y);break;case jn:e.y=e.y<0?0:1;break;case xr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};kt.DEFAULT_IMAGE=null;kt.DEFAULT_MAPPING=Kd;kt.DEFAULT_ANISOTROPY=1;var je=class s{constructor(e=0,t=0,n=0,i=1){s.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*i+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*i+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*i+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*i+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,c=e.elements,l=c[0],h=c[4],u=c[8],d=c[1],p=c[5],m=c[9],_=c[2],g=c[6],f=c[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(m-g)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(m+g)<.1&&Math.abs(l+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let b=(l+1)/2,S=(p+1)/2,P=(f+1)/2,C=(h+d)/4,I=(u+_)/4,L=(m+g)/4;return b>S&&b>P?b<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(b),i=C/n,r=I/n):S>P?S<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(S),n=C/i,r=L/i):P<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(P),n=I/r,i=L/r),this.set(n,i,r,t),this}let y=Math.sqrt((g-m)*(g-m)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(g-m)/y,this.y=(u-_)/y,this.z=(d-h)/y,this.w=Math.acos((l+p+f-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},mc=class extends ni{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new je(0,0,e,t),this.scissorTest=!1,this.viewport=new je(0,0,e,t);let i={width:e,height:t,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Zt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);let r=new kt(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];let o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let n=0,i=e.textures.length;n<i;n++)this.textures[n]=e.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;let t=Object.assign({},e.texture.image);return this.texture.source=new Ho(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},ii=class extends mc{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Vo=class extends kt{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=zt,this.minFilter=zt,this.wrapR=jn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var gc=class extends kt{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=zt,this.minFilter=zt,this.wrapR=jn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Jt=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,o,a){let c=n[i+0],l=n[i+1],h=n[i+2],u=n[i+3],d=r[o+0],p=r[o+1],m=r[o+2],_=r[o+3];if(a===0){e[t+0]=c,e[t+1]=l,e[t+2]=h,e[t+3]=u;return}if(a===1){e[t+0]=d,e[t+1]=p,e[t+2]=m,e[t+3]=_;return}if(u!==_||c!==d||l!==p||h!==m){let g=1-a,f=c*d+l*p+h*m+u*_,y=f>=0?1:-1,b=1-f*f;if(b>Number.EPSILON){let P=Math.sqrt(b),C=Math.atan2(P,f*y);g=Math.sin(g*C)/P,a=Math.sin(a*C)/P}let S=a*y;if(c=c*g+d*S,l=l*g+p*S,h=h*g+m*S,u=u*g+_*S,g===1-a){let P=1/Math.sqrt(c*c+l*l+h*h+u*u);c*=P,l*=P,h*=P,u*=P}}e[t]=c,e[t+1]=l,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,i,r,o){let a=n[i],c=n[i+1],l=n[i+2],h=n[i+3],u=r[o],d=r[o+1],p=r[o+2],m=r[o+3];return e[t]=a*m+h*u+c*p-l*d,e[t+1]=c*m+h*d+l*u-a*p,e[t+2]=l*m+h*p+a*d-c*u,e[t+3]=h*m-a*u-c*d-l*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,i=e._y,r=e._z,o=e._order,a=Math.cos,c=Math.sin,l=a(n/2),h=a(i/2),u=a(r/2),d=c(n/2),p=c(i/2),m=c(r/2);switch(o){case"XYZ":this._x=d*h*u+l*p*m,this._y=l*p*u-d*h*m,this._z=l*h*m+d*p*u,this._w=l*h*u-d*p*m;break;case"YXZ":this._x=d*h*u+l*p*m,this._y=l*p*u-d*h*m,this._z=l*h*m-d*p*u,this._w=l*h*u+d*p*m;break;case"ZXY":this._x=d*h*u-l*p*m,this._y=l*p*u+d*h*m,this._z=l*h*m+d*p*u,this._w=l*h*u-d*p*m;break;case"ZYX":this._x=d*h*u-l*p*m,this._y=l*p*u+d*h*m,this._z=l*h*m-d*p*u,this._w=l*h*u+d*p*m;break;case"YZX":this._x=d*h*u+l*p*m,this._y=l*p*u+d*h*m,this._z=l*h*m-d*p*u,this._w=l*h*u-d*p*m;break;case"XZY":this._x=d*h*u-l*p*m,this._y=l*p*u-d*h*m,this._z=l*h*m+d*p*u,this._w=l*h*u+d*p*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],o=t[1],a=t[5],c=t[9],l=t[2],h=t[6],u=t[10],d=n+a+u;if(d>0){let p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-c)*p,this._y=(r-l)*p,this._z=(o-i)*p}else if(n>a&&n>u){let p=2*Math.sqrt(1+n-a-u);this._w=(h-c)/p,this._x=.25*p,this._y=(i+o)/p,this._z=(r+l)/p}else if(a>u){let p=2*Math.sqrt(1+a-n-u);this._w=(r-l)/p,this._x=(i+o)/p,this._y=.25*p,this._z=(c+h)/p}else{let p=2*Math.sqrt(1+u-n-a);this._w=(o-i)/p,this._x=(r+l)/p,this._y=(c+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ct(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,r=e._z,o=e._w,a=t._x,c=t._y,l=t._z,h=t._w;return this._x=n*h+o*a+i*l-r*c,this._y=i*h+o*c+r*a-n*l,this._z=r*h+o*l+n*c-i*a,this._w=o*h-n*a-i*c-r*l,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,i=this._y,r=this._z,o=this._w,a=o*e._w+n*e._x+i*e._y+r*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=n,this._y=i,this._z=r,this;let c=1-a*a;if(c<=Number.EPSILON){let p=1-t;return this._w=p*o+t*this._w,this._x=p*n+t*this._x,this._y=p*i+t*this._y,this._z=p*r+t*this._z,this.normalize(),this}let l=Math.sqrt(c),h=Math.atan2(l,a),u=Math.sin((1-t)*h)/l,d=Math.sin(t*h)/l;return this._w=o*u+this._w*d,this._x=n*u+this._x*d,this._y=i*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},A=class s{constructor(e=0,t=0,n=0){s.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Gu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Gu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,r=e.x,o=e.y,a=e.z,c=e.w,l=2*(o*i-a*n),h=2*(a*t-r*i),u=2*(r*n-o*t);return this.x=t+c*l+o*u-a*h,this.y=n+c*h+a*l-r*u,this.z=i+c*u+r*h-o*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,r=e.z,o=t.x,a=t.y,c=t.z;return this.x=i*c-r*a,this.y=r*o-n*c,this.z=n*a-i*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return ja.copy(this).projectOnVector(e),this.sub(ja)}reflect(e){return this.sub(ja.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ct(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ja=new A,Gu=new Jt,Ut=class{constructor(e=new A(1/0,1/0,1/0),t=new A(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(_n.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(_n.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=_n.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,_n):_n.fromBufferAttribute(r,o),_n.applyMatrix4(e.matrixWorld),this.expandByPoint(_n);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),no.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),no.copy(n.boundingBox)),no.applyMatrix4(e.matrixWorld),this.union(no)}let i=e.children;for(let r=0,o=i.length;r<o;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,_n),_n.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(rr),io.subVectors(this.max,rr),as.subVectors(e.a,rr),ls.subVectors(e.b,rr),cs.subVectors(e.c,rr),_i.subVectors(ls,as),vi.subVectors(cs,ls),Bi.subVectors(as,cs);let t=[0,-_i.z,_i.y,0,-vi.z,vi.y,0,-Bi.z,Bi.y,_i.z,0,-_i.x,vi.z,0,-vi.x,Bi.z,0,-Bi.x,-_i.y,_i.x,0,-vi.y,vi.x,0,-Bi.y,Bi.x,0];return!Ja(t,as,ls,cs,io)||(t=[1,0,0,0,1,0,0,0,1],!Ja(t,as,ls,cs,io))?!1:(so.crossVectors(_i,vi),t=[so.x,so.y,so.z],Ja(t,as,ls,cs,io))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,_n).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(_n).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Wn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Wn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Wn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Wn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Wn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Wn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Wn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Wn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Wn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},Wn=[new A,new A,new A,new A,new A,new A,new A,new A],_n=new A,no=new Ut,as=new A,ls=new A,cs=new A,_i=new A,vi=new A,Bi=new A,rr=new A,io=new A,so=new A,zi=new A;function Ja(s,e,t,n,i){for(let r=0,o=s.length-3;r<=o;r+=3){zi.fromArray(s,r);let a=i.x*Math.abs(zi.x)+i.y*Math.abs(zi.y)+i.z*Math.abs(zi.z),c=e.dot(zi),l=t.dot(zi),h=n.dot(zi);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>a)return!1}return!0}var am=new Ut,or=new A,Qa=new A,on=class{constructor(e=new A,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):am.setFromPoints(e).getCenter(n);let i=0;for(let r=0,o=e.length;r<o;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;or.subVectors(e,this.center);let t=or.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(or,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Qa.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(or.copy(e.center).add(Qa)),this.expandByPoint(or.copy(e.center).sub(Qa))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},Xn=new A,el=new A,ro=new A,yi=new A,tl=new A,oo=new A,nl=new A,si=class{constructor(e=new A,t=new A(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Xn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Xn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Xn.copy(this.origin).addScaledVector(this.direction,t),Xn.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){el.copy(e).add(t).multiplyScalar(.5),ro.copy(t).sub(e).normalize(),yi.copy(this.origin).sub(el);let r=e.distanceTo(t)*.5,o=-this.direction.dot(ro),a=yi.dot(this.direction),c=-yi.dot(ro),l=yi.lengthSq(),h=Math.abs(1-o*o),u,d,p,m;if(h>0)if(u=o*c-a,d=o*a-c,m=r*h,u>=0)if(d>=-m)if(d<=m){let _=1/h;u*=_,d*=_,p=u*(u+o*d+2*a)+d*(o*u+d+2*c)+l}else d=r,u=Math.max(0,-(o*d+a)),p=-u*u+d*(d+2*c)+l;else d=-r,u=Math.max(0,-(o*d+a)),p=-u*u+d*(d+2*c)+l;else d<=-m?(u=Math.max(0,-(-o*r+a)),d=u>0?-r:Math.min(Math.max(-r,-c),r),p=-u*u+d*(d+2*c)+l):d<=m?(u=0,d=Math.min(Math.max(-r,-c),r),p=d*(d+2*c)+l):(u=Math.max(0,-(o*r+a)),d=u>0?r:Math.min(Math.max(-r,-c),r),p=-u*u+d*(d+2*c)+l);else d=o>0?-r:r,u=Math.max(0,-(o*d+a)),p=-u*u+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(el).addScaledVector(ro,d),p}intersectSphere(e,t){Xn.subVectors(e.center,this.origin);let n=Xn.dot(this.direction),i=Xn.dot(Xn)-n*n,r=e.radius*e.radius;if(i>r)return null;let o=Math.sqrt(r-i),a=n-o,c=n+o;return c<0?null:a<0?this.at(c,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,o,a,c,l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(e.min.x-d.x)*l,i=(e.max.x-d.x)*l):(n=(e.max.x-d.x)*l,i=(e.min.x-d.x)*l),h>=0?(r=(e.min.y-d.y)*h,o=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,o=(e.min.y-d.y)*h),n>o||r>i||((r>n||isNaN(n))&&(n=r),(o<i||isNaN(i))&&(i=o),u>=0?(a=(e.min.z-d.z)*u,c=(e.max.z-d.z)*u):(a=(e.max.z-d.z)*u,c=(e.min.z-d.z)*u),n>c||a>i)||((a>n||n!==n)&&(n=a),(c<i||i!==i)&&(i=c),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,Xn)!==null}intersectTriangle(e,t,n,i,r){tl.subVectors(t,e),oo.subVectors(n,e),nl.crossVectors(tl,oo);let o=this.direction.dot(nl),a;if(o>0){if(i)return null;a=1}else if(o<0)a=-1,o=-o;else return null;yi.subVectors(this.origin,e);let c=a*this.direction.dot(oo.crossVectors(yi,oo));if(c<0)return null;let l=a*this.direction.dot(tl.cross(yi));if(l<0||c+l>o)return null;let h=-a*yi.dot(nl);return h<0?null:this.at(h/o,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Re=class s{constructor(e,t,n,i,r,o,a,c,l,h,u,d,p,m,_,g){s.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,c,l,h,u,d,p,m,_,g)}set(e,t,n,i,r,o,a,c,l,h,u,d,p,m,_,g){let f=this.elements;return f[0]=e,f[4]=t,f[8]=n,f[12]=i,f[1]=r,f[5]=o,f[9]=a,f[13]=c,f[2]=l,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=m,f[11]=_,f[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new s().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,i=1/hs.setFromMatrixColumn(e,0).length(),r=1/hs.setFromMatrixColumn(e,1).length(),o=1/hs.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,i=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),c=Math.cos(i),l=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let d=o*h,p=o*u,m=a*h,_=a*u;t[0]=c*h,t[4]=-c*u,t[8]=l,t[1]=p+m*l,t[5]=d-_*l,t[9]=-a*c,t[2]=_-d*l,t[6]=m+p*l,t[10]=o*c}else if(e.order==="YXZ"){let d=c*h,p=c*u,m=l*h,_=l*u;t[0]=d+_*a,t[4]=m*a-p,t[8]=o*l,t[1]=o*u,t[5]=o*h,t[9]=-a,t[2]=p*a-m,t[6]=_+d*a,t[10]=o*c}else if(e.order==="ZXY"){let d=c*h,p=c*u,m=l*h,_=l*u;t[0]=d-_*a,t[4]=-o*u,t[8]=m+p*a,t[1]=p+m*a,t[5]=o*h,t[9]=_-d*a,t[2]=-o*l,t[6]=a,t[10]=o*c}else if(e.order==="ZYX"){let d=o*h,p=o*u,m=a*h,_=a*u;t[0]=c*h,t[4]=m*l-p,t[8]=d*l+_,t[1]=c*u,t[5]=_*l+d,t[9]=p*l-m,t[2]=-l,t[6]=a*c,t[10]=o*c}else if(e.order==="YZX"){let d=o*c,p=o*l,m=a*c,_=a*l;t[0]=c*h,t[4]=_-d*u,t[8]=m*u+p,t[1]=u,t[5]=o*h,t[9]=-a*h,t[2]=-l*h,t[6]=p*u+m,t[10]=d-_*u}else if(e.order==="XZY"){let d=o*c,p=o*l,m=a*c,_=a*l;t[0]=c*h,t[4]=-u,t[8]=l*h,t[1]=d*u+_,t[5]=o*h,t[9]=p*u-m,t[2]=m*u-p,t[6]=a*h,t[10]=_*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(lm,e,cm)}lookAt(e,t,n){let i=this.elements;return nn.subVectors(e,t),nn.lengthSq()===0&&(nn.z=1),nn.normalize(),xi.crossVectors(n,nn),xi.lengthSq()===0&&(Math.abs(n.z)===1?nn.x+=1e-4:nn.z+=1e-4,nn.normalize(),xi.crossVectors(n,nn)),xi.normalize(),ao.crossVectors(nn,xi),i[0]=xi.x,i[4]=ao.x,i[8]=nn.x,i[1]=xi.y,i[5]=ao.y,i[9]=nn.y,i[2]=xi.z,i[6]=ao.z,i[10]=nn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[4],c=n[8],l=n[12],h=n[1],u=n[5],d=n[9],p=n[13],m=n[2],_=n[6],g=n[10],f=n[14],y=n[3],b=n[7],S=n[11],P=n[15],C=i[0],I=i[4],L=i[8],x=i[12],M=i[1],R=i[5],O=i[9],F=i[13],V=i[2],Z=i[6],X=i[10],ee=i[14],W=i[3],re=i[7],ue=i[11],Me=i[15];return r[0]=o*C+a*M+c*V+l*W,r[4]=o*I+a*R+c*Z+l*re,r[8]=o*L+a*O+c*X+l*ue,r[12]=o*x+a*F+c*ee+l*Me,r[1]=h*C+u*M+d*V+p*W,r[5]=h*I+u*R+d*Z+p*re,r[9]=h*L+u*O+d*X+p*ue,r[13]=h*x+u*F+d*ee+p*Me,r[2]=m*C+_*M+g*V+f*W,r[6]=m*I+_*R+g*Z+f*re,r[10]=m*L+_*O+g*X+f*ue,r[14]=m*x+_*F+g*ee+f*Me,r[3]=y*C+b*M+S*V+P*W,r[7]=y*I+b*R+S*Z+P*re,r[11]=y*L+b*O+S*X+P*ue,r[15]=y*x+b*F+S*ee+P*Me,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],o=e[1],a=e[5],c=e[9],l=e[13],h=e[2],u=e[6],d=e[10],p=e[14],m=e[3],_=e[7],g=e[11],f=e[15];return m*(+r*c*u-i*l*u-r*a*d+n*l*d+i*a*p-n*c*p)+_*(+t*c*p-t*l*d+r*o*d-i*o*p+i*l*h-r*c*h)+g*(+t*l*u-t*a*p-r*o*u+n*o*p+r*a*h-n*l*h)+f*(-i*a*h-t*c*u+t*a*d+i*o*u-n*o*d+n*c*h)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],h=e[8],u=e[9],d=e[10],p=e[11],m=e[12],_=e[13],g=e[14],f=e[15],y=u*g*l-_*d*l+_*c*p-a*g*p-u*c*f+a*d*f,b=m*d*l-h*g*l-m*c*p+o*g*p+h*c*f-o*d*f,S=h*_*l-m*u*l+m*a*p-o*_*p-h*a*f+o*u*f,P=m*u*c-h*_*c-m*a*d+o*_*d+h*a*g-o*u*g,C=t*y+n*b+i*S+r*P;if(C===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let I=1/C;return e[0]=y*I,e[1]=(_*d*r-u*g*r-_*i*p+n*g*p+u*i*f-n*d*f)*I,e[2]=(a*g*r-_*c*r+_*i*l-n*g*l-a*i*f+n*c*f)*I,e[3]=(u*c*r-a*d*r-u*i*l+n*d*l+a*i*p-n*c*p)*I,e[4]=b*I,e[5]=(h*g*r-m*d*r+m*i*p-t*g*p-h*i*f+t*d*f)*I,e[6]=(m*c*r-o*g*r-m*i*l+t*g*l+o*i*f-t*c*f)*I,e[7]=(o*d*r-h*c*r+h*i*l-t*d*l-o*i*p+t*c*p)*I,e[8]=S*I,e[9]=(m*u*r-h*_*r-m*n*p+t*_*p+h*n*f-t*u*f)*I,e[10]=(o*_*r-m*a*r+m*n*l-t*_*l-o*n*f+t*a*f)*I,e[11]=(h*a*r-o*u*r-h*n*l+t*u*l+o*n*p-t*a*p)*I,e[12]=P*I,e[13]=(h*_*i-m*u*i+m*n*d-t*_*d-h*n*g+t*u*g)*I,e[14]=(m*a*i-o*_*i-m*n*c+t*_*c+o*n*g-t*a*g)*I,e[15]=(o*u*i-h*a*i+h*n*c-t*u*c-o*n*d+t*a*d)*I,this}scale(e){let t=this.elements,n=e.x,i=e.y,r=e.z;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,o=e.x,a=e.y,c=e.z,l=r*o,h=r*a;return this.set(l*o+n,l*a-i*c,l*c+i*a,0,l*a+i*c,h*a+n,h*c-i*o,0,l*c-i*a,h*c+i*o,r*c*c+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,o){return this.set(1,n,r,0,e,1,o,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,r=t._x,o=t._y,a=t._z,c=t._w,l=r+r,h=o+o,u=a+a,d=r*l,p=r*h,m=r*u,_=o*h,g=o*u,f=a*u,y=c*l,b=c*h,S=c*u,P=n.x,C=n.y,I=n.z;return i[0]=(1-(_+f))*P,i[1]=(p+S)*P,i[2]=(m-b)*P,i[3]=0,i[4]=(p-S)*C,i[5]=(1-(d+f))*C,i[6]=(g+y)*C,i[7]=0,i[8]=(m+b)*I,i[9]=(g-y)*I,i[10]=(1-(d+_))*I,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements,r=hs.set(i[0],i[1],i[2]).length(),o=hs.set(i[4],i[5],i[6]).length(),a=hs.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),e.x=i[12],e.y=i[13],e.z=i[14],vn.copy(this);let l=1/r,h=1/o,u=1/a;return vn.elements[0]*=l,vn.elements[1]*=l,vn.elements[2]*=l,vn.elements[4]*=h,vn.elements[5]*=h,vn.elements[6]*=h,vn.elements[8]*=u,vn.elements[9]*=u,vn.elements[10]*=u,t.setFromRotationMatrix(vn),n.x=r,n.y=o,n.z=a,this}makePerspective(e,t,n,i,r,o,a=Jn){let c=this.elements,l=2*r/(t-e),h=2*r/(n-i),u=(t+e)/(t-e),d=(n+i)/(n-i),p,m;if(a===Jn)p=-(o+r)/(o-r),m=-2*o*r/(o-r);else if(a===zo)p=-o/(o-r),m=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=l,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=h,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,i,r,o,a=Jn){let c=this.elements,l=1/(t-e),h=1/(n-i),u=1/(o-r),d=(t+e)*l,p=(n+i)*h,m,_;if(a===Jn)m=(o+r)*u,_=-2*u;else if(a===zo)m=r*u,_=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=2*l,c[4]=0,c[8]=0,c[12]=-d,c[1]=0,c[5]=2*h,c[9]=0,c[13]=-p,c[2]=0,c[6]=0,c[10]=_,c[14]=-m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},hs=new A,vn=new Re,lm=new A(0,0,0),cm=new A(1,1,1),xi=new A,ao=new A,nn=new A,Wu=new Re,Xu=new Jt,Sn=class s{constructor(e=0,t=0,n=0,i=s.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],o=i[4],a=i[8],c=i[1],l=i[5],h=i[9],u=i[2],d=i[6],p=i[10];switch(t){case"XYZ":this._y=Math.asin(Ct(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-Ct(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ct(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-o,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-Ct(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-o,l));break;case"YZX":this._z=Math.asin(Ct(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-Ct(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Wu.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Wu,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Xu.setFromEuler(this),this.setFromQuaternion(Xu,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Sn.DEFAULT_ORDER="XYZ";var Sr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},hm=0,$u=new A,us=new Jt,$n=new Re,lo=new A,ar=new A,um=new A,dm=new Jt,qu=new A(1,0,0),Yu=new A(0,1,0),Ku=new A(0,0,1),Zu={type:"added"},fm={type:"removed"},ds={type:"childadded",child:null},il={type:"childremoved",child:null},lt=class s extends ni{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:hm++}),this.uuid=Mn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let e=new A,t=new Sn,n=new Jt,i=new A(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Re},normalMatrix:{value:new ke}}),this.matrix=new Re,this.matrixWorld=new Re,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Sr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return us.setFromAxisAngle(e,t),this.quaternion.multiply(us),this}rotateOnWorldAxis(e,t){return us.setFromAxisAngle(e,t),this.quaternion.premultiply(us),this}rotateX(e){return this.rotateOnAxis(qu,e)}rotateY(e){return this.rotateOnAxis(Yu,e)}rotateZ(e){return this.rotateOnAxis(Ku,e)}translateOnAxis(e,t){return $u.copy(e).applyQuaternion(this.quaternion),this.position.add($u.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(qu,e)}translateY(e){return this.translateOnAxis(Yu,e)}translateZ(e){return this.translateOnAxis(Ku,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4($n.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?lo.copy(e):lo.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),ar.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?$n.lookAt(ar,lo,this.up):$n.lookAt(lo,ar,this.up),this.quaternion.setFromRotationMatrix($n),i&&($n.extractRotation(i.matrixWorld),us.setFromRotationMatrix($n),this.quaternion.premultiply(us.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Zu),ds.child=e,this.dispatchEvent(ds),ds.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(fm),il.child=e,this.dispatchEvent(il),il.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),$n.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),$n.multiply(e.parent.matrixWorld)),e.applyMatrix4($n),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Zu),ds.child=e,this.dispatchEvent(ds),ds.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let i=this.children;for(let r=0,o=i.length;r<o;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ar,e,um),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ar,dm,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){let i=this.children;for(let r=0,o=i.length;r<o;r++)i[r].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let c=a.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){let u=c[l];r(e.shapes,u)}else r(e.shapes,c)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(r(e.materials,this.material[c]));i.material=a}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let c=this.animations[a];i.animations.push(r(e.animations,c))}}if(t){let a=o(e.geometries),c=o(e.materials),l=o(e.textures),h=o(e.images),u=o(e.shapes),d=o(e.skeletons),p=o(e.animations),m=o(e.nodes);a.length>0&&(n.geometries=a),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),m.length>0&&(n.nodes=m)}return n.object=i,n;function o(a){let c=[];for(let l in a){let h=a[l];delete h.metadata,c.push(h)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}};lt.DEFAULT_UP=new A(0,1,0);lt.DEFAULT_MATRIX_AUTO_UPDATE=!0;lt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var yn=new A,qn=new A,sl=new A,Yn=new A,fs=new A,ps=new A,ju=new A,rl=new A,ol=new A,al=new A,ll=new je,cl=new je,hl=new je,wi=class s{constructor(e=new A,t=new A,n=new A){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),yn.subVectors(e,t),i.cross(yn);let r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(e,t,n,i,r){yn.subVectors(i,t),qn.subVectors(n,t),sl.subVectors(e,t);let o=yn.dot(yn),a=yn.dot(qn),c=yn.dot(sl),l=qn.dot(qn),h=qn.dot(sl),u=o*l-a*a;if(u===0)return r.set(0,0,0),null;let d=1/u,p=(l*c-a*h)*d,m=(o*h-a*c)*d;return r.set(1-p-m,m,p)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,Yn)===null?!1:Yn.x>=0&&Yn.y>=0&&Yn.x+Yn.y<=1}static getInterpolation(e,t,n,i,r,o,a,c){return this.getBarycoord(e,t,n,i,Yn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,Yn.x),c.addScaledVector(o,Yn.y),c.addScaledVector(a,Yn.z),c)}static getInterpolatedAttribute(e,t,n,i,r,o){return ll.setScalar(0),cl.setScalar(0),hl.setScalar(0),ll.fromBufferAttribute(e,t),cl.fromBufferAttribute(e,n),hl.fromBufferAttribute(e,i),o.setScalar(0),o.addScaledVector(ll,r.x),o.addScaledVector(cl,r.y),o.addScaledVector(hl,r.z),o}static isFrontFacing(e,t,n,i){return yn.subVectors(n,t),qn.subVectors(e,t),yn.cross(qn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return yn.subVectors(this.c,this.b),qn.subVectors(this.a,this.b),yn.cross(qn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return s.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return s.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return s.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return s.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return s.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,o,a;fs.subVectors(i,n),ps.subVectors(r,n),rl.subVectors(e,n);let c=fs.dot(rl),l=ps.dot(rl);if(c<=0&&l<=0)return t.copy(n);ol.subVectors(e,i);let h=fs.dot(ol),u=ps.dot(ol);if(h>=0&&u<=h)return t.copy(i);let d=c*u-h*l;if(d<=0&&c>=0&&h<=0)return o=c/(c-h),t.copy(n).addScaledVector(fs,o);al.subVectors(e,r);let p=fs.dot(al),m=ps.dot(al);if(m>=0&&p<=m)return t.copy(r);let _=p*l-c*m;if(_<=0&&l>=0&&m<=0)return a=l/(l-m),t.copy(n).addScaledVector(ps,a);let g=h*m-p*u;if(g<=0&&u-h>=0&&p-m>=0)return ju.subVectors(r,i),a=(u-h)/(u-h+(p-m)),t.copy(i).addScaledVector(ju,a);let f=1/(g+_+d);return o=_*f,a=d*f,t.copy(n).addScaledVector(fs,o).addScaledVector(ps,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},cf={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},bi={h:0,s:0,l:0},co={h:0,s:0,l:0};function ul(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}var me=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=_t){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ve.toWorkingColorSpace(this,t),this}setRGB(e,t,n,i=Ve.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ve.toWorkingColorSpace(this,i),this}setHSL(e,t,n,i=Ve.workingColorSpace){if(e=ah(e,1),t=Ct(t,0,1),n=Ct(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=ul(o,r,e+1/3),this.g=ul(o,r,e),this.b=ul(o,r,e-1/3)}return Ve.toWorkingColorSpace(this,i),this}setStyle(e,t=_t){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,o=i[1],a=i[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=_t){let n=cf[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Qn(e.r),this.g=Qn(e.g),this.b=Qn(e.b),this}copyLinearToSRGB(e){return this.r=Es(e.r),this.g=Es(e.g),this.b=Es(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=_t){return Ve.fromWorkingColorSpace(Bt.copy(this),e),Math.round(Ct(Bt.r*255,0,255))*65536+Math.round(Ct(Bt.g*255,0,255))*256+Math.round(Ct(Bt.b*255,0,255))}getHexString(e=_t){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ve.workingColorSpace){Ve.fromWorkingColorSpace(Bt.copy(this),t);let n=Bt.r,i=Bt.g,r=Bt.b,o=Math.max(n,i,r),a=Math.min(n,i,r),c,l,h=(a+o)/2;if(a===o)c=0,l=0;else{let u=o-a;switch(l=h<=.5?u/(o+a):u/(2-o-a),o){case n:c=(i-r)/u+(i<r?6:0);break;case i:c=(r-n)/u+2;break;case r:c=(n-i)/u+4;break}c/=6}return e.h=c,e.s=l,e.l=h,e}getRGB(e,t=Ve.workingColorSpace){return Ve.fromWorkingColorSpace(Bt.copy(this),t),e.r=Bt.r,e.g=Bt.g,e.b=Bt.b,e}getStyle(e=_t){Ve.fromWorkingColorSpace(Bt.copy(this),e);let t=Bt.r,n=Bt.g,i=Bt.b;return e!==_t?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(bi),this.setHSL(bi.h+e,bi.s+t,bi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(bi),e.getHSL(co);let n=gr(bi.h,co.h,t),i=gr(bi.s,co.s,t),r=gr(bi.l,co.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Bt=new me;me.NAMES=cf;var pm=0,Qt=class extends ni{static get type(){return"Material"}get type(){return this.constructor.type}set type(e){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:pm++}),this.uuid=Mn(),this.name="",this.blending=Ms,this.side=Nn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Il,this.blendDst=Pl,this.blendEquation=$i,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new me(0,0,0),this.blendAlpha=0,this.depthFunc=As,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Nu,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=rs,this.stencilZFail=rs,this.stencilZPass=rs,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Ms&&(n.blending=this.blending),this.side!==Nn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Il&&(n.blendSrc=this.blendSrc),this.blendDst!==Pl&&(n.blendDst=this.blendDst),this.blendEquation!==$i&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==As&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Nu&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==rs&&(n.stencilFail=this.stencilFail),this.stencilZFail!==rs&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==rs&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){let o=[];for(let a in r){let c=r[a];delete c.metadata,o.push(c)}return o}if(t){let r=i(e.textures),o=i(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}},Wt=class extends Qt{static get type(){return"MeshBasicMaterial"}constructor(e){super(),this.isMeshBasicMaterial=!0,this.color=new me(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Sn,this.combine=jc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}};var Tt=new A,ho=new se,Et=class{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=fc,this.updateRanges=[],this.gpuType=bn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ho.fromBufferAttribute(this,t),ho.applyMatrix3(e),this.setXY(t,ho.x,ho.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.applyMatrix3(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.applyMatrix4(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.applyNormalMatrix(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.transformDirection(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=xn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=it(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=xn(t,this.array)),t}setX(e,t){return this.normalized&&(t=it(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=xn(t,this.array)),t}setY(e,t){return this.normalized&&(t=it(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=xn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=it(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=xn(t,this.array)),t}setW(e,t){return this.normalized&&(t=it(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=it(t,this.array),n=it(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=it(t,this.array),n=it(n,this.array),i=it(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=it(t,this.array),n=it(n,this.array),i=it(i,this.array),r=it(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==fc&&(e.usage=this.usage),e}};var Go=class extends Et{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Wo=class extends Et{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var tt=class extends Et{constructor(e,t,n){super(new Float32Array(e),t,n)}},mm=0,hn=new Re,dl=new lt,ms=new A,sn=new Ut,lr=new Ut,Nt=new A,xt=class s extends ni{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:mm++}),this.uuid=Mn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(lf(e)?Wo:Go)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new ke().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return hn.makeRotationFromQuaternion(e),this.applyMatrix4(hn),this}rotateX(e){return hn.makeRotationX(e),this.applyMatrix4(hn),this}rotateY(e){return hn.makeRotationY(e),this.applyMatrix4(hn),this}rotateZ(e){return hn.makeRotationZ(e),this.applyMatrix4(hn),this}translate(e,t,n){return hn.makeTranslation(e,t,n),this.applyMatrix4(hn),this}scale(e,t,n){return hn.makeScale(e,t,n),this.applyMatrix4(hn),this}lookAt(e){return dl.lookAt(e),dl.updateMatrix(),this.applyMatrix4(dl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ms).negate(),this.translate(ms.x,ms.y,ms.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let o=e[i];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new tt(n,3))}else{for(let n=0,i=t.count;n<i;n++){let r=e[n];t.setXYZ(n,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ut);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new A(-1/0,-1/0,-1/0),new A(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];sn.setFromBufferAttribute(r),this.morphTargetsRelative?(Nt.addVectors(this.boundingBox.min,sn.min),this.boundingBox.expandByPoint(Nt),Nt.addVectors(this.boundingBox.max,sn.max),this.boundingBox.expandByPoint(Nt)):(this.boundingBox.expandByPoint(sn.min),this.boundingBox.expandByPoint(sn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new on);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new A,1/0);return}if(e){let n=this.boundingSphere.center;if(sn.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){let a=t[r];lr.setFromBufferAttribute(a),this.morphTargetsRelative?(Nt.addVectors(sn.min,lr.min),sn.expandByPoint(Nt),Nt.addVectors(sn.max,lr.max),sn.expandByPoint(Nt)):(sn.expandByPoint(lr.min),sn.expandByPoint(lr.max))}sn.getCenter(n);let i=0;for(let r=0,o=e.count;r<o;r++)Nt.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Nt));if(t)for(let r=0,o=t.length;r<o;r++){let a=t[r],c=this.morphTargetsRelative;for(let l=0,h=a.count;l<h;l++)Nt.fromBufferAttribute(a,l),c&&(ms.fromBufferAttribute(e,l),Nt.add(ms)),i=Math.max(i,n.distanceToSquared(Nt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,i=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Et(new Float32Array(4*n.count),4));let o=this.getAttribute("tangent"),a=[],c=[];for(let L=0;L<n.count;L++)a[L]=new A,c[L]=new A;let l=new A,h=new A,u=new A,d=new se,p=new se,m=new se,_=new A,g=new A;function f(L,x,M){l.fromBufferAttribute(n,L),h.fromBufferAttribute(n,x),u.fromBufferAttribute(n,M),d.fromBufferAttribute(r,L),p.fromBufferAttribute(r,x),m.fromBufferAttribute(r,M),h.sub(l),u.sub(l),p.sub(d),m.sub(d);let R=1/(p.x*m.y-m.x*p.y);isFinite(R)&&(_.copy(h).multiplyScalar(m.y).addScaledVector(u,-p.y).multiplyScalar(R),g.copy(u).multiplyScalar(p.x).addScaledVector(h,-m.x).multiplyScalar(R),a[L].add(_),a[x].add(_),a[M].add(_),c[L].add(g),c[x].add(g),c[M].add(g))}let y=this.groups;y.length===0&&(y=[{start:0,count:e.count}]);for(let L=0,x=y.length;L<x;++L){let M=y[L],R=M.start,O=M.count;for(let F=R,V=R+O;F<V;F+=3)f(e.getX(F+0),e.getX(F+1),e.getX(F+2))}let b=new A,S=new A,P=new A,C=new A;function I(L){P.fromBufferAttribute(i,L),C.copy(P);let x=a[L];b.copy(x),b.sub(P.multiplyScalar(P.dot(x))).normalize(),S.crossVectors(C,x);let R=S.dot(c[L])<0?-1:1;o.setXYZW(L,b.x,b.y,b.z,R)}for(let L=0,x=y.length;L<x;++L){let M=y[L],R=M.start,O=M.count;for(let F=R,V=R+O;F<V;F+=3)I(e.getX(F+0)),I(e.getX(F+1)),I(e.getX(F+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Et(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);let i=new A,r=new A,o=new A,a=new A,c=new A,l=new A,h=new A,u=new A;if(e)for(let d=0,p=e.count;d<p;d+=3){let m=e.getX(d+0),_=e.getX(d+1),g=e.getX(d+2);i.fromBufferAttribute(t,m),r.fromBufferAttribute(t,_),o.fromBufferAttribute(t,g),h.subVectors(o,r),u.subVectors(i,r),h.cross(u),a.fromBufferAttribute(n,m),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,g),a.add(h),c.add(h),l.add(h),n.setXYZ(m,a.x,a.y,a.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(g,l.x,l.y,l.z)}else for(let d=0,p=t.count;d<p;d+=3)i.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),h.subVectors(o,r),u.subVectors(i,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Nt.fromBufferAttribute(e,t),Nt.normalize(),e.setXYZ(t,Nt.x,Nt.y,Nt.z)}toNonIndexed(){function e(a,c){let l=a.array,h=a.itemSize,u=a.normalized,d=new l.constructor(c.length*h),p=0,m=0;for(let _=0,g=c.length;_<g;_++){a.isInterleavedBufferAttribute?p=c[_]*a.data.stride+a.offset:p=c[_]*h;for(let f=0;f<h;f++)d[m++]=l[p++]}return new Et(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new s,n=this.index.array,i=this.attributes;for(let a in i){let c=i[a],l=e(c,n);t.setAttribute(a,l)}let r=this.morphAttributes;for(let a in r){let c=[],l=r[a];for(let h=0,u=l.length;h<u;h++){let d=l[h],p=e(d,n);c.push(p)}t.morphAttributes[a]=c}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,c=o.length;a<c;a++){let l=o[a];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let c in n){let l=n[c];e.data.attributes[c]=l.toJSON(e.data)}let i={},r=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],h=[];for(let u=0,d=l.length;u<d;u++){let p=l[u];h.push(p.toJSON(e.data))}h.length>0&&(i[c]=h,r=!0)}r&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone(t));let i=e.attributes;for(let l in i){let h=i[l];this.setAttribute(l,h.clone(t))}let r=e.morphAttributes;for(let l in r){let h=[],u=r[l];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[l]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let l=0,h=o.length;l<h;l++){let u=o[l];this.addGroup(u.start,u.count,u.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},Ju=new Re,Hi=new si,uo=new on,Qu=new A,fo=new A,po=new A,mo=new A,fl=new A,go=new A,ed=new A,_o=new A,$e=class extends lt{constructor(e=new xt,t=new Wt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let a=this.morphTargetInfluences;if(r&&a){go.set(0,0,0);for(let c=0,l=r.length;c<l;c++){let h=a[c],u=r[c];h!==0&&(fl.fromBufferAttribute(u,e),o?go.addScaledVector(fl,h):go.addScaledVector(fl.sub(t),h))}t.add(go)}return t}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),uo.copy(n.boundingSphere),uo.applyMatrix4(r),Hi.copy(e.ray).recast(e.near),!(uo.containsPoint(Hi.origin)===!1&&(Hi.intersectSphere(uo,Qu)===null||Hi.origin.distanceToSquared(Qu)>(e.far-e.near)**2))&&(Ju.copy(r).invert(),Hi.copy(e.ray).applyMatrix4(Ju),!(n.boundingBox!==null&&Hi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Hi)))}_computeIntersections(e,t,n){let i,r=this.geometry,o=this.material,a=r.index,c=r.attributes.position,l=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,p=r.drawRange;if(a!==null)if(Array.isArray(o))for(let m=0,_=d.length;m<_;m++){let g=d[m],f=o[g.materialIndex],y=Math.max(g.start,p.start),b=Math.min(a.count,Math.min(g.start+g.count,p.start+p.count));for(let S=y,P=b;S<P;S+=3){let C=a.getX(S),I=a.getX(S+1),L=a.getX(S+2);i=vo(this,f,e,n,l,h,u,C,I,L),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=g.materialIndex,t.push(i))}}else{let m=Math.max(0,p.start),_=Math.min(a.count,p.start+p.count);for(let g=m,f=_;g<f;g+=3){let y=a.getX(g),b=a.getX(g+1),S=a.getX(g+2);i=vo(this,o,e,n,l,h,u,y,b,S),i&&(i.faceIndex=Math.floor(g/3),t.push(i))}}else if(c!==void 0)if(Array.isArray(o))for(let m=0,_=d.length;m<_;m++){let g=d[m],f=o[g.materialIndex],y=Math.max(g.start,p.start),b=Math.min(c.count,Math.min(g.start+g.count,p.start+p.count));for(let S=y,P=b;S<P;S+=3){let C=S,I=S+1,L=S+2;i=vo(this,f,e,n,l,h,u,C,I,L),i&&(i.faceIndex=Math.floor(S/3),i.face.materialIndex=g.materialIndex,t.push(i))}}else{let m=Math.max(0,p.start),_=Math.min(c.count,p.start+p.count);for(let g=m,f=_;g<f;g+=3){let y=g,b=g+1,S=g+2;i=vo(this,o,e,n,l,h,u,y,b,S),i&&(i.faceIndex=Math.floor(g/3),t.push(i))}}}};function gm(s,e,t,n,i,r,o,a){let c;if(e.side===jt?c=n.intersectTriangle(o,r,i,!0,a):c=n.intersectTriangle(i,r,o,e.side===Nn,a),c===null)return null;_o.copy(a),_o.applyMatrix4(s.matrixWorld);let l=t.ray.origin.distanceTo(_o);return l<t.near||l>t.far?null:{distance:l,point:_o.clone(),object:s}}function vo(s,e,t,n,i,r,o,a,c,l){s.getVertexPosition(a,fo),s.getVertexPosition(c,po),s.getVertexPosition(l,mo);let h=gm(s,e,t,n,fo,po,mo,ed);if(h){let u=new A;wi.getBarycoord(ed,fo,po,mo,u),i&&(h.uv=wi.getInterpolatedAttribute(i,a,c,l,u,new se)),r&&(h.uv1=wi.getInterpolatedAttribute(r,a,c,l,u,new se)),o&&(h.normal=wi.getInterpolatedAttribute(o,a,c,l,u,new A),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a,b:c,c:l,normal:new A,materialIndex:0};wi.getNormal(fo,po,mo,d.normal),h.face=d,h.barycoord=u}return h}var wn=class s extends xt{constructor(e=1,t=1,n=1,i=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:o};let a=this;i=Math.floor(i),r=Math.floor(r),o=Math.floor(o);let c=[],l=[],h=[],u=[],d=0,p=0;m("z","y","x",-1,-1,n,t,e,o,r,0),m("z","y","x",1,-1,n,t,-e,o,r,1),m("x","z","y",1,1,e,n,t,i,o,2),m("x","z","y",1,-1,e,n,-t,i,o,3),m("x","y","z",1,-1,e,t,n,i,r,4),m("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(c),this.setAttribute("position",new tt(l,3)),this.setAttribute("normal",new tt(h,3)),this.setAttribute("uv",new tt(u,2));function m(_,g,f,y,b,S,P,C,I,L,x){let M=S/I,R=P/L,O=S/2,F=P/2,V=C/2,Z=I+1,X=L+1,ee=0,W=0,re=new A;for(let ue=0;ue<X;ue++){let Me=ue*R-F;for(let Fe=0;Fe<Z;Fe++){let ot=Fe*M-O;re[_]=ot*y,re[g]=Me*b,re[f]=V,l.push(re.x,re.y,re.z),re[_]=0,re[g]=0,re[f]=C>0?1:-1,h.push(re.x,re.y,re.z),u.push(Fe/I),u.push(1-ue/L),ee+=1}}for(let ue=0;ue<L;ue++)for(let Me=0;Me<I;Me++){let Fe=d+Me+Z*ue,ot=d+Me+Z*(ue+1),q=d+(Me+1)+Z*(ue+1),te=d+(Me+1)+Z*ue;c.push(Fe,ot,te),c.push(ot,q,te),W+=6}a.addGroup(p,W,x),p+=W,d+=ee}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function ks(s){let e={};for(let t in s){e[t]={};for(let n in s[t]){let i=s[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function Gt(s){let e={};for(let t=0;t<s.length;t++){let n=ks(s[t]);for(let i in n)e[i]=n[i]}return e}function _m(s){let e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function hf(s){let e=s.getRenderTarget();return e===null?s.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Ve.workingColorSpace}var vm={clone:ks,merge:Gt},ym=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,xm=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,kn=class extends Qt{static get type(){return"ShaderMaterial"}constructor(e){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=ym,this.fragmentShader=xm,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ks(e.uniforms),this.uniformsGroups=_m(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let o=this.uniforms[i].value;o&&o.isTexture?t.uniforms[i]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[i]={type:"m4",value:o.toArray()}:t.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},Xo=class extends lt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Re,this.projectionMatrix=new Re,this.projectionMatrixInverse=new Re,this.coordinateSystem=Jn}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},Mi=new A,td=new se,nd=new se,At=class extends Xo{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Ns*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(ws*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ns*2*Math.atan(Math.tan(ws*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Mi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Mi.x,Mi.y).multiplyScalar(-e/Mi.z),Mi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Mi.x,Mi.y).multiplyScalar(-e/Mi.z)}getViewSize(e,t){return this.getViewBounds(e,td,nd),t.subVectors(nd,td)}setViewOffset(e,t,n,i,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(ws*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i,o=this.view;if(this.view!==null&&this.view.enabled){let c=o.fullWidth,l=o.fullHeight;r+=o.offsetX*i/c,t-=o.offsetY*n/l,i*=o.width/c,n*=o.height/l}let a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},gs=-90,_s=1,_c=class extends lt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new At(gs,_s,e,t);i.layers=this.layers,this.add(i);let r=new At(gs,_s,e,t);r.layers=this.layers,this.add(r);let o=new At(gs,_s,e,t);o.layers=this.layers,this.add(o);let a=new At(gs,_s,e,t);a.layers=this.layers,this.add(a);let c=new At(gs,_s,e,t);c.layers=this.layers,this.add(c);let l=new At(gs,_s,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,o,a,c]=t;for(let l of t)this.remove(l);if(e===Jn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===zo)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,c,l,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),m=e.xr.enabled;e.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,i),e.render(t,r),e.setRenderTarget(n,1,i),e.render(t,o),e.setRenderTarget(n,2,i),e.render(t,a),e.setRenderTarget(n,3,i),e.render(t,c),e.setRenderTarget(n,4,i),e.render(t,l),n.texture.generateMipmaps=_,e.setRenderTarget(n,5,i),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=m,n.texture.needsPMREMUpdate=!0}},$o=class extends kt{constructor(e,t,n,i,r,o,a,c,l,h){e=e!==void 0?e:[],t=t!==void 0?t:Rs,super(e,t,n,i,r,o,a,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},vc=class extends ii{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new $o(i,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Zt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new wn(5,5,5),r=new kn({name:"CubemapFromEquirect",uniforms:ks(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:jt,blending:Ti});r.uniforms.tEquirect.value=t;let o=new $e(i,r),a=t.minFilter;return t.minFilter===Dn&&(t.minFilter=Zt),new _c(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,n,i){let r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,i);e.setRenderTarget(r)}},pl=new A,bm=new A,Mm=new ke,rn=class{constructor(e=new A(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=pl.subVectors(n,t).cross(bm.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let n=e.delta(pl),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let r=-(e.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Mm.getNormalMatrix(e),i=this.coplanarPoint(pl).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Vi=new on,yo=new A,wr=class{constructor(e=new rn,t=new rn,n=new rn,i=new rn,r=new rn,o=new rn){this.planes=[e,t,n,i,r,o]}set(e,t,n,i,r,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(r),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Jn){let n=this.planes,i=e.elements,r=i[0],o=i[1],a=i[2],c=i[3],l=i[4],h=i[5],u=i[6],d=i[7],p=i[8],m=i[9],_=i[10],g=i[11],f=i[12],y=i[13],b=i[14],S=i[15];if(n[0].setComponents(c-r,d-l,g-p,S-f).normalize(),n[1].setComponents(c+r,d+l,g+p,S+f).normalize(),n[2].setComponents(c+o,d+h,g+m,S+y).normalize(),n[3].setComponents(c-o,d-h,g-m,S-y).normalize(),n[4].setComponents(c-a,d-u,g-_,S-b).normalize(),t===Jn)n[5].setComponents(c+a,d+u,g+_,S+b).normalize();else if(t===zo)n[5].setComponents(a,u,_,b).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Vi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Vi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Vi)}intersectsSprite(e){return Vi.center.set(0,0,0),Vi.radius=.7071067811865476,Vi.applyMatrix4(e.matrixWorld),this.intersectsSphere(Vi)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(yo.x=i.normal.x>0?e.max.x:e.min.x,yo.y=i.normal.y>0?e.max.y:e.min.y,yo.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(yo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function uf(){let s=null,e=!1,t=null,n=null;function i(r,o){t(r,o),n=s.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=s.requestAnimationFrame(i),e=!0)},stop:function(){s.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function Sm(s){let e=new WeakMap;function t(a,c){let l=a.array,h=a.usage,u=l.byteLength,d=s.createBuffer();s.bindBuffer(c,d),s.bufferData(c,l,h),a.onUploadCallback();let p;if(l instanceof Float32Array)p=s.FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?p=s.HALF_FLOAT:p=s.UNSIGNED_SHORT;else if(l instanceof Int16Array)p=s.SHORT;else if(l instanceof Uint32Array)p=s.UNSIGNED_INT;else if(l instanceof Int32Array)p=s.INT;else if(l instanceof Int8Array)p=s.BYTE;else if(l instanceof Uint8Array)p=s.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)p=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:d,type:p,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:u}}function n(a,c,l){let h=c.array,u=c.updateRanges;if(s.bindBuffer(l,a),u.length===0)s.bufferSubData(l,0,h);else{u.sort((p,m)=>p.start-m.start);let d=0;for(let p=1;p<u.length;p++){let m=u[d],_=u[p];_.start<=m.start+m.count+1?m.count=Math.max(m.count,_.start+_.count-m.start):(++d,u[d]=_)}u.length=d+1;for(let p=0,m=u.length;p<m;p++){let _=u[p];s.bufferSubData(l,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}c.clearUpdateRanges()}c.onUploadCallback()}function i(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let c=e.get(a);c&&(s.deleteBuffer(c.buffer),e.delete(a))}function o(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let l=e.get(a);if(l===void 0)e.set(a,t(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,a,c),l.version=a.version}}return{get:i,remove:r,update:o}}var Us=class s extends xt{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,o=t/2,a=Math.floor(n),c=Math.floor(i),l=a+1,h=c+1,u=e/a,d=t/c,p=[],m=[],_=[],g=[];for(let f=0;f<h;f++){let y=f*d-o;for(let b=0;b<l;b++){let S=b*u-r;m.push(S,-y,0),_.push(0,0,1),g.push(b/a),g.push(1-f/c)}}for(let f=0;f<c;f++)for(let y=0;y<a;y++){let b=y+l*f,S=y+l*(f+1),P=y+1+l*(f+1),C=y+1+l*f;p.push(b,S,C),p.push(S,P,C)}this.setIndex(p),this.setAttribute("position",new tt(m,3)),this.setAttribute("normal",new tt(_,3)),this.setAttribute("uv",new tt(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.widthSegments,e.heightSegments)}},wm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Em=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Tm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Am=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Rm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Cm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Im=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Pm=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Lm=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Dm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Nm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,km=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Um=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Om=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Fm=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Bm=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,zm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Hm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Vm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Gm=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Wm=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Xm=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,$m=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,qm=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ym=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Km=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Zm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,jm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Jm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Qm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,eg="gl_FragColor = linearToOutputTexel( gl_FragColor );",tg=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,ng=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,ig=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,sg=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,rg=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,og=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,ag=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,lg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,cg=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,hg=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ug=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,dg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,fg=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,pg=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,mg=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,gg=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,_g=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,vg=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,yg=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,xg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,bg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Mg=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Sg=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,wg=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Eg=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Tg=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Ag=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Rg=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Cg=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ig=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Pg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Lg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Dg=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ng=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,kg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Ug=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Og=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Fg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Bg=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,zg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Hg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Vg=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Gg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Wg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Xg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,$g=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,qg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Yg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Kg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Zg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,jg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Jg=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Qg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,e0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,t0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,n0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,i0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,s0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,r0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,o0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,a0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,l0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,c0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,h0=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,u0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,d0=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,f0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,p0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,m0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,g0=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,_0=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,v0=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,y0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,x0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,b0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,M0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,S0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,w0=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,E0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,T0=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,A0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,R0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,C0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,I0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,P0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,L0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,D0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,N0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,k0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,U0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,O0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,F0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,B0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,z0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,H0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,V0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,G0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,W0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,X0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,$0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,q0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Y0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,K0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Z0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,j0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,J0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Q0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,e_=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,t_=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,n_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Oe={alphahash_fragment:wm,alphahash_pars_fragment:Em,alphamap_fragment:Tm,alphamap_pars_fragment:Am,alphatest_fragment:Rm,alphatest_pars_fragment:Cm,aomap_fragment:Im,aomap_pars_fragment:Pm,batching_pars_vertex:Lm,batching_vertex:Dm,begin_vertex:Nm,beginnormal_vertex:km,bsdfs:Um,iridescence_fragment:Om,bumpmap_pars_fragment:Fm,clipping_planes_fragment:Bm,clipping_planes_pars_fragment:zm,clipping_planes_pars_vertex:Hm,clipping_planes_vertex:Vm,color_fragment:Gm,color_pars_fragment:Wm,color_pars_vertex:Xm,color_vertex:$m,common:qm,cube_uv_reflection_fragment:Ym,defaultnormal_vertex:Km,displacementmap_pars_vertex:Zm,displacementmap_vertex:jm,emissivemap_fragment:Jm,emissivemap_pars_fragment:Qm,colorspace_fragment:eg,colorspace_pars_fragment:tg,envmap_fragment:ng,envmap_common_pars_fragment:ig,envmap_pars_fragment:sg,envmap_pars_vertex:rg,envmap_physical_pars_fragment:gg,envmap_vertex:og,fog_vertex:ag,fog_pars_vertex:lg,fog_fragment:cg,fog_pars_fragment:hg,gradientmap_pars_fragment:ug,lightmap_pars_fragment:dg,lights_lambert_fragment:fg,lights_lambert_pars_fragment:pg,lights_pars_begin:mg,lights_toon_fragment:_g,lights_toon_pars_fragment:vg,lights_phong_fragment:yg,lights_phong_pars_fragment:xg,lights_physical_fragment:bg,lights_physical_pars_fragment:Mg,lights_fragment_begin:Sg,lights_fragment_maps:wg,lights_fragment_end:Eg,logdepthbuf_fragment:Tg,logdepthbuf_pars_fragment:Ag,logdepthbuf_pars_vertex:Rg,logdepthbuf_vertex:Cg,map_fragment:Ig,map_pars_fragment:Pg,map_particle_fragment:Lg,map_particle_pars_fragment:Dg,metalnessmap_fragment:Ng,metalnessmap_pars_fragment:kg,morphinstance_vertex:Ug,morphcolor_vertex:Og,morphnormal_vertex:Fg,morphtarget_pars_vertex:Bg,morphtarget_vertex:zg,normal_fragment_begin:Hg,normal_fragment_maps:Vg,normal_pars_fragment:Gg,normal_pars_vertex:Wg,normal_vertex:Xg,normalmap_pars_fragment:$g,clearcoat_normal_fragment_begin:qg,clearcoat_normal_fragment_maps:Yg,clearcoat_pars_fragment:Kg,iridescence_pars_fragment:Zg,opaque_fragment:jg,packing:Jg,premultiplied_alpha_fragment:Qg,project_vertex:e0,dithering_fragment:t0,dithering_pars_fragment:n0,roughnessmap_fragment:i0,roughnessmap_pars_fragment:s0,shadowmap_pars_fragment:r0,shadowmap_pars_vertex:o0,shadowmap_vertex:a0,shadowmask_pars_fragment:l0,skinbase_vertex:c0,skinning_pars_vertex:h0,skinning_vertex:u0,skinnormal_vertex:d0,specularmap_fragment:f0,specularmap_pars_fragment:p0,tonemapping_fragment:m0,tonemapping_pars_fragment:g0,transmission_fragment:_0,transmission_pars_fragment:v0,uv_pars_fragment:y0,uv_pars_vertex:x0,uv_vertex:b0,worldpos_vertex:M0,background_vert:S0,background_frag:w0,backgroundCube_vert:E0,backgroundCube_frag:T0,cube_vert:A0,cube_frag:R0,depth_vert:C0,depth_frag:I0,distanceRGBA_vert:P0,distanceRGBA_frag:L0,equirect_vert:D0,equirect_frag:N0,linedashed_vert:k0,linedashed_frag:U0,meshbasic_vert:O0,meshbasic_frag:F0,meshlambert_vert:B0,meshlambert_frag:z0,meshmatcap_vert:H0,meshmatcap_frag:V0,meshnormal_vert:G0,meshnormal_frag:W0,meshphong_vert:X0,meshphong_frag:$0,meshphysical_vert:q0,meshphysical_frag:Y0,meshtoon_vert:K0,meshtoon_frag:Z0,points_vert:j0,points_frag:J0,shadow_vert:Q0,shadow_frag:e_,sprite_vert:t_,sprite_frag:n_},ne={common:{diffuse:{value:new me(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ke},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ke}},envmap:{envMap:{value:null},envMapRotation:{value:new ke},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ke}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ke}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ke},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ke},normalScale:{value:new se(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ke},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ke}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ke}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ke}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new me(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new me(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0},uvTransform:{value:new ke}},sprite:{diffuse:{value:new me(16777215)},opacity:{value:1},center:{value:new se(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ke},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0}}},Ln={basic:{uniforms:Gt([ne.common,ne.specularmap,ne.envmap,ne.aomap,ne.lightmap,ne.fog]),vertexShader:Oe.meshbasic_vert,fragmentShader:Oe.meshbasic_frag},lambert:{uniforms:Gt([ne.common,ne.specularmap,ne.envmap,ne.aomap,ne.lightmap,ne.emissivemap,ne.bumpmap,ne.normalmap,ne.displacementmap,ne.fog,ne.lights,{emissive:{value:new me(0)}}]),vertexShader:Oe.meshlambert_vert,fragmentShader:Oe.meshlambert_frag},phong:{uniforms:Gt([ne.common,ne.specularmap,ne.envmap,ne.aomap,ne.lightmap,ne.emissivemap,ne.bumpmap,ne.normalmap,ne.displacementmap,ne.fog,ne.lights,{emissive:{value:new me(0)},specular:{value:new me(1118481)},shininess:{value:30}}]),vertexShader:Oe.meshphong_vert,fragmentShader:Oe.meshphong_frag},standard:{uniforms:Gt([ne.common,ne.envmap,ne.aomap,ne.lightmap,ne.emissivemap,ne.bumpmap,ne.normalmap,ne.displacementmap,ne.roughnessmap,ne.metalnessmap,ne.fog,ne.lights,{emissive:{value:new me(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag},toon:{uniforms:Gt([ne.common,ne.aomap,ne.lightmap,ne.emissivemap,ne.bumpmap,ne.normalmap,ne.displacementmap,ne.gradientmap,ne.fog,ne.lights,{emissive:{value:new me(0)}}]),vertexShader:Oe.meshtoon_vert,fragmentShader:Oe.meshtoon_frag},matcap:{uniforms:Gt([ne.common,ne.bumpmap,ne.normalmap,ne.displacementmap,ne.fog,{matcap:{value:null}}]),vertexShader:Oe.meshmatcap_vert,fragmentShader:Oe.meshmatcap_frag},points:{uniforms:Gt([ne.points,ne.fog]),vertexShader:Oe.points_vert,fragmentShader:Oe.points_frag},dashed:{uniforms:Gt([ne.common,ne.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Oe.linedashed_vert,fragmentShader:Oe.linedashed_frag},depth:{uniforms:Gt([ne.common,ne.displacementmap]),vertexShader:Oe.depth_vert,fragmentShader:Oe.depth_frag},normal:{uniforms:Gt([ne.common,ne.bumpmap,ne.normalmap,ne.displacementmap,{opacity:{value:1}}]),vertexShader:Oe.meshnormal_vert,fragmentShader:Oe.meshnormal_frag},sprite:{uniforms:Gt([ne.sprite,ne.fog]),vertexShader:Oe.sprite_vert,fragmentShader:Oe.sprite_frag},background:{uniforms:{uvTransform:{value:new ke},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Oe.background_vert,fragmentShader:Oe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ke}},vertexShader:Oe.backgroundCube_vert,fragmentShader:Oe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Oe.cube_vert,fragmentShader:Oe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Oe.equirect_vert,fragmentShader:Oe.equirect_frag},distanceRGBA:{uniforms:Gt([ne.common,ne.displacementmap,{referencePosition:{value:new A},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Oe.distanceRGBA_vert,fragmentShader:Oe.distanceRGBA_frag},shadow:{uniforms:Gt([ne.lights,ne.fog,{color:{value:new me(0)},opacity:{value:1}}]),vertexShader:Oe.shadow_vert,fragmentShader:Oe.shadow_frag}};Ln.physical={uniforms:Gt([Ln.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ke},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ke},clearcoatNormalScale:{value:new se(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ke},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ke},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ke},sheen:{value:0},sheenColor:{value:new me(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ke},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ke},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ke},transmissionSamplerSize:{value:new se},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ke},attenuationDistance:{value:0},attenuationColor:{value:new me(0)},specularColor:{value:new me(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ke},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ke},anisotropyVector:{value:new se},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ke}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag};var xo={r:0,b:0,g:0},Gi=new Sn,i_=new Re;function s_(s,e,t,n,i,r,o){let a=new me(0),c=r===!0?0:1,l,h,u=null,d=0,p=null;function m(y){let b=y.isScene===!0?y.background:null;return b&&b.isTexture&&(b=(y.backgroundBlurriness>0?t:e).get(b)),b}function _(y){let b=!1,S=m(y);S===null?f(a,c):S&&S.isColor&&(f(S,1),b=!0);let P=s.xr.getEnvironmentBlendMode();P==="additive"?n.buffers.color.setClear(0,0,0,1,o):P==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(s.autoClear||b)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function g(y,b){let S=m(b);S&&(S.isCubeTexture||S.mapping===ya)?(h===void 0&&(h=new $e(new wn(1,1,1),new kn({name:"BackgroundCubeMaterial",uniforms:ks(Ln.backgroundCube.uniforms),vertexShader:Ln.backgroundCube.vertexShader,fragmentShader:Ln.backgroundCube.fragmentShader,side:jt,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(P,C,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),Gi.copy(b.backgroundRotation),Gi.x*=-1,Gi.y*=-1,Gi.z*=-1,S.isCubeTexture&&S.isRenderTargetTexture===!1&&(Gi.y*=-1,Gi.z*=-1),h.material.uniforms.envMap.value=S,h.material.uniforms.flipEnvMap.value=S.isCubeTexture&&S.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=b.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(i_.makeRotationFromEuler(Gi)),h.material.toneMapped=Ve.getTransfer(S.colorSpace)!==st,(u!==S||d!==S.version||p!==s.toneMapping)&&(h.material.needsUpdate=!0,u=S,d=S.version,p=s.toneMapping),h.layers.enableAll(),y.unshift(h,h.geometry,h.material,0,0,null)):S&&S.isTexture&&(l===void 0&&(l=new $e(new Us(2,2),new kn({name:"BackgroundMaterial",uniforms:ks(Ln.background.uniforms),vertexShader:Ln.background.vertexShader,fragmentShader:Ln.background.fragmentShader,side:Nn,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=S,l.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,l.material.toneMapped=Ve.getTransfer(S.colorSpace)!==st,S.matrixAutoUpdate===!0&&S.updateMatrix(),l.material.uniforms.uvTransform.value.copy(S.matrix),(u!==S||d!==S.version||p!==s.toneMapping)&&(l.material.needsUpdate=!0,u=S,d=S.version,p=s.toneMapping),l.layers.enableAll(),y.unshift(l,l.geometry,l.material,0,0,null))}function f(y,b){y.getRGB(xo,hf(s)),n.buffers.color.setClear(xo.r,xo.g,xo.b,b,o)}return{getClearColor:function(){return a},setClearColor:function(y,b=1){a.set(y),c=b,f(a,c)},getClearAlpha:function(){return c},setClearAlpha:function(y){c=y,f(a,c)},render:_,addToRenderList:g}}function r_(s,e){let t=s.getParameter(s.MAX_VERTEX_ATTRIBS),n={},i=d(null),r=i,o=!1;function a(M,R,O,F,V){let Z=!1,X=u(F,O,R);r!==X&&(r=X,l(r.object)),Z=p(M,F,O,V),Z&&m(M,F,O,V),V!==null&&e.update(V,s.ELEMENT_ARRAY_BUFFER),(Z||o)&&(o=!1,S(M,R,O,F),V!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(V).buffer))}function c(){return s.createVertexArray()}function l(M){return s.bindVertexArray(M)}function h(M){return s.deleteVertexArray(M)}function u(M,R,O){let F=O.wireframe===!0,V=n[M.id];V===void 0&&(V={},n[M.id]=V);let Z=V[R.id];Z===void 0&&(Z={},V[R.id]=Z);let X=Z[F];return X===void 0&&(X=d(c()),Z[F]=X),X}function d(M){let R=[],O=[],F=[];for(let V=0;V<t;V++)R[V]=0,O[V]=0,F[V]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:R,enabledAttributes:O,attributeDivisors:F,object:M,attributes:{},index:null}}function p(M,R,O,F){let V=r.attributes,Z=R.attributes,X=0,ee=O.getAttributes();for(let W in ee)if(ee[W].location>=0){let ue=V[W],Me=Z[W];if(Me===void 0&&(W==="instanceMatrix"&&M.instanceMatrix&&(Me=M.instanceMatrix),W==="instanceColor"&&M.instanceColor&&(Me=M.instanceColor)),ue===void 0||ue.attribute!==Me||Me&&ue.data!==Me.data)return!0;X++}return r.attributesNum!==X||r.index!==F}function m(M,R,O,F){let V={},Z=R.attributes,X=0,ee=O.getAttributes();for(let W in ee)if(ee[W].location>=0){let ue=Z[W];ue===void 0&&(W==="instanceMatrix"&&M.instanceMatrix&&(ue=M.instanceMatrix),W==="instanceColor"&&M.instanceColor&&(ue=M.instanceColor));let Me={};Me.attribute=ue,ue&&ue.data&&(Me.data=ue.data),V[W]=Me,X++}r.attributes=V,r.attributesNum=X,r.index=F}function _(){let M=r.newAttributes;for(let R=0,O=M.length;R<O;R++)M[R]=0}function g(M){f(M,0)}function f(M,R){let O=r.newAttributes,F=r.enabledAttributes,V=r.attributeDivisors;O[M]=1,F[M]===0&&(s.enableVertexAttribArray(M),F[M]=1),V[M]!==R&&(s.vertexAttribDivisor(M,R),V[M]=R)}function y(){let M=r.newAttributes,R=r.enabledAttributes;for(let O=0,F=R.length;O<F;O++)R[O]!==M[O]&&(s.disableVertexAttribArray(O),R[O]=0)}function b(M,R,O,F,V,Z,X){X===!0?s.vertexAttribIPointer(M,R,O,V,Z):s.vertexAttribPointer(M,R,O,F,V,Z)}function S(M,R,O,F){_();let V=F.attributes,Z=O.getAttributes(),X=R.defaultAttributeValues;for(let ee in Z){let W=Z[ee];if(W.location>=0){let re=V[ee];if(re===void 0&&(ee==="instanceMatrix"&&M.instanceMatrix&&(re=M.instanceMatrix),ee==="instanceColor"&&M.instanceColor&&(re=M.instanceColor)),re!==void 0){let ue=re.normalized,Me=re.itemSize,Fe=e.get(re);if(Fe===void 0)continue;let ot=Fe.buffer,q=Fe.type,te=Fe.bytesPerElement,ye=q===s.INT||q===s.UNSIGNED_INT||re.gpuType===Qc;if(re.isInterleavedBufferAttribute){let oe=re.data,Ae=oe.stride,Le=re.offset;if(oe.isInstancedInterleavedBuffer){for(let Be=0;Be<W.locationSize;Be++)f(W.location+Be,oe.meshPerAttribute);M.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=oe.meshPerAttribute*oe.count)}else for(let Be=0;Be<W.locationSize;Be++)g(W.location+Be);s.bindBuffer(s.ARRAY_BUFFER,ot);for(let Be=0;Be<W.locationSize;Be++)b(W.location+Be,Me/W.locationSize,q,ue,Ae*te,(Le+Me/W.locationSize*Be)*te,ye)}else{if(re.isInstancedBufferAttribute){for(let oe=0;oe<W.locationSize;oe++)f(W.location+oe,re.meshPerAttribute);M.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=re.meshPerAttribute*re.count)}else for(let oe=0;oe<W.locationSize;oe++)g(W.location+oe);s.bindBuffer(s.ARRAY_BUFFER,ot);for(let oe=0;oe<W.locationSize;oe++)b(W.location+oe,Me/W.locationSize,q,ue,Me*te,Me/W.locationSize*oe*te,ye)}}else if(X!==void 0){let ue=X[ee];if(ue!==void 0)switch(ue.length){case 2:s.vertexAttrib2fv(W.location,ue);break;case 3:s.vertexAttrib3fv(W.location,ue);break;case 4:s.vertexAttrib4fv(W.location,ue);break;default:s.vertexAttrib1fv(W.location,ue)}}}}y()}function P(){L();for(let M in n){let R=n[M];for(let O in R){let F=R[O];for(let V in F)h(F[V].object),delete F[V];delete R[O]}delete n[M]}}function C(M){if(n[M.id]===void 0)return;let R=n[M.id];for(let O in R){let F=R[O];for(let V in F)h(F[V].object),delete F[V];delete R[O]}delete n[M.id]}function I(M){for(let R in n){let O=n[R];if(O[M.id]===void 0)continue;let F=O[M.id];for(let V in F)h(F[V].object),delete F[V];delete O[M.id]}}function L(){x(),o=!0,r!==i&&(r=i,l(r.object))}function x(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:a,reset:L,resetDefaultState:x,dispose:P,releaseStatesOfGeometry:C,releaseStatesOfProgram:I,initAttributes:_,enableAttribute:g,disableUnusedAttributes:y}}function o_(s,e,t){let n;function i(l){n=l}function r(l,h){s.drawArrays(n,l,h),t.update(h,n,1)}function o(l,h,u){u!==0&&(s.drawArraysInstanced(n,l,h,u),t.update(h,n,u))}function a(l,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,h,0,u);let p=0;for(let m=0;m<u;m++)p+=h[m];t.update(p,n,1)}function c(l,h,u,d){if(u===0)return;let p=e.get("WEBGL_multi_draw");if(p===null)for(let m=0;m<l.length;m++)o(l[m],h[m],d[m]);else{p.multiDrawArraysInstancedWEBGL(n,l,0,h,0,d,0,u);let m=0;for(let _=0;_<u;_++)m+=h[_]*d[_];t.update(m,n,1)}}this.setMode=i,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=c}function a_(s,e,t,n){let i;function r(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){let I=e.get("EXT_texture_filter_anisotropic");i=s.getParameter(I.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(I){return!(I!==un&&n.convert(I)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(I){let L=I===Or&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(I!==ti&&n.convert(I)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE)&&I!==bn&&!L)}function c(I){if(I==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";I="mediump"}return I==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=t.precision!==void 0?t.precision:"highp",h=c(l);h!==l&&(console.warn("THREE.WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);let u=t.logarithmicDepthBuffer===!0,d=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control"),p=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),m=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),f=s.getParameter(s.MAX_VERTEX_ATTRIBS),y=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),b=s.getParameter(s.MAX_VARYING_VECTORS),S=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),P=m>0,C=s.getParameter(s.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:p,maxVertexTextures:m,maxTextureSize:_,maxCubemapSize:g,maxAttributes:f,maxVertexUniforms:y,maxVaryings:b,maxFragmentUniforms:S,vertexTextures:P,maxSamples:C}}function l_(s){let e=this,t=null,n=0,i=!1,r=!1,o=new rn,a=new ke,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){let p=u.length!==0||d||n!==0||i;return i=d,n=u.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,p){let m=u.clippingPlanes,_=u.clipIntersection,g=u.clipShadows,f=s.get(u);if(!i||m===null||m.length===0||r&&!g)r?h(null):l();else{let y=r?0:n,b=y*4,S=f.clippingState||null;c.value=S,S=h(m,d,b,p);for(let P=0;P!==b;++P)S[P]=t[P];f.clippingState=S,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=y}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,d,p,m){let _=u!==null?u.length:0,g=null;if(_!==0){if(g=c.value,m!==!0||g===null){let f=p+_*4,y=d.matrixWorldInverse;a.getNormalMatrix(y),(g===null||g.length<f)&&(g=new Float32Array(f));for(let b=0,S=p;b!==_;++b,S+=4)o.copy(u[b]).applyMatrix4(y,a),o.normal.toArray(g,S),g[S+3]=o.constant}c.value=g,c.needsUpdate=!0}return e.numPlanes=_,e.numIntersection=0,g}}function c_(s){let e=new WeakMap;function t(o,a){return a===Bl?o.mapping=Rs:a===zl&&(o.mapping=Cs),o}function n(o){if(o&&o.isTexture){let a=o.mapping;if(a===Bl||a===zl)if(e.has(o)){let c=e.get(o).texture;return t(c,o.mapping)}else{let c=o.image;if(c&&c.height>0){let l=new vc(c.height);return l.fromEquirectangularTexture(s,o),e.set(o,l),o.addEventListener("dispose",i),t(l.texture,o.mapping)}else return null}}return o}function i(o){let a=o.target;a.removeEventListener("dispose",i);let c=e.get(a);c!==void 0&&(e.delete(a),c.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}var Os=class extends Xo{constructor(e=-1,t=1,n=1,i=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,o=n+e,a=i+t,c=i-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,o=r+l*this.view.width,a-=h*this.view.offsetY,c=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},bs=4,id=[.125,.215,.35,.446,.526,.582],qi=20,ml=new Os,sd=new me,gl=null,_l=0,vl=0,yl=!1,Xi=(1+Math.sqrt(5))/2,vs=1/Xi,rd=[new A(-Xi,vs,0),new A(Xi,vs,0),new A(-vs,0,Xi),new A(vs,0,Xi),new A(0,Xi,-vs),new A(0,Xi,vs),new A(-1,1,-1),new A(1,1,-1),new A(-1,1,1),new A(1,1,1)],qo=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,i=100){gl=this._renderer.getRenderTarget(),_l=this._renderer.getActiveCubeFace(),vl=this._renderer.getActiveMipmapLevel(),yl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(e,n,i,r),t>0&&this._blur(r,0,0,t),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ld(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ad(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(gl,_l,vl),this._renderer.xr.enabled=yl,e.scissorTest=!1,bo(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Rs||e.mapping===Cs?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),gl=this._renderer.getRenderTarget(),_l=this._renderer.getActiveCubeFace(),vl=this._renderer.getActiveMipmapLevel(),yl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Zt,minFilter:Zt,generateMipmaps:!1,type:Or,format:un,colorSpace:Ht,depthBuffer:!1},i=od(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=od(e,t,n);let{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=h_(r)),this._blurMaterial=u_(r,e,t)}return i}_compileMaterial(e){let t=new $e(this._lodPlanes[0],e);this._renderer.compile(t,ml)}_sceneToCubeUV(e,t,n,i){let a=new At(90,1,t,n),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(sd),h.toneMapping=Ai,h.autoClear=!1;let p=new Wt({name:"PMREM.Background",side:jt,depthWrite:!1,depthTest:!1}),m=new $e(new wn,p),_=!1,g=e.background;g?g.isColor&&(p.color.copy(g),e.background=null,_=!0):(p.color.copy(sd),_=!0);for(let f=0;f<6;f++){let y=f%3;y===0?(a.up.set(0,c[f],0),a.lookAt(l[f],0,0)):y===1?(a.up.set(0,0,c[f]),a.lookAt(0,l[f],0)):(a.up.set(0,c[f],0),a.lookAt(0,0,l[f]));let b=this._cubeSize;bo(i,y*b,f>2?b:0,b,b),h.setRenderTarget(i),_&&h.render(m,a),h.render(e,a)}m.geometry.dispose(),m.material.dispose(),h.toneMapping=d,h.autoClear=u,e.background=g}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Rs||e.mapping===Cs;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=ld()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ad());let r=i?this._cubemapMaterial:this._equirectMaterial,o=new $e(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=e;let c=this._cubeSize;bo(t,0,0,3*c,2*c),n.setRenderTarget(t),n.render(o,ml)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodPlanes.length;for(let r=1;r<i;r++){let o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=rd[(i-r-1)%rd.length];this._blur(e,r-1,r,o,a)}t.autoClear=n}_blur(e,t,n,i,r){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,n,i,"latitudinal",r),this._halfBlur(o,e,n,n,i,"longitudinal",r)}_halfBlur(e,t,n,i,r,o,a){let c=this._renderer,l=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=3,u=new $e(this._lodPlanes[i],l),d=l.uniforms,p=this._sizeLods[n]-1,m=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*qi-1),_=r/m,g=isFinite(r)?1+Math.floor(h*_):qi;g>qi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${qi}`);let f=[],y=0;for(let I=0;I<qi;++I){let L=I/_,x=Math.exp(-L*L/2);f.push(x),I===0?y+=x:I<g&&(y+=2*x)}for(let I=0;I<f.length;I++)f[I]=f[I]/y;d.envMap.value=e.texture,d.samples.value=g,d.weights.value=f,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);let{_lodMax:b}=this;d.dTheta.value=m,d.mipInt.value=b-n;let S=this._sizeLods[i],P=3*S*(i>b-bs?i-b+bs:0),C=4*(this._cubeSize-S);bo(t,P,C,3*S,2*S),c.setRenderTarget(t),c.render(u,ml)}};function h_(s){let e=[],t=[],n=[],i=s,r=s-bs+1+id.length;for(let o=0;o<r;o++){let a=Math.pow(2,i);t.push(a);let c=1/a;o>s-bs?c=id[o-s+bs-1]:o===0&&(c=0),n.push(c);let l=1/(a-2),h=-l,u=1+l,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,m=6,_=3,g=2,f=1,y=new Float32Array(_*m*p),b=new Float32Array(g*m*p),S=new Float32Array(f*m*p);for(let C=0;C<p;C++){let I=C%3*2/3-1,L=C>2?0:-1,x=[I,L,0,I+2/3,L,0,I+2/3,L+1,0,I,L,0,I+2/3,L+1,0,I,L+1,0];y.set(x,_*m*C),b.set(d,g*m*C);let M=[C,C,C,C,C,C];S.set(M,f*m*C)}let P=new xt;P.setAttribute("position",new Et(y,_)),P.setAttribute("uv",new Et(b,g)),P.setAttribute("faceIndex",new Et(S,f)),e.push(P),i>bs&&i--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function od(s,e,t){let n=new ii(s,e,t);return n.texture.mapping=ya,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function bo(s,e,t,n,i){s.viewport.set(e,t,n,i),s.scissor.set(e,t,n,i)}function u_(s,e,t){let n=new Float32Array(qi),i=new A(0,1,0);return new kn({name:"SphericalGaussianBlur",defines:{n:qi,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:lh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Ti,depthTest:!1,depthWrite:!1})}function ad(){return new kn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:lh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Ti,depthTest:!1,depthWrite:!1})}function ld(){return new kn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:lh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Ti,depthTest:!1,depthWrite:!1})}function lh(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function d_(s){let e=new WeakMap,t=null;function n(a){if(a&&a.isTexture){let c=a.mapping,l=c===Bl||c===zl,h=c===Rs||c===Cs;if(l||h){let u=e.get(a),d=u!==void 0?u.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return t===null&&(t=new qo(s)),u=l?t.fromEquirectangular(a,u):t.fromCubemap(a,u),u.texture.pmremVersion=a.pmremVersion,e.set(a,u),u.texture;if(u!==void 0)return u.texture;{let p=a.image;return l&&p&&p.height>0||h&&p&&i(p)?(t===null&&(t=new qo(s)),u=l?t.fromEquirectangular(a):t.fromCubemap(a),u.texture.pmremVersion=a.pmremVersion,e.set(a,u),a.addEventListener("dispose",r),u.texture):null}}}return a}function i(a){let c=0,l=6;for(let h=0;h<l;h++)a[h]!==void 0&&c++;return c===l}function r(a){let c=a.target;c.removeEventListener("dispose",r);let l=e.get(c);l!==void 0&&(e.delete(c),l.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:o}}function f_(s){let e={};function t(n){if(e[n]!==void 0)return e[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let i=t(n);return i===null&&fr("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function p_(s,e,t,n){let i={},r=new WeakMap;function o(u){let d=u.target;d.index!==null&&e.remove(d.index);for(let m in d.attributes)e.remove(d.attributes[m]);for(let m in d.morphAttributes){let _=d.morphAttributes[m];for(let g=0,f=_.length;g<f;g++)e.remove(_[g])}d.removeEventListener("dispose",o),delete i[d.id];let p=r.get(d);p&&(e.remove(p),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(u,d){return i[d.id]===!0||(d.addEventListener("dispose",o),i[d.id]=!0,t.memory.geometries++),d}function c(u){let d=u.attributes;for(let m in d)e.update(d[m],s.ARRAY_BUFFER);let p=u.morphAttributes;for(let m in p){let _=p[m];for(let g=0,f=_.length;g<f;g++)e.update(_[g],s.ARRAY_BUFFER)}}function l(u){let d=[],p=u.index,m=u.attributes.position,_=0;if(p!==null){let y=p.array;_=p.version;for(let b=0,S=y.length;b<S;b+=3){let P=y[b+0],C=y[b+1],I=y[b+2];d.push(P,C,C,I,I,P)}}else if(m!==void 0){let y=m.array;_=m.version;for(let b=0,S=y.length/3-1;b<S;b+=3){let P=b+0,C=b+1,I=b+2;d.push(P,C,C,I,I,P)}}else return;let g=new(lf(d)?Wo:Go)(d,1);g.version=_;let f=r.get(u);f&&e.remove(f),r.set(u,g)}function h(u){let d=r.get(u);if(d){let p=u.index;p!==null&&d.version<p.version&&l(u)}else l(u);return r.get(u)}return{get:a,update:c,getWireframeAttribute:h}}function m_(s,e,t){let n;function i(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function c(d,p){s.drawElements(n,p,r,d*o),t.update(p,n,1)}function l(d,p,m){m!==0&&(s.drawElementsInstanced(n,p,r,d*o,m),t.update(p,n,m))}function h(d,p,m){if(m===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,p,0,r,d,0,m);let g=0;for(let f=0;f<m;f++)g+=p[f];t.update(g,n,1)}function u(d,p,m,_){if(m===0)return;let g=e.get("WEBGL_multi_draw");if(g===null)for(let f=0;f<d.length;f++)l(d[f]/o,p[f],_[f]);else{g.multiDrawElementsInstancedWEBGL(n,p,0,r,d,0,_,0,m);let f=0;for(let y=0;y<m;y++)f+=p[y]*_[y];t.update(f,n,1)}}this.setMode=i,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function g_(s){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case s.TRIANGLES:t.triangles+=a*(r/3);break;case s.LINES:t.lines+=a*(r/2);break;case s.LINE_STRIP:t.lines+=a*(r-1);break;case s.LINE_LOOP:t.lines+=a*r;break;case s.POINTS:t.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function __(s,e,t){let n=new WeakMap,i=new je;function r(o,a,c){let l=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,u=h!==void 0?h.length:0,d=n.get(a);if(d===void 0||d.count!==u){let x=function(){I.dispose(),n.delete(a),a.removeEventListener("dispose",x)};d!==void 0&&d.texture.dispose();let p=a.morphAttributes.position!==void 0,m=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,g=a.morphAttributes.position||[],f=a.morphAttributes.normal||[],y=a.morphAttributes.color||[],b=0;p===!0&&(b=1),m===!0&&(b=2),_===!0&&(b=3);let S=a.attributes.position.count*b,P=1;S>e.maxTextureSize&&(P=Math.ceil(S/e.maxTextureSize),S=e.maxTextureSize);let C=new Float32Array(S*P*4*u),I=new Vo(C,S,P,u);I.type=bn,I.needsUpdate=!0;let L=b*4;for(let M=0;M<u;M++){let R=g[M],O=f[M],F=y[M],V=S*P*4*M;for(let Z=0;Z<R.count;Z++){let X=Z*L;p===!0&&(i.fromBufferAttribute(R,Z),C[V+X+0]=i.x,C[V+X+1]=i.y,C[V+X+2]=i.z,C[V+X+3]=0),m===!0&&(i.fromBufferAttribute(O,Z),C[V+X+4]=i.x,C[V+X+5]=i.y,C[V+X+6]=i.z,C[V+X+7]=0),_===!0&&(i.fromBufferAttribute(F,Z),C[V+X+8]=i.x,C[V+X+9]=i.y,C[V+X+10]=i.z,C[V+X+11]=F.itemSize===4?i.w:1)}}d={count:u,texture:I,size:new se(S,P)},n.set(a,d),a.addEventListener("dispose",x)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(s,"morphTexture",o.morphTexture,t);else{let p=0;for(let _=0;_<l.length;_++)p+=l[_];let m=a.morphTargetsRelative?1:1-p;c.getUniforms().setValue(s,"morphTargetBaseInfluence",m),c.getUniforms().setValue(s,"morphTargetInfluences",l)}c.getUniforms().setValue(s,"morphTargetsTexture",d.texture,t),c.getUniforms().setValue(s,"morphTargetsTextureSize",d.size)}return{update:r}}function v_(s,e,t,n){let i=new WeakMap;function r(c){let l=n.render.frame,h=c.geometry,u=e.get(c,h);if(i.get(u)!==l&&(e.update(u),i.set(u,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",a)===!1&&c.addEventListener("dispose",a),i.get(c)!==l&&(t.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,s.ARRAY_BUFFER),i.set(c,l))),c.isSkinnedMesh){let d=c.skeleton;i.get(d)!==l&&(d.update(),i.set(d,l))}return u}function o(){i=new WeakMap}function a(c){let l=c.target;l.removeEventListener("dispose",a),t.remove(l.instanceMatrix),l.instanceColor!==null&&t.remove(l.instanceColor)}return{update:r,dispose:o}}var Yo=class extends kt{constructor(e,t,n,i,r,o,a,c,l,h=Ss){if(h!==Ss&&h!==Ps)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Ss&&(n=Yi),n===void 0&&h===Ps&&(n=Is),super(null,i,r,o,a,c,h,n,l),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=a!==void 0?a:zt,this.minFilter=c!==void 0?c:zt,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},df=new kt,cd=new Yo(1,1),ff=new Vo,pf=new gc,mf=new $o,hd=[],ud=[],dd=new Float32Array(16),fd=new Float32Array(9),pd=new Float32Array(4);function Hs(s,e,t){let n=s[0];if(n<=0||n>0)return s;let i=e*t,r=hd[i];if(r===void 0&&(r=new Float32Array(i),hd[i]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,s[o].toArray(r,a)}return r}function It(s,e){if(s.length!==e.length)return!1;for(let t=0,n=s.length;t<n;t++)if(s[t]!==e[t])return!1;return!0}function Pt(s,e){for(let t=0,n=e.length;t<n;t++)s[t]=e[t]}function Sa(s,e){let t=ud[e];t===void 0&&(t=new Int32Array(e),ud[e]=t);for(let n=0;n!==e;++n)t[n]=s.allocateTextureUnit();return t}function y_(s,e){let t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function x_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(It(t,e))return;s.uniform2fv(this.addr,e),Pt(t,e)}}function b_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(It(t,e))return;s.uniform3fv(this.addr,e),Pt(t,e)}}function M_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(It(t,e))return;s.uniform4fv(this.addr,e),Pt(t,e)}}function S_(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(It(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),Pt(t,e)}else{if(It(t,n))return;pd.set(n),s.uniformMatrix2fv(this.addr,!1,pd),Pt(t,n)}}function w_(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(It(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),Pt(t,e)}else{if(It(t,n))return;fd.set(n),s.uniformMatrix3fv(this.addr,!1,fd),Pt(t,n)}}function E_(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(It(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),Pt(t,e)}else{if(It(t,n))return;dd.set(n),s.uniformMatrix4fv(this.addr,!1,dd),Pt(t,n)}}function T_(s,e){let t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function A_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(It(t,e))return;s.uniform2iv(this.addr,e),Pt(t,e)}}function R_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(It(t,e))return;s.uniform3iv(this.addr,e),Pt(t,e)}}function C_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(It(t,e))return;s.uniform4iv(this.addr,e),Pt(t,e)}}function I_(s,e){let t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function P_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(It(t,e))return;s.uniform2uiv(this.addr,e),Pt(t,e)}}function L_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(It(t,e))return;s.uniform3uiv(this.addr,e),Pt(t,e)}}function D_(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(It(t,e))return;s.uniform4uiv(this.addr,e),Pt(t,e)}}function N_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r;this.type===s.SAMPLER_2D_SHADOW?(cd.compareFunction=af,r=cd):r=df,t.setTexture2D(e||r,i)}function k_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||pf,i)}function U_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||mf,i)}function O_(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||ff,i)}function F_(s){switch(s){case 5126:return y_;case 35664:return x_;case 35665:return b_;case 35666:return M_;case 35674:return S_;case 35675:return w_;case 35676:return E_;case 5124:case 35670:return T_;case 35667:case 35671:return A_;case 35668:case 35672:return R_;case 35669:case 35673:return C_;case 5125:return I_;case 36294:return P_;case 36295:return L_;case 36296:return D_;case 35678:case 36198:case 36298:case 36306:case 35682:return N_;case 35679:case 36299:case 36307:return k_;case 35680:case 36300:case 36308:case 36293:return U_;case 36289:case 36303:case 36311:case 36292:return O_}}function B_(s,e){s.uniform1fv(this.addr,e)}function z_(s,e){let t=Hs(e,this.size,2);s.uniform2fv(this.addr,t)}function H_(s,e){let t=Hs(e,this.size,3);s.uniform3fv(this.addr,t)}function V_(s,e){let t=Hs(e,this.size,4);s.uniform4fv(this.addr,t)}function G_(s,e){let t=Hs(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function W_(s,e){let t=Hs(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function X_(s,e){let t=Hs(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function $_(s,e){s.uniform1iv(this.addr,e)}function q_(s,e){s.uniform2iv(this.addr,e)}function Y_(s,e){s.uniform3iv(this.addr,e)}function K_(s,e){s.uniform4iv(this.addr,e)}function Z_(s,e){s.uniform1uiv(this.addr,e)}function j_(s,e){s.uniform2uiv(this.addr,e)}function J_(s,e){s.uniform3uiv(this.addr,e)}function Q_(s,e){s.uniform4uiv(this.addr,e)}function ev(s,e,t){let n=this.cache,i=e.length,r=Sa(t,i);It(n,r)||(s.uniform1iv(this.addr,r),Pt(n,r));for(let o=0;o!==i;++o)t.setTexture2D(e[o]||df,r[o])}function tv(s,e,t){let n=this.cache,i=e.length,r=Sa(t,i);It(n,r)||(s.uniform1iv(this.addr,r),Pt(n,r));for(let o=0;o!==i;++o)t.setTexture3D(e[o]||pf,r[o])}function nv(s,e,t){let n=this.cache,i=e.length,r=Sa(t,i);It(n,r)||(s.uniform1iv(this.addr,r),Pt(n,r));for(let o=0;o!==i;++o)t.setTextureCube(e[o]||mf,r[o])}function iv(s,e,t){let n=this.cache,i=e.length,r=Sa(t,i);It(n,r)||(s.uniform1iv(this.addr,r),Pt(n,r));for(let o=0;o!==i;++o)t.setTexture2DArray(e[o]||ff,r[o])}function sv(s){switch(s){case 5126:return B_;case 35664:return z_;case 35665:return H_;case 35666:return V_;case 35674:return G_;case 35675:return W_;case 35676:return X_;case 5124:case 35670:return $_;case 35667:case 35671:return q_;case 35668:case 35672:return Y_;case 35669:case 35673:return K_;case 5125:return Z_;case 36294:return j_;case 36295:return J_;case 36296:return Q_;case 35678:case 36198:case 36298:case 36306:case 35682:return ev;case 35679:case 36299:case 36307:return tv;case 35680:case 36300:case 36308:case 36293:return nv;case 36289:case 36303:case 36311:case 36292:return iv}}var yc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=F_(t.type)}},xc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=sv(t.type)}},bc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,o=i.length;r!==o;++r){let a=i[r];a.setValue(e,t[a.id],n)}}},xl=/(\w+)(\])?(\[|\.)?/g;function md(s,e){s.seq.push(e),s.map[e.id]=e}function rv(s,e,t){let n=s.name,i=n.length;for(xl.lastIndex=0;;){let r=xl.exec(n),o=xl.lastIndex,a=r[1],c=r[2]==="]",l=r[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===i){md(t,l===void 0?new yc(a,s,e):new xc(a,s,e));break}else{let u=t.map[a];u===void 0&&(u=new bc(a),md(t,u)),t=u}}}var Ts=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){let r=e.getActiveUniform(t,i),o=e.getUniformLocation(t,r.name);rv(r,o,this)}}setValue(e,t,n,i){let r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,o=t.length;r!==o;++r){let a=t[r],c=n[a.id];c.needsUpdate!==!1&&a.setValue(e,c.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let o=e[i];o.id in t&&n.push(o)}return n}};function gd(s,e,t){let n=s.createShader(e);return s.shaderSource(n,t),s.compileShader(n),n}var ov=37297,av=0;function lv(s,e){let t=s.split(`
`),n=[],i=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=i;o<r;o++){let a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}var _d=new ke;function cv(s){Ve._getMatrix(_d,Ve.workingColorSpace,s);let e=`mat3( ${_d.elements.map(t=>t.toFixed(4))} )`;switch(Ve.getTransfer(s)){case ba:return[e,"LinearTransferOETF"];case st:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",s),[e,"LinearTransferOETF"]}}function vd(s,e,t){let n=s.getShaderParameter(e,s.COMPILE_STATUS),i=s.getShaderInfoLog(e).trim();if(n&&i==="")return"";let r=/ERROR: 0:(\d+)/.exec(i);if(r){let o=parseInt(r[1]);return t.toUpperCase()+`

`+i+`

`+lv(s.getShaderSource(e),o)}else return i}function hv(s,e){let t=cv(e);return[`vec4 ${s}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function uv(s,e){let t;switch(e){case xp:t="Linear";break;case bp:t="Reinhard";break;case Mp:t="Cineon";break;case Sp:t="ACESFilmic";break;case Ep:t="AgX";break;case Tp:t="Neutral";break;case wp:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Mo=new A;function dv(){Ve.getLuminanceCoefficients(Mo);let s=Mo.x.toFixed(4),e=Mo.y.toFixed(4),t=Mo.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function fv(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(pr).join(`
`)}function pv(s){let e=[];for(let t in s){let n=s[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function mv(s,e){let t={},n=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){let r=s.getActiveAttrib(e,i),o=r.name,a=1;r.type===s.FLOAT_MAT2&&(a=2),r.type===s.FLOAT_MAT3&&(a=3),r.type===s.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:s.getAttribLocation(e,o),locationSize:a}}return t}function pr(s){return s!==""}function yd(s,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function xd(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var gv=/^[ \t]*#include +<([\w\d./]+)>/gm;function Mc(s){return s.replace(gv,vv)}var _v=new Map;function vv(s,e){let t=Oe[e];if(t===void 0){let n=_v.get(e);if(n!==void 0)t=Oe[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Mc(t)}var yv=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function bd(s){return s.replace(yv,xv)}function xv(s,e,t,n){let i="";for(let r=parseInt(e);r<parseInt(t);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Md(s){let e=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?e+=`
#define HIGH_PRECISION`:s.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function bv(s){let e="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Yd?e="SHADOWMAP_TYPE_PCF":s.shadowMapType===Qf?e="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===Zn&&(e="SHADOWMAP_TYPE_VSM"),e}function Mv(s){let e="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case Rs:case Cs:e="ENVMAP_TYPE_CUBE";break;case ya:e="ENVMAP_TYPE_CUBE_UV";break}return e}function Sv(s){let e="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case Cs:e="ENVMAP_MODE_REFRACTION";break}return e}function wv(s){let e="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case jc:e="ENVMAP_BLENDING_MULTIPLY";break;case vp:e="ENVMAP_BLENDING_MIX";break;case yp:e="ENVMAP_BLENDING_ADD";break}return e}function Ev(s){let e=s.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function Tv(s,e,t,n){let i=s.getContext(),r=t.defines,o=t.vertexShader,a=t.fragmentShader,c=bv(t),l=Mv(t),h=Sv(t),u=wv(t),d=Ev(t),p=fv(t),m=pv(r),_=i.createProgram(),g,f,y=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(pr).join(`
`),g.length>0&&(g+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m].filter(pr).join(`
`),f.length>0&&(f+=`
`)):(g=[Md(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(pr).join(`
`),f=[Md(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,m,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Ai?"#define TONE_MAPPING":"",t.toneMapping!==Ai?Oe.tonemapping_pars_fragment:"",t.toneMapping!==Ai?uv("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Oe.colorspace_pars_fragment,hv("linearToOutputTexel",t.outputColorSpace),dv(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(pr).join(`
`)),o=Mc(o),o=yd(o,t),o=xd(o,t),a=Mc(a),a=yd(a,t),a=xd(a,t),o=bd(o),a=bd(a),t.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,g=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,f=["#define varying in",t.glslVersion===ku?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ku?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let b=y+g+o,S=y+f+a,P=gd(i,i.VERTEX_SHADER,b),C=gd(i,i.FRAGMENT_SHADER,S);i.attachShader(_,P),i.attachShader(_,C),t.index0AttributeName!==void 0?i.bindAttribLocation(_,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(_,0,"position"),i.linkProgram(_);function I(R){if(s.debug.checkShaderErrors){let O=i.getProgramInfoLog(_).trim(),F=i.getShaderInfoLog(P).trim(),V=i.getShaderInfoLog(C).trim(),Z=!0,X=!0;if(i.getProgramParameter(_,i.LINK_STATUS)===!1)if(Z=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,_,P,C);else{let ee=vd(i,P,"vertex"),W=vd(i,C,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(_,i.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+O+`
`+ee+`
`+W)}else O!==""?console.warn("THREE.WebGLProgram: Program Info Log:",O):(F===""||V==="")&&(X=!1);X&&(R.diagnostics={runnable:Z,programLog:O,vertexShader:{log:F,prefix:g},fragmentShader:{log:V,prefix:f}})}i.deleteShader(P),i.deleteShader(C),L=new Ts(i,_),x=mv(i,_)}let L;this.getUniforms=function(){return L===void 0&&I(this),L};let x;this.getAttributes=function(){return x===void 0&&I(this),x};let M=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=i.getProgramParameter(_,ov)),M},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(_),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=av++,this.cacheKey=e,this.usedTimes=1,this.program=_,this.vertexShader=P,this.fragmentShader=C,this}var Av=0,Sc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(e);return o.has(i)===!1&&(o.add(i),i.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new wc(e),t.set(e,n)),n}},wc=class{constructor(e){this.id=Av++,this.code=e,this.usedTimes=0}};function Rv(s,e,t,n,i,r,o){let a=new Sr,c=new Sc,l=new Set,h=[],u=i.logarithmicDepthBuffer,d=i.vertexTextures,p=i.precision,m={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(x){return l.add(x),x===0?"uv":`uv${x}`}function g(x,M,R,O,F){let V=O.fog,Z=F.geometry,X=x.isMeshStandardMaterial?O.environment:null,ee=(x.isMeshStandardMaterial?t:e).get(x.envMap||X),W=ee&&ee.mapping===ya?ee.image.height:null,re=m[x.type];x.precision!==null&&(p=i.getMaxPrecision(x.precision),p!==x.precision&&console.warn("THREE.WebGLProgram.getParameters:",x.precision,"not supported, using",p,"instead."));let ue=Z.morphAttributes.position||Z.morphAttributes.normal||Z.morphAttributes.color,Me=ue!==void 0?ue.length:0,Fe=0;Z.morphAttributes.position!==void 0&&(Fe=1),Z.morphAttributes.normal!==void 0&&(Fe=2),Z.morphAttributes.color!==void 0&&(Fe=3);let ot,q,te,ye;if(re){let nt=Ln[re];ot=nt.vertexShader,q=nt.fragmentShader}else ot=x.vertexShader,q=x.fragmentShader,c.update(x),te=c.getVertexShaderID(x),ye=c.getFragmentShaderID(x);let oe=s.getRenderTarget(),Ae=s.state.buffers.depth.getReversed(),Le=F.isInstancedMesh===!0,Be=F.isBatchedMesh===!0,yt=!!x.map,Ye=!!x.matcap,St=!!ee,U=!!x.aoMap,ln=!!x.lightMap,Ge=!!x.bumpMap,We=!!x.normalMap,Ee=!!x.displacementMap,pt=!!x.emissiveMap,we=!!x.metalnessMap,T=!!x.roughnessMap,w=x.anisotropy>0,B=x.clearcoat>0,Y=x.dispersion>0,j=x.iridescence>0,$=x.sheen>0,xe=x.transmission>0,ae=w&&!!x.anisotropyMap,de=B&&!!x.clearcoatMap,Ke=B&&!!x.clearcoatNormalMap,J=B&&!!x.clearcoatRoughnessMap,fe=j&&!!x.iridescenceMap,Te=j&&!!x.iridescenceThicknessMap,Ce=$&&!!x.sheenColorMap,pe=$&&!!x.sheenRoughnessMap,Xe=!!x.specularMap,Ue=!!x.specularColorMap,ht=!!x.specularIntensityMap,D=xe&&!!x.transmissionMap,ie=xe&&!!x.thicknessMap,G=!!x.gradientMap,K=!!x.alphaMap,he=x.alphaTest>0,le=!!x.alphaHash,De=!!x.extensions,bt=Ai;x.toneMapped&&(oe===null||oe.isXRRenderTarget===!0)&&(bt=s.toneMapping);let Ot={shaderID:re,shaderType:x.type,shaderName:x.name,vertexShader:ot,fragmentShader:q,defines:x.defines,customVertexShaderID:te,customFragmentShaderID:ye,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:p,batching:Be,batchingColor:Be&&F._colorsTexture!==null,instancing:Le,instancingColor:Le&&F.instanceColor!==null,instancingMorph:Le&&F.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:oe===null?s.outputColorSpace:oe.isXRRenderTarget===!0?oe.texture.colorSpace:Ht,alphaToCoverage:!!x.alphaToCoverage,map:yt,matcap:Ye,envMap:St,envMapMode:St&&ee.mapping,envMapCubeUVHeight:W,aoMap:U,lightMap:ln,bumpMap:Ge,normalMap:We,displacementMap:d&&Ee,emissiveMap:pt,normalMapObjectSpace:We&&x.normalMapType===Pp,normalMapTangentSpace:We&&x.normalMapType===oh,metalnessMap:we,roughnessMap:T,anisotropy:w,anisotropyMap:ae,clearcoat:B,clearcoatMap:de,clearcoatNormalMap:Ke,clearcoatRoughnessMap:J,dispersion:Y,iridescence:j,iridescenceMap:fe,iridescenceThicknessMap:Te,sheen:$,sheenColorMap:Ce,sheenRoughnessMap:pe,specularMap:Xe,specularColorMap:Ue,specularIntensityMap:ht,transmission:xe,transmissionMap:D,thicknessMap:ie,gradientMap:G,opaque:x.transparent===!1&&x.blending===Ms&&x.alphaToCoverage===!1,alphaMap:K,alphaTest:he,alphaHash:le,combine:x.combine,mapUv:yt&&_(x.map.channel),aoMapUv:U&&_(x.aoMap.channel),lightMapUv:ln&&_(x.lightMap.channel),bumpMapUv:Ge&&_(x.bumpMap.channel),normalMapUv:We&&_(x.normalMap.channel),displacementMapUv:Ee&&_(x.displacementMap.channel),emissiveMapUv:pt&&_(x.emissiveMap.channel),metalnessMapUv:we&&_(x.metalnessMap.channel),roughnessMapUv:T&&_(x.roughnessMap.channel),anisotropyMapUv:ae&&_(x.anisotropyMap.channel),clearcoatMapUv:de&&_(x.clearcoatMap.channel),clearcoatNormalMapUv:Ke&&_(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:J&&_(x.clearcoatRoughnessMap.channel),iridescenceMapUv:fe&&_(x.iridescenceMap.channel),iridescenceThicknessMapUv:Te&&_(x.iridescenceThicknessMap.channel),sheenColorMapUv:Ce&&_(x.sheenColorMap.channel),sheenRoughnessMapUv:pe&&_(x.sheenRoughnessMap.channel),specularMapUv:Xe&&_(x.specularMap.channel),specularColorMapUv:Ue&&_(x.specularColorMap.channel),specularIntensityMapUv:ht&&_(x.specularIntensityMap.channel),transmissionMapUv:D&&_(x.transmissionMap.channel),thicknessMapUv:ie&&_(x.thicknessMap.channel),alphaMapUv:K&&_(x.alphaMap.channel),vertexTangents:!!Z.attributes.tangent&&(We||w),vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!Z.attributes.color&&Z.attributes.color.itemSize===4,pointsUvs:F.isPoints===!0&&!!Z.attributes.uv&&(yt||K),fog:!!V,useFog:x.fog===!0,fogExp2:!!V&&V.isFogExp2,flatShading:x.flatShading===!0,sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Ae,skinning:F.isSkinnedMesh===!0,morphTargets:Z.morphAttributes.position!==void 0,morphNormals:Z.morphAttributes.normal!==void 0,morphColors:Z.morphAttributes.color!==void 0,morphTargetsCount:Me,morphTextureStride:Fe,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:x.dithering,shadowMapEnabled:s.shadowMap.enabled&&R.length>0,shadowMapType:s.shadowMap.type,toneMapping:bt,decodeVideoTexture:yt&&x.map.isVideoTexture===!0&&Ve.getTransfer(x.map.colorSpace)===st,decodeVideoTextureEmissive:pt&&x.emissiveMap.isVideoTexture===!0&&Ve.getTransfer(x.emissiveMap.colorSpace)===st,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Kt,flipSided:x.side===jt,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:De&&x.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(De&&x.extensions.multiDraw===!0||Be)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Ot.vertexUv1s=l.has(1),Ot.vertexUv2s=l.has(2),Ot.vertexUv3s=l.has(3),l.clear(),Ot}function f(x){let M=[];if(x.shaderID?M.push(x.shaderID):(M.push(x.customVertexShaderID),M.push(x.customFragmentShaderID)),x.defines!==void 0)for(let R in x.defines)M.push(R),M.push(x.defines[R]);return x.isRawShaderMaterial===!1&&(y(M,x),b(M,x),M.push(s.outputColorSpace)),M.push(x.customProgramCacheKey),M.join()}function y(x,M){x.push(M.precision),x.push(M.outputColorSpace),x.push(M.envMapMode),x.push(M.envMapCubeUVHeight),x.push(M.mapUv),x.push(M.alphaMapUv),x.push(M.lightMapUv),x.push(M.aoMapUv),x.push(M.bumpMapUv),x.push(M.normalMapUv),x.push(M.displacementMapUv),x.push(M.emissiveMapUv),x.push(M.metalnessMapUv),x.push(M.roughnessMapUv),x.push(M.anisotropyMapUv),x.push(M.clearcoatMapUv),x.push(M.clearcoatNormalMapUv),x.push(M.clearcoatRoughnessMapUv),x.push(M.iridescenceMapUv),x.push(M.iridescenceThicknessMapUv),x.push(M.sheenColorMapUv),x.push(M.sheenRoughnessMapUv),x.push(M.specularMapUv),x.push(M.specularColorMapUv),x.push(M.specularIntensityMapUv),x.push(M.transmissionMapUv),x.push(M.thicknessMapUv),x.push(M.combine),x.push(M.fogExp2),x.push(M.sizeAttenuation),x.push(M.morphTargetsCount),x.push(M.morphAttributeCount),x.push(M.numDirLights),x.push(M.numPointLights),x.push(M.numSpotLights),x.push(M.numSpotLightMaps),x.push(M.numHemiLights),x.push(M.numRectAreaLights),x.push(M.numDirLightShadows),x.push(M.numPointLightShadows),x.push(M.numSpotLightShadows),x.push(M.numSpotLightShadowsWithMaps),x.push(M.numLightProbes),x.push(M.shadowMapType),x.push(M.toneMapping),x.push(M.numClippingPlanes),x.push(M.numClipIntersection),x.push(M.depthPacking)}function b(x,M){a.disableAll(),M.supportsVertexTextures&&a.enable(0),M.instancing&&a.enable(1),M.instancingColor&&a.enable(2),M.instancingMorph&&a.enable(3),M.matcap&&a.enable(4),M.envMap&&a.enable(5),M.normalMapObjectSpace&&a.enable(6),M.normalMapTangentSpace&&a.enable(7),M.clearcoat&&a.enable(8),M.iridescence&&a.enable(9),M.alphaTest&&a.enable(10),M.vertexColors&&a.enable(11),M.vertexAlphas&&a.enable(12),M.vertexUv1s&&a.enable(13),M.vertexUv2s&&a.enable(14),M.vertexUv3s&&a.enable(15),M.vertexTangents&&a.enable(16),M.anisotropy&&a.enable(17),M.alphaHash&&a.enable(18),M.batching&&a.enable(19),M.dispersion&&a.enable(20),M.batchingColor&&a.enable(21),x.push(a.mask),a.disableAll(),M.fog&&a.enable(0),M.useFog&&a.enable(1),M.flatShading&&a.enable(2),M.logarithmicDepthBuffer&&a.enable(3),M.reverseDepthBuffer&&a.enable(4),M.skinning&&a.enable(5),M.morphTargets&&a.enable(6),M.morphNormals&&a.enable(7),M.morphColors&&a.enable(8),M.premultipliedAlpha&&a.enable(9),M.shadowMapEnabled&&a.enable(10),M.doubleSided&&a.enable(11),M.flipSided&&a.enable(12),M.useDepthPacking&&a.enable(13),M.dithering&&a.enable(14),M.transmission&&a.enable(15),M.sheen&&a.enable(16),M.opaque&&a.enable(17),M.pointsUvs&&a.enable(18),M.decodeVideoTexture&&a.enable(19),M.decodeVideoTextureEmissive&&a.enable(20),M.alphaToCoverage&&a.enable(21),x.push(a.mask)}function S(x){let M=m[x.type],R;if(M){let O=Ln[M];R=vm.clone(O.uniforms)}else R=x.uniforms;return R}function P(x,M){let R;for(let O=0,F=h.length;O<F;O++){let V=h[O];if(V.cacheKey===M){R=V,++R.usedTimes;break}}return R===void 0&&(R=new Tv(s,M,x,r),h.push(R)),R}function C(x){if(--x.usedTimes===0){let M=h.indexOf(x);h[M]=h[h.length-1],h.pop(),x.destroy()}}function I(x){c.remove(x)}function L(){c.dispose()}return{getParameters:g,getProgramCacheKey:f,getUniforms:S,acquireProgram:P,releaseProgram:C,releaseShaderCache:I,programs:h,dispose:L}}function Cv(){let s=new WeakMap;function e(o){return s.has(o)}function t(o){let a=s.get(o);return a===void 0&&(a={},s.set(o,a)),a}function n(o){s.delete(o)}function i(o,a,c){s.get(o)[a]=c}function r(){s=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:r}}function Iv(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.z!==e.z?s.z-e.z:s.id-e.id}function Sd(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function wd(){let s=[],e=0,t=[],n=[],i=[];function r(){e=0,t.length=0,n.length=0,i.length=0}function o(u,d,p,m,_,g){let f=s[e];return f===void 0?(f={id:u.id,object:u,geometry:d,material:p,groupOrder:m,renderOrder:u.renderOrder,z:_,group:g},s[e]=f):(f.id=u.id,f.object=u,f.geometry=d,f.material=p,f.groupOrder=m,f.renderOrder=u.renderOrder,f.z=_,f.group=g),e++,f}function a(u,d,p,m,_,g){let f=o(u,d,p,m,_,g);p.transmission>0?n.push(f):p.transparent===!0?i.push(f):t.push(f)}function c(u,d,p,m,_,g){let f=o(u,d,p,m,_,g);p.transmission>0?n.unshift(f):p.transparent===!0?i.unshift(f):t.unshift(f)}function l(u,d){t.length>1&&t.sort(u||Iv),n.length>1&&n.sort(d||Sd),i.length>1&&i.sort(d||Sd)}function h(){for(let u=e,d=s.length;u<d;u++){let p=s[u];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:i,init:r,push:a,unshift:c,finish:h,sort:l}}function Pv(){let s=new WeakMap;function e(n,i){let r=s.get(n),o;return r===void 0?(o=new wd,s.set(n,[o])):i>=r.length?(o=new wd,r.push(o)):o=r[i],o}function t(){s=new WeakMap}return{get:e,dispose:t}}function Lv(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new A,color:new me};break;case"SpotLight":t={position:new A,direction:new A,color:new me,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new A,color:new me,distance:0,decay:0};break;case"HemisphereLight":t={direction:new A,skyColor:new me,groundColor:new me};break;case"RectAreaLight":t={color:new me,position:new A,halfWidth:new A,halfHeight:new A};break}return s[e.id]=t,t}}}function Dv(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}var Nv=0;function kv(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function Uv(s){let e=new Lv,t=Dv(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new A);let i=new A,r=new Re,o=new Re;function a(l){let h=0,u=0,d=0;for(let x=0;x<9;x++)n.probe[x].set(0,0,0);let p=0,m=0,_=0,g=0,f=0,y=0,b=0,S=0,P=0,C=0,I=0;l.sort(kv);for(let x=0,M=l.length;x<M;x++){let R=l[x],O=R.color,F=R.intensity,V=R.distance,Z=R.shadow&&R.shadow.map?R.shadow.map.texture:null;if(R.isAmbientLight)h+=O.r*F,u+=O.g*F,d+=O.b*F;else if(R.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(R.sh.coefficients[X],F);I++}else if(R.isDirectionalLight){let X=e.get(R);if(X.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let ee=R.shadow,W=t.get(R);W.shadowIntensity=ee.intensity,W.shadowBias=ee.bias,W.shadowNormalBias=ee.normalBias,W.shadowRadius=ee.radius,W.shadowMapSize=ee.mapSize,n.directionalShadow[p]=W,n.directionalShadowMap[p]=Z,n.directionalShadowMatrix[p]=R.shadow.matrix,y++}n.directional[p]=X,p++}else if(R.isSpotLight){let X=e.get(R);X.position.setFromMatrixPosition(R.matrixWorld),X.color.copy(O).multiplyScalar(F),X.distance=V,X.coneCos=Math.cos(R.angle),X.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),X.decay=R.decay,n.spot[_]=X;let ee=R.shadow;if(R.map&&(n.spotLightMap[P]=R.map,P++,ee.updateMatrices(R),R.castShadow&&C++),n.spotLightMatrix[_]=ee.matrix,R.castShadow){let W=t.get(R);W.shadowIntensity=ee.intensity,W.shadowBias=ee.bias,W.shadowNormalBias=ee.normalBias,W.shadowRadius=ee.radius,W.shadowMapSize=ee.mapSize,n.spotShadow[_]=W,n.spotShadowMap[_]=Z,S++}_++}else if(R.isRectAreaLight){let X=e.get(R);X.color.copy(O).multiplyScalar(F),X.halfWidth.set(R.width*.5,0,0),X.halfHeight.set(0,R.height*.5,0),n.rectArea[g]=X,g++}else if(R.isPointLight){let X=e.get(R);if(X.color.copy(R.color).multiplyScalar(R.intensity),X.distance=R.distance,X.decay=R.decay,R.castShadow){let ee=R.shadow,W=t.get(R);W.shadowIntensity=ee.intensity,W.shadowBias=ee.bias,W.shadowNormalBias=ee.normalBias,W.shadowRadius=ee.radius,W.shadowMapSize=ee.mapSize,W.shadowCameraNear=ee.camera.near,W.shadowCameraFar=ee.camera.far,n.pointShadow[m]=W,n.pointShadowMap[m]=Z,n.pointShadowMatrix[m]=R.shadow.matrix,b++}n.point[m]=X,m++}else if(R.isHemisphereLight){let X=e.get(R);X.skyColor.copy(R.color).multiplyScalar(F),X.groundColor.copy(R.groundColor).multiplyScalar(F),n.hemi[f]=X,f++}}g>0&&(s.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ne.LTC_FLOAT_1,n.rectAreaLTC2=ne.LTC_FLOAT_2):(n.rectAreaLTC1=ne.LTC_HALF_1,n.rectAreaLTC2=ne.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;let L=n.hash;(L.directionalLength!==p||L.pointLength!==m||L.spotLength!==_||L.rectAreaLength!==g||L.hemiLength!==f||L.numDirectionalShadows!==y||L.numPointShadows!==b||L.numSpotShadows!==S||L.numSpotMaps!==P||L.numLightProbes!==I)&&(n.directional.length=p,n.spot.length=_,n.rectArea.length=g,n.point.length=m,n.hemi.length=f,n.directionalShadow.length=y,n.directionalShadowMap.length=y,n.pointShadow.length=b,n.pointShadowMap.length=b,n.spotShadow.length=S,n.spotShadowMap.length=S,n.directionalShadowMatrix.length=y,n.pointShadowMatrix.length=b,n.spotLightMatrix.length=S+P-C,n.spotLightMap.length=P,n.numSpotLightShadowsWithMaps=C,n.numLightProbes=I,L.directionalLength=p,L.pointLength=m,L.spotLength=_,L.rectAreaLength=g,L.hemiLength=f,L.numDirectionalShadows=y,L.numPointShadows=b,L.numSpotShadows=S,L.numSpotMaps=P,L.numLightProbes=I,n.version=Nv++)}function c(l,h){let u=0,d=0,p=0,m=0,_=0,g=h.matrixWorldInverse;for(let f=0,y=l.length;f<y;f++){let b=l[f];if(b.isDirectionalLight){let S=n.directional[u];S.direction.setFromMatrixPosition(b.matrixWorld),i.setFromMatrixPosition(b.target.matrixWorld),S.direction.sub(i),S.direction.transformDirection(g),u++}else if(b.isSpotLight){let S=n.spot[p];S.position.setFromMatrixPosition(b.matrixWorld),S.position.applyMatrix4(g),S.direction.setFromMatrixPosition(b.matrixWorld),i.setFromMatrixPosition(b.target.matrixWorld),S.direction.sub(i),S.direction.transformDirection(g),p++}else if(b.isRectAreaLight){let S=n.rectArea[m];S.position.setFromMatrixPosition(b.matrixWorld),S.position.applyMatrix4(g),o.identity(),r.copy(b.matrixWorld),r.premultiply(g),o.extractRotation(r),S.halfWidth.set(b.width*.5,0,0),S.halfHeight.set(0,b.height*.5,0),S.halfWidth.applyMatrix4(o),S.halfHeight.applyMatrix4(o),m++}else if(b.isPointLight){let S=n.point[d];S.position.setFromMatrixPosition(b.matrixWorld),S.position.applyMatrix4(g),d++}else if(b.isHemisphereLight){let S=n.hemi[_];S.direction.setFromMatrixPosition(b.matrixWorld),S.direction.transformDirection(g),_++}}}return{setup:a,setupView:c,state:n}}function Ed(s){let e=new Uv(s),t=[],n=[];function i(h){l.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function o(h){n.push(h)}function a(){e.setup(t)}function c(h){e.setupView(t,h)}let l={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:i,state:l,setupLights:a,setupLightsView:c,pushLight:r,pushShadow:o}}function Ov(s){let e=new WeakMap;function t(i,r=0){let o=e.get(i),a;return o===void 0?(a=new Ed(s),e.set(i,[a])):r>=o.length?(a=new Ed(s),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}var Ec=class extends Qt{static get type(){return"MeshDepthMaterial"}constructor(e){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Cp,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Tc=class extends Qt{static get type(){return"MeshDistanceMaterial"}constructor(e){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}},Fv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Bv=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function zv(s,e,t){let n=new wr,i=new se,r=new se,o=new je,a=new Ec({depthPacking:Ip}),c=new Tc,l={},h=t.maxTextureSize,u={[Nn]:jt,[jt]:Nn,[Kt]:Kt},d=new kn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new se},radius:{value:4}},vertexShader:Fv,fragmentShader:Bv}),p=d.clone();p.defines.HORIZONTAL_PASS=1;let m=new xt;m.setAttribute("position",new Et(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new $e(m,d),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Yd;let f=this.type;this.render=function(C,I,L){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||C.length===0)return;let x=s.getRenderTarget(),M=s.getActiveCubeFace(),R=s.getActiveMipmapLevel(),O=s.state;O.setBlending(Ti),O.buffers.color.setClear(1,1,1,1),O.buffers.depth.setTest(!0),O.setScissorTest(!1);let F=f!==Zn&&this.type===Zn,V=f===Zn&&this.type!==Zn;for(let Z=0,X=C.length;Z<X;Z++){let ee=C[Z],W=ee.shadow;if(W===void 0){console.warn("THREE.WebGLShadowMap:",ee,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;i.copy(W.mapSize);let re=W.getFrameExtents();if(i.multiply(re),r.copy(W.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/re.x),i.x=r.x*re.x,W.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/re.y),i.y=r.y*re.y,W.mapSize.y=r.y)),W.map===null||F===!0||V===!0){let Me=this.type!==Zn?{minFilter:zt,magFilter:zt}:{};W.map!==null&&W.map.dispose(),W.map=new ii(i.x,i.y,Me),W.map.texture.name=ee.name+".shadowMap",W.camera.updateProjectionMatrix()}s.setRenderTarget(W.map),s.clear();let ue=W.getViewportCount();for(let Me=0;Me<ue;Me++){let Fe=W.getViewport(Me);o.set(r.x*Fe.x,r.y*Fe.y,r.x*Fe.z,r.y*Fe.w),O.viewport(o),W.updateMatrices(ee,Me),n=W.getFrustum(),S(I,L,W.camera,ee,this.type)}W.isPointLightShadow!==!0&&this.type===Zn&&y(W,L),W.needsUpdate=!1}f=this.type,g.needsUpdate=!1,s.setRenderTarget(x,M,R)};function y(C,I){let L=e.update(_);d.defines.VSM_SAMPLES!==C.blurSamples&&(d.defines.VSM_SAMPLES=C.blurSamples,p.defines.VSM_SAMPLES=C.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),C.mapPass===null&&(C.mapPass=new ii(i.x,i.y)),d.uniforms.shadow_pass.value=C.map.texture,d.uniforms.resolution.value=C.mapSize,d.uniforms.radius.value=C.radius,s.setRenderTarget(C.mapPass),s.clear(),s.renderBufferDirect(I,null,L,d,_,null),p.uniforms.shadow_pass.value=C.mapPass.texture,p.uniforms.resolution.value=C.mapSize,p.uniforms.radius.value=C.radius,s.setRenderTarget(C.map),s.clear(),s.renderBufferDirect(I,null,L,p,_,null)}function b(C,I,L,x){let M=null,R=L.isPointLight===!0?C.customDistanceMaterial:C.customDepthMaterial;if(R!==void 0)M=R;else if(M=L.isPointLight===!0?c:a,s.localClippingEnabled&&I.clipShadows===!0&&Array.isArray(I.clippingPlanes)&&I.clippingPlanes.length!==0||I.displacementMap&&I.displacementScale!==0||I.alphaMap&&I.alphaTest>0||I.map&&I.alphaTest>0){let O=M.uuid,F=I.uuid,V=l[O];V===void 0&&(V={},l[O]=V);let Z=V[F];Z===void 0&&(Z=M.clone(),V[F]=Z,I.addEventListener("dispose",P)),M=Z}if(M.visible=I.visible,M.wireframe=I.wireframe,x===Zn?M.side=I.shadowSide!==null?I.shadowSide:I.side:M.side=I.shadowSide!==null?I.shadowSide:u[I.side],M.alphaMap=I.alphaMap,M.alphaTest=I.alphaTest,M.map=I.map,M.clipShadows=I.clipShadows,M.clippingPlanes=I.clippingPlanes,M.clipIntersection=I.clipIntersection,M.displacementMap=I.displacementMap,M.displacementScale=I.displacementScale,M.displacementBias=I.displacementBias,M.wireframeLinewidth=I.wireframeLinewidth,M.linewidth=I.linewidth,L.isPointLight===!0&&M.isMeshDistanceMaterial===!0){let O=s.properties.get(M);O.light=L}return M}function S(C,I,L,x,M){if(C.visible===!1)return;if(C.layers.test(I.layers)&&(C.isMesh||C.isLine||C.isPoints)&&(C.castShadow||C.receiveShadow&&M===Zn)&&(!C.frustumCulled||n.intersectsObject(C))){C.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,C.matrixWorld);let F=e.update(C),V=C.material;if(Array.isArray(V)){let Z=F.groups;for(let X=0,ee=Z.length;X<ee;X++){let W=Z[X],re=V[W.materialIndex];if(re&&re.visible){let ue=b(C,re,x,M);C.onBeforeShadow(s,C,I,L,F,ue,W),s.renderBufferDirect(L,null,F,ue,C,W),C.onAfterShadow(s,C,I,L,F,ue,W)}}}else if(V.visible){let Z=b(C,V,x,M);C.onBeforeShadow(s,C,I,L,F,Z,null),s.renderBufferDirect(L,null,F,Z,C,null),C.onAfterShadow(s,C,I,L,F,Z,null)}}let O=C.children;for(let F=0,V=O.length;F<V;F++)S(O[F],I,L,x,M)}function P(C){C.target.removeEventListener("dispose",P);for(let L in l){let x=l[L],M=C.target.uuid;M in x&&(x[M].dispose(),delete x[M])}}}var Hv={[Ll]:Dl,[Nl]:Ol,[kl]:Fl,[As]:Ul,[Dl]:Ll,[Ol]:Nl,[Fl]:kl,[Ul]:As};function Vv(s,e){function t(){let D=!1,ie=new je,G=null,K=new je(0,0,0,0);return{setMask:function(he){G!==he&&!D&&(s.colorMask(he,he,he,he),G=he)},setLocked:function(he){D=he},setClear:function(he,le,De,bt,Ot){Ot===!0&&(he*=bt,le*=bt,De*=bt),ie.set(he,le,De,bt),K.equals(ie)===!1&&(s.clearColor(he,le,De,bt),K.copy(ie))},reset:function(){D=!1,G=null,K.set(-1,0,0,0)}}}function n(){let D=!1,ie=!1,G=null,K=null,he=null;return{setReversed:function(le){if(ie!==le){let De=e.get("EXT_clip_control");ie?De.clipControlEXT(De.LOWER_LEFT_EXT,De.ZERO_TO_ONE_EXT):De.clipControlEXT(De.LOWER_LEFT_EXT,De.NEGATIVE_ONE_TO_ONE_EXT);let bt=he;he=null,this.setClear(bt)}ie=le},getReversed:function(){return ie},setTest:function(le){le?oe(s.DEPTH_TEST):Ae(s.DEPTH_TEST)},setMask:function(le){G!==le&&!D&&(s.depthMask(le),G=le)},setFunc:function(le){if(ie&&(le=Hv[le]),K!==le){switch(le){case Ll:s.depthFunc(s.NEVER);break;case Dl:s.depthFunc(s.ALWAYS);break;case Nl:s.depthFunc(s.LESS);break;case As:s.depthFunc(s.LEQUAL);break;case kl:s.depthFunc(s.EQUAL);break;case Ul:s.depthFunc(s.GEQUAL);break;case Ol:s.depthFunc(s.GREATER);break;case Fl:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}K=le}},setLocked:function(le){D=le},setClear:function(le){he!==le&&(ie&&(le=1-le),s.clearDepth(le),he=le)},reset:function(){D=!1,G=null,K=null,he=null,ie=!1}}}function i(){let D=!1,ie=null,G=null,K=null,he=null,le=null,De=null,bt=null,Ot=null;return{setTest:function(nt){D||(nt?oe(s.STENCIL_TEST):Ae(s.STENCIL_TEST))},setMask:function(nt){ie!==nt&&!D&&(s.stencilMask(nt),ie=nt)},setFunc:function(nt,mn,Fn){(G!==nt||K!==mn||he!==Fn)&&(s.stencilFunc(nt,mn,Fn),G=nt,K=mn,he=Fn)},setOp:function(nt,mn,Fn){(le!==nt||De!==mn||bt!==Fn)&&(s.stencilOp(nt,mn,Fn),le=nt,De=mn,bt=Fn)},setLocked:function(nt){D=nt},setClear:function(nt){Ot!==nt&&(s.clearStencil(nt),Ot=nt)},reset:function(){D=!1,ie=null,G=null,K=null,he=null,le=null,De=null,bt=null,Ot=null}}}let r=new t,o=new n,a=new i,c=new WeakMap,l=new WeakMap,h={},u={},d=new WeakMap,p=[],m=null,_=!1,g=null,f=null,y=null,b=null,S=null,P=null,C=null,I=new me(0,0,0),L=0,x=!1,M=null,R=null,O=null,F=null,V=null,Z=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),X=!1,ee=0,W=s.getParameter(s.VERSION);W.indexOf("WebGL")!==-1?(ee=parseFloat(/^WebGL (\d)/.exec(W)[1]),X=ee>=1):W.indexOf("OpenGL ES")!==-1&&(ee=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),X=ee>=2);let re=null,ue={},Me=s.getParameter(s.SCISSOR_BOX),Fe=s.getParameter(s.VIEWPORT),ot=new je().fromArray(Me),q=new je().fromArray(Fe);function te(D,ie,G,K){let he=new Uint8Array(4),le=s.createTexture();s.bindTexture(D,le),s.texParameteri(D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(D,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let De=0;De<G;De++)D===s.TEXTURE_3D||D===s.TEXTURE_2D_ARRAY?s.texImage3D(ie,0,s.RGBA,1,1,K,0,s.RGBA,s.UNSIGNED_BYTE,he):s.texImage2D(ie+De,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,he);return le}let ye={};ye[s.TEXTURE_2D]=te(s.TEXTURE_2D,s.TEXTURE_2D,1),ye[s.TEXTURE_CUBE_MAP]=te(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),ye[s.TEXTURE_2D_ARRAY]=te(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),ye[s.TEXTURE_3D]=te(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),oe(s.DEPTH_TEST),o.setFunc(As),Ge(!1),We(Tu),oe(s.CULL_FACE),U(Ti);function oe(D){h[D]!==!0&&(s.enable(D),h[D]=!0)}function Ae(D){h[D]!==!1&&(s.disable(D),h[D]=!1)}function Le(D,ie){return u[D]!==ie?(s.bindFramebuffer(D,ie),u[D]=ie,D===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=ie),D===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=ie),!0):!1}function Be(D,ie){let G=p,K=!1;if(D){G=d.get(ie),G===void 0&&(G=[],d.set(ie,G));let he=D.textures;if(G.length!==he.length||G[0]!==s.COLOR_ATTACHMENT0){for(let le=0,De=he.length;le<De;le++)G[le]=s.COLOR_ATTACHMENT0+le;G.length=he.length,K=!0}}else G[0]!==s.BACK&&(G[0]=s.BACK,K=!0);K&&s.drawBuffers(G)}function yt(D){return m!==D?(s.useProgram(D),m=D,!0):!1}let Ye={[$i]:s.FUNC_ADD,[tp]:s.FUNC_SUBTRACT,[np]:s.FUNC_REVERSE_SUBTRACT};Ye[ip]=s.MIN,Ye[sp]=s.MAX;let St={[rp]:s.ZERO,[op]:s.ONE,[ap]:s.SRC_COLOR,[Il]:s.SRC_ALPHA,[fp]:s.SRC_ALPHA_SATURATE,[up]:s.DST_COLOR,[cp]:s.DST_ALPHA,[lp]:s.ONE_MINUS_SRC_COLOR,[Pl]:s.ONE_MINUS_SRC_ALPHA,[dp]:s.ONE_MINUS_DST_COLOR,[hp]:s.ONE_MINUS_DST_ALPHA,[pp]:s.CONSTANT_COLOR,[mp]:s.ONE_MINUS_CONSTANT_COLOR,[gp]:s.CONSTANT_ALPHA,[_p]:s.ONE_MINUS_CONSTANT_ALPHA};function U(D,ie,G,K,he,le,De,bt,Ot,nt){if(D===Ti){_===!0&&(Ae(s.BLEND),_=!1);return}if(_===!1&&(oe(s.BLEND),_=!0),D!==ep){if(D!==g||nt!==x){if((f!==$i||S!==$i)&&(s.blendEquation(s.FUNC_ADD),f=$i,S=$i),nt)switch(D){case Ms:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Au:s.blendFunc(s.ONE,s.ONE);break;case Ru:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Cu:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case Ms:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Au:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case Ru:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Cu:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}y=null,b=null,P=null,C=null,I.set(0,0,0),L=0,g=D,x=nt}return}he=he||ie,le=le||G,De=De||K,(ie!==f||he!==S)&&(s.blendEquationSeparate(Ye[ie],Ye[he]),f=ie,S=he),(G!==y||K!==b||le!==P||De!==C)&&(s.blendFuncSeparate(St[G],St[K],St[le],St[De]),y=G,b=K,P=le,C=De),(bt.equals(I)===!1||Ot!==L)&&(s.blendColor(bt.r,bt.g,bt.b,Ot),I.copy(bt),L=Ot),g=D,x=!1}function ln(D,ie){D.side===Kt?Ae(s.CULL_FACE):oe(s.CULL_FACE);let G=D.side===jt;ie&&(G=!G),Ge(G),D.blending===Ms&&D.transparent===!1?U(Ti):U(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),o.setFunc(D.depthFunc),o.setTest(D.depthTest),o.setMask(D.depthWrite),r.setMask(D.colorWrite);let K=D.stencilWrite;a.setTest(K),K&&(a.setMask(D.stencilWriteMask),a.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),a.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),pt(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?oe(s.SAMPLE_ALPHA_TO_COVERAGE):Ae(s.SAMPLE_ALPHA_TO_COVERAGE)}function Ge(D){M!==D&&(D?s.frontFace(s.CW):s.frontFace(s.CCW),M=D)}function We(D){D!==jf?(oe(s.CULL_FACE),D!==R&&(D===Tu?s.cullFace(s.BACK):D===Jf?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):Ae(s.CULL_FACE),R=D}function Ee(D){D!==O&&(X&&s.lineWidth(D),O=D)}function pt(D,ie,G){D?(oe(s.POLYGON_OFFSET_FILL),(F!==ie||V!==G)&&(s.polygonOffset(ie,G),F=ie,V=G)):Ae(s.POLYGON_OFFSET_FILL)}function we(D){D?oe(s.SCISSOR_TEST):Ae(s.SCISSOR_TEST)}function T(D){D===void 0&&(D=s.TEXTURE0+Z-1),re!==D&&(s.activeTexture(D),re=D)}function w(D,ie,G){G===void 0&&(re===null?G=s.TEXTURE0+Z-1:G=re);let K=ue[G];K===void 0&&(K={type:void 0,texture:void 0},ue[G]=K),(K.type!==D||K.texture!==ie)&&(re!==G&&(s.activeTexture(G),re=G),s.bindTexture(D,ie||ye[D]),K.type=D,K.texture=ie)}function B(){let D=ue[re];D!==void 0&&D.type!==void 0&&(s.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function Y(){try{s.compressedTexImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function j(){try{s.compressedTexImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function $(){try{s.texSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function xe(){try{s.texSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ae(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function de(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ke(){try{s.texStorage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function J(){try{s.texStorage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function fe(){try{s.texImage2D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Te(){try{s.texImage3D.apply(s,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ce(D){ot.equals(D)===!1&&(s.scissor(D.x,D.y,D.z,D.w),ot.copy(D))}function pe(D){q.equals(D)===!1&&(s.viewport(D.x,D.y,D.z,D.w),q.copy(D))}function Xe(D,ie){let G=l.get(ie);G===void 0&&(G=new WeakMap,l.set(ie,G));let K=G.get(D);K===void 0&&(K=s.getUniformBlockIndex(ie,D.name),G.set(D,K))}function Ue(D,ie){let K=l.get(ie).get(D);c.get(ie)!==K&&(s.uniformBlockBinding(ie,K,D.__bindingPointIndex),c.set(ie,K))}function ht(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),o.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),h={},re=null,ue={},u={},d=new WeakMap,p=[],m=null,_=!1,g=null,f=null,y=null,b=null,S=null,P=null,C=null,I=new me(0,0,0),L=0,x=!1,M=null,R=null,O=null,F=null,V=null,ot.set(0,0,s.canvas.width,s.canvas.height),q.set(0,0,s.canvas.width,s.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:oe,disable:Ae,bindFramebuffer:Le,drawBuffers:Be,useProgram:yt,setBlending:U,setMaterial:ln,setFlipSided:Ge,setCullFace:We,setLineWidth:Ee,setPolygonOffset:pt,setScissorTest:we,activeTexture:T,bindTexture:w,unbindTexture:B,compressedTexImage2D:Y,compressedTexImage3D:j,texImage2D:fe,texImage3D:Te,updateUBOMapping:Xe,uniformBlockBinding:Ue,texStorage2D:Ke,texStorage3D:J,texSubImage2D:$,texSubImage3D:xe,compressedTexSubImage2D:ae,compressedTexSubImage3D:de,scissor:Ce,viewport:pe,reset:ht}}function Td(s,e,t,n){let i=Gv(n);switch(t){case Qd:return s*e;case tf:return s*e;case nf:return s*e*2;case nh:return s*e/i.components*i.byteLength;case ih:return s*e/i.components*i.byteLength;case sf:return s*e*2/i.components*i.byteLength;case sh:return s*e*2/i.components*i.byteLength;case ef:return s*e*3/i.components*i.byteLength;case un:return s*e*4/i.components*i.byteLength;case rh:return s*e*4/i.components*i.byteLength;case ko:case Uo:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case Oo:case Fo:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Vl:case Wl:return Math.max(s,16)*Math.max(e,8)/4;case Hl:case Gl:return Math.max(s,8)*Math.max(e,8)/2;case Xl:case $l:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case ql:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Yl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Kl:return Math.floor((s+4)/5)*Math.floor((e+3)/4)*16;case Zl:return Math.floor((s+4)/5)*Math.floor((e+4)/5)*16;case jl:return Math.floor((s+5)/6)*Math.floor((e+4)/5)*16;case Jl:return Math.floor((s+5)/6)*Math.floor((e+5)/6)*16;case Ql:return Math.floor((s+7)/8)*Math.floor((e+4)/5)*16;case ec:return Math.floor((s+7)/8)*Math.floor((e+5)/6)*16;case tc:return Math.floor((s+7)/8)*Math.floor((e+7)/8)*16;case nc:return Math.floor((s+9)/10)*Math.floor((e+4)/5)*16;case ic:return Math.floor((s+9)/10)*Math.floor((e+5)/6)*16;case sc:return Math.floor((s+9)/10)*Math.floor((e+7)/8)*16;case rc:return Math.floor((s+9)/10)*Math.floor((e+9)/10)*16;case oc:return Math.floor((s+11)/12)*Math.floor((e+9)/10)*16;case ac:return Math.floor((s+11)/12)*Math.floor((e+11)/12)*16;case Bo:case lc:case cc:return Math.ceil(s/4)*Math.ceil(e/4)*16;case rf:case hc:return Math.ceil(s/4)*Math.ceil(e/4)*8;case uc:case dc:return Math.ceil(s/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Gv(s){switch(s){case ti:case Zd:return{byteLength:1,components:1};case br:case jd:case Or:return{byteLength:2,components:1};case eh:case th:return{byteLength:2,components:4};case Yi:case Qc:case bn:return{byteLength:4,components:1};case Jd:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${s}.`)}function Wv(s,e,t,n,i,r,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new se,h=new WeakMap,u,d=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(T,w){return p?new OffscreenCanvas(T,w):Mr("canvas")}function _(T,w,B){let Y=1,j=we(T);if((j.width>B||j.height>B)&&(Y=B/Math.max(j.width,j.height)),Y<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){let $=Math.floor(Y*j.width),xe=Math.floor(Y*j.height);u===void 0&&(u=m($,xe));let ae=w?m($,xe):u;return ae.width=$,ae.height=xe,ae.getContext("2d").drawImage(T,0,0,$,xe),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+j.width+"x"+j.height+") to ("+$+"x"+xe+")."),ae}else return"data"in T&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+j.width+"x"+j.height+")."),T;return T}function g(T){return T.generateMipmaps}function f(T){s.generateMipmap(T)}function y(T){return T.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?s.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function b(T,w,B,Y,j=!1){if(T!==null){if(s[T]!==void 0)return s[T];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let $=w;if(w===s.RED&&(B===s.FLOAT&&($=s.R32F),B===s.HALF_FLOAT&&($=s.R16F),B===s.UNSIGNED_BYTE&&($=s.R8)),w===s.RED_INTEGER&&(B===s.UNSIGNED_BYTE&&($=s.R8UI),B===s.UNSIGNED_SHORT&&($=s.R16UI),B===s.UNSIGNED_INT&&($=s.R32UI),B===s.BYTE&&($=s.R8I),B===s.SHORT&&($=s.R16I),B===s.INT&&($=s.R32I)),w===s.RG&&(B===s.FLOAT&&($=s.RG32F),B===s.HALF_FLOAT&&($=s.RG16F),B===s.UNSIGNED_BYTE&&($=s.RG8)),w===s.RG_INTEGER&&(B===s.UNSIGNED_BYTE&&($=s.RG8UI),B===s.UNSIGNED_SHORT&&($=s.RG16UI),B===s.UNSIGNED_INT&&($=s.RG32UI),B===s.BYTE&&($=s.RG8I),B===s.SHORT&&($=s.RG16I),B===s.INT&&($=s.RG32I)),w===s.RGB_INTEGER&&(B===s.UNSIGNED_BYTE&&($=s.RGB8UI),B===s.UNSIGNED_SHORT&&($=s.RGB16UI),B===s.UNSIGNED_INT&&($=s.RGB32UI),B===s.BYTE&&($=s.RGB8I),B===s.SHORT&&($=s.RGB16I),B===s.INT&&($=s.RGB32I)),w===s.RGBA_INTEGER&&(B===s.UNSIGNED_BYTE&&($=s.RGBA8UI),B===s.UNSIGNED_SHORT&&($=s.RGBA16UI),B===s.UNSIGNED_INT&&($=s.RGBA32UI),B===s.BYTE&&($=s.RGBA8I),B===s.SHORT&&($=s.RGBA16I),B===s.INT&&($=s.RGBA32I)),w===s.RGB&&B===s.UNSIGNED_INT_5_9_9_9_REV&&($=s.RGB9_E5),w===s.RGBA){let xe=j?ba:Ve.getTransfer(Y);B===s.FLOAT&&($=s.RGBA32F),B===s.HALF_FLOAT&&($=s.RGBA16F),B===s.UNSIGNED_BYTE&&($=xe===st?s.SRGB8_ALPHA8:s.RGBA8),B===s.UNSIGNED_SHORT_4_4_4_4&&($=s.RGBA4),B===s.UNSIGNED_SHORT_5_5_5_1&&($=s.RGB5_A1)}return($===s.R16F||$===s.R32F||$===s.RG16F||$===s.RG32F||$===s.RGBA16F||$===s.RGBA32F)&&e.get("EXT_color_buffer_float"),$}function S(T,w){let B;return T?w===null||w===Yi||w===Is?B=s.DEPTH24_STENCIL8:w===bn?B=s.DEPTH32F_STENCIL8:w===br&&(B=s.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):w===null||w===Yi||w===Is?B=s.DEPTH_COMPONENT24:w===bn?B=s.DEPTH_COMPONENT32F:w===br&&(B=s.DEPTH_COMPONENT16),B}function P(T,w){return g(T)===!0||T.isFramebufferTexture&&T.minFilter!==zt&&T.minFilter!==Zt?Math.log2(Math.max(w.width,w.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?w.mipmaps.length:1}function C(T){let w=T.target;w.removeEventListener("dispose",C),L(w),w.isVideoTexture&&h.delete(w)}function I(T){let w=T.target;w.removeEventListener("dispose",I),M(w)}function L(T){let w=n.get(T);if(w.__webglInit===void 0)return;let B=T.source,Y=d.get(B);if(Y){let j=Y[w.__cacheKey];j.usedTimes--,j.usedTimes===0&&x(T),Object.keys(Y).length===0&&d.delete(B)}n.remove(T)}function x(T){let w=n.get(T);s.deleteTexture(w.__webglTexture);let B=T.source,Y=d.get(B);delete Y[w.__cacheKey],o.memory.textures--}function M(T){let w=n.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),n.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let Y=0;Y<6;Y++){if(Array.isArray(w.__webglFramebuffer[Y]))for(let j=0;j<w.__webglFramebuffer[Y].length;j++)s.deleteFramebuffer(w.__webglFramebuffer[Y][j]);else s.deleteFramebuffer(w.__webglFramebuffer[Y]);w.__webglDepthbuffer&&s.deleteRenderbuffer(w.__webglDepthbuffer[Y])}else{if(Array.isArray(w.__webglFramebuffer))for(let Y=0;Y<w.__webglFramebuffer.length;Y++)s.deleteFramebuffer(w.__webglFramebuffer[Y]);else s.deleteFramebuffer(w.__webglFramebuffer);if(w.__webglDepthbuffer&&s.deleteRenderbuffer(w.__webglDepthbuffer),w.__webglMultisampledFramebuffer&&s.deleteFramebuffer(w.__webglMultisampledFramebuffer),w.__webglColorRenderbuffer)for(let Y=0;Y<w.__webglColorRenderbuffer.length;Y++)w.__webglColorRenderbuffer[Y]&&s.deleteRenderbuffer(w.__webglColorRenderbuffer[Y]);w.__webglDepthRenderbuffer&&s.deleteRenderbuffer(w.__webglDepthRenderbuffer)}let B=T.textures;for(let Y=0,j=B.length;Y<j;Y++){let $=n.get(B[Y]);$.__webglTexture&&(s.deleteTexture($.__webglTexture),o.memory.textures--),n.remove(B[Y])}n.remove(T)}let R=0;function O(){R=0}function F(){let T=R;return T>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+i.maxTextures),R+=1,T}function V(T){let w=[];return w.push(T.wrapS),w.push(T.wrapT),w.push(T.wrapR||0),w.push(T.magFilter),w.push(T.minFilter),w.push(T.anisotropy),w.push(T.internalFormat),w.push(T.format),w.push(T.type),w.push(T.generateMipmaps),w.push(T.premultiplyAlpha),w.push(T.flipY),w.push(T.unpackAlignment),w.push(T.colorSpace),w.join()}function Z(T,w){let B=n.get(T);if(T.isVideoTexture&&Ee(T),T.isRenderTargetTexture===!1&&T.version>0&&B.__version!==T.version){let Y=T.image;if(Y===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Y.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{q(B,T,w);return}}t.bindTexture(s.TEXTURE_2D,B.__webglTexture,s.TEXTURE0+w)}function X(T,w){let B=n.get(T);if(T.version>0&&B.__version!==T.version){q(B,T,w);return}t.bindTexture(s.TEXTURE_2D_ARRAY,B.__webglTexture,s.TEXTURE0+w)}function ee(T,w){let B=n.get(T);if(T.version>0&&B.__version!==T.version){q(B,T,w);return}t.bindTexture(s.TEXTURE_3D,B.__webglTexture,s.TEXTURE0+w)}function W(T,w){let B=n.get(T);if(T.version>0&&B.__version!==T.version){te(B,T,w);return}t.bindTexture(s.TEXTURE_CUBE_MAP,B.__webglTexture,s.TEXTURE0+w)}let re={[ei]:s.REPEAT,[jn]:s.CLAMP_TO_EDGE,[xr]:s.MIRRORED_REPEAT},ue={[zt]:s.NEAREST,[Jc]:s.NEAREST_MIPMAP_NEAREST,[xs]:s.NEAREST_MIPMAP_LINEAR,[Zt]:s.LINEAR,[mr]:s.LINEAR_MIPMAP_NEAREST,[Dn]:s.LINEAR_MIPMAP_LINEAR},Me={[Lp]:s.NEVER,[Fp]:s.ALWAYS,[Dp]:s.LESS,[af]:s.LEQUAL,[Np]:s.EQUAL,[Op]:s.GEQUAL,[kp]:s.GREATER,[Up]:s.NOTEQUAL};function Fe(T,w){if(w.type===bn&&e.has("OES_texture_float_linear")===!1&&(w.magFilter===Zt||w.magFilter===mr||w.magFilter===xs||w.magFilter===Dn||w.minFilter===Zt||w.minFilter===mr||w.minFilter===xs||w.minFilter===Dn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(T,s.TEXTURE_WRAP_S,re[w.wrapS]),s.texParameteri(T,s.TEXTURE_WRAP_T,re[w.wrapT]),(T===s.TEXTURE_3D||T===s.TEXTURE_2D_ARRAY)&&s.texParameteri(T,s.TEXTURE_WRAP_R,re[w.wrapR]),s.texParameteri(T,s.TEXTURE_MAG_FILTER,ue[w.magFilter]),s.texParameteri(T,s.TEXTURE_MIN_FILTER,ue[w.minFilter]),w.compareFunction&&(s.texParameteri(T,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(T,s.TEXTURE_COMPARE_FUNC,Me[w.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(w.magFilter===zt||w.minFilter!==xs&&w.minFilter!==Dn||w.type===bn&&e.has("OES_texture_float_linear")===!1)return;if(w.anisotropy>1||n.get(w).__currentAnisotropy){let B=e.get("EXT_texture_filter_anisotropic");s.texParameterf(T,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(w.anisotropy,i.getMaxAnisotropy())),n.get(w).__currentAnisotropy=w.anisotropy}}}function ot(T,w){let B=!1;T.__webglInit===void 0&&(T.__webglInit=!0,w.addEventListener("dispose",C));let Y=w.source,j=d.get(Y);j===void 0&&(j={},d.set(Y,j));let $=V(w);if($!==T.__cacheKey){j[$]===void 0&&(j[$]={texture:s.createTexture(),usedTimes:0},o.memory.textures++,B=!0),j[$].usedTimes++;let xe=j[T.__cacheKey];xe!==void 0&&(j[T.__cacheKey].usedTimes--,xe.usedTimes===0&&x(w)),T.__cacheKey=$,T.__webglTexture=j[$].texture}return B}function q(T,w,B){let Y=s.TEXTURE_2D;(w.isDataArrayTexture||w.isCompressedArrayTexture)&&(Y=s.TEXTURE_2D_ARRAY),w.isData3DTexture&&(Y=s.TEXTURE_3D);let j=ot(T,w),$=w.source;t.bindTexture(Y,T.__webglTexture,s.TEXTURE0+B);let xe=n.get($);if($.version!==xe.__version||j===!0){t.activeTexture(s.TEXTURE0+B);let ae=Ve.getPrimaries(Ve.workingColorSpace),de=w.colorSpace===Si?null:Ve.getPrimaries(w.colorSpace),Ke=w.colorSpace===Si||ae===de?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,w.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,w.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ke);let J=_(w.image,!1,i.maxTextureSize);J=pt(w,J);let fe=r.convert(w.format,w.colorSpace),Te=r.convert(w.type),Ce=b(w.internalFormat,fe,Te,w.colorSpace,w.isVideoTexture);Fe(Y,w);let pe,Xe=w.mipmaps,Ue=w.isVideoTexture!==!0,ht=xe.__version===void 0||j===!0,D=$.dataReady,ie=P(w,J);if(w.isDepthTexture)Ce=S(w.format===Ps,w.type),ht&&(Ue?t.texStorage2D(s.TEXTURE_2D,1,Ce,J.width,J.height):t.texImage2D(s.TEXTURE_2D,0,Ce,J.width,J.height,0,fe,Te,null));else if(w.isDataTexture)if(Xe.length>0){Ue&&ht&&t.texStorage2D(s.TEXTURE_2D,ie,Ce,Xe[0].width,Xe[0].height);for(let G=0,K=Xe.length;G<K;G++)pe=Xe[G],Ue?D&&t.texSubImage2D(s.TEXTURE_2D,G,0,0,pe.width,pe.height,fe,Te,pe.data):t.texImage2D(s.TEXTURE_2D,G,Ce,pe.width,pe.height,0,fe,Te,pe.data);w.generateMipmaps=!1}else Ue?(ht&&t.texStorage2D(s.TEXTURE_2D,ie,Ce,J.width,J.height),D&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,J.width,J.height,fe,Te,J.data)):t.texImage2D(s.TEXTURE_2D,0,Ce,J.width,J.height,0,fe,Te,J.data);else if(w.isCompressedTexture)if(w.isCompressedArrayTexture){Ue&&ht&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ie,Ce,Xe[0].width,Xe[0].height,J.depth);for(let G=0,K=Xe.length;G<K;G++)if(pe=Xe[G],w.format!==un)if(fe!==null)if(Ue){if(D)if(w.layerUpdates.size>0){let he=Td(pe.width,pe.height,w.format,w.type);for(let le of w.layerUpdates){let De=pe.data.subarray(le*he/pe.data.BYTES_PER_ELEMENT,(le+1)*he/pe.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,G,0,0,le,pe.width,pe.height,1,fe,De)}w.clearLayerUpdates()}else t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,G,0,0,0,pe.width,pe.height,J.depth,fe,pe.data)}else t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,G,Ce,pe.width,pe.height,J.depth,0,pe.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ue?D&&t.texSubImage3D(s.TEXTURE_2D_ARRAY,G,0,0,0,pe.width,pe.height,J.depth,fe,Te,pe.data):t.texImage3D(s.TEXTURE_2D_ARRAY,G,Ce,pe.width,pe.height,J.depth,0,fe,Te,pe.data)}else{Ue&&ht&&t.texStorage2D(s.TEXTURE_2D,ie,Ce,Xe[0].width,Xe[0].height);for(let G=0,K=Xe.length;G<K;G++)pe=Xe[G],w.format!==un?fe!==null?Ue?D&&t.compressedTexSubImage2D(s.TEXTURE_2D,G,0,0,pe.width,pe.height,fe,pe.data):t.compressedTexImage2D(s.TEXTURE_2D,G,Ce,pe.width,pe.height,0,pe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ue?D&&t.texSubImage2D(s.TEXTURE_2D,G,0,0,pe.width,pe.height,fe,Te,pe.data):t.texImage2D(s.TEXTURE_2D,G,Ce,pe.width,pe.height,0,fe,Te,pe.data)}else if(w.isDataArrayTexture)if(Ue){if(ht&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ie,Ce,J.width,J.height,J.depth),D)if(w.layerUpdates.size>0){let G=Td(J.width,J.height,w.format,w.type);for(let K of w.layerUpdates){let he=J.data.subarray(K*G/J.data.BYTES_PER_ELEMENT,(K+1)*G/J.data.BYTES_PER_ELEMENT);t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,K,J.width,J.height,1,fe,Te,he)}w.clearLayerUpdates()}else t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,fe,Te,J.data)}else t.texImage3D(s.TEXTURE_2D_ARRAY,0,Ce,J.width,J.height,J.depth,0,fe,Te,J.data);else if(w.isData3DTexture)Ue?(ht&&t.texStorage3D(s.TEXTURE_3D,ie,Ce,J.width,J.height,J.depth),D&&t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,fe,Te,J.data)):t.texImage3D(s.TEXTURE_3D,0,Ce,J.width,J.height,J.depth,0,fe,Te,J.data);else if(w.isFramebufferTexture){if(ht)if(Ue)t.texStorage2D(s.TEXTURE_2D,ie,Ce,J.width,J.height);else{let G=J.width,K=J.height;for(let he=0;he<ie;he++)t.texImage2D(s.TEXTURE_2D,he,Ce,G,K,0,fe,Te,null),G>>=1,K>>=1}}else if(Xe.length>0){if(Ue&&ht){let G=we(Xe[0]);t.texStorage2D(s.TEXTURE_2D,ie,Ce,G.width,G.height)}for(let G=0,K=Xe.length;G<K;G++)pe=Xe[G],Ue?D&&t.texSubImage2D(s.TEXTURE_2D,G,0,0,fe,Te,pe):t.texImage2D(s.TEXTURE_2D,G,Ce,fe,Te,pe);w.generateMipmaps=!1}else if(Ue){if(ht){let G=we(J);t.texStorage2D(s.TEXTURE_2D,ie,Ce,G.width,G.height)}D&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,fe,Te,J)}else t.texImage2D(s.TEXTURE_2D,0,Ce,fe,Te,J);g(w)&&f(Y),xe.__version=$.version,w.onUpdate&&w.onUpdate(w)}T.__version=w.version}function te(T,w,B){if(w.image.length!==6)return;let Y=ot(T,w),j=w.source;t.bindTexture(s.TEXTURE_CUBE_MAP,T.__webglTexture,s.TEXTURE0+B);let $=n.get(j);if(j.version!==$.__version||Y===!0){t.activeTexture(s.TEXTURE0+B);let xe=Ve.getPrimaries(Ve.workingColorSpace),ae=w.colorSpace===Si?null:Ve.getPrimaries(w.colorSpace),de=w.colorSpace===Si||xe===ae?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,w.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,w.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,de);let Ke=w.isCompressedTexture||w.image[0].isCompressedTexture,J=w.image[0]&&w.image[0].isDataTexture,fe=[];for(let K=0;K<6;K++)!Ke&&!J?fe[K]=_(w.image[K],!0,i.maxCubemapSize):fe[K]=J?w.image[K].image:w.image[K],fe[K]=pt(w,fe[K]);let Te=fe[0],Ce=r.convert(w.format,w.colorSpace),pe=r.convert(w.type),Xe=b(w.internalFormat,Ce,pe,w.colorSpace),Ue=w.isVideoTexture!==!0,ht=$.__version===void 0||Y===!0,D=j.dataReady,ie=P(w,Te);Fe(s.TEXTURE_CUBE_MAP,w);let G;if(Ke){Ue&&ht&&t.texStorage2D(s.TEXTURE_CUBE_MAP,ie,Xe,Te.width,Te.height);for(let K=0;K<6;K++){G=fe[K].mipmaps;for(let he=0;he<G.length;he++){let le=G[he];w.format!==un?Ce!==null?Ue?D&&t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he,0,0,le.width,le.height,Ce,le.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he,Xe,le.width,le.height,0,le.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ue?D&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he,0,0,le.width,le.height,Ce,pe,le.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he,Xe,le.width,le.height,0,Ce,pe,le.data)}}}else{if(G=w.mipmaps,Ue&&ht){G.length>0&&ie++;let K=we(fe[0]);t.texStorage2D(s.TEXTURE_CUBE_MAP,ie,Xe,K.width,K.height)}for(let K=0;K<6;K++)if(J){Ue?D&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,fe[K].width,fe[K].height,Ce,pe,fe[K].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Xe,fe[K].width,fe[K].height,0,Ce,pe,fe[K].data);for(let he=0;he<G.length;he++){let De=G[he].image[K].image;Ue?D&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he+1,0,0,De.width,De.height,Ce,pe,De.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he+1,Xe,De.width,De.height,0,Ce,pe,De.data)}}else{Ue?D&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,0,0,Ce,pe,fe[K]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,0,Xe,Ce,pe,fe[K]);for(let he=0;he<G.length;he++){let le=G[he];Ue?D&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he+1,0,0,Ce,pe,le.image[K]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+K,he+1,Xe,Ce,pe,le.image[K])}}}g(w)&&f(s.TEXTURE_CUBE_MAP),$.__version=j.version,w.onUpdate&&w.onUpdate(w)}T.__version=w.version}function ye(T,w,B,Y,j,$){let xe=r.convert(B.format,B.colorSpace),ae=r.convert(B.type),de=b(B.internalFormat,xe,ae,B.colorSpace),Ke=n.get(w),J=n.get(B);if(J.__renderTarget=w,!Ke.__hasExternalTextures){let fe=Math.max(1,w.width>>$),Te=Math.max(1,w.height>>$);j===s.TEXTURE_3D||j===s.TEXTURE_2D_ARRAY?t.texImage3D(j,$,de,fe,Te,w.depth,0,xe,ae,null):t.texImage2D(j,$,de,fe,Te,0,xe,ae,null)}t.bindFramebuffer(s.FRAMEBUFFER,T),We(w)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,Y,j,J.__webglTexture,0,Ge(w)):(j===s.TEXTURE_2D||j>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&j<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,Y,j,J.__webglTexture,$),t.bindFramebuffer(s.FRAMEBUFFER,null)}function oe(T,w,B){if(s.bindRenderbuffer(s.RENDERBUFFER,T),w.depthBuffer){let Y=w.depthTexture,j=Y&&Y.isDepthTexture?Y.type:null,$=S(w.stencilBuffer,j),xe=w.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ae=Ge(w);We(w)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,ae,$,w.width,w.height):B?s.renderbufferStorageMultisample(s.RENDERBUFFER,ae,$,w.width,w.height):s.renderbufferStorage(s.RENDERBUFFER,$,w.width,w.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,xe,s.RENDERBUFFER,T)}else{let Y=w.textures;for(let j=0;j<Y.length;j++){let $=Y[j],xe=r.convert($.format,$.colorSpace),ae=r.convert($.type),de=b($.internalFormat,xe,ae,$.colorSpace),Ke=Ge(w);B&&We(w)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,Ke,de,w.width,w.height):We(w)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Ke,de,w.width,w.height):s.renderbufferStorage(s.RENDERBUFFER,de,w.width,w.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function Ae(T,w){if(w&&w.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(s.FRAMEBUFFER,T),!(w.depthTexture&&w.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let Y=n.get(w.depthTexture);Y.__renderTarget=w,(!Y.__webglTexture||w.depthTexture.image.width!==w.width||w.depthTexture.image.height!==w.height)&&(w.depthTexture.image.width=w.width,w.depthTexture.image.height=w.height,w.depthTexture.needsUpdate=!0),Z(w.depthTexture,0);let j=Y.__webglTexture,$=Ge(w);if(w.depthTexture.format===Ss)We(w)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,j,0,$):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,j,0);else if(w.depthTexture.format===Ps)We(w)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,j,0,$):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,j,0);else throw new Error("Unknown depthTexture format")}function Le(T){let w=n.get(T),B=T.isWebGLCubeRenderTarget===!0;if(w.__boundDepthTexture!==T.depthTexture){let Y=T.depthTexture;if(w.__depthDisposeCallback&&w.__depthDisposeCallback(),Y){let j=()=>{delete w.__boundDepthTexture,delete w.__depthDisposeCallback,Y.removeEventListener("dispose",j)};Y.addEventListener("dispose",j),w.__depthDisposeCallback=j}w.__boundDepthTexture=Y}if(T.depthTexture&&!w.__autoAllocateDepthBuffer){if(B)throw new Error("target.depthTexture not supported in Cube render targets");Ae(w.__webglFramebuffer,T)}else if(B){w.__webglDepthbuffer=[];for(let Y=0;Y<6;Y++)if(t.bindFramebuffer(s.FRAMEBUFFER,w.__webglFramebuffer[Y]),w.__webglDepthbuffer[Y]===void 0)w.__webglDepthbuffer[Y]=s.createRenderbuffer(),oe(w.__webglDepthbuffer[Y],T,!1);else{let j=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,$=w.__webglDepthbuffer[Y];s.bindRenderbuffer(s.RENDERBUFFER,$),s.framebufferRenderbuffer(s.FRAMEBUFFER,j,s.RENDERBUFFER,$)}}else if(t.bindFramebuffer(s.FRAMEBUFFER,w.__webglFramebuffer),w.__webglDepthbuffer===void 0)w.__webglDepthbuffer=s.createRenderbuffer(),oe(w.__webglDepthbuffer,T,!1);else{let Y=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,j=w.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,j),s.framebufferRenderbuffer(s.FRAMEBUFFER,Y,s.RENDERBUFFER,j)}t.bindFramebuffer(s.FRAMEBUFFER,null)}function Be(T,w,B){let Y=n.get(T);w!==void 0&&ye(Y.__webglFramebuffer,T,T.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),B!==void 0&&Le(T)}function yt(T){let w=T.texture,B=n.get(T),Y=n.get(w);T.addEventListener("dispose",I);let j=T.textures,$=T.isWebGLCubeRenderTarget===!0,xe=j.length>1;if(xe||(Y.__webglTexture===void 0&&(Y.__webglTexture=s.createTexture()),Y.__version=w.version,o.memory.textures++),$){B.__webglFramebuffer=[];for(let ae=0;ae<6;ae++)if(w.mipmaps&&w.mipmaps.length>0){B.__webglFramebuffer[ae]=[];for(let de=0;de<w.mipmaps.length;de++)B.__webglFramebuffer[ae][de]=s.createFramebuffer()}else B.__webglFramebuffer[ae]=s.createFramebuffer()}else{if(w.mipmaps&&w.mipmaps.length>0){B.__webglFramebuffer=[];for(let ae=0;ae<w.mipmaps.length;ae++)B.__webglFramebuffer[ae]=s.createFramebuffer()}else B.__webglFramebuffer=s.createFramebuffer();if(xe)for(let ae=0,de=j.length;ae<de;ae++){let Ke=n.get(j[ae]);Ke.__webglTexture===void 0&&(Ke.__webglTexture=s.createTexture(),o.memory.textures++)}if(T.samples>0&&We(T)===!1){B.__webglMultisampledFramebuffer=s.createFramebuffer(),B.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let ae=0;ae<j.length;ae++){let de=j[ae];B.__webglColorRenderbuffer[ae]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,B.__webglColorRenderbuffer[ae]);let Ke=r.convert(de.format,de.colorSpace),J=r.convert(de.type),fe=b(de.internalFormat,Ke,J,de.colorSpace,T.isXRRenderTarget===!0),Te=Ge(T);s.renderbufferStorageMultisample(s.RENDERBUFFER,Te,fe,T.width,T.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ae,s.RENDERBUFFER,B.__webglColorRenderbuffer[ae])}s.bindRenderbuffer(s.RENDERBUFFER,null),T.depthBuffer&&(B.__webglDepthRenderbuffer=s.createRenderbuffer(),oe(B.__webglDepthRenderbuffer,T,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if($){t.bindTexture(s.TEXTURE_CUBE_MAP,Y.__webglTexture),Fe(s.TEXTURE_CUBE_MAP,w);for(let ae=0;ae<6;ae++)if(w.mipmaps&&w.mipmaps.length>0)for(let de=0;de<w.mipmaps.length;de++)ye(B.__webglFramebuffer[ae][de],T,w,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ae,de);else ye(B.__webglFramebuffer[ae],T,w,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0);g(w)&&f(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(xe){for(let ae=0,de=j.length;ae<de;ae++){let Ke=j[ae],J=n.get(Ke);t.bindTexture(s.TEXTURE_2D,J.__webglTexture),Fe(s.TEXTURE_2D,Ke),ye(B.__webglFramebuffer,T,Ke,s.COLOR_ATTACHMENT0+ae,s.TEXTURE_2D,0),g(Ke)&&f(s.TEXTURE_2D)}t.unbindTexture()}else{let ae=s.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(ae=T.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(ae,Y.__webglTexture),Fe(ae,w),w.mipmaps&&w.mipmaps.length>0)for(let de=0;de<w.mipmaps.length;de++)ye(B.__webglFramebuffer[de],T,w,s.COLOR_ATTACHMENT0,ae,de);else ye(B.__webglFramebuffer,T,w,s.COLOR_ATTACHMENT0,ae,0);g(w)&&f(ae),t.unbindTexture()}T.depthBuffer&&Le(T)}function Ye(T){let w=T.textures;for(let B=0,Y=w.length;B<Y;B++){let j=w[B];if(g(j)){let $=y(T),xe=n.get(j).__webglTexture;t.bindTexture($,xe),f($),t.unbindTexture()}}}let St=[],U=[];function ln(T){if(T.samples>0){if(We(T)===!1){let w=T.textures,B=T.width,Y=T.height,j=s.COLOR_BUFFER_BIT,$=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,xe=n.get(T),ae=w.length>1;if(ae)for(let de=0;de<w.length;de++)t.bindFramebuffer(s.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,xe.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,xe.__webglMultisampledFramebuffer),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,xe.__webglFramebuffer);for(let de=0;de<w.length;de++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(j|=s.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(j|=s.STENCIL_BUFFER_BIT)),ae){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,xe.__webglColorRenderbuffer[de]);let Ke=n.get(w[de]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,Ke,0)}s.blitFramebuffer(0,0,B,Y,0,0,B,Y,j,s.NEAREST),c===!0&&(St.length=0,U.length=0,St.push(s.COLOR_ATTACHMENT0+de),T.depthBuffer&&T.resolveDepthBuffer===!1&&(St.push($),U.push($),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,U)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,St))}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),ae)for(let de=0;de<w.length;de++){t.bindFramebuffer(s.FRAMEBUFFER,xe.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.RENDERBUFFER,xe.__webglColorRenderbuffer[de]);let Ke=n.get(w[de]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,xe.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+de,s.TEXTURE_2D,Ke,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,xe.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&c){let w=T.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[w])}}}function Ge(T){return Math.min(i.maxSamples,T.samples)}function We(T){let w=n.get(T);return T.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&w.__useRenderToTexture!==!1}function Ee(T){let w=o.render.frame;h.get(T)!==w&&(h.set(T,w),T.update())}function pt(T,w){let B=T.colorSpace,Y=T.format,j=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||B!==Ht&&B!==Si&&(Ve.getTransfer(B)===st?(Y!==un||j!==ti)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",B)),w}function we(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(l.width=T.naturalWidth||T.width,l.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(l.width=T.displayWidth,l.height=T.displayHeight):(l.width=T.width,l.height=T.height),l}this.allocateTextureUnit=F,this.resetTextureUnits=O,this.setTexture2D=Z,this.setTexture2DArray=X,this.setTexture3D=ee,this.setTextureCube=W,this.rebindTextures=Be,this.setupRenderTarget=yt,this.updateRenderTargetMipmap=Ye,this.updateMultisampleRenderTarget=ln,this.setupDepthRenderbuffer=Le,this.setupFrameBufferTexture=ye,this.useMultisampledRTT=We}function Xv(s,e){function t(n,i=Si){let r,o=Ve.getTransfer(i);if(n===ti)return s.UNSIGNED_BYTE;if(n===eh)return s.UNSIGNED_SHORT_4_4_4_4;if(n===th)return s.UNSIGNED_SHORT_5_5_5_1;if(n===Jd)return s.UNSIGNED_INT_5_9_9_9_REV;if(n===Zd)return s.BYTE;if(n===jd)return s.SHORT;if(n===br)return s.UNSIGNED_SHORT;if(n===Qc)return s.INT;if(n===Yi)return s.UNSIGNED_INT;if(n===bn)return s.FLOAT;if(n===Or)return s.HALF_FLOAT;if(n===Qd)return s.ALPHA;if(n===ef)return s.RGB;if(n===un)return s.RGBA;if(n===tf)return s.LUMINANCE;if(n===nf)return s.LUMINANCE_ALPHA;if(n===Ss)return s.DEPTH_COMPONENT;if(n===Ps)return s.DEPTH_STENCIL;if(n===nh)return s.RED;if(n===ih)return s.RED_INTEGER;if(n===sf)return s.RG;if(n===sh)return s.RG_INTEGER;if(n===rh)return s.RGBA_INTEGER;if(n===ko||n===Uo||n===Oo||n===Fo)if(o===st)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===ko)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Uo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Oo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Fo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===ko)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Uo)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Oo)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Fo)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Hl||n===Vl||n===Gl||n===Wl)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Hl)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Vl)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Gl)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Wl)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Xl||n===$l||n===ql)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Xl||n===$l)return o===st?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===ql)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Yl||n===Kl||n===Zl||n===jl||n===Jl||n===Ql||n===ec||n===tc||n===nc||n===ic||n===sc||n===rc||n===oc||n===ac)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Yl)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Kl)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Zl)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===jl)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Jl)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Ql)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===ec)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===tc)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===nc)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===ic)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===sc)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===rc)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===oc)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===ac)return o===st?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Bo||n===lc||n===cc)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===Bo)return o===st?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===lc)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===cc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===rf||n===hc||n===uc||n===dc)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===Bo)return r.COMPRESSED_RED_RGTC1_EXT;if(n===hc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===uc)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===dc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Is?s.UNSIGNED_INT_24_8:s[n]!==void 0?s[n]:null}return{convert:t}}var Ac=class extends At{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}},qe=class extends lt{constructor(){super(),this.isGroup=!0,this.type="Group"}},$v={type:"move"},_r=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new qe,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new qe,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new A,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new A),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new qe,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new A,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new A),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,o=null,a=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){o=!0;for(let _ of e.hand.values()){let g=t.getJointPose(_,n),f=this._getHandJoint(l,_);g!==null&&(f.matrix.fromArray(g.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=g.radius),f.visible=g!==null}let h=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,m=.005;l.inputState.pinching&&d>p+m?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&d<=p-m&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1));a!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent($v)))}return a!==null&&(a.visible=i!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new qe;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},qv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Yv=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Rc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,n){if(this.texture===null){let i=new kt,r=e.properties.get(i);r.__webglTexture=t.texture,(t.depthNear!=n.depthNear||t.depthFar!=n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new kn({vertexShader:qv,fragmentShader:Yv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new $e(new Us(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Cc=class extends ni{constructor(e,t){super();let n=this,i=null,r=1,o=null,a="local-floor",c=1,l=null,h=null,u=null,d=null,p=null,m=null,_=new Rc,g=t.getContextAttributes(),f=null,y=null,b=[],S=[],P=new se,C=null,I=new At;I.viewport=new je;let L=new At;L.viewport=new je;let x=[I,L],M=new Ac,R=null,O=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let te=b[q];return te===void 0&&(te=new _r,b[q]=te),te.getTargetRaySpace()},this.getControllerGrip=function(q){let te=b[q];return te===void 0&&(te=new _r,b[q]=te),te.getGripSpace()},this.getHand=function(q){let te=b[q];return te===void 0&&(te=new _r,b[q]=te),te.getHandSpace()};function F(q){let te=S.indexOf(q.inputSource);if(te===-1)return;let ye=b[te];ye!==void 0&&(ye.update(q.inputSource,q.frame,l||o),ye.dispatchEvent({type:q.type,data:q.inputSource}))}function V(){i.removeEventListener("select",F),i.removeEventListener("selectstart",F),i.removeEventListener("selectend",F),i.removeEventListener("squeeze",F),i.removeEventListener("squeezestart",F),i.removeEventListener("squeezeend",F),i.removeEventListener("end",V),i.removeEventListener("inputsourceschange",Z);for(let q=0;q<b.length;q++){let te=S[q];te!==null&&(S[q]=null,b[q].disconnect(te))}R=null,O=null,_.reset(),e.setRenderTarget(f),p=null,d=null,u=null,i=null,y=null,ot.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(P.width,P.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){r=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){a=q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function(q){l=q},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u},this.getFrame=function(){return m},this.getSession=function(){return i},this.setSession=async function(q){if(i=q,i!==null){if(f=e.getRenderTarget(),i.addEventListener("select",F),i.addEventListener("selectstart",F),i.addEventListener("selectend",F),i.addEventListener("squeeze",F),i.addEventListener("squeezestart",F),i.addEventListener("squeezeend",F),i.addEventListener("end",V),i.addEventListener("inputsourceschange",Z),g.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(P),i.renderState.layers===void 0){let te={antialias:g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(i,t,te),i.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),y=new ii(p.framebufferWidth,p.framebufferHeight,{format:un,type:ti,colorSpace:e.outputColorSpace,stencilBuffer:g.stencil})}else{let te=null,ye=null,oe=null;g.depth&&(oe=g.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,te=g.stencil?Ps:Ss,ye=g.stencil?Is:Yi);let Ae={colorFormat:t.RGBA8,depthFormat:oe,scaleFactor:r};u=new XRWebGLBinding(i,t),d=u.createProjectionLayer(Ae),i.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),y=new ii(d.textureWidth,d.textureHeight,{format:un,type:ti,depthTexture:new Yo(d.textureWidth,d.textureHeight,ye,void 0,void 0,void 0,void 0,void 0,void 0,te),stencilBuffer:g.stencil,colorSpace:e.outputColorSpace,samples:g.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await i.requestReferenceSpace(a),ot.setContext(i),ot.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function Z(q){for(let te=0;te<q.removed.length;te++){let ye=q.removed[te],oe=S.indexOf(ye);oe>=0&&(S[oe]=null,b[oe].disconnect(ye))}for(let te=0;te<q.added.length;te++){let ye=q.added[te],oe=S.indexOf(ye);if(oe===-1){for(let Le=0;Le<b.length;Le++)if(Le>=S.length){S.push(ye),oe=Le;break}else if(S[Le]===null){S[Le]=ye,oe=Le;break}if(oe===-1)break}let Ae=b[oe];Ae&&Ae.connect(ye)}}let X=new A,ee=new A;function W(q,te,ye){X.setFromMatrixPosition(te.matrixWorld),ee.setFromMatrixPosition(ye.matrixWorld);let oe=X.distanceTo(ee),Ae=te.projectionMatrix.elements,Le=ye.projectionMatrix.elements,Be=Ae[14]/(Ae[10]-1),yt=Ae[14]/(Ae[10]+1),Ye=(Ae[9]+1)/Ae[5],St=(Ae[9]-1)/Ae[5],U=(Ae[8]-1)/Ae[0],ln=(Le[8]+1)/Le[0],Ge=Be*U,We=Be*ln,Ee=oe/(-U+ln),pt=Ee*-U;if(te.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(pt),q.translateZ(Ee),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert(),Ae[10]===-1)q.projectionMatrix.copy(te.projectionMatrix),q.projectionMatrixInverse.copy(te.projectionMatrixInverse);else{let we=Be+Ee,T=yt+Ee,w=Ge-pt,B=We+(oe-pt),Y=Ye*yt/T*we,j=St*yt/T*we;q.projectionMatrix.makePerspective(w,B,Y,j,we,T),q.projectionMatrixInverse.copy(q.projectionMatrix).invert()}}function re(q,te){te===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(te.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.updateCamera=function(q){if(i===null)return;let te=q.near,ye=q.far;_.texture!==null&&(_.depthNear>0&&(te=_.depthNear),_.depthFar>0&&(ye=_.depthFar)),M.near=L.near=I.near=te,M.far=L.far=I.far=ye,(R!==M.near||O!==M.far)&&(i.updateRenderState({depthNear:M.near,depthFar:M.far}),R=M.near,O=M.far),I.layers.mask=q.layers.mask|2,L.layers.mask=q.layers.mask|4,M.layers.mask=I.layers.mask|L.layers.mask;let oe=q.parent,Ae=M.cameras;re(M,oe);for(let Le=0;Le<Ae.length;Le++)re(Ae[Le],oe);Ae.length===2?W(M,I,L):M.projectionMatrix.copy(I.projectionMatrix),ue(q,M,oe)};function ue(q,te,ye){ye===null?q.matrix.copy(te.matrixWorld):(q.matrix.copy(ye.matrixWorld),q.matrix.invert(),q.matrix.multiply(te.matrixWorld)),q.matrix.decompose(q.position,q.quaternion,q.scale),q.updateMatrixWorld(!0),q.projectionMatrix.copy(te.projectionMatrix),q.projectionMatrixInverse.copy(te.projectionMatrixInverse),q.isPerspectiveCamera&&(q.fov=Ns*2*Math.atan(1/q.projectionMatrix.elements[5]),q.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(d===null&&p===null))return c},this.setFoveation=function(q){c=q,d!==null&&(d.fixedFoveation=q),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=q)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(M)};let Me=null;function Fe(q,te){if(h=te.getViewerPose(l||o),m=te,h!==null){let ye=h.views;p!==null&&(e.setRenderTargetFramebuffer(y,p.framebuffer),e.setRenderTarget(y));let oe=!1;ye.length!==M.cameras.length&&(M.cameras.length=0,oe=!0);for(let Le=0;Le<ye.length;Le++){let Be=ye[Le],yt=null;if(p!==null)yt=p.getViewport(Be);else{let St=u.getViewSubImage(d,Be);yt=St.viewport,Le===0&&(e.setRenderTargetTextures(y,St.colorTexture,d.ignoreDepthValues?void 0:St.depthStencilTexture),e.setRenderTarget(y))}let Ye=x[Le];Ye===void 0&&(Ye=new At,Ye.layers.enable(Le),Ye.viewport=new je,x[Le]=Ye),Ye.matrix.fromArray(Be.transform.matrix),Ye.matrix.decompose(Ye.position,Ye.quaternion,Ye.scale),Ye.projectionMatrix.fromArray(Be.projectionMatrix),Ye.projectionMatrixInverse.copy(Ye.projectionMatrix).invert(),Ye.viewport.set(yt.x,yt.y,yt.width,yt.height),Le===0&&(M.matrix.copy(Ye.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),oe===!0&&M.cameras.push(Ye)}let Ae=i.enabledFeatures;if(Ae&&Ae.includes("depth-sensing")){let Le=u.getDepthInformation(ye[0]);Le&&Le.isValid&&Le.texture&&_.init(e,Le,i.renderState)}}for(let ye=0;ye<b.length;ye++){let oe=S[ye],Ae=b[ye];oe!==null&&Ae!==void 0&&Ae.update(oe,te,l||o)}Me&&Me(q,te),te.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:te}),m=null}let ot=new uf;ot.setAnimationLoop(Fe),this.setAnimationLoop=function(q){Me=q},this.dispose=function(){}}},Wi=new Sn,Kv=new Re;function Zv(s,e){function t(g,f){g.matrixAutoUpdate===!0&&g.updateMatrix(),f.value.copy(g.matrix)}function n(g,f){f.color.getRGB(g.fogColor.value,hf(s)),f.isFog?(g.fogNear.value=f.near,g.fogFar.value=f.far):f.isFogExp2&&(g.fogDensity.value=f.density)}function i(g,f,y,b,S){f.isMeshBasicMaterial||f.isMeshLambertMaterial?r(g,f):f.isMeshToonMaterial?(r(g,f),u(g,f)):f.isMeshPhongMaterial?(r(g,f),h(g,f)):f.isMeshStandardMaterial?(r(g,f),d(g,f),f.isMeshPhysicalMaterial&&p(g,f,S)):f.isMeshMatcapMaterial?(r(g,f),m(g,f)):f.isMeshDepthMaterial?r(g,f):f.isMeshDistanceMaterial?(r(g,f),_(g,f)):f.isMeshNormalMaterial?r(g,f):f.isLineBasicMaterial?(o(g,f),f.isLineDashedMaterial&&a(g,f)):f.isPointsMaterial?c(g,f,y,b):f.isSpriteMaterial?l(g,f):f.isShadowMaterial?(g.color.value.copy(f.color),g.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(g,f){g.opacity.value=f.opacity,f.color&&g.diffuse.value.copy(f.color),f.emissive&&g.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(g.map.value=f.map,t(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,t(f.alphaMap,g.alphaMapTransform)),f.bumpMap&&(g.bumpMap.value=f.bumpMap,t(f.bumpMap,g.bumpMapTransform),g.bumpScale.value=f.bumpScale,f.side===jt&&(g.bumpScale.value*=-1)),f.normalMap&&(g.normalMap.value=f.normalMap,t(f.normalMap,g.normalMapTransform),g.normalScale.value.copy(f.normalScale),f.side===jt&&g.normalScale.value.negate()),f.displacementMap&&(g.displacementMap.value=f.displacementMap,t(f.displacementMap,g.displacementMapTransform),g.displacementScale.value=f.displacementScale,g.displacementBias.value=f.displacementBias),f.emissiveMap&&(g.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,g.emissiveMapTransform)),f.specularMap&&(g.specularMap.value=f.specularMap,t(f.specularMap,g.specularMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest);let y=e.get(f),b=y.envMap,S=y.envMapRotation;b&&(g.envMap.value=b,Wi.copy(S),Wi.x*=-1,Wi.y*=-1,Wi.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(Wi.y*=-1,Wi.z*=-1),g.envMapRotation.value.setFromMatrix4(Kv.makeRotationFromEuler(Wi)),g.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,g.reflectivity.value=f.reflectivity,g.ior.value=f.ior,g.refractionRatio.value=f.refractionRatio),f.lightMap&&(g.lightMap.value=f.lightMap,g.lightMapIntensity.value=f.lightMapIntensity,t(f.lightMap,g.lightMapTransform)),f.aoMap&&(g.aoMap.value=f.aoMap,g.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,g.aoMapTransform))}function o(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,f.map&&(g.map.value=f.map,t(f.map,g.mapTransform))}function a(g,f){g.dashSize.value=f.dashSize,g.totalSize.value=f.dashSize+f.gapSize,g.scale.value=f.scale}function c(g,f,y,b){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.size.value=f.size*y,g.scale.value=b*.5,f.map&&(g.map.value=f.map,t(f.map,g.uvTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,t(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function l(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.rotation.value=f.rotation,f.map&&(g.map.value=f.map,t(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,t(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function h(g,f){g.specular.value.copy(f.specular),g.shininess.value=Math.max(f.shininess,1e-4)}function u(g,f){f.gradientMap&&(g.gradientMap.value=f.gradientMap)}function d(g,f){g.metalness.value=f.metalness,f.metalnessMap&&(g.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,g.metalnessMapTransform)),g.roughness.value=f.roughness,f.roughnessMap&&(g.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,g.roughnessMapTransform)),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)}function p(g,f,y){g.ior.value=f.ior,f.sheen>0&&(g.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),g.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(g.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,g.sheenColorMapTransform)),f.sheenRoughnessMap&&(g.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,g.sheenRoughnessMapTransform))),f.clearcoat>0&&(g.clearcoat.value=f.clearcoat,g.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(g.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,g.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(g.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===jt&&g.clearcoatNormalScale.value.negate())),f.dispersion>0&&(g.dispersion.value=f.dispersion),f.iridescence>0&&(g.iridescence.value=f.iridescence,g.iridescenceIOR.value=f.iridescenceIOR,g.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(g.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,g.iridescenceMapTransform)),f.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),f.transmission>0&&(g.transmission.value=f.transmission,g.transmissionSamplerMap.value=y.texture,g.transmissionSamplerSize.value.set(y.width,y.height),f.transmissionMap&&(g.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,g.transmissionMapTransform)),g.thickness.value=f.thickness,f.thicknessMap&&(g.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=f.attenuationDistance,g.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(g.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(g.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=f.specularIntensity,g.specularColor.value.copy(f.specularColor),f.specularColorMap&&(g.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,g.specularColorMapTransform)),f.specularIntensityMap&&(g.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,g.specularIntensityMapTransform))}function m(g,f){f.matcap&&(g.matcap.value=f.matcap)}function _(g,f){let y=e.get(f).light;g.referencePosition.value.setFromMatrixPosition(y.matrixWorld),g.nearDistance.value=y.shadow.camera.near,g.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function jv(s,e,t,n){let i={},r={},o=[],a=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function c(y,b){let S=b.program;n.uniformBlockBinding(y,S)}function l(y,b){let S=i[y.id];S===void 0&&(m(y),S=h(y),i[y.id]=S,y.addEventListener("dispose",g));let P=b.program;n.updateUBOMapping(y,P);let C=e.render.frame;r[y.id]!==C&&(d(y),r[y.id]=C)}function h(y){let b=u();y.__bindingPointIndex=b;let S=s.createBuffer(),P=y.__size,C=y.usage;return s.bindBuffer(s.UNIFORM_BUFFER,S),s.bufferData(s.UNIFORM_BUFFER,P,C),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,b,S),S}function u(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(y){let b=i[y.id],S=y.uniforms,P=y.__cache;s.bindBuffer(s.UNIFORM_BUFFER,b);for(let C=0,I=S.length;C<I;C++){let L=Array.isArray(S[C])?S[C]:[S[C]];for(let x=0,M=L.length;x<M;x++){let R=L[x];if(p(R,C,x,P)===!0){let O=R.__offset,F=Array.isArray(R.value)?R.value:[R.value],V=0;for(let Z=0;Z<F.length;Z++){let X=F[Z],ee=_(X);typeof X=="number"||typeof X=="boolean"?(R.__data[0]=X,s.bufferSubData(s.UNIFORM_BUFFER,O+V,R.__data)):X.isMatrix3?(R.__data[0]=X.elements[0],R.__data[1]=X.elements[1],R.__data[2]=X.elements[2],R.__data[3]=0,R.__data[4]=X.elements[3],R.__data[5]=X.elements[4],R.__data[6]=X.elements[5],R.__data[7]=0,R.__data[8]=X.elements[6],R.__data[9]=X.elements[7],R.__data[10]=X.elements[8],R.__data[11]=0):(X.toArray(R.__data,V),V+=ee.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,O,R.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function p(y,b,S,P){let C=y.value,I=b+"_"+S;if(P[I]===void 0)return typeof C=="number"||typeof C=="boolean"?P[I]=C:P[I]=C.clone(),!0;{let L=P[I];if(typeof C=="number"||typeof C=="boolean"){if(L!==C)return P[I]=C,!0}else if(L.equals(C)===!1)return L.copy(C),!0}return!1}function m(y){let b=y.uniforms,S=0,P=16;for(let I=0,L=b.length;I<L;I++){let x=Array.isArray(b[I])?b[I]:[b[I]];for(let M=0,R=x.length;M<R;M++){let O=x[M],F=Array.isArray(O.value)?O.value:[O.value];for(let V=0,Z=F.length;V<Z;V++){let X=F[V],ee=_(X),W=S%P,re=W%ee.boundary,ue=W+re;S+=re,ue!==0&&P-ue<ee.storage&&(S+=P-ue),O.__data=new Float32Array(ee.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=S,S+=ee.storage}}}let C=S%P;return C>0&&(S+=P-C),y.__size=S,y.__cache={},this}function _(y){let b={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(b.boundary=4,b.storage=4):y.isVector2?(b.boundary=8,b.storage=8):y.isVector3||y.isColor?(b.boundary=16,b.storage=12):y.isVector4?(b.boundary=16,b.storage=16):y.isMatrix3?(b.boundary=48,b.storage=48):y.isMatrix4?(b.boundary=64,b.storage=64):y.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",y),b}function g(y){let b=y.target;b.removeEventListener("dispose",g);let S=o.indexOf(b.__bindingPointIndex);o.splice(S,1),s.deleteBuffer(i[b.id]),delete i[b.id],delete r[b.id]}function f(){for(let y in i)s.deleteBuffer(i[y]);o=[],i={},r={}}return{bind:c,update:l,dispose:f}}var Er=class{constructor(e={}){let{canvas:t=tm(),context:n=null,depth:i=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=o;let m=new Uint32Array(4),_=new Int32Array(4),g=null,f=null,y=[],b=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=_t,this.toneMapping=Ai,this.toneMappingExposure=1;let S=this,P=!1,C=0,I=0,L=null,x=-1,M=null,R=new je,O=new je,F=null,V=new me(0),Z=0,X=t.width,ee=t.height,W=1,re=null,ue=null,Me=new je(0,0,X,ee),Fe=new je(0,0,X,ee),ot=!1,q=new wr,te=!1,ye=!1,oe=new Re,Ae=new Re,Le=new A,Be=new je,yt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ye=!1;function St(){return L===null?W:1}let U=n;function ln(E,N){return t.getContext(E,N)}try{let E={alpha:!0,depth:i,stencil:r,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Zc}`),t.addEventListener("webglcontextlost",K,!1),t.addEventListener("webglcontextrestored",he,!1),t.addEventListener("webglcontextcreationerror",le,!1),U===null){let N="webgl2";if(U=ln(N,E),U===null)throw ln(N)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let Ge,We,Ee,pt,we,T,w,B,Y,j,$,xe,ae,de,Ke,J,fe,Te,Ce,pe,Xe,Ue,ht,D;function ie(){Ge=new f_(U),Ge.init(),Ue=new Xv(U,Ge),We=new a_(U,Ge,e,Ue),Ee=new Vv(U,Ge),We.reverseDepthBuffer&&d&&Ee.buffers.depth.setReversed(!0),pt=new g_(U),we=new Cv,T=new Wv(U,Ge,Ee,we,We,Ue,pt),w=new c_(S),B=new d_(S),Y=new Sm(U),ht=new r_(U,Y),j=new p_(U,Y,pt,ht),$=new v_(U,j,Y,pt),Ce=new __(U,We,T),J=new l_(we),xe=new Rv(S,w,B,Ge,We,ht,J),ae=new Zv(S,we),de=new Pv,Ke=new Ov(Ge),Te=new s_(S,w,B,Ee,$,p,c),fe=new zv(S,$,We),D=new jv(U,pt,We,Ee),pe=new o_(U,Ge,pt),Xe=new m_(U,Ge,pt),pt.programs=xe.programs,S.capabilities=We,S.extensions=Ge,S.properties=we,S.renderLists=de,S.shadowMap=fe,S.state=Ee,S.info=pt}ie();let G=new Cc(S,U);this.xr=G,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let E=Ge.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){let E=Ge.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return W},this.setPixelRatio=function(E){E!==void 0&&(W=E,this.setSize(X,ee,!1))},this.getSize=function(E){return E.set(X,ee)},this.setSize=function(E,N,z=!0){if(G.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}X=E,ee=N,t.width=Math.floor(E*W),t.height=Math.floor(N*W),z===!0&&(t.style.width=E+"px",t.style.height=N+"px"),this.setViewport(0,0,E,N)},this.getDrawingBufferSize=function(E){return E.set(X*W,ee*W).floor()},this.setDrawingBufferSize=function(E,N,z){X=E,ee=N,W=z,t.width=Math.floor(E*z),t.height=Math.floor(N*z),this.setViewport(0,0,E,N)},this.getCurrentViewport=function(E){return E.copy(R)},this.getViewport=function(E){return E.copy(Me)},this.setViewport=function(E,N,z,H){E.isVector4?Me.set(E.x,E.y,E.z,E.w):Me.set(E,N,z,H),Ee.viewport(R.copy(Me).multiplyScalar(W).round())},this.getScissor=function(E){return E.copy(Fe)},this.setScissor=function(E,N,z,H){E.isVector4?Fe.set(E.x,E.y,E.z,E.w):Fe.set(E,N,z,H),Ee.scissor(O.copy(Fe).multiplyScalar(W).round())},this.getScissorTest=function(){return ot},this.setScissorTest=function(E){Ee.setScissorTest(ot=E)},this.setOpaqueSort=function(E){re=E},this.setTransparentSort=function(E){ue=E},this.getClearColor=function(E){return E.copy(Te.getClearColor())},this.setClearColor=function(){Te.setClearColor.apply(Te,arguments)},this.getClearAlpha=function(){return Te.getClearAlpha()},this.setClearAlpha=function(){Te.setClearAlpha.apply(Te,arguments)},this.clear=function(E=!0,N=!0,z=!0){let H=0;if(E){let k=!1;if(L!==null){let Q=L.texture.format;k=Q===rh||Q===sh||Q===ih}if(k){let Q=L.texture.type,ce=Q===ti||Q===Yi||Q===br||Q===Is||Q===eh||Q===th,ge=Te.getClearColor(),_e=Te.getClearAlpha(),Ie=ge.r,Ne=ge.g,ve=ge.b;ce?(m[0]=Ie,m[1]=Ne,m[2]=ve,m[3]=_e,U.clearBufferuiv(U.COLOR,0,m)):(_[0]=Ie,_[1]=Ne,_[2]=ve,_[3]=_e,U.clearBufferiv(U.COLOR,0,_))}else H|=U.COLOR_BUFFER_BIT}N&&(H|=U.DEPTH_BUFFER_BIT),z&&(H|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),U.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",K,!1),t.removeEventListener("webglcontextrestored",he,!1),t.removeEventListener("webglcontextcreationerror",le,!1),de.dispose(),Ke.dispose(),we.dispose(),w.dispose(),B.dispose(),$.dispose(),ht.dispose(),D.dispose(),xe.dispose(),G.dispose(),G.removeEventListener("sessionstart",ru),G.removeEventListener("sessionend",ou),ki.stop()};function K(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),P=!0}function he(){console.log("THREE.WebGLRenderer: Context Restored."),P=!1;let E=pt.autoReset,N=fe.enabled,z=fe.autoUpdate,H=fe.needsUpdate,k=fe.type;ie(),pt.autoReset=E,fe.enabled=N,fe.autoUpdate=z,fe.needsUpdate=H,fe.type=k}function le(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function De(E){let N=E.target;N.removeEventListener("dispose",De),bt(N)}function bt(E){Ot(E),we.remove(E)}function Ot(E){let N=we.get(E).programs;N!==void 0&&(N.forEach(function(z){xe.releaseProgram(z)}),E.isShaderMaterial&&xe.releaseShaderCache(E))}this.renderBufferDirect=function(E,N,z,H,k,Q){N===null&&(N=yt);let ce=k.isMesh&&k.matrixWorld.determinant()<0,ge=Yf(E,N,z,H,k);Ee.setMaterial(H,ce);let _e=z.index,Ie=1;if(H.wireframe===!0){if(_e=j.getWireframeAttribute(z),_e===void 0)return;Ie=2}let Ne=z.drawRange,ve=z.attributes.position,Ze=Ne.start*Ie,ut=(Ne.start+Ne.count)*Ie;Q!==null&&(Ze=Math.max(Ze,Q.start*Ie),ut=Math.min(ut,(Q.start+Q.count)*Ie)),_e!==null?(Ze=Math.max(Ze,0),ut=Math.min(ut,_e.count)):ve!=null&&(Ze=Math.max(Ze,0),ut=Math.min(ut,ve.count));let mt=ut-Ze;if(mt<0||mt===1/0)return;ht.setup(k,H,ge,z,_e);let Xt,Qe=pe;if(_e!==null&&(Xt=Y.get(_e),Qe=Xe,Qe.setIndex(Xt)),k.isMesh)H.wireframe===!0?(Ee.setLineWidth(H.wireframeLinewidth*St()),Qe.setMode(U.LINES)):Qe.setMode(U.TRIANGLES);else if(k.isLine){let be=H.linewidth;be===void 0&&(be=1),Ee.setLineWidth(be*St()),k.isLineSegments?Qe.setMode(U.LINES):k.isLineLoop?Qe.setMode(U.LINE_LOOP):Qe.setMode(U.LINE_STRIP)}else k.isPoints?Qe.setMode(U.POINTS):k.isSprite&&Qe.setMode(U.TRIANGLES);if(k.isBatchedMesh)if(k._multiDrawInstances!==null)Qe.renderMultiDrawInstances(k._multiDrawStarts,k._multiDrawCounts,k._multiDrawCount,k._multiDrawInstances);else if(Ge.get("WEBGL_multi_draw"))Qe.renderMultiDraw(k._multiDrawStarts,k._multiDrawCounts,k._multiDrawCount);else{let be=k._multiDrawStarts,Bn=k._multiDrawCounts,et=k._multiDrawCount,gn=_e?Y.get(_e).bytesPerElement:1,ts=we.get(H).currentProgram.getUniforms();for(let tn=0;tn<et;tn++)ts.setValue(U,"_gl_DrawID",tn),Qe.render(be[tn]/gn,Bn[tn])}else if(k.isInstancedMesh)Qe.renderInstances(Ze,mt,k.count);else if(z.isInstancedBufferGeometry){let be=z._maxInstanceCount!==void 0?z._maxInstanceCount:1/0,Bn=Math.min(z.instanceCount,be);Qe.renderInstances(Ze,mt,Bn)}else Qe.render(Ze,mt)};function nt(E,N,z){E.transparent===!0&&E.side===Kt&&E.forceSinglePass===!1?(E.side=jt,E.needsUpdate=!0,Yr(E,N,z),E.side=Nn,E.needsUpdate=!0,Yr(E,N,z),E.side=Kt):Yr(E,N,z)}this.compile=function(E,N,z=null){z===null&&(z=E),f=Ke.get(z),f.init(N),b.push(f),z.traverseVisible(function(k){k.isLight&&k.layers.test(N.layers)&&(f.pushLight(k),k.castShadow&&f.pushShadow(k))}),E!==z&&E.traverseVisible(function(k){k.isLight&&k.layers.test(N.layers)&&(f.pushLight(k),k.castShadow&&f.pushShadow(k))}),f.setupLights();let H=new Set;return E.traverse(function(k){if(!(k.isMesh||k.isPoints||k.isLine||k.isSprite))return;let Q=k.material;if(Q)if(Array.isArray(Q))for(let ce=0;ce<Q.length;ce++){let ge=Q[ce];nt(ge,z,k),H.add(ge)}else nt(Q,z,k),H.add(Q)}),b.pop(),f=null,H},this.compileAsync=function(E,N,z=null){let H=this.compile(E,N,z);return new Promise(k=>{function Q(){if(H.forEach(function(ce){we.get(ce).currentProgram.isReady()&&H.delete(ce)}),H.size===0){k(E);return}setTimeout(Q,10)}Ge.get("KHR_parallel_shader_compile")!==null?Q():setTimeout(Q,10)})};let mn=null;function Fn(E){mn&&mn(E)}function ru(){ki.stop()}function ou(){ki.start()}let ki=new uf;ki.setAnimationLoop(Fn),typeof self<"u"&&ki.setContext(self),this.setAnimationLoop=function(E){mn=E,G.setAnimationLoop(E),E===null?ki.stop():ki.start()},G.addEventListener("sessionstart",ru),G.addEventListener("sessionend",ou),this.render=function(E,N){if(N!==void 0&&N.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),G.enabled===!0&&G.isPresenting===!0&&(G.cameraAutoUpdate===!0&&G.updateCamera(N),N=G.getCamera()),E.isScene===!0&&E.onBeforeRender(S,E,N,L),f=Ke.get(E,b.length),f.init(N),b.push(f),Ae.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),q.setFromProjectionMatrix(Ae),ye=this.localClippingEnabled,te=J.init(this.clippingPlanes,ye),g=de.get(E,y.length),g.init(),y.push(g),G.enabled===!0&&G.isPresenting===!0){let Q=S.xr.getDepthSensingMesh();Q!==null&&Ha(Q,N,-1/0,S.sortObjects)}Ha(E,N,0,S.sortObjects),g.finish(),S.sortObjects===!0&&g.sort(re,ue),Ye=G.enabled===!1||G.isPresenting===!1||G.hasDepthSensing()===!1,Ye&&Te.addToRenderList(g,E),this.info.render.frame++,te===!0&&J.beginShadows();let z=f.state.shadowsArray;fe.render(z,E,N),te===!0&&J.endShadows(),this.info.autoReset===!0&&this.info.reset();let H=g.opaque,k=g.transmissive;if(f.setupLights(),N.isArrayCamera){let Q=N.cameras;if(k.length>0)for(let ce=0,ge=Q.length;ce<ge;ce++){let _e=Q[ce];lu(H,k,E,_e)}Ye&&Te.render(E);for(let ce=0,ge=Q.length;ce<ge;ce++){let _e=Q[ce];au(g,E,_e,_e.viewport)}}else k.length>0&&lu(H,k,E,N),Ye&&Te.render(E),au(g,E,N);L!==null&&(T.updateMultisampleRenderTarget(L),T.updateRenderTargetMipmap(L)),E.isScene===!0&&E.onAfterRender(S,E,N),ht.resetDefaultState(),x=-1,M=null,b.pop(),b.length>0?(f=b[b.length-1],te===!0&&J.setGlobalState(S.clippingPlanes,f.state.camera)):f=null,y.pop(),y.length>0?g=y[y.length-1]:g=null};function Ha(E,N,z,H){if(E.visible===!1)return;if(E.layers.test(N.layers)){if(E.isGroup)z=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(N);else if(E.isLight)f.pushLight(E),E.castShadow&&f.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||q.intersectsSprite(E)){H&&Be.setFromMatrixPosition(E.matrixWorld).applyMatrix4(Ae);let ce=$.update(E),ge=E.material;ge.visible&&g.push(E,ce,ge,z,Be.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||q.intersectsObject(E))){let ce=$.update(E),ge=E.material;if(H&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Be.copy(E.boundingSphere.center)):(ce.boundingSphere===null&&ce.computeBoundingSphere(),Be.copy(ce.boundingSphere.center)),Be.applyMatrix4(E.matrixWorld).applyMatrix4(Ae)),Array.isArray(ge)){let _e=ce.groups;for(let Ie=0,Ne=_e.length;Ie<Ne;Ie++){let ve=_e[Ie],Ze=ge[ve.materialIndex];Ze&&Ze.visible&&g.push(E,ce,Ze,z,Be.z,ve)}}else ge.visible&&g.push(E,ce,ge,z,Be.z,null)}}let Q=E.children;for(let ce=0,ge=Q.length;ce<ge;ce++)Ha(Q[ce],N,z,H)}function au(E,N,z,H){let k=E.opaque,Q=E.transmissive,ce=E.transparent;f.setupLightsView(z),te===!0&&J.setGlobalState(S.clippingPlanes,z),H&&Ee.viewport(R.copy(H)),k.length>0&&qr(k,N,z),Q.length>0&&qr(Q,N,z),ce.length>0&&qr(ce,N,z),Ee.buffers.depth.setTest(!0),Ee.buffers.depth.setMask(!0),Ee.buffers.color.setMask(!0),Ee.setPolygonOffset(!1)}function lu(E,N,z,H){if((z.isScene===!0?z.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[H.id]===void 0&&(f.state.transmissionRenderTarget[H.id]=new ii(1,1,{generateMipmaps:!0,type:Ge.has("EXT_color_buffer_half_float")||Ge.has("EXT_color_buffer_float")?Or:ti,minFilter:Dn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ve.workingColorSpace}));let Q=f.state.transmissionRenderTarget[H.id],ce=H.viewport||R;Q.setSize(ce.z,ce.w);let ge=S.getRenderTarget();S.setRenderTarget(Q),S.getClearColor(V),Z=S.getClearAlpha(),Z<1&&S.setClearColor(16777215,.5),S.clear(),Ye&&Te.render(z);let _e=S.toneMapping;S.toneMapping=Ai;let Ie=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),f.setupLightsView(H),te===!0&&J.setGlobalState(S.clippingPlanes,H),qr(E,z,H),T.updateMultisampleRenderTarget(Q),T.updateRenderTargetMipmap(Q),Ge.has("WEBGL_multisampled_render_to_texture")===!1){let Ne=!1;for(let ve=0,Ze=N.length;ve<Ze;ve++){let ut=N[ve],mt=ut.object,Xt=ut.geometry,Qe=ut.material,be=ut.group;if(Qe.side===Kt&&mt.layers.test(H.layers)){let Bn=Qe.side;Qe.side=jt,Qe.needsUpdate=!0,cu(mt,z,H,Xt,Qe,be),Qe.side=Bn,Qe.needsUpdate=!0,Ne=!0}}Ne===!0&&(T.updateMultisampleRenderTarget(Q),T.updateRenderTargetMipmap(Q))}S.setRenderTarget(ge),S.setClearColor(V,Z),Ie!==void 0&&(H.viewport=Ie),S.toneMapping=_e}function qr(E,N,z){let H=N.isScene===!0?N.overrideMaterial:null;for(let k=0,Q=E.length;k<Q;k++){let ce=E[k],ge=ce.object,_e=ce.geometry,Ie=H===null?ce.material:H,Ne=ce.group;ge.layers.test(z.layers)&&cu(ge,N,z,_e,Ie,Ne)}}function cu(E,N,z,H,k,Q){E.onBeforeRender(S,N,z,H,k,Q),E.modelViewMatrix.multiplyMatrices(z.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),k.onBeforeRender(S,N,z,H,E,Q),k.transparent===!0&&k.side===Kt&&k.forceSinglePass===!1?(k.side=jt,k.needsUpdate=!0,S.renderBufferDirect(z,N,H,k,E,Q),k.side=Nn,k.needsUpdate=!0,S.renderBufferDirect(z,N,H,k,E,Q),k.side=Kt):S.renderBufferDirect(z,N,H,k,E,Q),E.onAfterRender(S,N,z,H,k,Q)}function Yr(E,N,z){N.isScene!==!0&&(N=yt);let H=we.get(E),k=f.state.lights,Q=f.state.shadowsArray,ce=k.state.version,ge=xe.getParameters(E,k.state,Q,N,z),_e=xe.getProgramCacheKey(ge),Ie=H.programs;H.environment=E.isMeshStandardMaterial?N.environment:null,H.fog=N.fog,H.envMap=(E.isMeshStandardMaterial?B:w).get(E.envMap||H.environment),H.envMapRotation=H.environment!==null&&E.envMap===null?N.environmentRotation:E.envMapRotation,Ie===void 0&&(E.addEventListener("dispose",De),Ie=new Map,H.programs=Ie);let Ne=Ie.get(_e);if(Ne!==void 0){if(H.currentProgram===Ne&&H.lightsStateVersion===ce)return uu(E,ge),Ne}else ge.uniforms=xe.getUniforms(E),E.onBeforeCompile(ge,S),Ne=xe.acquireProgram(ge,_e),Ie.set(_e,Ne),H.uniforms=ge.uniforms;let ve=H.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(ve.clippingPlanes=J.uniform),uu(E,ge),H.needsLights=Zf(E),H.lightsStateVersion=ce,H.needsLights&&(ve.ambientLightColor.value=k.state.ambient,ve.lightProbe.value=k.state.probe,ve.directionalLights.value=k.state.directional,ve.directionalLightShadows.value=k.state.directionalShadow,ve.spotLights.value=k.state.spot,ve.spotLightShadows.value=k.state.spotShadow,ve.rectAreaLights.value=k.state.rectArea,ve.ltc_1.value=k.state.rectAreaLTC1,ve.ltc_2.value=k.state.rectAreaLTC2,ve.pointLights.value=k.state.point,ve.pointLightShadows.value=k.state.pointShadow,ve.hemisphereLights.value=k.state.hemi,ve.directionalShadowMap.value=k.state.directionalShadowMap,ve.directionalShadowMatrix.value=k.state.directionalShadowMatrix,ve.spotShadowMap.value=k.state.spotShadowMap,ve.spotLightMatrix.value=k.state.spotLightMatrix,ve.spotLightMap.value=k.state.spotLightMap,ve.pointShadowMap.value=k.state.pointShadowMap,ve.pointShadowMatrix.value=k.state.pointShadowMatrix),H.currentProgram=Ne,H.uniformsList=null,Ne}function hu(E){if(E.uniformsList===null){let N=E.currentProgram.getUniforms();E.uniformsList=Ts.seqWithValue(N.seq,E.uniforms)}return E.uniformsList}function uu(E,N){let z=we.get(E);z.outputColorSpace=N.outputColorSpace,z.batching=N.batching,z.batchingColor=N.batchingColor,z.instancing=N.instancing,z.instancingColor=N.instancingColor,z.instancingMorph=N.instancingMorph,z.skinning=N.skinning,z.morphTargets=N.morphTargets,z.morphNormals=N.morphNormals,z.morphColors=N.morphColors,z.morphTargetsCount=N.morphTargetsCount,z.numClippingPlanes=N.numClippingPlanes,z.numIntersection=N.numClipIntersection,z.vertexAlphas=N.vertexAlphas,z.vertexTangents=N.vertexTangents,z.toneMapping=N.toneMapping}function Yf(E,N,z,H,k){N.isScene!==!0&&(N=yt),T.resetTextureUnits();let Q=N.fog,ce=H.isMeshStandardMaterial?N.environment:null,ge=L===null?S.outputColorSpace:L.isXRRenderTarget===!0?L.texture.colorSpace:Ht,_e=(H.isMeshStandardMaterial?B:w).get(H.envMap||ce),Ie=H.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,Ne=!!z.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),ve=!!z.morphAttributes.position,Ze=!!z.morphAttributes.normal,ut=!!z.morphAttributes.color,mt=Ai;H.toneMapped&&(L===null||L.isXRRenderTarget===!0)&&(mt=S.toneMapping);let Xt=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,Qe=Xt!==void 0?Xt.length:0,be=we.get(H),Bn=f.state.lights;if(te===!0&&(ye===!0||E!==M)){let cn=E===M&&H.id===x;J.setState(H,E,cn)}let et=!1;H.version===be.__version?(be.needsLights&&be.lightsStateVersion!==Bn.state.version||be.outputColorSpace!==ge||k.isBatchedMesh&&be.batching===!1||!k.isBatchedMesh&&be.batching===!0||k.isBatchedMesh&&be.batchingColor===!0&&k.colorTexture===null||k.isBatchedMesh&&be.batchingColor===!1&&k.colorTexture!==null||k.isInstancedMesh&&be.instancing===!1||!k.isInstancedMesh&&be.instancing===!0||k.isSkinnedMesh&&be.skinning===!1||!k.isSkinnedMesh&&be.skinning===!0||k.isInstancedMesh&&be.instancingColor===!0&&k.instanceColor===null||k.isInstancedMesh&&be.instancingColor===!1&&k.instanceColor!==null||k.isInstancedMesh&&be.instancingMorph===!0&&k.morphTexture===null||k.isInstancedMesh&&be.instancingMorph===!1&&k.morphTexture!==null||be.envMap!==_e||H.fog===!0&&be.fog!==Q||be.numClippingPlanes!==void 0&&(be.numClippingPlanes!==J.numPlanes||be.numIntersection!==J.numIntersection)||be.vertexAlphas!==Ie||be.vertexTangents!==Ne||be.morphTargets!==ve||be.morphNormals!==Ze||be.morphColors!==ut||be.toneMapping!==mt||be.morphTargetsCount!==Qe)&&(et=!0):(et=!0,be.__version=H.version);let gn=be.currentProgram;et===!0&&(gn=Yr(H,N,k));let ts=!1,tn=!1,Ks=!1,gt=gn.getUniforms(),Cn=be.uniforms;if(Ee.useProgram(gn.program)&&(ts=!0,tn=!0,Ks=!0),H.id!==x&&(x=H.id,tn=!0),ts||M!==E){Ee.buffers.depth.getReversed()?(oe.copy(E.projectionMatrix),im(oe),sm(oe),gt.setValue(U,"projectionMatrix",oe)):gt.setValue(U,"projectionMatrix",E.projectionMatrix),gt.setValue(U,"viewMatrix",E.matrixWorldInverse);let ui=gt.map.cameraPosition;ui!==void 0&&ui.setValue(U,Le.setFromMatrixPosition(E.matrixWorld)),We.logarithmicDepthBuffer&&gt.setValue(U,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&gt.setValue(U,"isOrthographic",E.isOrthographicCamera===!0),M!==E&&(M=E,tn=!0,Ks=!0)}if(k.isSkinnedMesh){gt.setOptional(U,k,"bindMatrix"),gt.setOptional(U,k,"bindMatrixInverse");let cn=k.skeleton;cn&&(cn.boneTexture===null&&cn.computeBoneTexture(),gt.setValue(U,"boneTexture",cn.boneTexture,T))}k.isBatchedMesh&&(gt.setOptional(U,k,"batchingTexture"),gt.setValue(U,"batchingTexture",k._matricesTexture,T),gt.setOptional(U,k,"batchingIdTexture"),gt.setValue(U,"batchingIdTexture",k._indirectTexture,T),gt.setOptional(U,k,"batchingColorTexture"),k._colorsTexture!==null&&gt.setValue(U,"batchingColorTexture",k._colorsTexture,T));let Zs=z.morphAttributes;if((Zs.position!==void 0||Zs.normal!==void 0||Zs.color!==void 0)&&Ce.update(k,z,gn),(tn||be.receiveShadow!==k.receiveShadow)&&(be.receiveShadow=k.receiveShadow,gt.setValue(U,"receiveShadow",k.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(Cn.envMap.value=_e,Cn.flipEnvMap.value=_e.isCubeTexture&&_e.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&N.environment!==null&&(Cn.envMapIntensity.value=N.environmentIntensity),tn&&(gt.setValue(U,"toneMappingExposure",S.toneMappingExposure),be.needsLights&&Kf(Cn,Ks),Q&&H.fog===!0&&ae.refreshFogUniforms(Cn,Q),ae.refreshMaterialUniforms(Cn,H,W,ee,f.state.transmissionRenderTarget[E.id]),Ts.upload(U,hu(be),Cn,T)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Ts.upload(U,hu(be),Cn,T),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&gt.setValue(U,"center",k.center),gt.setValue(U,"modelViewMatrix",k.modelViewMatrix),gt.setValue(U,"normalMatrix",k.normalMatrix),gt.setValue(U,"modelMatrix",k.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){let cn=H.uniformsGroups;for(let ui=0,di=cn.length;ui<di;ui++){let du=cn[ui];D.update(du,gn),D.bind(du,gn)}}return gn}function Kf(E,N){E.ambientLightColor.needsUpdate=N,E.lightProbe.needsUpdate=N,E.directionalLights.needsUpdate=N,E.directionalLightShadows.needsUpdate=N,E.pointLights.needsUpdate=N,E.pointLightShadows.needsUpdate=N,E.spotLights.needsUpdate=N,E.spotLightShadows.needsUpdate=N,E.rectAreaLights.needsUpdate=N,E.hemisphereLights.needsUpdate=N}function Zf(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return C},this.getActiveMipmapLevel=function(){return I},this.getRenderTarget=function(){return L},this.setRenderTargetTextures=function(E,N,z){we.get(E.texture).__webglTexture=N,we.get(E.depthTexture).__webglTexture=z;let H=we.get(E);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=z===void 0,H.__autoAllocateDepthBuffer||Ge.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(E,N){let z=we.get(E);z.__webglFramebuffer=N,z.__useDefaultFramebuffer=N===void 0},this.setRenderTarget=function(E,N=0,z=0){L=E,C=N,I=z;let H=!0,k=null,Q=!1,ce=!1;if(E){let _e=we.get(E);if(_e.__useDefaultFramebuffer!==void 0)Ee.bindFramebuffer(U.FRAMEBUFFER,null),H=!1;else if(_e.__webglFramebuffer===void 0)T.setupRenderTarget(E);else if(_e.__hasExternalTextures)T.rebindTextures(E,we.get(E.texture).__webglTexture,we.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let ve=E.depthTexture;if(_e.__boundDepthTexture!==ve){if(ve!==null&&we.has(ve)&&(E.width!==ve.image.width||E.height!==ve.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");T.setupDepthRenderbuffer(E)}}let Ie=E.texture;(Ie.isData3DTexture||Ie.isDataArrayTexture||Ie.isCompressedArrayTexture)&&(ce=!0);let Ne=we.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Ne[N])?k=Ne[N][z]:k=Ne[N],Q=!0):E.samples>0&&T.useMultisampledRTT(E)===!1?k=we.get(E).__webglMultisampledFramebuffer:Array.isArray(Ne)?k=Ne[z]:k=Ne,R.copy(E.viewport),O.copy(E.scissor),F=E.scissorTest}else R.copy(Me).multiplyScalar(W).floor(),O.copy(Fe).multiplyScalar(W).floor(),F=ot;if(Ee.bindFramebuffer(U.FRAMEBUFFER,k)&&H&&Ee.drawBuffers(E,k),Ee.viewport(R),Ee.scissor(O),Ee.setScissorTest(F),Q){let _e=we.get(E.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+N,_e.__webglTexture,z)}else if(ce){let _e=we.get(E.texture),Ie=N||0;U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,_e.__webglTexture,z||0,Ie)}x=-1},this.readRenderTargetPixels=function(E,N,z,H,k,Q,ce){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ge=we.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ce!==void 0&&(ge=ge[ce]),ge){Ee.bindFramebuffer(U.FRAMEBUFFER,ge);try{let _e=E.texture,Ie=_e.format,Ne=_e.type;if(!We.textureFormatReadable(Ie)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!We.textureTypeReadable(Ne)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=E.width-H&&z>=0&&z<=E.height-k&&U.readPixels(N,z,H,k,Ue.convert(Ie),Ue.convert(Ne),Q)}finally{let _e=L!==null?we.get(L).__webglFramebuffer:null;Ee.bindFramebuffer(U.FRAMEBUFFER,_e)}}},this.readRenderTargetPixelsAsync=async function(E,N,z,H,k,Q,ce){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ge=we.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ce!==void 0&&(ge=ge[ce]),ge){let _e=E.texture,Ie=_e.format,Ne=_e.type;if(!We.textureFormatReadable(Ie))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!We.textureTypeReadable(Ne))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(N>=0&&N<=E.width-H&&z>=0&&z<=E.height-k){Ee.bindFramebuffer(U.FRAMEBUFFER,ge);let ve=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,ve),U.bufferData(U.PIXEL_PACK_BUFFER,Q.byteLength,U.STREAM_READ),U.readPixels(N,z,H,k,Ue.convert(Ie),Ue.convert(Ne),0);let Ze=L!==null?we.get(L).__webglFramebuffer:null;Ee.bindFramebuffer(U.FRAMEBUFFER,Ze);let ut=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await nm(U,ut,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,ve),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,Q),U.deleteBuffer(ve),U.deleteSync(ut),Q}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(E,N=null,z=0){E.isTexture!==!0&&(fr("WebGLRenderer: copyFramebufferToTexture function signature has changed."),N=arguments[0]||null,E=arguments[1]);let H=Math.pow(2,-z),k=Math.floor(E.image.width*H),Q=Math.floor(E.image.height*H),ce=N!==null?N.x:0,ge=N!==null?N.y:0;T.setTexture2D(E,0),U.copyTexSubImage2D(U.TEXTURE_2D,z,0,0,ce,ge,k,Q),Ee.unbindTexture()},this.copyTextureToTexture=function(E,N,z=null,H=null,k=0){E.isTexture!==!0&&(fr("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,E=arguments[1],N=arguments[2],k=arguments[3]||0,z=null);let Q,ce,ge,_e,Ie,Ne,ve,Ze,ut,mt=E.isCompressedTexture?E.mipmaps[k]:E.image;z!==null?(Q=z.max.x-z.min.x,ce=z.max.y-z.min.y,ge=z.isBox3?z.max.z-z.min.z:1,_e=z.min.x,Ie=z.min.y,Ne=z.isBox3?z.min.z:0):(Q=mt.width,ce=mt.height,ge=mt.depth||1,_e=0,Ie=0,Ne=0),H!==null?(ve=H.x,Ze=H.y,ut=H.z):(ve=0,Ze=0,ut=0);let Xt=Ue.convert(N.format),Qe=Ue.convert(N.type),be;N.isData3DTexture?(T.setTexture3D(N,0),be=U.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(T.setTexture2DArray(N,0),be=U.TEXTURE_2D_ARRAY):(T.setTexture2D(N,0),be=U.TEXTURE_2D),U.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,N.flipY),U.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),U.pixelStorei(U.UNPACK_ALIGNMENT,N.unpackAlignment);let Bn=U.getParameter(U.UNPACK_ROW_LENGTH),et=U.getParameter(U.UNPACK_IMAGE_HEIGHT),gn=U.getParameter(U.UNPACK_SKIP_PIXELS),ts=U.getParameter(U.UNPACK_SKIP_ROWS),tn=U.getParameter(U.UNPACK_SKIP_IMAGES);U.pixelStorei(U.UNPACK_ROW_LENGTH,mt.width),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,mt.height),U.pixelStorei(U.UNPACK_SKIP_PIXELS,_e),U.pixelStorei(U.UNPACK_SKIP_ROWS,Ie),U.pixelStorei(U.UNPACK_SKIP_IMAGES,Ne);let Ks=E.isDataArrayTexture||E.isData3DTexture,gt=N.isDataArrayTexture||N.isData3DTexture;if(E.isRenderTargetTexture||E.isDepthTexture){let Cn=we.get(E),Zs=we.get(N),cn=we.get(Cn.__renderTarget),ui=we.get(Zs.__renderTarget);Ee.bindFramebuffer(U.READ_FRAMEBUFFER,cn.__webglFramebuffer),Ee.bindFramebuffer(U.DRAW_FRAMEBUFFER,ui.__webglFramebuffer);for(let di=0;di<ge;di++)Ks&&U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,we.get(E).__webglTexture,k,Ne+di),E.isDepthTexture?(gt&&U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,we.get(N).__webglTexture,k,ut+di),U.blitFramebuffer(_e,Ie,Q,ce,ve,Ze,Q,ce,U.DEPTH_BUFFER_BIT,U.NEAREST)):gt?U.copyTexSubImage3D(be,k,ve,Ze,ut+di,_e,Ie,Q,ce):U.copyTexSubImage2D(be,k,ve,Ze,ut+di,_e,Ie,Q,ce);Ee.bindFramebuffer(U.READ_FRAMEBUFFER,null),Ee.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else gt?E.isDataTexture||E.isData3DTexture?U.texSubImage3D(be,k,ve,Ze,ut,Q,ce,ge,Xt,Qe,mt.data):N.isCompressedArrayTexture?U.compressedTexSubImage3D(be,k,ve,Ze,ut,Q,ce,ge,Xt,mt.data):U.texSubImage3D(be,k,ve,Ze,ut,Q,ce,ge,Xt,Qe,mt):E.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,k,ve,Ze,Q,ce,Xt,Qe,mt.data):E.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,k,ve,Ze,mt.width,mt.height,Xt,mt.data):U.texSubImage2D(U.TEXTURE_2D,k,ve,Ze,Q,ce,Xt,Qe,mt);U.pixelStorei(U.UNPACK_ROW_LENGTH,Bn),U.pixelStorei(U.UNPACK_IMAGE_HEIGHT,et),U.pixelStorei(U.UNPACK_SKIP_PIXELS,gn),U.pixelStorei(U.UNPACK_SKIP_ROWS,ts),U.pixelStorei(U.UNPACK_SKIP_IMAGES,tn),k===0&&N.generateMipmaps&&U.generateMipmap(be),Ee.unbindTexture()},this.copyTextureToTexture3D=function(E,N,z=null,H=null,k=0){return E.isTexture!==!0&&(fr("WebGLRenderer: copyTextureToTexture3D function signature has changed."),z=arguments[0]||null,H=arguments[1]||null,E=arguments[2],N=arguments[3],k=arguments[4]||0),fr('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(E,N,z,H,k)},this.initRenderTarget=function(E){we.get(E).__webglFramebuffer===void 0&&T.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?T.setTextureCube(E,0):E.isData3DTexture?T.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?T.setTexture2DArray(E,0):T.setTexture2D(E,0),Ee.unbindTexture()},this.resetState=function(){C=0,I=0,L=null,Ee.reset(),ht.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Jn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorspace=Ve._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ve._getUnpackColorSpace()}};var Tr=class extends lt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Sn,this.environmentIntensity=1,this.environmentRotation=new Sn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},Ar=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=fc,this.updateRanges=[],this.version=0,this.uuid=Mn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Mn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Mn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Vt=new A,Rr=class s{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Vt.fromBufferAttribute(this,t),Vt.applyMatrix4(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Vt.fromBufferAttribute(this,t),Vt.applyNormalMatrix(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Vt.fromBufferAttribute(this,t),Vt.transformDirection(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=xn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=it(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=it(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=it(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=it(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=it(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=xn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=xn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=xn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=xn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=it(t,this.array),n=it(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=it(t,this.array),n=it(n,this.array),i=it(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=it(t,this.array),n=it(n,this.array),i=it(i,this.array),r=it(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new Et(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new s(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}};var Ad=new A,Rd=new je,Cd=new je,Jv=new A,Id=new Re,So=new A,bl=new on,Pd=new Re,Ml=new si,Ko=class extends $e{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Iu,this.bindMatrix=new Re,this.bindMatrixInverse=new Re,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new Ut),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,So),this.boundingBox.expandByPoint(So)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new on),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,So),this.boundingSphere.expandByPoint(So)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),bl.copy(this.boundingSphere),bl.applyMatrix4(i),e.ray.intersectsSphere(bl)!==!1&&(Pd.copy(i).invert(),Ml.copy(e.ray).applyMatrix4(Pd),!(this.boundingBox!==null&&Ml.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,Ml)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new je,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);let r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Iu?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Ap?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,i=this.geometry;Rd.fromBufferAttribute(i.attributes.skinIndex,e),Cd.fromBufferAttribute(i.attributes.skinWeight,e),Ad.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let r=0;r<4;r++){let o=Cd.getComponent(r);if(o!==0){let a=Rd.getComponent(r);Id.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(Jv.copy(Ad).applyMatrix4(Id),o)}}return t.applyMatrix4(this.bindMatrixInverse)}},Cr=class extends lt{constructor(){super(),this.isBone=!0,this.type="Bone"}},Zo=class extends kt{constructor(e=null,t=1,n=1,i,r,o,a,c,l=zt,h=zt,u,d){super(null,o,a,c,l,h,i,r,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Ld=new Re,Qv=new Re,jo=class s{constructor(e=[],t=[]){this.uuid=Mn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Re)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new Re;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let r=0,o=e.length;r<o;r++){let a=e[r]?e[r].matrixWorld:Qv;Ld.multiplyMatrices(a,t[r]),Ld.toArray(n,r*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new s(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new Zo(t,e,e,un,bn);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){let r=e.bones[n],o=t[r];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",r),o=new Cr),this.bones.push(o),this.boneInverses.push(new Re().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let i=0,r=t.length;i<r;i++){let o=t[i];e.bones.push(o.uuid);let a=n[i];e.boneInverses.push(a.toArray())}return e}},Ki=class extends Et{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},ys=new Re,Dd=new Re,wo=[],Nd=new Ut,ey=new Re,cr=new $e,hr=new on,Jo=class extends $e{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Ki(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,ey)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Ut),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ys),Nd.copy(e.boundingBox).applyMatrix4(ys),this.boundingBox.union(Nd)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new on),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ys),hr.copy(e.boundingSphere).applyMatrix4(ys),this.boundingSphere.union(hr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,r=n.length+1,o=e*r+1;for(let a=0;a<n.length;a++)n[a]=i[o+a]}raycast(e,t){let n=this.matrixWorld,i=this.count;if(cr.geometry=this.geometry,cr.material=this.material,cr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),hr.copy(this.boundingSphere),hr.applyMatrix4(n),e.ray.intersectsSphere(hr)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,ys),Dd.multiplyMatrices(n,ys),cr.matrixWorld=Dd,cr.raycast(e,wo);for(let o=0,a=wo.length;o<a;o++){let c=wo[o];c.instanceId=r,c.object=this,t.push(c)}wo.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Ki(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){let n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Zo(new Float32Array(i*this.count),i,this.count,nh,bn));let r=this.morphTexture.source.data.data,o=0;for(let l=0;l<n.length;l++)o+=n[l];let a=this.geometry.morphTargetsRelative?1:1-o,c=i*e;r[c]=a,r.set(n,c+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}};var dn=class extends Qt{static get type(){return"LineBasicMaterial"}constructor(e){super(),this.isLineBasicMaterial=!0,this.color=new me(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Qo=new A,ea=new A,kd=new Re,ur=new si,Eo=new on,Sl=new A,Ud=new A,ri=class extends lt{constructor(e=new xt,t=new dn){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)Qo.fromBufferAttribute(t,i-1),ea.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Qo.distanceTo(ea);e.setAttribute("lineDistance",new tt(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Eo.copy(n.boundingSphere),Eo.applyMatrix4(i),Eo.radius+=r,e.ray.intersectsSphere(Eo)===!1)return;kd.copy(i).invert(),ur.copy(e.ray).applyMatrix4(kd);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=this.isLineSegments?2:1,h=n.index,d=n.attributes.position;if(h!==null){let p=Math.max(0,o.start),m=Math.min(h.count,o.start+o.count);for(let _=p,g=m-1;_<g;_+=l){let f=h.getX(_),y=h.getX(_+1),b=To(this,e,ur,c,f,y);b&&t.push(b)}if(this.isLineLoop){let _=h.getX(m-1),g=h.getX(p),f=To(this,e,ur,c,_,g);f&&t.push(f)}}else{let p=Math.max(0,o.start),m=Math.min(d.count,o.start+o.count);for(let _=p,g=m-1;_<g;_+=l){let f=To(this,e,ur,c,_,_+1);f&&t.push(f)}if(this.isLineLoop){let _=To(this,e,ur,c,m-1,p);_&&t.push(_)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function To(s,e,t,n,i,r){let o=s.geometry.attributes.position;if(Qo.fromBufferAttribute(o,i),ea.fromBufferAttribute(o,r),t.distanceSqToSegment(Qo,ea,Sl,Ud)>n)return;Sl.applyMatrix4(s.matrixWorld);let c=e.ray.origin.distanceTo(Sl);if(!(c<e.near||c>e.far))return{distance:c,point:Ud.clone().applyMatrix4(s.matrixWorld),index:i,face:null,faceIndex:null,barycoord:null,object:s}}var Od=new A,Fd=new A,Un=class extends ri{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)Od.fromBufferAttribute(t,i),Fd.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+Od.distanceTo(Fd);e.setAttribute("lineDistance",new tt(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},ta=class extends ri{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},Ir=class extends Qt{static get type(){return"PointsMaterial"}constructor(e){super(),this.isPointsMaterial=!0,this.color=new me(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Bd=new Re,Ic=new si,Ao=new on,Ro=new A,na=class extends lt{constructor(e=new xt,t=new Ir){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ao.copy(n.boundingSphere),Ao.applyMatrix4(i),Ao.radius+=r,e.ray.intersectsSphere(Ao)===!1)return;Bd.copy(i).invert(),Ic.copy(e.ray).applyMatrix4(Bd);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=n.index,u=n.attributes.position;if(l!==null){let d=Math.max(0,o.start),p=Math.min(l.count,o.start+o.count);for(let m=d,_=p;m<_;m++){let g=l.getX(m);Ro.fromBufferAttribute(u,g),zd(Ro,g,c,i,e,t,this)}}else{let d=Math.max(0,o.start),p=Math.min(u.count,o.start+o.count);for(let m=d,_=p;m<_;m++)Ro.fromBufferAttribute(u,m),zd(Ro,m,c,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function zd(s,e,t,n,i,r,o){let a=Ic.distanceSqToPoint(s);if(a<t){let c=new A;Ic.closestPointToPoint(s,c),c.applyMatrix4(n);let l=i.ray.origin.distanceTo(c);if(l<i.near||l>i.far)return;r.push({distance:l,distanceToRay:Math.sqrt(a),point:c,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}var Zi=class extends kt{constructor(e,t,n,i,r,o,a,c,l){super(e,t,n,i,r,o,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}},En=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){let n=this.getLengths(),i=0,r=n.length,o;t?o=t:o=e*n[r-1];let a=0,c=r-1,l;for(;a<=c;)if(i=Math.floor(a+(c-a)/2),l=n[i]-o,l<0)a=i+1;else if(l>0)c=i-1;else{c=i;break}if(i=c,n[i]===o)return i/(r-1);let h=n[i],d=n[i+1]-h,p=(o-h)/d;return(i+p)/(r-1)}getTangent(e,t){let i=e-1e-4,r=e+1e-4;i<0&&(i=0),r>1&&(r=1);let o=this.getPoint(i),a=this.getPoint(r),c=t||(o.isVector2?new se:new A);return c.copy(a).sub(o).normalize(),c}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){let n=new A,i=[],r=[],o=[],a=new A,c=new Re;for(let p=0;p<=e;p++){let m=p/e;i[p]=this.getTangentAt(m,new A)}r[0]=new A,o[0]=new A;let l=Number.MAX_VALUE,h=Math.abs(i[0].x),u=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=l&&(l=h,n.set(1,0,0)),u<=l&&(l=u,n.set(0,1,0)),d<=l&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],a),o[0].crossVectors(i[0],r[0]);for(let p=1;p<=e;p++){if(r[p]=r[p-1].clone(),o[p]=o[p-1].clone(),a.crossVectors(i[p-1],i[p]),a.length()>Number.EPSILON){a.normalize();let m=Math.acos(Ct(i[p-1].dot(i[p]),-1,1));r[p].applyMatrix4(c.makeRotationAxis(a,m))}o[p].crossVectors(i[p],r[p])}if(t===!0){let p=Math.acos(Ct(r[0].dot(r[e]),-1,1));p/=e,i[0].dot(a.crossVectors(r[0],r[e]))>0&&(p=-p);for(let m=1;m<=e;m++)r[m].applyMatrix4(c.makeRotationAxis(i[m],p*m)),o[m].crossVectors(i[m],r[m])}return{tangents:i,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},ia=class extends En{constructor(e=0,t=0,n=1,i=1,r=0,o=Math.PI*2,a=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=c}getPoint(e,t=new se){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(o?r=0:r=i),this.aClockwise===!0&&!o&&(r===i?r=-i:r=r-i);let a=this.aStartAngle+e*r,c=this.aX+this.xRadius*Math.cos(a),l=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=c-this.aX,p=l-this.aY;c=d*h-p*u+this.aX,l=d*u+p*h+this.aY}return n.set(c,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},Pc=class extends ia{constructor(e,t,n,i,r,o){super(e,t,n,n,i,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function ch(){let s=0,e=0,t=0,n=0;function i(r,o,a,c){s=r,e=a,t=-3*r+3*o-2*a-c,n=2*r-2*o+a+c}return{initCatmullRom:function(r,o,a,c,l){i(o,a,l*(a-r),l*(c-o))},initNonuniformCatmullRom:function(r,o,a,c,l,h,u){let d=(o-r)/l-(a-r)/(l+h)+(a-o)/h,p=(a-o)/h-(c-o)/(h+u)+(c-a)/u;d*=h,p*=h,i(o,a,d,p)},calc:function(r){let o=r*r,a=o*r;return s+e*r+t*o+n*a}}}var Co=new A,wl=new ch,El=new ch,Tl=new ch,Lc=class extends En{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new A){let n=t,i=this.points,r=i.length,o=(r-(this.closed?0:1))*e,a=Math.floor(o),c=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:c===0&&a===r-1&&(a=r-2,c=1);let l,h;this.closed||a>0?l=i[(a-1)%r]:(Co.subVectors(i[0],i[1]).add(i[0]),l=Co);let u=i[a%r],d=i[(a+1)%r];if(this.closed||a+2<r?h=i[(a+2)%r]:(Co.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=Co),this.curveType==="centripetal"||this.curveType==="chordal"){let p=this.curveType==="chordal"?.5:.25,m=Math.pow(l.distanceToSquared(u),p),_=Math.pow(u.distanceToSquared(d),p),g=Math.pow(d.distanceToSquared(h),p);_<1e-4&&(_=1),m<1e-4&&(m=_),g<1e-4&&(g=_),wl.initNonuniformCatmullRom(l.x,u.x,d.x,h.x,m,_,g),El.initNonuniformCatmullRom(l.y,u.y,d.y,h.y,m,_,g),Tl.initNonuniformCatmullRom(l.z,u.z,d.z,h.z,m,_,g)}else this.curveType==="catmullrom"&&(wl.initCatmullRom(l.x,u.x,d.x,h.x,this.tension),El.initCatmullRom(l.y,u.y,d.y,h.y,this.tension),Tl.initCatmullRom(l.z,u.z,d.z,h.z,this.tension));return n.set(wl.calc(c),El.calc(c),Tl.calc(c)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new A().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Hd(s,e,t,n,i){let r=(n-e)*.5,o=(i-t)*.5,a=s*s,c=s*a;return(2*t-2*n+r+o)*c+(-3*t+3*n-2*r-o)*a+r*s+t}function ty(s,e){let t=1-s;return t*t*e}function ny(s,e){return 2*(1-s)*s*e}function iy(s,e){return s*s*e}function vr(s,e,t,n){return ty(s,e)+ny(s,t)+iy(s,n)}function sy(s,e){let t=1-s;return t*t*t*e}function ry(s,e){let t=1-s;return 3*t*t*s*e}function oy(s,e){return 3*(1-s)*s*s*e}function ay(s,e){return s*s*s*e}function yr(s,e,t,n,i){return sy(s,e)+ry(s,t)+oy(s,n)+ay(s,i)}var Dc=class extends En{constructor(e=new se,t=new se,n=new se,i=new se){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new se){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(yr(e,i.x,r.x,o.x,a.x),yr(e,i.y,r.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Pr=class extends En{constructor(e=new A,t=new A,n=new A,i=new A){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new A){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(yr(e,i.x,r.x,o.x,a.x),yr(e,i.y,r.y,o.y,a.y),yr(e,i.z,r.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Nc=class extends En{constructor(e=new se,t=new se){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new se){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new se){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},kc=class extends En{constructor(e=new A,t=new A){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new A){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new A){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Uc=class extends En{constructor(e=new se,t=new se,n=new se){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new se){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(vr(e,i.x,r.x,o.x),vr(e,i.y,r.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},sa=class extends En{constructor(e=new A,t=new A,n=new A){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new A){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(vr(e,i.x,r.x,o.x),vr(e,i.y,r.y,o.y),vr(e,i.z,r.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Oc=class extends En{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new se){let n=t,i=this.points,r=(i.length-1)*e,o=Math.floor(r),a=r-o,c=i[o===0?o:o-1],l=i[o],h=i[o>i.length-2?i.length-1:o+1],u=i[o>i.length-3?i.length-1:o+2];return n.set(Hd(a,c.x,l.x,h.x,u.x),Hd(a,c.y,l.y,h.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new se().fromArray(i))}return this}},ly=Object.freeze({__proto__:null,ArcCurve:Pc,CatmullRomCurve3:Lc,CubicBezierCurve:Dc,CubicBezierCurve3:Pr,EllipseCurve:ia,LineCurve:Nc,LineCurve3:kc,QuadraticBezierCurve:Uc,QuadraticBezierCurve3:sa,SplineCurve:Oc});var ra=class s extends xt{constructor(e=1,t=1,n=1,i=32,r=1,o=!1,a=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:c};let l=this;i=Math.floor(i),r=Math.floor(r);let h=[],u=[],d=[],p=[],m=0,_=[],g=n/2,f=0;y(),o===!1&&(e>0&&b(!0),t>0&&b(!1)),this.setIndex(h),this.setAttribute("position",new tt(u,3)),this.setAttribute("normal",new tt(d,3)),this.setAttribute("uv",new tt(p,2));function y(){let S=new A,P=new A,C=0,I=(t-e)/n;for(let L=0;L<=r;L++){let x=[],M=L/r,R=M*(t-e)+e;for(let O=0;O<=i;O++){let F=O/i,V=F*c+a,Z=Math.sin(V),X=Math.cos(V);P.x=R*Z,P.y=-M*n+g,P.z=R*X,u.push(P.x,P.y,P.z),S.set(Z,I,X).normalize(),d.push(S.x,S.y,S.z),p.push(F,1-M),x.push(m++)}_.push(x)}for(let L=0;L<i;L++)for(let x=0;x<r;x++){let M=_[x][L],R=_[x+1][L],O=_[x+1][L+1],F=_[x][L+1];(e>0||x!==0)&&(h.push(M,R,F),C+=3),(t>0||x!==r-1)&&(h.push(R,O,F),C+=3)}l.addGroup(f,C,0),f+=C}function b(S){let P=m,C=new se,I=new A,L=0,x=S===!0?e:t,M=S===!0?1:-1;for(let O=1;O<=i;O++)u.push(0,g*M,0),d.push(0,M,0),p.push(.5,.5),m++;let R=m;for(let O=0;O<=i;O++){let V=O/i*c+a,Z=Math.cos(V),X=Math.sin(V);I.x=x*X,I.y=g*M,I.z=x*Z,u.push(I.x,I.y,I.z),d.push(0,M,0),C.x=Z*.5+.5,C.y=X*.5*M+.5,p.push(C.x,C.y),m++}for(let O=0;O<i;O++){let F=P+O,V=R+O;S===!0?h.push(V,V+1,F):h.push(V+1,V,F),L+=3}l.addGroup(f,L,S===!0?1:2),f+=L}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var Io=new A,Po=new A,Al=new A,Lo=new wi,Fs=class extends xt{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){let i=Math.pow(10,4),r=Math.cos(ws*t),o=e.getIndex(),a=e.getAttribute("position"),c=o?o.count:a.count,l=[0,0,0],h=["a","b","c"],u=new Array(3),d={},p=[];for(let m=0;m<c;m+=3){o?(l[0]=o.getX(m),l[1]=o.getX(m+1),l[2]=o.getX(m+2)):(l[0]=m,l[1]=m+1,l[2]=m+2);let{a:_,b:g,c:f}=Lo;if(_.fromBufferAttribute(a,l[0]),g.fromBufferAttribute(a,l[1]),f.fromBufferAttribute(a,l[2]),Lo.getNormal(Al),u[0]=`${Math.round(_.x*i)},${Math.round(_.y*i)},${Math.round(_.z*i)}`,u[1]=`${Math.round(g.x*i)},${Math.round(g.y*i)},${Math.round(g.z*i)}`,u[2]=`${Math.round(f.x*i)},${Math.round(f.y*i)},${Math.round(f.z*i)}`,!(u[0]===u[1]||u[1]===u[2]||u[2]===u[0]))for(let y=0;y<3;y++){let b=(y+1)%3,S=u[y],P=u[b],C=Lo[h[y]],I=Lo[h[b]],L=`${S}_${P}`,x=`${P}_${S}`;x in d&&d[x]?(Al.dot(d[x].normal)<=r&&(p.push(C.x,C.y,C.z),p.push(I.x,I.y,I.z)),d[x]=null):L in d||(d[L]={index0:l[y],index1:l[b],normal:Al.clone()})}}for(let m in d)if(d[m]){let{index0:_,index1:g}=d[m];Io.fromBufferAttribute(a,_),Po.fromBufferAttribute(a,g),p.push(Io.x,Io.y,Io.z),p.push(Po.x,Po.y,Po.z)}this.setAttribute("position",new tt(p,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}};var oa=class s extends xt{constructor(e=.5,t=1,n=32,i=1,r=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:r,thetaLength:o},n=Math.max(3,n),i=Math.max(1,i);let a=[],c=[],l=[],h=[],u=e,d=(t-e)/i,p=new A,m=new se;for(let _=0;_<=i;_++){for(let g=0;g<=n;g++){let f=r+g/n*o;p.x=u*Math.cos(f),p.y=u*Math.sin(f),c.push(p.x,p.y,p.z),l.push(0,0,1),m.x=(p.x/t+1)/2,m.y=(p.y/t+1)/2,h.push(m.x,m.y)}u+=d}for(let _=0;_<i;_++){let g=_*(n+1);for(let f=0;f<n;f++){let y=f+g,b=y,S=y+n+1,P=y+n+2,C=y+1;a.push(b,S,C),a.push(S,P,C)}}this.setIndex(a),this.setAttribute("position",new tt(c,3)),this.setAttribute("normal",new tt(l,3)),this.setAttribute("uv",new tt(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}};var ji=class s extends xt{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let c=Math.min(o+a,Math.PI),l=0,h=[],u=new A,d=new A,p=[],m=[],_=[],g=[];for(let f=0;f<=n;f++){let y=[],b=f/n,S=0;f===0&&o===0?S=.5/t:f===n&&c===Math.PI&&(S=-.5/t);for(let P=0;P<=t;P++){let C=P/t;u.x=-e*Math.cos(i+C*r)*Math.sin(o+b*a),u.y=e*Math.cos(o+b*a),u.z=e*Math.sin(i+C*r)*Math.sin(o+b*a),m.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),g.push(C+S,1-b),y.push(l++)}h.push(y)}for(let f=0;f<n;f++)for(let y=0;y<t;y++){let b=h[f][y+1],S=h[f][y],P=h[f+1][y],C=h[f+1][y+1];(f!==0||o>0)&&p.push(b,S,C),(f!==n-1||c<Math.PI)&&p.push(S,P,C)}this.setIndex(p),this.setAttribute("position",new tt(m,3)),this.setAttribute("normal",new tt(_,3)),this.setAttribute("uv",new tt(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};var aa=class s extends xt{constructor(e=1,t=.4,n=12,i=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:r},n=Math.floor(n),i=Math.floor(i);let o=[],a=[],c=[],l=[],h=new A,u=new A,d=new A;for(let p=0;p<=n;p++)for(let m=0;m<=i;m++){let _=m/i*r,g=p/n*Math.PI*2;u.x=(e+t*Math.cos(g))*Math.cos(_),u.y=(e+t*Math.cos(g))*Math.sin(_),u.z=t*Math.sin(g),a.push(u.x,u.y,u.z),h.x=e*Math.cos(_),h.y=e*Math.sin(_),d.subVectors(u,h).normalize(),c.push(d.x,d.y,d.z),l.push(m/i),l.push(p/n)}for(let p=1;p<=n;p++)for(let m=1;m<=i;m++){let _=(i+1)*p+m-1,g=(i+1)*(p-1)+m-1,f=(i+1)*(p-1)+m,y=(i+1)*p+m;o.push(_,g,y),o.push(g,f,y)}this.setIndex(o),this.setAttribute("position",new tt(a,3)),this.setAttribute("normal",new tt(c,3)),this.setAttribute("uv",new tt(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}};var la=class s extends xt{constructor(e=new sa(new A(-1,-1,0),new A(-1,1,0),new A(1,1,0)),t=64,n=1,i=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:r};let o=e.computeFrenetFrames(t,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;let a=new A,c=new A,l=new se,h=new A,u=[],d=[],p=[],m=[];_(),this.setIndex(m),this.setAttribute("position",new tt(u,3)),this.setAttribute("normal",new tt(d,3)),this.setAttribute("uv",new tt(p,2));function _(){for(let b=0;b<t;b++)g(b);g(r===!1?t:0),y(),f()}function g(b){h=e.getPointAt(b/t,h);let S=o.normals[b],P=o.binormals[b];for(let C=0;C<=i;C++){let I=C/i*Math.PI*2,L=Math.sin(I),x=-Math.cos(I);c.x=x*S.x+L*P.x,c.y=x*S.y+L*P.y,c.z=x*S.z+L*P.z,c.normalize(),d.push(c.x,c.y,c.z),a.x=h.x+n*c.x,a.y=h.y+n*c.y,a.z=h.z+n*c.z,u.push(a.x,a.y,a.z)}}function f(){for(let b=1;b<=t;b++)for(let S=1;S<=i;S++){let P=(i+1)*(b-1)+(S-1),C=(i+1)*b+(S-1),I=(i+1)*b+S,L=(i+1)*(b-1)+S;m.push(P,C,L),m.push(C,I,L)}}function y(){for(let b=0;b<=t;b++)for(let S=0;S<=i;S++)l.x=b/t,l.y=S/i,p.push(l.x,l.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new s(new ly[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}};var Bs=class extends Qt{static get type(){return"MeshStandardMaterial"}constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new me(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new me(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=oh,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Sn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},an=class extends Bs{static get type(){return"MeshPhysicalMaterial"}constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new se(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ct(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new me(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new me(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new me(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var Tn=class extends Qt{static get type(){return"MeshLambertMaterial"}constructor(e){super(),this.isMeshLambertMaterial=!0,this.color=new me(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new me(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=oh,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Sn,this.combine=jc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}};var Lr=class extends dn{static get type(){return"LineDashedMaterial"}constructor(e){super(),this.isLineDashedMaterial=!0,this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}};function Do(s,e,t){return!s||!t&&s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function cy(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function hy(s){function e(i,r){return s[i]-s[r]}let t=s.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function Vd(s,e,t){let n=s.length,i=new s.constructor(n);for(let r=0,o=0;o!==n;++r){let a=t[r]*e;for(let c=0;c!==e;++c)i[o++]=s[a+c]}return i}function gf(s,e,t,n){let i=1,r=s[0];for(;r!==void 0&&r[n]===void 0;)r=s[i++];if(r===void 0)return;let o=r[n];if(o!==void 0)if(Array.isArray(o))do o=r[n],o!==void 0&&(e.push(r.time),t.push.apply(t,o)),r=s[i++];while(r!==void 0);else if(o.toArray!==void 0)do o=r[n],o!==void 0&&(e.push(r.time),o.toArray(t,t.length)),r=s[i++];while(r!==void 0);else do o=r[n],o!==void 0&&(e.push(r.time),t.push(o)),r=s[i++];while(r!==void 0)}var Ri=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];n:{e:{let o;t:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=i,i=t[++n],e<i)break e}o=t.length;break t}if(!(e>=r)){let a=t[1];e<a&&(n=2,r=a);for(let c=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===c)break;if(i=r,r=t[--n-1],e>=r)break e}o=n,n=0;break t}break n}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let o=0;o!==i;++o)t[o]=n[r+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},Fc=class extends Ri{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Pu,endingEnd:Pu}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,o=e+1,a=i[r],c=i[o];if(a===void 0)switch(this.getSettings_().endingStart){case Lu:r=e,a=2*t-n;break;case Du:r=i.length-2,a=t+i[r]-i[r+1];break;default:r=e,a=n}if(c===void 0)switch(this.getSettings_().endingEnd){case Lu:o=e,c=2*n-t;break;case Du:o=1,c=n+i[1]-i[0];break;default:o=e-1,c=t}let l=(n-t)*.5,h=this.valueSize;this._weightPrev=l/(t-a),this._weightNext=l/(c-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,p=this._weightNext,m=(n-t)/(i-t),_=m*m,g=_*m,f=-d*g+2*d*_-d*m,y=(1+d)*g+(-1.5-2*d)*_+(-.5+d)*m+1,b=(-1-p)*g+(1.5+p)*_+.5*m,S=p*g-p*_;for(let P=0;P!==a;++P)r[P]=f*o[h+P]+y*o[l+P]+b*o[c+P]+S*o[u+P];return r}},Bc=class extends Ri{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,l=c-a,h=(n-t)/(i-t),u=1-h;for(let d=0;d!==a;++d)r[d]=o[l+d]*u+o[c+d]*h;return r}},zc=class extends Ri{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},fn=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Do(t,this.TimeBufferType),this.values=Do(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Do(e.times,Array),values:Do(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new zc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Bc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Fc(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case Ls:t=this.InterpolantFactoryMethodDiscrete;break;case Ds:t=this.InterpolantFactoryMethodLinear;break;case Ya:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Ls;case this.InterpolantFactoryMethodLinear:return Ds;case this.InterpolantFactoryMethodSmooth:return Ya}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){let n=this.times,i=n.length,r=0,o=i-1;for(;r!==i&&n[r]<e;)++r;for(;o!==-1&&n[o]>t;)--o;if(++o,r!==0||o!==i){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){let c=n[a];if(typeof c=="number"&&isNaN(c)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,c),e=!1;break}if(o!==null&&o>c){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,c,o),e=!1;break}o=c}if(i!==void 0&&cy(i))for(let a=0,c=i.length;a!==c;++a){let l=i[a];if(isNaN(l)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,l),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Ya,r=e.length-1,o=1;for(let a=1;a<r;++a){let c=!1,l=e[a],h=e[a+1];if(l!==h&&(a!==1||l!==e[0]))if(i)c=!0;else{let u=a*n,d=u-n,p=u+n;for(let m=0;m!==n;++m){let _=t[u+m];if(_!==t[d+m]||_!==t[p+m]){c=!0;break}}}if(c){if(a!==o){e[o]=e[a];let u=a*n,d=o*n;for(let p=0;p!==n;++p)t[d+p]=t[u+p]}++o}}if(r>0){e[o]=e[r];for(let a=r*n,c=o*n,l=0;l!==n;++l)t[c+l]=t[a+l];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};fn.prototype.TimeBufferType=Float32Array;fn.prototype.ValueBufferType=Float32Array;fn.prototype.DefaultInterpolation=Ds;var Ci=class extends fn{constructor(e,t,n){super(e,t,n)}};Ci.prototype.ValueTypeName="bool";Ci.prototype.ValueBufferType=Array;Ci.prototype.DefaultInterpolation=Ls;Ci.prototype.InterpolantFactoryMethodLinear=void 0;Ci.prototype.InterpolantFactoryMethodSmooth=void 0;var ca=class extends fn{};ca.prototype.ValueTypeName="color";var oi=class extends fn{};oi.prototype.ValueTypeName="number";var Hc=class extends Ri{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=(n-t)/(i-t),l=e*a;for(let h=l+a;l!==h;l+=4)Jt.slerpFlat(r,0,o,l-a,o,l,c);return r}},ai=class extends fn{InterpolantFactoryMethodLinear(e){return new Hc(this.times,this.values,this.getValueSize(),e)}};ai.prototype.ValueTypeName="quaternion";ai.prototype.InterpolantFactoryMethodSmooth=void 0;var Ii=class extends fn{constructor(e,t,n){super(e,t,n)}};Ii.prototype.ValueTypeName="string";Ii.prototype.ValueBufferType=Array;Ii.prototype.DefaultInterpolation=Ls;Ii.prototype.InterpolantFactoryMethodLinear=void 0;Ii.prototype.InterpolantFactoryMethodSmooth=void 0;var li=class extends fn{};li.prototype.ValueTypeName="vector";var ha=class{constructor(e="",t=-1,n=[],i=Rp){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=Mn(),this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let o=0,a=n.length;o!==a;++o)t.push(dy(n[o]).scale(i));let r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let r=0,o=n.length;r!==o;++r)t.push(fn.toJSON(n[r]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let r=t.length,o=[];for(let a=0;a<r;a++){let c=[],l=[];c.push((a+r-1)%r,a,(a+1)%r),l.push(0,1,0);let h=hy(c);c=Vd(c,1,h),l=Vd(l,1,h),!i&&c[0]===0&&(c.push(r),l.push(l[0])),o.push(new oi(".morphTargetInfluences["+t[a].name+"]",c,l).scale(1/n))}return new this(e,-1,o)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,c=e.length;a<c;a++){let l=e[a],h=l.name.match(r);if(h&&h.length>1){let u=h[1],d=i[u];d||(i[u]=d=[]),d.push(l)}}let o=[];for(let a in i)o.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return o}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;let n=function(u,d,p,m,_){if(p.length!==0){let g=[],f=[];gf(p,g,f,m),g.length!==0&&_.push(new u(d,g,f))}},i=[],r=e.name||"default",o=e.fps||30,a=e.blendMode,c=e.length||-1,l=e.hierarchy||[];for(let u=0;u<l.length;u++){let d=l[u].keys;if(!(!d||d.length===0))if(d[0].morphTargets){let p={},m;for(m=0;m<d.length;m++)if(d[m].morphTargets)for(let _=0;_<d[m].morphTargets.length;_++)p[d[m].morphTargets[_]]=-1;for(let _ in p){let g=[],f=[];for(let y=0;y!==d[m].morphTargets.length;++y){let b=d[m];g.push(b.time),f.push(b.morphTarget===_?1:0)}i.push(new oi(".morphTargetInfluence["+_+"]",g,f))}c=p.length*o}else{let p=".bones["+t[u].name+"]";n(li,p+".position",d,"pos",i),n(ai,p+".quaternion",d,"rot",i),n(li,p+".scale",d,"scl",i)}}return i.length===0?null:new this(r,c,i,a)}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}};function uy(s){switch(s.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return oi;case"vector":case"vector2":case"vector3":case"vector4":return li;case"color":return ca;case"quaternion":return ai;case"bool":case"boolean":return Ci;case"string":return Ii}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+s)}function dy(s){if(s.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=uy(s.type);if(s.times===void 0){let t=[],n=[];gf(s.keys,t,n,"value"),s.times=t,s.values=n}return e.parse!==void 0?e.parse(s):new e(s.name,s.times,s.values,s.interpolation)}var Ei={enabled:!1,files:{},add:function(s,e){this.enabled!==!1&&(this.files[s]=e)},get:function(s){if(this.enabled!==!1)return this.files[s]},remove:function(s){delete this.files[s]},clear:function(){this.files={}}},Vc=class{constructor(e,t,n){let i=this,r=!1,o=0,a=0,c,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(h){a++,r===!1&&i.onStart!==void 0&&i.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,i.onProgress!==void 0&&i.onProgress(h,o,a),o===a&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return c?c(h):h},this.setURLModifier=function(h){return c=h,this},this.addHandler=function(h,u){return l.push(h,u),this},this.removeHandler=function(h){let u=l.indexOf(h);return u!==-1&&l.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=l.length;u<d;u+=2){let p=l[u],m=l[u+1];if(p.global&&(p.lastIndex=0),p.test(h))return m}return null}}},fy=new Vc,ci=class{constructor(e){this.manager=e!==void 0?e:fy,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}};ci.DEFAULT_MATERIAL_NAME="__DEFAULT";var Kn={},Gc=class extends Error{constructor(e,t){super(e),this.response=t}},Dr=class extends ci{constructor(e){super(e)}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=Ei.get(e);if(r!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0),r;if(Kn[e]!==void 0){Kn[e].push({onLoad:t,onProgress:n,onError:i});return}Kn[e]=[],Kn[e].push({onLoad:t,onProgress:n,onError:i});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),a=this.mimeType,c=this.responseType;fetch(o).then(l=>{if(l.status===200||l.status===0){if(l.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||l.body===void 0||l.body.getReader===void 0)return l;let h=Kn[e],u=l.body.getReader(),d=l.headers.get("X-File-Size")||l.headers.get("Content-Length"),p=d?parseInt(d):0,m=p!==0,_=0,g=new ReadableStream({start(f){y();function y(){u.read().then(({done:b,value:S})=>{if(b)f.close();else{_+=S.byteLength;let P=new ProgressEvent("progress",{lengthComputable:m,loaded:_,total:p});for(let C=0,I=h.length;C<I;C++){let L=h[C];L.onProgress&&L.onProgress(P)}f.enqueue(S),y()}},b=>{f.error(b)})}}});return new Response(g)}else throw new Gc(`fetch for "${l.url}" responded with ${l.status}: ${l.statusText}`,l)}).then(l=>{switch(c){case"arraybuffer":return l.arrayBuffer();case"blob":return l.blob();case"document":return l.text().then(h=>new DOMParser().parseFromString(h,a));case"json":return l.json();default:if(a===void 0)return l.text();{let u=/charset="?([^;"\s]*)"?/i.exec(a),d=u&&u[1]?u[1].toLowerCase():void 0,p=new TextDecoder(d);return l.arrayBuffer().then(m=>p.decode(m))}}}).then(l=>{Ei.add(e,l);let h=Kn[e];delete Kn[e];for(let u=0,d=h.length;u<d;u++){let p=h[u];p.onLoad&&p.onLoad(l)}}).catch(l=>{let h=Kn[e];if(h===void 0)throw this.manager.itemError(e),l;delete Kn[e];for(let u=0,d=h.length;u<d;u++){let p=h[u];p.onError&&p.onError(l)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}};var Wc=class extends ci{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=Ei.get(e);if(o!==void 0)return r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0),o;let a=Mr("img");function c(){h(),Ei.add(e,this),t&&t(this),r.manager.itemEnd(e)}function l(u){h(),i&&i(u),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){a.removeEventListener("load",c,!1),a.removeEventListener("error",l,!1)}return a.addEventListener("load",c,!1),a.addEventListener("error",l,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),r.manager.itemStart(e),a.src=e,a}};var ua=class extends ci{constructor(e){super(e)}load(e,t,n,i){let r=new kt,o=new Wc(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},n,i),r}},zs=class extends lt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new me(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}},Nr=class extends zs{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(lt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new me(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}},Rl=new Re,Gd=new A,Wd=new A,kr=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new se(512,512),this.map=null,this.mapPass=null,this.matrix=new Re,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new wr,this._frameExtents=new se(1,1),this._viewportCount=1,this._viewports=[new je(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Gd.setFromMatrixPosition(e.matrixWorld),t.position.copy(Gd),Wd.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Wd),t.updateMatrixWorld(),Rl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Rl),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Rl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Xc=class extends kr{constructor(){super(new At(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){let t=this.camera,n=Ns*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height,r=e.distance||t.far;(n!==t.fov||i!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=i,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}},da=class extends zs{constructor(e,t,n=0,i=Math.PI/3,r=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(lt.DEFAULT_UP),this.updateMatrix(),this.target=new lt,this.distance=n,this.angle=i,this.penumbra=r,this.decay=o,this.map=null,this.shadow=new Xc}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},Xd=new Re,dr=new A,Cl=new A,$c=class extends kr{constructor(){super(new At(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new se(4,2),this._viewportCount=6,this._viewports=[new je(2,1,1,1),new je(0,1,1,1),new je(3,1,1,1),new je(1,1,1,1),new je(3,0,1,1),new je(1,0,1,1)],this._cubeDirections=[new A(1,0,0),new A(-1,0,0),new A(0,0,1),new A(0,0,-1),new A(0,1,0),new A(0,-1,0)],this._cubeUps=[new A(0,1,0),new A(0,1,0),new A(0,1,0),new A(0,1,0),new A(0,0,1),new A(0,0,-1)]}updateMatrices(e,t=0){let n=this.camera,i=this.matrix,r=e.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),dr.setFromMatrixPosition(e.matrixWorld),n.position.copy(dr),Cl.copy(n.position),Cl.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(Cl),n.updateMatrixWorld(),i.makeTranslation(-dr.x,-dr.y,-dr.z),Xd.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Xd)}},fa=class extends zs{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new $c}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}},qc=class extends kr{constructor(){super(new Os(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Pi=class extends zs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(lt.DEFAULT_UP),this.updateMatrix(),this.target=new lt,this.shadow=new qc}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}};var Li=class{static decodeText(e){if(console.warn("THREE.LoaderUtils: decodeText() has been deprecated with r165 and will be removed with r175. Use TextDecoder instead."),typeof TextDecoder<"u")return new TextDecoder().decode(e);let t="";for(let n=0,i=e.length;n<i;n++)t+=String.fromCharCode(e[n]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}};var pa=class extends ci{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=Ei.get(e);if(o!==void 0){if(r.manager.itemStart(e),o.then){o.then(l=>{t&&t(l),r.manager.itemEnd(e)}).catch(l=>{i&&i(l)});return}return setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0),o}let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader;let c=fetch(e,a).then(function(l){return l.blob()}).then(function(l){return createImageBitmap(l,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(l){return Ei.add(e,l),t&&t(l),r.manager.itemEnd(e),l}).catch(function(l){i&&i(l),Ei.remove(e),r.manager.itemError(e),r.manager.itemEnd(e)});Ei.add(e,c),r.manager.itemStart(e)}};var hh="\\[\\]\\.:\\/",py=new RegExp("["+hh+"]","g"),uh="[^"+hh+"]",my="[^"+hh.replace("\\.","")+"]",gy=/((?:WC+[\/:])*)/.source.replace("WC",uh),_y=/(WCOD+)?/.source.replace("WCOD",my),vy=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",uh),yy=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",uh),xy=new RegExp("^"+gy+_y+vy+yy+"$"),by=["material","materials","bones","map"],Yc=class{constructor(e,t,n){let i=n||ft.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},ft=class s{constructor(e,t,n){this.path=t,this.parsedPath=n||s.parseTrackName(t),this.node=s.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new s.Composite(e,t,n):new s(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(py,"")}static parseTrackName(e){let t=xy.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);by.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===t||a.uuid===t)return a;let c=n(a.children);if(c)return c}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,r=t.propertyIndex;if(e||(e=s.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===l){l=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let o=e[i];if(o===void 0){let l=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+l+"."+i+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?a=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};ft.Composite=Yc;ft.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ft.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ft.prototype.GetterByBindingType=[ft.prototype._getValue_direct,ft.prototype._getValue_array,ft.prototype._getValue_arrayElement,ft.prototype._getValue_toArray];ft.prototype.SetterByBindingTypeAndVersioning=[[ft.prototype._setValue_direct,ft.prototype._setValue_direct_setNeedsUpdate,ft.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ft.prototype._setValue_array,ft.prototype._setValue_array_setNeedsUpdate,ft.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ft.prototype._setValue_arrayElement,ft.prototype._setValue_arrayElement_setNeedsUpdate,ft.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ft.prototype._setValue_fromArray,ft.prototype._setValue_fromArray_setNeedsUpdate,ft.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Mx=new Float32Array(1);var $d=new Re,ma=class{constructor(e,t,n=0,i=1/0){this.ray=new si(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new Sr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return $d.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4($d),this}intersectObject(e,t=!0,n=[]){return Kc(e,this,n,t),n.sort(qd),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)Kc(e[i],this,n,t);return n.sort(qd),n}};function qd(s,e){return s.distance-e.distance}function Kc(s,e,t,n){let i=!0;if(s.layers.test(e.layers)&&s.raycast(e,t)===!1&&(i=!1),i===!0&&n===!0){let r=s.children;for(let o=0,a=r.length;o<a;o++)Kc(r[o],e,t,!0)}}var Ur=class{constructor(e=1,t=0,n=0){return this.radius=e,this.phi=t,this.theta=n,this}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(Ct(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var ga=class extends Un{constructor(e=10,t=10,n=4473924,i=8947848){n=new me(n),i=new me(i);let r=t/2,o=e/t,a=e/2,c=[],l=[];for(let d=0,p=0,m=-a;d<=t;d++,m+=o){c.push(-a,0,m,a,0,m),c.push(m,0,-a,m,0,a);let _=d===r?n:i;_.toArray(l,p),p+=3,_.toArray(l,p),p+=3,_.toArray(l,p),p+=3,_.toArray(l,p),p+=3}let h=new xt;h.setAttribute("position",new tt(c,3)),h.setAttribute("color",new tt(l,3));let u=new dn({vertexColors:!0,toneMapped:!1});super(h,u),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}};var No=new Ut,_a=class extends Un{constructor(e,t=16776960){let n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),i=new Float32Array(8*3),r=new xt;r.setIndex(new Et(n,1)),r.setAttribute("position",new Et(i,3)),super(r,new dn({color:t,toneMapped:!1})),this.object=e,this.type="BoxHelper",this.matrixAutoUpdate=!1,this.update()}update(e){if(e!==void 0&&console.warn("THREE.BoxHelper: .update() has no longer arguments."),this.object!==void 0&&No.setFromObject(this.object),No.isEmpty())return;let t=No.min,n=No.max,i=this.geometry.attributes.position,r=i.array;r[0]=n.x,r[1]=n.y,r[2]=n.z,r[3]=t.x,r[4]=n.y,r[5]=n.z,r[6]=t.x,r[7]=t.y,r[8]=n.z,r[9]=n.x,r[10]=t.y,r[11]=n.z,r[12]=n.x,r[13]=n.y,r[14]=t.z,r[15]=t.x,r[16]=n.y,r[17]=t.z,r[18]=t.x,r[19]=t.y,r[20]=t.z,r[21]=n.x,r[22]=t.y,r[23]=t.z,i.needsUpdate=!0,this.geometry.computeBoundingSphere()}setFromObject(e){return this.object=e,this.update(),this}copy(e,t){return super.copy(e,t),this.object=e.object,this}dispose(){this.geometry.dispose(),this.material.dispose()}};var va=class extends ni{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Zc}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Zc);var vf={type:"change"},fh={type:"start"},xf={type:"end"},wa=new si,yf=new rn,My=Math.cos(70*Ma.DEG2RAD),Lt=new A,en=2*Math.PI,rt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},dh=1e-6,Ea=class extends va{constructor(e,t=null){super(e,t),this.state=rt.NONE,this.enabled=!0,this.target=new A,this.cursor=new A,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:An.ROTATE,MIDDLE:An.DOLLY,RIGHT:An.PAN},this.touches={ONE:Ji.ROTATE,TWO:Ji.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new A,this._lastQuaternion=new Jt,this._lastTargetPosition=new A,this._quat=new Jt().setFromUnitVectors(e.up,new A(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Ur,this._sphericalDelta=new Ur,this._scale=1,this._panOffset=new A,this._rotateStart=new se,this._rotateEnd=new se,this._rotateDelta=new se,this._panStart=new se,this._panEnd=new se,this._panDelta=new se,this._dollyStart=new se,this._dollyEnd=new se,this._dollyDelta=new se,this._dollyDirection=new A,this._mouse=new se,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=wy.bind(this),this._onPointerDown=Sy.bind(this),this._onPointerUp=Ey.bind(this),this._onContextMenu=Ly.bind(this),this._onMouseWheel=Ry.bind(this),this._onKeyDown=Cy.bind(this),this._onTouchStart=Iy.bind(this),this._onTouchMove=Py.bind(this),this._onMouseDown=Ty.bind(this),this._onMouseMove=Ay.bind(this),this._interceptControlDown=Dy.bind(this),this._interceptControlUp=Ny.bind(this),this.domElement!==null&&this.connect(),this.update()}connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(vf),this.update(),this.state=rt.NONE}update(e=null){let t=this.object.position;Lt.copy(t).sub(this.target),Lt.applyQuaternion(this._quat),this._spherical.setFromVector3(Lt),this.autoRotate&&this.state===rt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,i=this.maxAzimuthAngle;isFinite(n)&&isFinite(i)&&(n<-Math.PI?n+=en:n>Math.PI&&(n-=en),i<-Math.PI?i+=en:i>Math.PI&&(i-=en),n<=i?this._spherical.theta=Math.max(n,Math.min(i,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+i)/2?Math.max(n,this._spherical.theta):Math.min(i,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(Lt.setFromSpherical(this._spherical),Lt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Lt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=Lt.length();o=this._clampDistance(a*this._scale);let c=a-o;this.object.position.addScaledVector(this._dollyDirection,c),this.object.updateMatrixWorld(),r=!!c}else if(this.object.isOrthographicCamera){let a=new A(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let c=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=c!==this.object.zoom;let l=new A(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(a),this.object.updateMatrixWorld(),o=Lt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(wa.origin.copy(this.object.position),wa.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(wa.direction))<My?this.object.lookAt(this.target):(yf.setFromNormalAndCoplanarPoint(this.object.up,this.target),wa.intersectPlane(yf,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>dh||8*(1-this._lastQuaternion.dot(this.object.quaternion))>dh||this._lastTargetPosition.distanceToSquared(this.target)>dh?(this.dispatchEvent(vf),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?en/60*this.autoRotateSpeed*e:en/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Lt.setFromMatrixColumn(t,0),Lt.multiplyScalar(-e),this._panOffset.add(Lt)}_panUp(e,t){this.screenSpacePanning===!0?Lt.setFromMatrixColumn(t,1):(Lt.setFromMatrixColumn(t,0),Lt.crossVectors(this.object.up,Lt)),Lt.multiplyScalar(e),this._panOffset.add(Lt)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let i=this.object.position;Lt.copy(i).sub(this.target);let r=Lt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),i=e-n.left,r=t-n.top,o=n.width,a=n.height;this._mouse.x=i/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(en*this._rotateDelta.x/t.clientHeight),this._rotateUp(en*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(en*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateUp(-en*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(en*this.rotateSpeed/this.domElement.clientHeight):this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this._rotateLeft(-en*this.rotateSpeed/this.domElement.clientHeight):this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),i=.5*(e.pageY+t.y);this._rotateStart.set(n,i)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),i=.5*(e.pageY+t.y);this._panStart.set(n,i)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),i=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(i,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(en*this._rotateDelta.x/t.clientHeight),this._rotateUp(en*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),i=.5*(e.pageY+t.y);this._panEnd.set(n,i)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new se,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function Sy(s){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(s.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(s)&&(this._addPointer(s),s.pointerType==="touch"?this._onTouchStart(s):this._onMouseDown(s)))}function wy(s){this.enabled!==!1&&(s.pointerType==="touch"?this._onTouchMove(s):this._onMouseMove(s))}function Ey(s){switch(this._removePointer(s),this._pointers.length){case 0:this.domElement.releasePointerCapture(s.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(xf),this.state=rt.NONE;break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Ty(s){let e;switch(s.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case An.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(s),this.state=rt.DOLLY;break;case An.ROTATE:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=rt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=rt.ROTATE}break;case An.PAN:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=rt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=rt.PAN}break;default:this.state=rt.NONE}this.state!==rt.NONE&&this.dispatchEvent(fh)}function Ay(s){switch(this.state){case rt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(s);break;case rt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(s);break;case rt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(s);break}}function Ry(s){this.enabled===!1||this.enableZoom===!1||this.state!==rt.NONE||(s.preventDefault(),this.dispatchEvent(fh),this._handleMouseWheel(this._customWheelEvent(s)),this.dispatchEvent(xf))}function Cy(s){this.enabled===!1||this.enablePan===!1||this._handleKeyDown(s)}function Iy(s){switch(this._trackPointer(s),this._pointers.length){case 1:switch(this.touches.ONE){case Ji.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(s),this.state=rt.TOUCH_ROTATE;break;case Ji.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(s),this.state=rt.TOUCH_PAN;break;default:this.state=rt.NONE}break;case 2:switch(this.touches.TWO){case Ji.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(s),this.state=rt.TOUCH_DOLLY_PAN;break;case Ji.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(s),this.state=rt.TOUCH_DOLLY_ROTATE;break;default:this.state=rt.NONE}break;default:this.state=rt.NONE}this.state!==rt.NONE&&this.dispatchEvent(fh)}function Py(s){switch(this._trackPointer(s),this.state){case rt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(s),this.update();break;case rt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(s),this.update();break;case rt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(s),this.update();break;case rt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(s),this.update();break;default:this.state=rt.NONE}}function Ly(s){this.enabled!==!1&&s.preventDefault()}function Dy(s){s.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Ny(s){s.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var Ta=class extends lt{constructor(e=document.createElement("div")){super(),this.isCSS2DObject=!0,this.element=e,this.element.style.position="absolute",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.center=new se(.5,.5),this.addEventListener("removed",function(){this.traverse(function(t){t.element instanceof t.element.ownerDocument.defaultView.Element&&t.element.parentNode!==null&&t.element.remove()})})}copy(e,t){return super.copy(e,t),this.element=e.element.cloneNode(!0),this.center=e.center,this}},Vs=new A,bf=new Re,Mf=new Re,Sf=new A,wf=new A,Aa=class{constructor(e={}){let t=this,n,i,r,o,a={objects:new WeakMap},c=e.element!==void 0?e.element:document.createElement("div");c.style.overflow="hidden",this.domElement=c,this.getSize=function(){return{width:n,height:i}},this.render=function(m,_){m.matrixWorldAutoUpdate===!0&&m.updateMatrixWorld(),_.parent===null&&_.matrixWorldAutoUpdate===!0&&_.updateMatrixWorld(),bf.copy(_.matrixWorldInverse),Mf.multiplyMatrices(_.projectionMatrix,bf),h(m,m,_),p(m)},this.setSize=function(m,_){n=m,i=_,r=n/2,o=i/2,c.style.width=m+"px",c.style.height=_+"px"};function l(m){m.isCSS2DObject&&(m.element.style.display="none");for(let _=0,g=m.children.length;_<g;_++)l(m.children[_])}function h(m,_,g){if(m.visible===!1){l(m);return}if(m.isCSS2DObject){Vs.setFromMatrixPosition(m.matrixWorld),Vs.applyMatrix4(Mf);let f=Vs.z>=-1&&Vs.z<=1&&m.layers.test(g.layers)===!0,y=m.element;y.style.display=f===!0?"":"none",f===!0&&(m.onBeforeRender(t,_,g),y.style.transform="translate("+-100*m.center.x+"%,"+-100*m.center.y+"%)translate("+(Vs.x*r+r)+"px,"+(-Vs.y*o+o)+"px)",y.parentNode!==c&&c.appendChild(y),m.onAfterRender(t,_,g));let b={distanceToCameraSquared:u(g,m)};a.objects.set(m,b)}for(let f=0,y=m.children.length;f<y;f++)h(m.children[f],_,g)}function u(m,_){return Sf.setFromMatrixPosition(m.matrixWorld),wf.setFromMatrixPosition(_.matrixWorld),Sf.distanceToSquared(wf)}function d(m){let _=[];return m.traverseVisible(function(g){g.isCSS2DObject&&_.push(g)}),_}function p(m){let _=d(m).sort(function(f,y){if(f.renderOrder!==y.renderOrder)return y.renderOrder-f.renderOrder;let b=a.objects.get(f).distanceToCameraSquared,S=a.objects.get(y).distanceToCameraSquared;return b-S}),g=_.length;for(let f=0,y=_.length;f<y;f++)_[f].element.style.zIndex=g-f}}};function ph(s,e){if(e===of)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),s;if(e===Fr||e===xa){let t=s.getIndex();if(t===null){let o=[],a=s.getAttribute("position");if(a!==void 0){for(let c=0;c<a.count;c++)o.push(c);s.setIndex(o),t=s.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),s}let n=t.count-2,i=[];if(e===Fr)for(let o=1;o<=n;o++)i.push(t.getX(0)),i.push(t.getX(o)),i.push(t.getX(o+1));else for(let o=0;o<n;o++)o%2===0?(i.push(t.getX(o)),i.push(t.getX(o+1)),i.push(t.getX(o+2))):(i.push(t.getX(o+2)),i.push(t.getX(o+1)),i.push(t.getX(o)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");let r=s.clone();return r.setIndex(i),r.clearGroups(),r}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),s}var Ra=class extends ci{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new bh(t)}),this.register(function(t){return new Mh(t)}),this.register(function(t){return new Ph(t)}),this.register(function(t){return new Lh(t)}),this.register(function(t){return new Dh(t)}),this.register(function(t){return new wh(t)}),this.register(function(t){return new Eh(t)}),this.register(function(t){return new Th(t)}),this.register(function(t){return new Ah(t)}),this.register(function(t){return new xh(t)}),this.register(function(t){return new Rh(t)}),this.register(function(t){return new Sh(t)}),this.register(function(t){return new Ih(t)}),this.register(function(t){return new Ch(t)}),this.register(function(t){return new vh(t)}),this.register(function(t){return new Nh(t)}),this.register(function(t){return new kh(t)})}load(e,t,n,i){let r=this,o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){let l=Li.extractUrlBase(e);o=Li.resolveURL(l,this.path)}else o=Li.extractUrlBase(e);this.manager.itemStart(e);let a=function(l){i?i(l):console.error(l),r.manager.itemError(e),r.manager.itemEnd(e)},c=new Dr(this.manager);c.setPath(this.path),c.setResponseType("arraybuffer"),c.setRequestHeader(this.requestHeader),c.setWithCredentials(this.withCredentials),c.load(e,function(l){try{r.parse(l,o,function(h){t(h),r.manager.itemEnd(e)},a)}catch(h){a(h)}},n,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let r,o={},a={},c=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(c.decode(new Uint8Array(e,0,4))===Cf){try{o[ze.KHR_BINARY_GLTF]=new Uh(e)}catch(u){i&&i(u);return}r=JSON.parse(o[ze.KHR_BINARY_GLTF].content)}else r=JSON.parse(c.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let l=new Gh(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});l.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){let u=this.pluginCallbacks[h](l);u.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[u.name]=u,o[u.name]=!0}if(r.extensionsUsed)for(let h=0;h<r.extensionsUsed.length;++h){let u=r.extensionsUsed[h],d=r.extensionsRequired||[];switch(u){case ze.KHR_MATERIALS_UNLIT:o[u]=new yh;break;case ze.KHR_DRACO_MESH_COMPRESSION:o[u]=new Oh(r,this.dracoLoader);break;case ze.KHR_TEXTURE_TRANSFORM:o[u]=new Fh;break;case ze.KHR_MESH_QUANTIZATION:o[u]=new Bh;break;default:d.indexOf(u)>=0&&a[u]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+u+'".')}}l.setExtensions(o),l.setPlugins(a),l.parse(n,i)}parseAsync(e,t){let n=this;return new Promise(function(i,r){n.parse(e,t,i,r)})}};function ky(){let s={};return{get:function(e){return s[e]},add:function(e,t){s[e]=t},remove:function(e){delete s[e]},removeAll:function(){s={}}}}var ze={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},vh=class{constructor(e){this.parser=e,this.name=ze.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){let r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n="light:"+e,i=t.cache.get(n);if(i)return i;let r=t.json,c=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e],l,h=new me(16777215);c.color!==void 0&&h.setRGB(c.color[0],c.color[1],c.color[2],Ht);let u=c.range!==void 0?c.range:0;switch(c.type){case"directional":l=new Pi(h),l.target.position.set(0,0,-1),l.add(l.target);break;case"point":l=new fa(h),l.distance=u;break;case"spot":l=new da(h),l.distance=u,c.spot=c.spot||{},c.spot.innerConeAngle=c.spot.innerConeAngle!==void 0?c.spot.innerConeAngle:0,c.spot.outerConeAngle=c.spot.outerConeAngle!==void 0?c.spot.outerConeAngle:Math.PI/4,l.angle=c.spot.outerConeAngle,l.penumbra=1-c.spot.innerConeAngle/c.spot.outerConeAngle,l.target.position.set(0,0,-1),l.add(l.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+c.type)}return l.position.set(0,0,0),l.decay=2,hi(l,c),c.intensity!==void 0&&(l.intensity=c.intensity),l.name=t.createUniqueName(c.name||"light_"+e),i=Promise.resolve(l),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,r=n.json.nodes[e],a=(r.extensions&&r.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(c){return n._getNodeRef(t.cache,a,c)})}},yh=class{constructor(){this.name=ze.KHR_MATERIALS_UNLIT}getMaterialType(){return Wt}extendParams(e,t,n){let i=[];e.color=new me(1,1,1),e.opacity=1;let r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){let o=r.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],Ht),e.opacity=o[3]}r.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",r.baseColorTexture,_t))}return Promise.all(i)}},xh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let i=this.parser.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=i.extensions[this.name].emissiveStrength;return r!==void 0&&(t.emissiveIntensity=r),Promise.resolve()}},bh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];if(o.clearcoatFactor!==void 0&&(t.clearcoat=o.clearcoatFactor),o.clearcoatTexture!==void 0&&r.push(n.assignTexture(t,"clearcoatMap",o.clearcoatTexture)),o.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=o.clearcoatRoughnessFactor),o.clearcoatRoughnessTexture!==void 0&&r.push(n.assignTexture(t,"clearcoatRoughnessMap",o.clearcoatRoughnessTexture)),o.clearcoatNormalTexture!==void 0&&(r.push(n.assignTexture(t,"clearcoatNormalMap",o.clearcoatNormalTexture)),o.clearcoatNormalTexture.scale!==void 0)){let a=o.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new se(a,a)}return Promise.all(r)}},Mh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_DISPERSION}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let i=this.parser.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=i.extensions[this.name];return t.dispersion=r.dispersion!==void 0?r.dispersion:0,Promise.resolve()}},Sh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return o.iridescenceFactor!==void 0&&(t.iridescence=o.iridescenceFactor),o.iridescenceTexture!==void 0&&r.push(n.assignTexture(t,"iridescenceMap",o.iridescenceTexture)),o.iridescenceIor!==void 0&&(t.iridescenceIOR=o.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),o.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=o.iridescenceThicknessMaximum),o.iridescenceThicknessTexture!==void 0&&r.push(n.assignTexture(t,"iridescenceThicknessMap",o.iridescenceThicknessTexture)),Promise.all(r)}},wh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_SHEEN}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[];t.sheenColor=new me(0,0,0),t.sheenRoughness=0,t.sheen=1;let o=i.extensions[this.name];if(o.sheenColorFactor!==void 0){let a=o.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],Ht)}return o.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=o.sheenRoughnessFactor),o.sheenColorTexture!==void 0&&r.push(n.assignTexture(t,"sheenColorMap",o.sheenColorTexture,_t)),o.sheenRoughnessTexture!==void 0&&r.push(n.assignTexture(t,"sheenRoughnessMap",o.sheenRoughnessTexture)),Promise.all(r)}},Eh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return o.transmissionFactor!==void 0&&(t.transmission=o.transmissionFactor),o.transmissionTexture!==void 0&&r.push(n.assignTexture(t,"transmissionMap",o.transmissionTexture)),Promise.all(r)}},Th=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_VOLUME}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];t.thickness=o.thicknessFactor!==void 0?o.thicknessFactor:0,o.thicknessTexture!==void 0&&r.push(n.assignTexture(t,"thicknessMap",o.thicknessTexture)),t.attenuationDistance=o.attenuationDistance||1/0;let a=o.attenuationColor||[1,1,1];return t.attenuationColor=new me().setRGB(a[0],a[1],a[2],Ht),Promise.all(r)}},Ah=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_IOR}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let i=this.parser.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=i.extensions[this.name];return t.ior=r.ior!==void 0?r.ior:1.5,Promise.resolve()}},Rh=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_SPECULAR}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];t.specularIntensity=o.specularFactor!==void 0?o.specularFactor:1,o.specularTexture!==void 0&&r.push(n.assignTexture(t,"specularIntensityMap",o.specularTexture));let a=o.specularColorFactor||[1,1,1];return t.specularColor=new me().setRGB(a[0],a[1],a[2],Ht),o.specularColorTexture!==void 0&&r.push(n.assignTexture(t,"specularColorMap",o.specularColorTexture,_t)),Promise.all(r)}},Ch=class{constructor(e){this.parser=e,this.name=ze.EXT_MATERIALS_BUMP}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return t.bumpScale=o.bumpFactor!==void 0?o.bumpFactor:1,o.bumpTexture!==void 0&&r.push(n.assignTexture(t,"bumpMap",o.bumpTexture)),Promise.all(r)}},Ih=class{constructor(e){this.parser=e,this.name=ze.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:an}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return o.anisotropyStrength!==void 0&&(t.anisotropy=o.anisotropyStrength),o.anisotropyRotation!==void 0&&(t.anisotropyRotation=o.anisotropyRotation),o.anisotropyTexture!==void 0&&r.push(n.assignTexture(t,"anisotropyMap",o.anisotropyTexture)),Promise.all(r)}},Ph=class{constructor(e){this.parser=e,this.name=ze.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;let r=i.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,o)}},Lh=class{constructor(e){this.parser=e,this.name=ze.EXT_TEXTURE_WEBP,this.isSupported=null}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],c=n.textureLoader;if(a.uri){let l=n.options.manager.getHandler(a.uri);l!==null&&(c=l)}return this.detectSupport().then(function(l){if(l)return n.loadTextureImage(e,o.source,c);if(i.extensionsRequired&&i.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");return n.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){let t=new Image;t.src="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}},Dh=class{constructor(e){this.parser=e,this.name=ze.EXT_TEXTURE_AVIF,this.isSupported=null}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],c=n.textureLoader;if(a.uri){let l=n.options.manager.getHandler(a.uri);l!==null&&(c=l)}return this.detectSupport().then(function(l){if(l)return n.loadTextureImage(e,o.source,c);if(i.extensionsRequired&&i.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");return n.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){let t=new Image;t.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}},Nh=class{constructor(e){this.name=ze.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let i=n.extensions[this.name],r=this.parser.getDependency("buffer",i.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){let c=i.byteOffset||0,l=i.byteLength||0,h=i.count,u=i.byteStride,d=new Uint8Array(a,c,l);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(h,u,d,i.mode,i.filter).then(function(p){return p.buffer}):o.ready.then(function(){let p=new ArrayBuffer(h*u);return o.decodeGltfBuffer(new Uint8Array(p),h,u,d,i.mode,i.filter),p})})}else return null}},kh=class{constructor(e){this.name=ze.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let i=t.meshes[n.mesh];for(let l of i.primitives)if(l.mode!==pn.TRIANGLES&&l.mode!==pn.TRIANGLE_STRIP&&l.mode!==pn.TRIANGLE_FAN&&l.mode!==void 0)return null;let o=n.extensions[this.name].attributes,a=[],c={};for(let l in o)a.push(this.parser.getDependency("accessor",o[l]).then(h=>(c[l]=h,c[l])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(l=>{let h=l.pop(),u=h.isGroup?h.children:[h],d=l[0].count,p=[];for(let m of u){let _=new Re,g=new A,f=new Jt,y=new A(1,1,1),b=new Jo(m.geometry,m.material,d);for(let S=0;S<d;S++)c.TRANSLATION&&g.fromBufferAttribute(c.TRANSLATION,S),c.ROTATION&&f.fromBufferAttribute(c.ROTATION,S),c.SCALE&&y.fromBufferAttribute(c.SCALE,S),b.setMatrixAt(S,_.compose(g,f,y));for(let S in c)if(S==="_COLOR_0"){let P=c[S];b.instanceColor=new Ki(P.array,P.itemSize,P.normalized)}else S!=="TRANSLATION"&&S!=="ROTATION"&&S!=="SCALE"&&m.geometry.setAttribute(S,c[S]);lt.prototype.copy.call(b,m),this.parser.assignFinalMaterial(b),p.push(b)}return h.isGroup?(h.clear(),h.add(...p),h):p[0]}))}},Cf="glTF",Br=12,Ef={JSON:1313821514,BIN:5130562},Uh=class{constructor(e){this.name=ze.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,Br),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Cf)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let i=this.header.length-Br,r=new DataView(e,Br),o=0;for(;o<i;){let a=r.getUint32(o,!0);o+=4;let c=r.getUint32(o,!0);if(o+=4,c===Ef.JSON){let l=new Uint8Array(e,Br+o,a);this.content=n.decode(l)}else if(c===Ef.BIN){let l=Br+o;this.body=e.slice(l,l+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},Oh=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=ze.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,i=this.dracoLoader,r=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},c={},l={};for(let h in o){let u=Hh[h]||h.toLowerCase();a[u]=o[h]}for(let h in e.attributes){let u=Hh[h]||h.toLowerCase();if(o[h]!==void 0){let d=n.accessors[e.attributes[h]],p=Gs[d.componentType];l[u]=p.name,c[u]=d.normalized===!0}}return t.getDependency("bufferView",r).then(function(h){return new Promise(function(u,d){i.decodeDracoFile(h,function(p){for(let m in p.attributes){let _=p.attributes[m],g=c[m];g!==void 0&&(_.normalized=g)}u(p)},a,l,Ht,d)})})}},Fh=class{constructor(){this.name=ze.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}},Bh=class{constructor(){this.name=ze.KHR_MESH_QUANTIZATION}},Ca=class extends Ri{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i*3+i;for(let o=0;o!==i;o++)t[o]=n[r+o];return t}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=a*2,l=a*3,h=i-t,u=(n-t)/h,d=u*u,p=d*u,m=e*l,_=m-l,g=-2*p+3*d,f=p-d,y=1-g,b=f-d+u;for(let S=0;S!==a;S++){let P=o[_+S+a],C=o[_+S+c]*h,I=o[m+S+a],L=o[m+S]*h;r[S]=y*P+b*C+g*I+f*L}return r}},Uy=new Jt,zh=class extends Ca{interpolate_(e,t,n,i){let r=super.interpolate_(e,t,n,i);return Uy.fromArray(r).normalize().toArray(r),r}},pn={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Gs={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Tf={9728:zt,9729:Zt,9984:Jc,9985:mr,9986:xs,9987:Dn},Af={33071:jn,33648:xr,10497:ei},mh={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Hh={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Di={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},Oy={CUBICSPLINE:void 0,LINEAR:Ds,STEP:Ls},gh={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Fy(s){return s.DefaultMaterial===void 0&&(s.DefaultMaterial=new Bs({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Nn})),s.DefaultMaterial}function Qi(s,e,t){for(let n in t.extensions)s[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function hi(s,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(s.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function By(s,e,t){let n=!1,i=!1,r=!1;for(let l=0,h=e.length;l<h;l++){let u=e[l];if(u.POSITION!==void 0&&(n=!0),u.NORMAL!==void 0&&(i=!0),u.COLOR_0!==void 0&&(r=!0),n&&i&&r)break}if(!n&&!i&&!r)return Promise.resolve(s);let o=[],a=[],c=[];for(let l=0,h=e.length;l<h;l++){let u=e[l];if(n){let d=u.POSITION!==void 0?t.getDependency("accessor",u.POSITION):s.attributes.position;o.push(d)}if(i){let d=u.NORMAL!==void 0?t.getDependency("accessor",u.NORMAL):s.attributes.normal;a.push(d)}if(r){let d=u.COLOR_0!==void 0?t.getDependency("accessor",u.COLOR_0):s.attributes.color;c.push(d)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(c)]).then(function(l){let h=l[0],u=l[1],d=l[2];return n&&(s.morphAttributes.position=h),i&&(s.morphAttributes.normal=u),r&&(s.morphAttributes.color=d),s.morphTargetsRelative=!0,s})}function zy(s,e){if(s.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)s.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(s.morphTargetInfluences.length===t.length){s.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)s.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function Hy(s){let e,t=s.extensions&&s.extensions[ze.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+_h(t.attributes):e=s.indices+":"+_h(s.attributes)+":"+s.mode,s.targets!==void 0)for(let n=0,i=s.targets.length;n<i;n++)e+=":"+_h(s.targets[n]);return e}function _h(s){let e="",t=Object.keys(s).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+s[t[n]]+";";return e}function Vh(s){switch(s){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Vy(s){return s.search(/\.jpe?g($|\?)/i)>0||s.search(/^data\:image\/jpeg/)===0?"image/jpeg":s.search(/\.webp($|\?)/i)>0||s.search(/^data\:image\/webp/)===0?"image/webp":s.search(/\.ktx2($|\?)/i)>0||s.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var Gy=new Re,Gh=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new ky,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,r=!1,o=-1;if(typeof navigator<"u"){let a=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(a)===!0;let c=a.match(/Version\/(\d+)/);i=n&&c?parseInt(c[1],10):-1,r=a.indexOf("Firefox")>-1,o=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||r&&o<98?this.textureLoader=new ua(this.options.manager):this.textureLoader=new pa(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new Dr(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,i=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(o){let a={scene:o[0][i.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:i.asset,parser:n,userData:{}};return Qi(r,a,i),hi(a,i),Promise.all(n._invokeAll(function(c){return c.afterRoot&&c.afterRoot(a)})).then(function(){for(let c of a.scenes)c.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,r=t.length;i<r;i++){let o=t[i].joints;for(let a=0,c=o.length;a<c;a++)e[o[a]].isBone=!0}for(let i=0,r=e.length;i<r;i++){let o=e[i];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(n[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let i=n.clone(),r=(o,a)=>{let c=this.associations.get(o);c!=null&&this.associations.set(a,c);for(let[l,h]of o.children.entries())r(h,a.children[l])};return r(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let i=e(t[n]);if(i)return i}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let i=0;i<t.length;i++){let r=e(t[i]);r&&n.push(r)}return n}getDependency(e,t){let n=e+":"+t,i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":i=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(r,o){return n.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[ze.KHR_BINARY_GLTF].body);let i=this.options;return new Promise(function(r,o){n.load(Li.resolveURL(t.uri,i.path),r,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){let i=t.byteLength||0,r=t.byteOffset||0;return n.slice(r,r+i)})}loadAccessor(e){let t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){let o=mh[i.type],a=Gs[i.componentType],c=i.normalized===!0,l=new a(i.count*o);return Promise.resolve(new Et(l,o,c))}let r=[];return i.bufferView!==void 0?r.push(this.getDependency("bufferView",i.bufferView)):r.push(null),i.sparse!==void 0&&(r.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(r).then(function(o){let a=o[0],c=mh[i.type],l=Gs[i.componentType],h=l.BYTES_PER_ELEMENT,u=h*c,d=i.byteOffset||0,p=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,m=i.normalized===!0,_,g;if(p&&p!==u){let f=Math.floor(d/p),y="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+f+":"+i.count,b=t.cache.get(y);b||(_=new l(a,f*p,i.count*p/h),b=new Ar(_,p/h),t.cache.add(y,b)),g=new Rr(b,c,d%p/h,m)}else a===null?_=new l(i.count*c):_=new l(a,d,i.count*c),g=new Et(_,c,m);if(i.sparse!==void 0){let f=mh.SCALAR,y=Gs[i.sparse.indices.componentType],b=i.sparse.indices.byteOffset||0,S=i.sparse.values.byteOffset||0,P=new y(o[1],b,i.sparse.count*f),C=new l(o[2],S,i.sparse.count*c);a!==null&&(g=new Et(g.array.slice(),g.itemSize,g.normalized)),g.normalized=!1;for(let I=0,L=P.length;I<L;I++){let x=P[I];if(g.setX(x,C[I*c]),c>=2&&g.setY(x,C[I*c+1]),c>=3&&g.setZ(x,C[I*c+2]),c>=4&&g.setW(x,C[I*c+3]),c>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}g.normalized=m}return g})}loadTexture(e){let t=this.json,n=this.options,r=t.textures[e].source,o=t.images[r],a=this.textureLoader;if(o.uri){let c=n.manager.getHandler(o.uri);c!==null&&(a=c)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,n){let i=this,r=this.json,o=r.textures[e],a=r.images[t],c=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[c])return this.textureCache[c];let l=this.loadImageSource(t,n).then(function(h){h.flipY=!1,h.name=o.name||a.name||"",h.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(h.name=a.uri);let d=(r.samplers||{})[o.sampler]||{};return h.magFilter=Tf[d.magFilter]||Zt,h.minFilter=Tf[d.minFilter]||Dn,h.wrapS=Af[d.wrapS]||ei,h.wrapT=Af[d.wrapT]||ei,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==zt&&h.minFilter!==Zt,i.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[c]=l,l}loadImageSource(e,t){let n=this,i=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(u=>u.clone());let o=i.images[e],a=self.URL||self.webkitURL,c=o.uri||"",l=!1;if(o.bufferView!==void 0)c=n.getDependency("bufferView",o.bufferView).then(function(u){l=!0;let d=new Blob([u],{type:o.mimeType});return c=a.createObjectURL(d),c});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let h=Promise.resolve(c).then(function(u){return new Promise(function(d,p){let m=d;t.isImageBitmapLoader===!0&&(m=function(_){let g=new kt(_);g.needsUpdate=!0,d(g)}),t.load(Li.resolveURL(u,r.path),m,void 0,p)})}).then(function(u){return l===!0&&a.revokeObjectURL(c),hi(u,o),u.userData.mimeType=o.mimeType||Vy(o.uri),u}).catch(function(u){throw console.error("THREE.GLTFLoader: Couldn't load texture",c),u});return this.sourceCache[e]=h,h}assignTexture(e,t,n,i){let r=this;return this.getDependency("texture",n.index).then(function(o){if(!o)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(o=o.clone(),o.channel=n.texCoord),r.extensions[ze.KHR_TEXTURE_TRANSFORM]){let a=n.extensions!==void 0?n.extensions[ze.KHR_TEXTURE_TRANSFORM]:void 0;if(a){let c=r.associations.get(o);o=r.extensions[ze.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),r.associations.set(o,c)}}return i!==void 0&&(o.colorSpace=i),e[t]=o,o})}assignFinalMaterial(e){let t=e.geometry,n=e.material,i=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){let a="PointsMaterial:"+n.uuid,c=this.cache.get(a);c||(c=new Ir,Qt.prototype.copy.call(c,n),c.color.copy(n.color),c.map=n.map,c.sizeAttenuation=!1,this.cache.add(a,c)),n=c}else if(e.isLine){let a="LineBasicMaterial:"+n.uuid,c=this.cache.get(a);c||(c=new dn,Qt.prototype.copy.call(c,n),c.color.copy(n.color),c.map=n.map,this.cache.add(a,c)),n=c}if(i||r||o){let a="ClonedMaterial:"+n.uuid+":";i&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let c=this.cache.get(a);c||(c=n.clone(),r&&(c.vertexColors=!0),o&&(c.flatShading=!0),i&&(c.normalScale&&(c.normalScale.y*=-1),c.clearcoatNormalScale&&(c.clearcoatNormalScale.y*=-1)),this.cache.add(a,c),this.associations.set(c,this.associations.get(n))),n=c}e.material=n}getMaterialType(){return Bs}loadMaterial(e){let t=this,n=this.json,i=this.extensions,r=n.materials[e],o,a={},c=r.extensions||{},l=[];if(c[ze.KHR_MATERIALS_UNLIT]){let u=i[ze.KHR_MATERIALS_UNLIT];o=u.getMaterialType(),l.push(u.extendParams(a,r,t))}else{let u=r.pbrMetallicRoughness||{};if(a.color=new me(1,1,1),a.opacity=1,Array.isArray(u.baseColorFactor)){let d=u.baseColorFactor;a.color.setRGB(d[0],d[1],d[2],Ht),a.opacity=d[3]}u.baseColorTexture!==void 0&&l.push(t.assignTexture(a,"map",u.baseColorTexture,_t)),a.metalness=u.metallicFactor!==void 0?u.metallicFactor:1,a.roughness=u.roughnessFactor!==void 0?u.roughnessFactor:1,u.metallicRoughnessTexture!==void 0&&(l.push(t.assignTexture(a,"metalnessMap",u.metallicRoughnessTexture)),l.push(t.assignTexture(a,"roughnessMap",u.metallicRoughnessTexture))),o=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),l.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=Kt);let h=r.alphaMode||gh.OPAQUE;if(h===gh.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,h===gh.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&o!==Wt&&(l.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new se(1,1),r.normalTexture.scale!==void 0)){let u=r.normalTexture.scale;a.normalScale.set(u,u)}if(r.occlusionTexture!==void 0&&o!==Wt&&(l.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&o!==Wt){let u=r.emissiveFactor;a.emissive=new me().setRGB(u[0],u[1],u[2],Ht)}return r.emissiveTexture!==void 0&&o!==Wt&&l.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,_t)),Promise.all(l).then(function(){let u=new o(a);return r.name&&(u.name=r.name),hi(u,r),t.associations.set(u,{materials:e}),r.extensions&&Qi(i,u,r),u})}createUniqueName(e){let t=ft.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,i=this.primitiveCache;function r(a){return n[ze.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(c){return Rf(c,a,t)})}let o=[];for(let a=0,c=e.length;a<c;a++){let l=e[a],h=Hy(l),u=i[h];if(u)o.push(u.promise);else{let d;l.extensions&&l.extensions[ze.KHR_DRACO_MESH_COMPRESSION]?d=r(l):d=Rf(new xt,l,t),i[h]={primitive:l,promise:d},o.push(d)}}return Promise.all(o)}loadMesh(e){let t=this,n=this.json,i=this.extensions,r=n.meshes[e],o=r.primitives,a=[];for(let c=0,l=o.length;c<l;c++){let h=o[c].material===void 0?Fy(this.cache):this.getDependency("material",o[c].material);a.push(h)}return a.push(t.loadGeometries(o)),Promise.all(a).then(function(c){let l=c.slice(0,c.length-1),h=c[c.length-1],u=[];for(let p=0,m=h.length;p<m;p++){let _=h[p],g=o[p],f,y=l[p];if(g.mode===pn.TRIANGLES||g.mode===pn.TRIANGLE_STRIP||g.mode===pn.TRIANGLE_FAN||g.mode===void 0)f=r.isSkinnedMesh===!0?new Ko(_,y):new $e(_,y),f.isSkinnedMesh===!0&&f.normalizeSkinWeights(),g.mode===pn.TRIANGLE_STRIP?f.geometry=ph(f.geometry,xa):g.mode===pn.TRIANGLE_FAN&&(f.geometry=ph(f.geometry,Fr));else if(g.mode===pn.LINES)f=new Un(_,y);else if(g.mode===pn.LINE_STRIP)f=new ri(_,y);else if(g.mode===pn.LINE_LOOP)f=new ta(_,y);else if(g.mode===pn.POINTS)f=new na(_,y);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+g.mode);Object.keys(f.geometry.morphAttributes).length>0&&zy(f,r),f.name=t.createUniqueName(r.name||"mesh_"+e),hi(f,r),g.extensions&&Qi(i,f,g),t.assignFinalMaterial(f),u.push(f)}for(let p=0,m=u.length;p<m;p++)t.associations.set(u[p],{meshes:e,primitives:p});if(u.length===1)return r.extensions&&Qi(i,u[0],r),u[0];let d=new qe;r.extensions&&Qi(i,d,r),t.associations.set(d,{meshes:e});for(let p=0,m=u.length;p<m;p++)d.add(u[p]);return d})}loadCamera(e){let t,n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new At(Ma.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Os(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),hi(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let i=0,r=t.joints.length;i<r;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){let r=i.pop(),o=i,a=[],c=[];for(let l=0,h=o.length;l<h;l++){let u=o[l];if(u){a.push(u);let d=new Re;r!==null&&d.fromArray(r.array,l*16),c.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[l])}return new jo(a,c)})}loadAnimation(e){let t=this.json,n=this,i=t.animations[e],r=i.name?i.name:"animation_"+e,o=[],a=[],c=[],l=[],h=[];for(let u=0,d=i.channels.length;u<d;u++){let p=i.channels[u],m=i.samplers[p.sampler],_=p.target,g=_.node,f=i.parameters!==void 0?i.parameters[m.input]:m.input,y=i.parameters!==void 0?i.parameters[m.output]:m.output;_.node!==void 0&&(o.push(this.getDependency("node",g)),a.push(this.getDependency("accessor",f)),c.push(this.getDependency("accessor",y)),l.push(m),h.push(_))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(c),Promise.all(l),Promise.all(h)]).then(function(u){let d=u[0],p=u[1],m=u[2],_=u[3],g=u[4],f=[];for(let y=0,b=d.length;y<b;y++){let S=d[y],P=p[y],C=m[y],I=_[y],L=g[y];if(S===void 0)continue;S.updateMatrix&&S.updateMatrix();let x=n._createAnimationTracks(S,P,C,I,L);if(x)for(let M=0;M<x.length;M++)f.push(x[M])}return new ha(r,void 0,f)})}createNodeMesh(e){let t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(r){let o=n._getNodeRef(n.meshCache,i.mesh,r);return i.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let c=0,l=i.weights.length;c<l;c++)a.morphTargetInfluences[c]=i.weights[c]}),o})}loadNode(e){let t=this.json,n=this,i=t.nodes[e],r=n._loadNodeShallow(e),o=[],a=i.children||[];for(let l=0,h=a.length;l<h;l++)o.push(n.getDependency("node",a[l]));let c=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([r,Promise.all(o),c]).then(function(l){let h=l[0],u=l[1],d=l[2];d!==null&&h.traverse(function(p){p.isSkinnedMesh&&p.bind(d,Gy)});for(let p=0,m=u.length;p<m;p++)h.add(u[p]);return h})}_loadNodeShallow(e){let t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let r=t.nodes[e],o=r.name?i.createUniqueName(r.name):"",a=[],c=i._invokeOne(function(l){return l.createNodeMesh&&l.createNodeMesh(e)});return c&&a.push(c),r.camera!==void 0&&a.push(i.getDependency("camera",r.camera).then(function(l){return i._getNodeRef(i.cameraCache,r.camera,l)})),i._invokeAll(function(l){return l.createNodeAttachment&&l.createNodeAttachment(e)}).forEach(function(l){a.push(l)}),this.nodeCache[e]=Promise.all(a).then(function(l){let h;if(r.isBone===!0?h=new Cr:l.length>1?h=new qe:l.length===1?h=l[0]:h=new lt,h!==l[0])for(let u=0,d=l.length;u<d;u++)h.add(l[u]);if(r.name&&(h.userData.name=r.name,h.name=o),hi(h,r),r.extensions&&Qi(n,h,r),r.matrix!==void 0){let u=new Re;u.fromArray(r.matrix),h.applyMatrix4(u)}else r.translation!==void 0&&h.position.fromArray(r.translation),r.rotation!==void 0&&h.quaternion.fromArray(r.rotation),r.scale!==void 0&&h.scale.fromArray(r.scale);return i.associations.has(h)||i.associations.set(h,{}),i.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],i=this,r=new qe;n.name&&(r.name=i.createUniqueName(n.name)),hi(r,n),n.extensions&&Qi(t,r,n);let o=n.nodes||[],a=[];for(let c=0,l=o.length;c<l;c++)a.push(i.getDependency("node",o[c]));return Promise.all(a).then(function(c){for(let h=0,u=c.length;h<u;h++)r.add(c[h]);let l=h=>{let u=new Map;for(let[d,p]of i.associations)(d instanceof Qt||d instanceof kt)&&u.set(d,p);return h.traverse(d=>{let p=i.associations.get(d);p!=null&&u.set(d,p)}),u};return i.associations=l(r),r})}_createAnimationTracks(e,t,n,i,r){let o=[],a=e.name?e.name:e.uuid,c=[];Di[r.path]===Di.weights?e.traverse(function(d){d.morphTargetInfluences&&c.push(d.name?d.name:d.uuid)}):c.push(a);let l;switch(Di[r.path]){case Di.weights:l=oi;break;case Di.rotation:l=ai;break;case Di.position:case Di.scale:l=li;break;default:switch(n.itemSize){case 1:l=oi;break;case 2:case 3:default:l=li;break}break}let h=i.interpolation!==void 0?Oy[i.interpolation]:Ds,u=this._getArrayFromAccessor(n);for(let d=0,p=c.length;d<p;d++){let m=new l(c[d]+"."+Di[r.path],t.array,u,h);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(m),o.push(m)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let n=Vh(t.constructor),i=new Float32Array(t.length);for(let r=0,o=t.length;r<o;r++)i[r]=t[r]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){let i=this instanceof ai?zh:Ca;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function Wy(s,e,t){let n=e.attributes,i=new Ut;if(n.POSITION!==void 0){let a=t.json.accessors[n.POSITION],c=a.min,l=a.max;if(c!==void 0&&l!==void 0){if(i.set(new A(c[0],c[1],c[2]),new A(l[0],l[1],l[2])),a.normalized){let h=Vh(Gs[a.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let r=e.targets;if(r!==void 0){let a=new A,c=new A;for(let l=0,h=r.length;l<h;l++){let u=r[l];if(u.POSITION!==void 0){let d=t.json.accessors[u.POSITION],p=d.min,m=d.max;if(p!==void 0&&m!==void 0){if(c.setX(Math.max(Math.abs(p[0]),Math.abs(m[0]))),c.setY(Math.max(Math.abs(p[1]),Math.abs(m[1]))),c.setZ(Math.max(Math.abs(p[2]),Math.abs(m[2]))),d.normalized){let _=Vh(Gs[d.componentType]);c.multiplyScalar(_)}a.max(c)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(a)}s.boundingBox=i;let o=new on;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,s.boundingSphere=o}function Rf(s,e,t){let n=e.attributes,i=[];function r(o,a){return t.getDependency("accessor",o).then(function(c){s.setAttribute(a,c)})}for(let o in n){let a=Hh[o]||o.toLowerCase();a in s.attributes||i.push(r(n[o],a))}if(e.indices!==void 0&&!s.index){let o=t.getDependency("accessor",e.indices).then(function(a){s.setIndex(a)});i.push(o)}return Ve.workingColorSpace!==Ht&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Ve.workingColorSpace}" not supported.`),hi(s,e),Wy(s,e,t),Promise.all(i).then(function(){return e.targets!==void 0?By(s,e.targets,t):s})}var Wh=new Map;function Je(s,e={}){let t=s+JSON.stringify(e);return Wh.has(t)||Wh.set(t,new Tn({color:s,...e})),Wh.get(t)}function es(s,e){let t=new me(s);return t.r=Math.min(1,t.r*e),t.g=Math.min(1,t.g*e),t.b=Math.min(1,t.b*e),"#"+t.getHexString()}var $h=new wn(1,1,1),zr=new ra(.5,.5,1,20),Xy=new ji(.5,16,12);function ct(s,e,t,n,i=0,r=0,o=0){let a=new $e($h,n);return a.scale.set(s,e,t),a.position.set(i,r+e/2,o),a}function Hr(s,e,t,n,i,r){s.beginPath(),s.roundRect?s.roundRect(e,t,n,i,r):s.rect(e,t,n,i)}var $y=new Set(["rackmount","box","tower","nas","router","printer"]),If=new Set(["eth","sfp","console","usb","power"]);function qy(s){let{w:e,h:t}=s.dims,n=s.shape==="rackmount"?1024:512;return[n,Math.max(24,Math.min(1024,Math.round(n*t/e)))]}function Ia(s,e,t,n,i,r,o,a=1.25){let c=s.length;if(!c)return;let l=n-e,h=i-t,u=Math.max(1,Math.min(c,Math.round(Math.sqrt(c*a*h/l))||1)),d=Math.ceil(c/u),p=l/d,m=h/u,_=p*.8,g=m*.7;_>g*a*1.3?_=g*a*1.3:g>_/a&&(g=_/a),s.forEach((f,y)=>{let b=Math.floor(y/d),S=y%d;r.set(f.id,{side:o,x:e+S*p+(p-_)/2,y:t+b*m+(m-g)/2,pw:_,ph:g})})}function qh(s){let[e,t]=qy(s),n=new Map,i=s.ports;if($y.has(s.shape)){let r=s.face||"plain",o=r==="switch"||r==="firewall"||r==="patch",a=[],c=[],l=[],h=[],u=[];for(let p of i)If.has(p.kind)&&(p.kind==="power"?(r==="pdu"&&!/^in/i.test(p.name)?h:l).push(p):o&&(p.kind==="eth"||p.kind==="sfp")?(r==="patch"&&/R$/i.test(p.name)?u:a).push(p):c.push(p));if(a.length){let p=a.filter(P=>P.kind==="eth"),m=a.filter(P=>P.kind==="sfp"),_=e*(r==="firewall"?.3:.16),g=e*.97-(m.length?m.length*e*.045+e*.02:0),f=p.length>12?2:1,y=Math.ceil(p.length/f)||1,b=Math.min((g-_)/y,t*.9),S=Math.min(t*(f===2?.36:.5),b*.85);p.forEach((P,C)=>{let I=Math.floor(C/y),L=C%y,x=f===2?I===0?t*.1:t*.54:(t-S)/2;n.set(P.id,{side:"front",x:_+L*b+b*.1,y:x,pw:b*.8,ph:S})}),m.forEach((P,C)=>n.set(P.id,{side:"front",x:g+e*.02+C*e*.045,y:t*.3,pw:e*.038,ph:t*.4}))}for(let p of u){let m=i.find(g=>g.name.toUpperCase()===p.name.toUpperCase().replace(/R$/,"F")),_=m&&n.get(m.id);_?n.set(p.id,{side:"back",x:e-_.x-_.pw,y:_.y,pw:_.pw,ph:_.ph}):c.push(p)}if(h.length){let p=h.length;h.forEach((m,_)=>n.set(m.id,{side:"front",x:e*.15+_*(e*.75/p),y:t*.2,pw:e*.05,ph:t*.6}))}s.dims.h>s.dims.w*.8?(Ia(c,e*.15,t*.06,e*.85,t*.42,n,"back"),Ia(l,e*.3,t*.78,e*.7,t*.95,n,"back",1.4)):(Ia(c,e*.05,t*.12,l.length?e*.76:e*.95,t*.88,n,"back"),Ia(l,e*.79,t*.15,e*.97,t*.85,n,"back",1.4));for(let p of n.values())p.x!==void 0&&(p.u=(p.x+p.pw/2)/e,p.v=(p.y+p.ph/2)/t)}else{let r=i.filter(o=>If.has(o.kind));r.forEach((o,a)=>n.set(o.id,{side:"front",u:(a+1)/(r.length+1),v:.5}))}return{W:e,H:t,map:n}}function Df(s,e,t){let{w:n,h:i,d:r}=s.dims;if(!e||e.kind==="wifi")return{pos:new A(0,i,0),normal:new A(0,1,0)};let o=t.map.get(e.id);if(!o)return{pos:new A(0,i/2,0),normal:null};let a=(1-o.v)*i;return o.side==="back"?{pos:new A(-(o.u-.5)*n,a,-r/2-.001),normal:new A(0,0,-1)}:{pos:new A((o.u-.5)*n,a,r/2+.001),normal:new A(0,0,1)}}function Xh(s,e,t,n,i){let{x:r,y:o,pw:a,ph:c}=t,l=e.enabled?n.has(e.id)?"#38e07a":"#33403a":"#e0a030";if(e.kind==="power"){s.fillStyle="#0a0a0a",Hr(s,r,o,a,c,Math.min(a,c)*.2),s.fill(),s.fillStyle=n.has(e.id)?"#d8b04a":"#3a3a3a";for(let h of[.3,.5,.7])s.fillRect(r+a*h-a*.04,o+c*(h===.5?.25:.45),a*.08,c*.3)}else e.kind==="sfp"?(s.fillStyle="#0d0f12",Hr(s,r,o,a,c,2),s.fill(),s.strokeStyle="#4b525c",s.lineWidth=1,s.strokeRect(r+1,o+1,a-2,c-2),s.fillStyle=l,s.fillRect(r+a*.15,o-c*.25,a*.3,c*.15)):e.kind==="usb"?(s.fillStyle="#0d0f12",s.fillRect(r,o+c*.25,a,c*.5),s.fillStyle="#2e6bd1",s.fillRect(r+a*.1,o+c*.35,a*.8,c*.12)):(s.fillStyle=e.kind==="console"?"#16384f":"#121418",Hr(s,r,o,a,c,2),s.fill(),s.fillStyle="#2a2e35",s.fillRect(r+a*.28,o+c*.72,a*.44,c*.18),s.fillStyle=l,s.fillRect(r+a*.05,o+c*.06,a*.18,c*.12),s.fillStyle=l==="#33403a"?"#33403a":"#e0c040",s.fillRect(r+a*.77,o+c*.06,a*.18,c*.12));if(i){let h=Math.max(8,Math.min(c*.32,15));s.fillStyle="rgba(230,235,240,0.85)",s.font=`600 ${h}px system-ui, sans-serif`,s.textBaseline="top";let u=s.measureText(e.name).width;s.fillText(e.name,r+a/2-u/2,o+c+2)}}function Yy(s,e,t){let{W:n,H:i,map:r}=t,o=document.createElement("canvas");o.width=n,o.height=i;let a=o.getContext("2d");a.fillStyle=es(s.color,.8),a.fillRect(0,0,n,i),a.fillStyle="rgba(0,0,0,0.25)";for(let h=n*.02;h<n*.98;h+=n*.02)a.fillRect(h,i*.04,n*.006,i*.06);let c=s.ports.filter(h=>{var u;return((u=r.get(h.id))==null?void 0:u.side)==="back"});for(let h of c){let u=r.get(h.id);Xh(a,h,u,e,u.ph<i*.3||i>=160)}let l=new Zi(o);return l.colorSpace=_t,l.anisotropy=2,c.length?l:(l.dispose(),null)}function Ky(s,e,t){let{W:n,H:i}=t,r=document.createElement("canvas");r.width=n,r.height=i;let o=r.getContext("2d"),a=s.color,c=o.createLinearGradient(0,0,0,i);c.addColorStop(0,es(a,1.25)),c.addColorStop(1,es(a,.85)),o.fillStyle=c,o.fillRect(0,0,n,i),o.strokeStyle="rgba(255,255,255,0.12)",o.lineWidth=Math.max(1,i*.04),o.strokeRect(1,1,n-2,i-2);let l=s.ports.filter(m=>m.kind==="eth"||m.kind==="sfp"),h=m=>m.enabled?e.has(m.id)?"#38e07a":"#33403a":"#e0a030",u=(m,_,g,f,y="rgba(255,255,255,0.75)")=>{o.fillStyle=y,o.font=`600 ${f}px system-ui, sans-serif`,o.textBaseline="middle",o.fillText(m,_,g)},d=s.face||"plain";if(d==="switch"||d==="firewall"||d==="patch"){let m=0;for(let _ of s.ports){let g=t.map.get(_.id);!g||g.side!=="front"||(m++,d==="patch"?(o.fillStyle="#0b0c0e",Hr(o,g.x,g.y,g.pw,g.ph,2),o.fill(),u(_.name.replace(/F$/i,""),g.x+g.pw*.25,g.y<i*.3?g.y+g.ph+Math.max(5,g.ph*.18):g.y-Math.max(5,g.ph*.18),Math.max(8,g.ph*.28),"#c9ccd1")):Xh(o,_,g,e,!1))}u(s.name,n*.02,i*.3,Math.max(9,Math.min(i*.28,22))),d==="firewall"&&(o.fillStyle="rgba(255,255,255,0.08)",o.fillRect(n*.02,i*.55,n*.24,i*.25))}else if(d==="server"){let m=s.bays||8,_=s.uHeight>=2?m>=12?3:2:1,g=Math.ceil(m/_),f=n*.18,y=n*.86,b=(y-f)/g,S=i*.84/_;for(let P=0;P<m;P++){let C=Math.floor(P/g),I=P%g,L=f+I*b,x=i*.08+C*S;o.fillStyle="#1a1c20",o.fillRect(L+1,x+1,b-2,S-2),o.fillStyle="#3c4048",o.fillRect(L+b*.08,x+S*.2,b*.84,S*.25),o.fillStyle=P%3===0?"#38e07a":"#2ea8ff",o.fillRect(L+b*.8,x+S*.62,b*.1,S*.18)}u(s.name,n*.015,i*.35,Math.max(9,Math.min(i*.3,22))),o.fillStyle="#2ea8ff",o.beginPath(),o.arc(n*.93,i*.5,Math.min(i*.18,10),0,7),o.fill()}else if(d==="router"||d==="plain"||d==="vents"){if(d==="vents"){o.fillStyle="rgba(0,0,0,0.35)";for(let m=n*.1;m<n*.9;m+=n*.03)o.fillRect(m,i*.25,n*.012,i*.5)}if(d==="router"){let m=Math.min(8,Math.max(4,l.length+2));for(let _=0;_<m;_++){let g=l[_];o.fillStyle=g?h(g):"#38e07a",o.beginPath(),o.arc(n*(.2+_*.6/m),i*.5,Math.min(i*.12,8),0,7),o.fill()}}i>40&&u(s.name,n*.04,i*(d==="router"?.2:.5),Math.min(i*.18,28))}else if(d==="tower"){o.fillStyle="rgba(0,0,0,0.35)",o.fillRect(n*.12,i*.06,n*.76,i*.08),o.fillRect(n*.12,i*.16,n*.76,i*.08),o.fillStyle="rgba(255,255,255,0.08)";for(let m=i*.5;m<i*.95;m+=i*.025)o.fillRect(n*.15,m,n*.7,i*.008);o.fillStyle="#2ea8ff",o.beginPath(),o.arc(n*.5,i*.33,n*.06,0,7),o.fill(),u(s.name,n*.1,i*.42,Math.min(n*.09,40))}else if(d==="nas"){let m=s.bays||2,_=n*.08,g=n*.84/m;for(let f=0;f<m;f++){o.fillStyle="#16181b",o.fillRect(_+f*g+3,i*.08,g-6,i*.72),o.fillStyle="rgba(255,255,255,0.06)";for(let y=i*.12;y<i*.76;y+=i*.04)o.fillRect(_+f*g+g*.2,y,g*.6,i*.012);o.fillStyle="#38e07a",o.fillRect(_+f*g+g*.45,i*.84,g*.1,i*.03)}u(s.name,n*.08,i*.93,Math.min(n*.08,30))}else if(d==="ups")o.fillStyle="#0d2a3a",Hr(o,n*.3,i*.2,n*.4,i*.3,4),o.fill(),o.fillStyle="#5fd0ff",o.font=`${Math.max(8,i*.12)}px monospace`,o.textBaseline="middle",o.fillText("100%",n*.36,i*.35),o.fillStyle="#38e07a",o.beginPath(),o.arc(n*.2,i*.35,Math.min(i*.08,10),0,7),o.fill(),u(s.name,n*.05,i*.8,Math.max(9,Math.min(i*.14,26)));else if(d==="pdu"){for(let m of s.ports){let _=t.map.get(m.id);_&&_.side==="front"&&Xh(o,m,_,e,!1)}u(s.name,n*.015,i*.5,Math.max(9,i*.25))}let p=new Zi(r);return p.colorSpace=_t,p.anisotropy=2,p}function Pf(s,e,t,n,i){let r=Je(es(s.color,.9)),o=Je(es(s.color,1.05)),a=qh(s),c=new Tn({map:Ky(s,e,a)}),l=Yy(s,e,a),h=l?new Tn({map:l}):r,u=new $e($h,[r,r,o,r,c,h]);return u.userData.ownMaterial=c,l&&(u.userData.ownMaterial2=h),u.scale.set(t,n,i),u.position.y=n/2,u}var Vr={rackmount(s,e){let t=new qe,{w:n,h:i,d:r}=s.dims;t.add(Pf(s,e,n,i,r));let o=Je(es(s.color,.7));return t.add(ct(.025,i*.96,.004,o,-n/2-.0125,i*.02,r/2-.002)),t.add(ct(.025,i*.96,.004,o,n/2+.0125,i*.02,r/2-.002)),t},box(s,e){let t=new qe,{w:n,h:i,d:r}=s.dims;return t.add(Pf(s,e,n,i,r)),t},tower(s,e){return Vr.box(s,e)},nas(s,e){return Vr.box(s,e)},router(s,e){let t=Vr.box(s,e),{w:n,h:i,d:r}=s.dims,o=Je("#1b1d21");for(let a=0;a<4;a++){let c=new $e(zr,o);c.scale.set(.012,i*2.6,.012),c.position.set(-n*.38+a*n*.253,i+i*1.2,-r*.42),c.rotation.z=(a-1.5)*.12,t.add(c)}return t},ap(s){let e=new qe,{w:t,h:n}=s.dims,i=new $e(zr,Je(s.color));i.scale.set(t,n,t),i.position.y=n/2,e.add(i);let r=new $e(new aa(t*.32,t*.025,6,32),Je("#2ea8ff",{emissive:"#1477c9"}));return r.rotation.x=Math.PI/2,r.position.y=n+.001,e.add(r),e},laptop(s){let e=new qe,{w:t,h:n,d:i}=s.dims;e.add(ct(t,n,i,Je(s.color))),e.add(ct(t*.9,.002,i*.5,Je("#22252a"),0,n,i*.05));let r=new qe;return r.position.set(0,n,-i/2),r.add(ct(t,i*.95,.008,Je(s.color),0,0,0)),r.add(ct(t*.9,i*.82,.002,Je("#2b5c8a",{emissive:"#10263a"}),0,i*.06,.005)),r.rotation.x=-.25,e.add(r),e},phone(s){let e=new qe,{w:t,h:n,d:i}=s.dims;return e.add(ct(t,n,i,Je(s.color))),e.add(ct(t*.9,n*.92,.001,Je("#2b5c8a",{emissive:"#10263a"}),0,n*.04,i/2)),e},sbc(s){let e=new qe,{w:t,h:n,d:i}=s.dims;return e.add(ct(t,n*.12,i,Je(s.color))),e.add(ct(t*.18,n*.15,i*.25,Je("#b8bcc2"),-t*.1,n*.12,0)),e.add(ct(t*.2,n*.5,i*.28,Je("#c7ccd2"),t*.38,n*.12,-i*.25)),e.add(ct(t*.2,n*.55,i*.3,Je("#c7ccd2"),t*.38,n*.12,i*.2)),e.add(ct(t*.2,n*.4,i*.2,Je("#d8a54a"),t*.15,n*.12,i*.3)),e},camera(s){let e=new qe,{w:t,h:n,d:i}=s.dims,r=new $e(zr,Je(s.color));r.scale.set(t*.8,i,t*.8),r.rotation.x=Math.PI/2,r.position.set(0,n*.6,0),e.add(r),e.add(ct(t*.3,n*.4,t*.3,Je("#9aa0a6"),0,0,-i*.2));let o=new $e(zr,Je("#0b0c0e"));return o.scale.set(t*.4,.01,t*.4),o.rotation.x=Math.PI/2,o.position.set(0,n*.6,i/2),e.add(o),e},printer(s){let e=new qe,{w:t,h:n,d:i}=s.dims;return e.add(ct(t,n,i,Je(s.color))),e.add(ct(t*.6,.01,i*.35,Je("#f5f5f5"),0,n*.35,i*.6)),e.add(ct(t*.25,.02,i*.15,Je("#26292e"),t*.25,n,i*.3)),e},cloud(s){let e=new qe,{w:t,h:n,d:i}=s.dims,r=Je(s.color);return[[0,.45,0,.55],[-.3,.35,.05,.42],[.32,.33,0,.45],[.08,.62,-.05,.42],[-.12,.3,-.2,.4]].forEach(([o,a,c,l])=>{let h=new $e(Xy,r);h.scale.set(t*l,n*l*1.4,i*l),h.position.set(o*t,a*n,c*i),e.add(h)}),e},vm(s){let e=new qe,{w:t,h:n,d:i}=s.dims,r=new $e($h,new Tn({color:s.color,transparent:!0,opacity:.35,depthWrite:!1}));r.scale.set(t,n,i),r.position.y=n/2,r.userData.ownMaterial=r.material,e.add(r);let o=new Un(new Fs(new wn(t,n,i)),new dn({color:s.color}));return o.position.y=n/2,o.userData.ownGeometry=!0,e.add(o),e},cylinder(s){let e=new qe,{w:t,h:n,d:i}=s.dims,r=new $e(zr,Je(s.color));return r.scale.set(t,n,i),r.position.y=n/2,e.add(r),e},rack(s){let e=new qe,{w:t,h:n,d:i}=s.dims,r=Je(s.color),o=Je(es(s.color,1.3)),a=.03;for(let h of[-1,1])for(let u of[-1,1])e.add(ct(a,n,a,r,h*(t/2-a/2),0,u*(i/2-a/2)));e.add(ct(t,a,i,o,0,n-a,0)),e.add(ct(t,.06,i,r,0,0,0)),e.add(ct(.008,n-.1,i-2*a,o,-t/2+.004,.06,0)),e.add(ct(.008,n-.1,i-2*a,o,t/2-.004,.06,0));let c=s.rackUnits||42,l=Je("#3d434c");for(let h of[-1,1])e.add(ct(.018,c*is,.015,l,h*.2413,.06,i/2-.06));return e},desk(s){let e=new qe,{w:t,h:n,d:i}=s.dims;e.add(ct(t,.03,i,Je(s.color),0,n-.03,0));let r=Je("#3a3a3a");for(let o of[-1,1])for(let a of[-1,1])e.add(ct(.04,n-.03,.04,r,o*(t/2-.05),0,a*(i/2-.05)));return e},shelf(s){let e=new qe,{w:t,h:n,d:i}=s.dims,r=Je(s.color);for(let o of[-1,1])for(let a of[-1,1])e.add(ct(.02,n,.02,r,o*(t/2-.01),0,a*(i/2-.01)));for(let o of s.levels||[.4,.9,1.4])e.add(ct(t,.015,i,r,0,o-.015,0));return e}},Pa=new Map,Lf=null;function Zy(s){return s!=null&&s.modelData?(Pa.has(s.id)||(Lf||=new Ra,Pa.set(s.id,new Promise((e,t)=>Lf.load(s.modelData,n=>e(n.scene),void 0,t)))),Pa.get(s.id)):null}function La(s){Pa.delete(s)}function jy(s,e,t,n){let r=new Ut().setFromObject(s).getSize(new A),o=Math.min(e/(r.x||1),t/(r.y||1),n/(r.z||1));s.scale.setScalar(o);let a=new Ut().setFromObject(s),c=a.getCenter(new A);return s.position.x-=c.x,s.position.z-=c.z,s.position.y-=a.min.y,s}function Yh(s,e,t,n){let i=new qe,o=(Vr[s.shape]||Vr.box)(s,t||new Set);i.add(o);let a=e&&e.modelData?Zy(e):null;return a&&a.then(c=>{let l=jy(c.clone(!0),s.dims.w,s.dims.h,s.dims.d);i.remove(o),Ws(o),i.add(l),n&&n()}).catch(()=>{}),i}function Ws(s){s.traverse(e=>{var t;for(let n of["ownMaterial","ownMaterial2"])e.userData[n]&&((t=e.userData[n].map)==null||t.dispose(),e.userData[n].dispose());e.userData.ownGeometry&&e.geometry.dispose()})}function Kh(s){let{w:e,h:t,d:n}=s.dims,i=1.4/Math.max(e,n,.01);return t*i>1.5&&(i=1.5/t),i}var Zh={copper:"#4cc2ff",fiber:"#ff9f43",wireless:"#b28dff",tunnel:"#ff5ea8",virtual:"#8a93a6",console:"#7bd88f",power:"#ffd166"},Nf=new Set(["wireless","tunnel","virtual"]),Xs=class{constructor(e,t){this.app=t,this.el=e,this.mode="topo",this.tool="select",this.objs=new Map,this.layouts=new Map,this.statusMap=new Map,this.linkObjs=new Map,this.camState={},this.selection=null,this.pending=!1;let n=t.settings;this.renderer=new Er({antialias:!!n.antialias,powerPreference:"low-power"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,n.pixelCap||1.25)),this.renderer.outputColorSpace=_t,e.appendChild(this.renderer.domElement),this.labels=new Aa,Object.assign(this.labels.domElement.style,{position:"absolute",inset:"0",pointerEvents:"none"}),e.appendChild(this.labels.domElement),this.scene=new Tr,this.scene.background=new me(t.settings.bgColor||"#0c130e"),this.camera=new At(45,1,.02,600),this.camera.position.set(10,12,16),this.controls=new Ea(this.camera,this.renderer.domElement),this.controls.screenSpacePanning=!1,this.controls.maxPolarAngle=Math.PI*.495,this.controls.mouseButtons={LEFT:An.ROTATE,MIDDLE:An.DOLLY,RIGHT:An.PAN},this.controls.addEventListener("change",()=>this.requestRender()),this.scene.add(new Nr(16777215,3492411,1.6));let i=new Pi(16777215,1.6);i.position.set(6,12,8),this.scene.add(i);let r=new Pi(13168854,.5);r.position.set(-8,5,-6),this.scene.add(r),this.env=new qe,this.devGroup=new qe,this.linkGroup=new qe,this.fx=new qe,this.scene.add(this.env,this.devGroup,this.linkGroup,this.fx),this.selBox=new _a(new lt,16762967),this.selBox.visible=!1,this.fx.add(this.selBox),this.band=new ri(new xt().setFromPoints([new A,new A]),new Lr({color:16762967,dashSize:.2,gapSize:.12})),this.band.visible=!1,this.fx.add(this.band),this.ray=new ma,this.ray.params.Line.threshold=.12,this.groundPlane=new rn(new A(0,1,0),0),new ResizeObserver(()=>this.resize()).observe(e),this.bindPointer(),this.resize()}requestRender(){this.pending||(this.pending=!0,requestAnimationFrame(()=>{this.pending=!1,this.render()}))}render(){this.renderer.render(this.scene,this.camera),this.labels.render(this.scene,this.camera)}resize(){let e=this.el.clientWidth||1,t=this.el.clientHeight||1;this.renderer.setSize(e,t),this.labels.setSize(e,t),this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.requestRender()}setMode(e){this.camState[this.mode]={pos:this.camera.position.clone(),target:this.controls.target.clone()},this.mode=e,this.rebuildAll();let t=this.camState[e];t?(this.camera.position.copy(t.pos),this.controls.target.copy(t.target),this.controls.update()):this.fit()}visible(e){return this.mode==="topo"?xu(e):bu(e)&&gi(this.app.lab,e)===this.app.roomId}clearGroup(e){for(let t of[...e.children])e.remove(t),Ws(t),t.traverse(n=>{n.isCSS2DObject&&n.element.remove()})}rebuildAll(){this.clearGroup(this.env),this.clearGroup(this.devGroup),this.clearGroup(this.linkGroup),this.objs.clear(),this.linkObjs.clear(),this.buildEnv(),this.layouts=new Map;for(let e of this.app.lab.devices)this.visible(e)&&this.addDevice(e);this.scene.updateMatrixWorld(!0);for(let e of this.app.lab.links)this.addLink(e);this.setSelection(this.selection),this.requestRender()}rebuildEnv(){this.clearGroup(this.env),this.scene.background.set(this.app.settings.bgColor||"#0c130e"),this.buildEnv(),this.requestRender()}buildEnv(){if(this.mode==="topo"){let[f,y]=kf(this.app.settings),b=new ga(120,120,f,y);b.userData.ownGeometry=!0,b.userData.ownMaterial=b.material,b.position.y=-.001,this.env.add(b);return}let e=this.app.currentRoom();if(!e)return;let{w:t,d:n,h:i}=e,r=document.createElement("canvas");r.width=r.height=128;let[o,,a]=kf(this.app.settings),c=r.getContext("2d");c.fillStyle=a,c.fillRect(0,0,128,128),c.globalAlpha=.8,c.strokeStyle=o,c.lineWidth=3,c.strokeRect(0,0,128,128);let l=new Zi(r);l.wrapS=l.wrapT=ei,l.repeat.set(t/.5,n/.5),l.colorSpace=_t,l.anisotropy=4;let h=new Tn({map:l}),u=new $e(new Us(t,n),h);u.rotation.x=-Math.PI/2,u.position.set(t/2,0,n/2),u.userData.ownMaterial=h,u.userData.ownGeometry=!0,this.env.add(u);let d=new Tn({color:"#7fa58b",transparent:!0,opacity:.13,depthWrite:!1,side:Kt}),p=.06,m=[[t/2,n+p/2,t+2*p,p],[t/2,-p/2,t+2*p,p],[-p/2,n/2,p,n],[t+p/2,n/2,p,n]];for(let[f,y,b,S]of m){let P=new $e(new wn(b,i,S),d);P.position.set(f,i/2,y),P.userData.ownGeometry=!0,this.env.add(P)}let _=new Un(new Fs(new wn(t,i,n)),new dn({color:"#4a6b54"}));_.position.set(t/2,i/2,n/2),_.userData.ownGeometry=!0,this.env.add(_);let g=this.makeLabel(`<b>${Gr(e.name)}</b><span>${t} m \xD7 ${n} m \xD7 ${i} m</span>`,"lbl room");g.position.set(t/2,.02,n+.35),this.env.add(g)}makeLabel(e,t="lbl"){let n=document.createElement("div");return n.className=t,n.innerHTML=e,new Ta(n)}deviceLabelHtml(e){let t=e.ports.filter(i=>i.ip&&i.enabled&&Dt(i.ip)).map(i=>i.ip.split("/")[0]),n=t.length?`<span>${Gr(t[0])}${t.length>1?" +"+(t.length-1):""}</span>`:"";return`<b>${Gr(e.name)}</b>${this.mode==="topo"?n:""}`}addDevice(e){let t=this.app.lab,n=new qe;n.userData.devId=e.id;let i=Yh(e,this.app.library.get(e.templateId),yu(t,e.id),()=>{n.traverse(a=>{a.userData.devId=e.id}),this.updateSelBox(),this.refreshLinks()}),r=1;this.mode==="topo"&&(r=Kh(e),i.scale.setScalar(r)),n.add(i),n.traverse(a=>{a.userData.devId=e.id});let o=this.makeLabel(this.deviceLabelHtml(e),this.mode==="topo"?"lbl":"lbl small");o.visible=this.app.settings.labels&&!(this.mode==="room"&&Gn(e)),o.position.y=e.dims.h*r+(this.mode==="topo"?.35:.06)+(e.shape==="router"&&this.mode==="topo"?.4:0),this.mode==="room"&&e.phys.mount==="rack"&&(o.position.set(-e.dims.w/2-.05,e.dims.h/2,0),o.element.classList.add("side"),o.visible=this.app.settings.labels&&this.app.settings.rackLabels,o.userData.rack=!0),n.add(o),this.devGroup.add(n),this.objs.set(e.id,{root:n,label:o,scale:r,rackLabel:!!o.userData.rack}),this.place(e),this.setStatus(e.id)}place(e){let t=this.objs.get(e.id);if(!t)return;let n=t.root;if(this.mode==="topo"){n.position.set(e.topo.x,0,e.topo.z),n.rotation.y=0;return}if(e.phys.mount==="rack"&&e.phys.rackId){let i=He(this.app.lab,e.phys.rackId);if(i){let r=(i.phys.rot||0)*Math.PI/180,o=new A(0,.06+((e.phys.rackU||1)-1)*is,i.dims.d/2-.05-e.dims.d/2);o.applyAxisAngle(new A(0,1,0),r),n.position.set(i.phys.x+o.x,o.y+(i.phys.elev||0),i.phys.z+o.z),n.rotation.y=r;return}}n.position.set(e.phys.x,e.phys.elev||0,e.phys.z),n.rotation.y=(e.phys.rot||0)*Math.PI/180}refreshDevice(e){let t=He(this.app.lab,e),n=this.objs.get(e);if(n&&(this.devGroup.remove(n.root),Ws(n.root),n.label.element.remove(),this.objs.delete(e)),this.layouts.delete(e),t&&this.visible(t)&&this.addDevice(t),t&&Yt(t)&&this.mode==="room")for(let i of this.app.lab.devices)i.phys.rackId===t.id&&this.refreshDevice(i.id);this.refreshLinks(),this.setSelection(this.selection)}anchor(e){let t=this.objs.get(e);if(!t)return null;let n=He(this.app.lab,e),i=t.root.position.clone();return this.mode==="topo"?i.y=Math.min(n.dims.h*t.scale*.5,.45):i.y+=n.dims.h*.5,i}refreshLinks(){this.clearGroup(this.linkGroup),this.linkObjs.clear(),this.scene.updateMatrixWorld(!0);for(let e of this.app.lab.links)this.addLink(e);this.requestRender()}portEnd(e,t){let n=this.objs.get(e);if(!n)return null;let i=He(this.app.lab,e);if(!this.app.settings.portAnchors)return{pos:this.anchor(e),normal:null};let r=n.root.children[0];this.layouts.has(e)||this.layouts.set(e,qh(i));let o=Df(i,Mt(i,t),this.layouts.get(e)),a=r.localToWorld(o.pos.clone()),c=o.normal?o.normal.clone().transformDirection(r.matrixWorld):null;return{pos:a,normal:c}}addLink(e){if(this.mode==="room"&&(e.medium==="tunnel"||e.medium==="virtual"||!this.app.settings.cables)||this.mode==="topo"&&e.medium==="power"&&!this.app.settings.powerLinks)return;let t=this.portEnd(e.a.dev,e.a.port),n=this.portEnd(e.b.dev,e.b.port);if(!t||!n)return;let i=t.pos,r=n.pos,o=e.color||Zh[e.medium]||"#9aa4b2",a=i.distanceTo(r),c=this.mode==="topo",l=c?Math.min(1.2,Math.max(.35,a*.22)):Math.min(.3,Math.max(.05,a*.25)),h=(g,f)=>{let y=f.clone().sub(g);return y.y=0,y.lengthSq()>1e-6?y.normalize():new A(0,1,0)},u=i.clone().addScaledVector(t.normal||h(i,r),l),d=r.clone().addScaledVector(n.normal||h(r,i),l);if(c){let g=Math.min(2.5,a*(e.medium==="tunnel"?.28:Nf.has(e.medium)?.12:.08));u.y+=g,d.y+=g}else{let g=Math.min(.4,a*.12);u.y=Math.max(.02,u.y-g),d.y=Math.max(.02,d.y-g)}let p=new Pr(i,u,d,r),m=new qe;m.userData.linkId=e.id;let _;if(Nf.has(e.medium)){let g=new xt().setFromPoints(p.getPoints(40));_=new ri(g,new Lr({color:o,dashSize:this.mode==="topo"?.25:.06,gapSize:this.mode==="topo"?.15:.04})),_.computeLineDistances(),_.userData.ownMaterial=_.material}else{let g=c?e.medium==="power"?.012:.02:.004;_=new $e(new la(p,28,g,5,!1),new Tn({color:o,emissive:o,emissiveIntensity:.25})),_.userData.ownMaterial=_.material}if(_.userData.ownGeometry=!0,_.userData.linkId=e.id,m.add(_),this.mode==="topo"){let g=He(this.app.lab,e.a.dev),f=He(this.app.lab,e.b.dev),y=Mt(g,e.a.port),b=Mt(f,e.b.port),S=(y==null?void 0:y.enabled)&&(b==null?void 0:b.enabled);for(let[P,C]of[[0,y],[1,b]]){let I=new $e(Jy,S?Qy:ex);if(I.position.copy(p.getPoint(P)),I.userData.linkId=e.id,m.add(I),this.app.settings.portLabels&&C){let L=this.makeLabel(Gr(C.name),"plbl");L.position.copy(p.getPoint(P<.5?.12:.88)),m.add(L)}}if(e.label){let P=this.makeLabel(Gr(e.label),"plbl mid");P.position.copy(p.getPoint(.5)),m.add(P)}}this.linkGroup.add(m),this.linkObjs.set(e.id,{group:m,curve:p,line:_})}applyStatus(e){this.statusMap=e||new Map;for(let t of this.objs.keys())this.setStatus(t);this.requestRender()}setStatus(e){let t=this.objs.get(e);if(!t)return;let n=this.statusMap.get(e),i=t.label.element;for(let c of["st-up","st-down","st-degraded","st-unknown"])i.classList.remove(c);n&&i.classList.add("st-"+n),t.ring&&(t.root.remove(t.ring),t.ring.geometry.dispose(),t.ring=null);let r=He(this.app.lab,e);if(!n||!r||this.mode==="room"&&r.phys.mount==="rack")return;let o=Math.max(r.dims.w,r.dims.d)*t.scale*.62+(this.mode==="topo"?.08:.02),a=new $e(new oa(o,o+(this.mode==="topo"?.09:.025),40),Uf[n]||Uf.unknown);a.rotation.x=-Math.PI/2,a.position.y=.006,a.raycast=()=>{},a.userData.ownGeometry=!0,t.root.add(a),t.ring=a}setSelection(e){this.selection=e;for(let[t,n]of this.linkObjs){let i=e&&e.type==="link"&&e.id===t;n.line.material.emissiveIntensity!==void 0?n.line.material.emissiveIntensity=i?1:.25:n.line.material.opacity=1,n.line.scale.setScalar(1)}this.updateSelBox();for(let[t,n]of this.objs){let i=!!e&&e.type==="device"&&e.id===t;n.label.element.classList.toggle("sel",i),n.rackLabel&&(n.label.visible=this.app.settings.labels&&(this.app.settings.rackLabels||i))}this.requestRender()}updateSelBox(){let e=this.selection,t=e&&e.type==="device"?this.objs.get(e.id):null;t?(this.scene.updateMatrixWorld(!0),this.selBox.setFromObject(t.root.children[0]),this.selBox.visible=!0):this.selBox.visible=!1}fit(){this.scene.updateMatrixWorld(!0);let e=new Ut;if(this.mode==="room"){let c=this.app.currentRoom();c&&e.set(new A(0,0,0),new A(c.w,c.h,c.d))}for(let c of this.objs.values())e.expandByObject(c.root.children[0]);e.isEmpty()&&e.set(new A(-5,0,-5),new A(5,1,5));let t=e.getCenter(new A),n=e.getSize(new A),i=Math.max(n.x,n.z,n.y*1.5)*.5+.5,r=Math.tan(this.camera.fov*Math.PI/180/2),o=Math.max(i/r,i/(r*Math.max(.3,this.camera.aspect)))*1.02,a=this.camera.position.clone().sub(this.controls.target).normalize();(a.lengthSq()<.5||a.y<.2)&&a.set(.45,.75,.9).normalize(),this.controls.target.copy(t),this.camera.position.copy(t).addScaledVector(a,o),this.controls.update(),this.requestRender()}top(){let e=this.controls.target,t=Math.max(6,this.camera.position.distanceTo(e));this.camera.position.set(e.x,e.y+t,e.z+.001),this.controls.update(),this.requestRender()}ndc(e){let t=this.renderer.domElement.getBoundingClientRect();return new se((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height)*2+1)}pick(e){this.ray.setFromCamera(this.ndc(e),this.camera);let t=this.ray.intersectObjects([this.devGroup,this.linkGroup],!0);for(let n of t){if(n.object.isCSS2DObject)continue;let i=n.object;for(;i&&i.userData.devId===void 0&&i.userData.linkId===void 0;)i=i.parent;if(i){if(i.userData.devId!==void 0)return{type:"device",id:i.userData.devId,point:n.point};if(i.userData.linkId!==void 0)return{type:"link",id:i.userData.linkId,point:n.point}}}return null}ground(e,t=0){this.ray.setFromCamera(this.ndc(e),this.camera),this.groundPlane.constant=-t;let n=new A;return this.ray.ray.intersectPlane(this.groundPlane,n)?n:null}snap(e){if(!this.app.settings.snap)return e;let t=this.mode==="topo"?.5:.05;return Math.round(e/t)*t}bindPointer(){let e=this.renderer.domElement;e.addEventListener("contextmenu",t=>t.preventDefault()),e.addEventListener("pointerdown",t=>{if(t.button!==0||(this.down={x:t.clientX,y:t.clientY},this.tool!=="select"))return;let n=this.pick(t);if(n&&n.type==="device"){let i=this.app.lab,r=He(i,n.id);this.mode==="room"&&r.phys.mount==="rack"&&r.phys.rackId&&(r=He(i,r.phys.rackId)||r);let o=this.ground(t);if(!o||this.app.settings.lockLayout)return;let a=this.mode==="topo"?r.topo:r.phys;this.drag={dev:r,clickId:n.id,off:{x:a.x-o.x,z:a.z-o.z},moved:!1},this.controls.enabled=!1,e.setPointerCapture(t.pointerId)}}),e.addEventListener("pointermove",t=>{if(this.drag){if(!this.drag.moved&&Math.hypot(t.clientX-this.down.x,t.clientY-this.down.y)<4)return;this.drag.moved=!0;let n=this.ground(t);if(!n)return;let i=this.drag.dev,r=this.mode==="topo"?i.topo:i.phys;if(r.x=this.snap(n.x+this.drag.off.x),r.z=this.snap(n.z+this.drag.off.z),this.place(i),this.mode==="room"&&Yt(i))for(let o of this.app.lab.devices)o.phys.rackId===i.id&&this.place(o);this.refreshLinks(),this.updateSelBox(),this.requestRender();return}if(this.tool==="link"&&this.linkFrom){let n=this.anchor(this.linkFrom),i=this.ground(t,n?n.y:0);n&&i&&(this.band.geometry.setFromPoints([n,i]),this.band.computeLineDistances(),this.band.visible=!0,this.requestRender())}this.hoverPending||(this.hoverPending=!0,requestAnimationFrame(()=>{this.hoverPending=!1;let n=this.pick(t);e.style.cursor=this.tool==="place"?"copy":n?this.tool==="link"?"crosshair":"pointer":this.tool==="link"?"crosshair":"default"}))}),e.addEventListener("pointerup",t=>{if(t.button!==0)return;let n=this.down&&Math.hypot(t.clientX-this.down.x,t.clientY-this.down.y)<4;if(this.drag){let r=this.drag;if(this.drag=null,this.controls.enabled=!0,r.moved){this.app.afterDrag(r.dev);return}this.app.select({type:"device",id:r.clickId});return}if(!n)return;if(this.tool==="place"){let r=this.ground(t);r&&this.app.placeAt(r);return}let i=this.pick(t);if(this.tool==="link"){i&&i.type==="device"?this.app.linkClick(i.id,t.clientX,t.clientY):this.app.cancelLink();return}this.app.select(i?{type:i.type,id:i.id}:null)}),e.addEventListener("dblclick",t=>{let n=this.pick(t);n&&n.type==="device"&&this.app.openConsole(n.id)}),this.el.addEventListener("dragover",t=>{t.dataTransfer.types.includes("text/x-labtracer-template")&&(t.preventDefault(),t.dataTransfer.dropEffect="copy")}),this.el.addEventListener("drop",t=>{let n=t.dataTransfer.getData("text/x-labtracer-template");if(!n)return;t.preventDefault();let i=this.ground(t);i&&this.app.placeTemplate(n,i)})}setLinkSource(e){this.linkFrom=e,e||(this.band.visible=!1,this.requestRender())}animatePacket(e,t,n){let i=e.map(([d,p])=>{let m=this.linkObjs.get(d),_=this.app.lab.links.find(g=>g.id===d);return!m||!_?null:{curve:m.curve,rev:_.a.dev!==p}}).filter(Boolean);this.anim&&this.fx.remove(this.anim.mesh);let r=this.mode==="topo"?.16:.04,o=new $e(new ji(r,12,8),new Wt({color:t?6094749:16735324}));o.userData.ownGeometry=!0,this.fx.add(o);let a=380,c=Math.max(1,i.length)*a,l=performance.now(),h=this.anim={mesh:o},u=d=>{if(this.anim!==h)return;let p=Math.max(0,d-l);if(i.length){let m=Math.min(i.length-1,Math.floor(p/a)),_=Math.min(1,(p-m*a)/a);i[m].rev&&(_=1-_),o.position.copy(i[m].curve.getPoint(_))}else o.visible=!1;this.render(),p<c?requestAnimationFrame(u):setTimeout(()=>{this.anim===h&&(this.fx.remove(o),o.geometry.dispose(),this.anim=null,this.requestRender(),n&&n())},t?250:900)};requestAnimationFrame(u)}flashDevice(e,t="fail"){let n=this.objs.get(e);n&&(n.label.element.classList.add(t),setTimeout(()=>n.label.element.classList.remove(t),2200))}static preview(e,t,n){let i=new Er({canvas:e,antialias:!0}),r=new Tr;r.background=new me("#121a15"),r.add(new Nr(16777215,3492411,1.6));let o=new Pi(16777215,1.6);o.position.set(3,6,5),r.add(o);let a=new At(35,e.width/e.height,.01,100),c=null,l=(h,u)=>{c&&(r.remove(c),Ws(c)),c=Yh(h,u,new Set,()=>i.render(r,a));let d=Kh(h);c.scale.setScalar(d),r.add(c);let p=h.dims.h*d;a.position.set(2.2,1.4+p*.6,2.8),a.lookAt(0,p*.4,0),i.render(r,a)};return l(t,n),{draw:l,dispose:()=>{c&&Ws(c),i.dispose()}}}};function kf(s){let e=new me(s.gridColor||"#2b4a35"),t=new me(s.bgColor||"#0c130e"),n=t.clone().lerp(e,.55),i=t.clone().lerp(new me("#1f2e24"),.7);return["#"+e.getHexString(),"#"+n.getHexString(),"#"+i.getHexString()]}var Jy=new ji(.03,8,6),Da=s=>new Wt({color:s,transparent:!0,opacity:.75,side:Kt,depthWrite:!1}),Uf={up:Da(3727482),degraded:Da(16757575),down:Da(16735324),unknown:Da(7042694)},Qy=new Wt({color:3727482}),ex=new Wt({color:16739164});function Gr(s){return String(s??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}var tx=()=>document.getElementById("overlay");function Se(s,e="info",t=2600){let n=v("div",{class:"toast "+e},s);document.getElementById("toasts").appendChild(n),setTimeout(()=>n.classList.add("out"),t),setTimeout(()=>n.remove(),t+400)}function On(s,e,t=[{label:"Close"}],n={}){let i=v("div",{class:"modal-back"}),r=()=>{i.remove(),document.removeEventListener("keydown",o,!0),n.onClose&&n.onClose()},o=h=>{h.key==="Escape"&&(h.stopPropagation(),r())};document.addEventListener("keydown",o,!0);let a=v("div",{class:"modal-foot"},t.map(h=>v("button",{class:"btn"+(h.primary?" primary":"")+(h.danger?" danger":""),onclick:async()=>{(h.onClick?await h.onClick(r):!1)!==!0&&r()}},h.label))),c=v("div",{class:"modal"+(n.wide?" wide":""),role:"dialog"},v("div",{class:"modal-head"},v("span",null,s),v("button",{class:"x",title:"Close",onclick:r},"\xD7")),v("div",{class:"modal-body"},e),a);i.appendChild(c),i.addEventListener("mousedown",h=>{h.target===i&&r()}),tx().appendChild(i);let l=c.querySelector("input,select,textarea");return l&&!n.noFocus&&setTimeout(()=>l.focus(),30),{close:r,el:c}}function Ni(s,e,t="",n="OK"){return new Promise(i=>{let r=v("input",{class:"inp",value:t,onkeydown:c=>{c.key==="Enter"&&(o=!0,i(r.value.trim()),a.close())}}),o=!1,a=On(s,v("label",{class:"fld"},v("span",null,e),r),[{label:"Cancel"},{label:n,primary:!0,onClick:()=>{o=!0,i(r.value.trim())}}],{onClose:()=>{o||i(null)}});setTimeout(()=>r.select(),40)})}function Rn(s,e,t="OK",n=!1){return new Promise(i=>{let r=!1;On(s,v("p",null,e),[{label:"Cancel"},{label:t,primary:!n,danger:n,onClick:()=>{r=!0,i(!0)}}],{onClose:()=>{r||i(!1)}})})}function Xr(s,e,t,n){Wr();let i=v("div",{class:"popup",id:"popup"},t?v("div",{class:"popup-title"},t):null,v("div",{class:"popup-list"},n.map(o=>o==="-"?v("hr"):v("button",{class:"popup-item"+(o.disabled?" disabled":"")+(o.cls?" "+o.cls:""),disabled:o.disabled,onclick:()=>{Wr(),o.onClick&&o.onClick()}},v("span",null,o.label),o.sub?v("small",null,o.sub):null))));document.body.appendChild(i);let r=i.getBoundingClientRect();return i.style.left=Math.min(s+6,innerWidth-r.width-8)+"px",i.style.top=Math.min(e+6,innerHeight-r.height-8)+"px",setTimeout(()=>document.addEventListener("mousedown",Of,!0),0),i}function Of(s){let e=document.getElementById("popup");e&&!e.contains(s.target)&&Wr()}function Wr(){var s;(s=document.getElementById("popup"))==null||s.remove(),document.removeEventListener("mousedown",Of,!0)}var Ff={rackmount:'<rect x="2" y="9" width="20" height="6" rx="1"/><path d="M5 12h2M9 12h2M13 12h2"/>',box:'<rect x="4" y="8" width="16" height="8" rx="1.5"/>',router:'<rect x="3" y="12" width="18" height="6" rx="1.5"/><path d="M6 12V5M12 12V4M18 12V5"/>',ap:'<ellipse cx="12" cy="13" rx="9" ry="4"/><path d="M8 8a6 6 0 0 1 8 0"/>',tower:'<rect x="7" y="3" width="10" height="18" rx="1.5"/><circle cx="12" cy="8" r="1.5"/>',nas:'<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M9.5 7v10M14.5 7v10"/>',laptop:'<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M2 19h20"/>',phone:'<rect x="8" y="3" width="8" height="18" rx="2"/>',sbc:'<rect x="3" y="7" width="18" height="10" rx="1"/><rect x="7" y="10" width="4" height="4"/><path d="M15 9h4v6h-4"/>',camera:'<rect x="3" y="8" width="14" height="7" rx="3"/><path d="M17 11l4-2v6l-4-2"/>',printer:'<rect x="4" y="9" width="16" height="8" rx="1"/><path d="M7 9V4h10v5M7 17v3h10v-3"/>',cloud:'<path d="M7 18a4 4 0 0 1 0-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 18 18z"/>',vm:'<rect x="5" y="5" width="14" height="14" rx="1" stroke-dasharray="3 2"/>',cylinder:'<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5V6"/>',rack:'<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M8 6h8M8 9h8M8 12h8M8 15h8"/>',desk:'<path d="M3 9h18M5 9v10M19 9v10"/>',shelf:'<path d="M5 3v18M19 3v18M5 7h14M5 12h14M5 17h14"/>'};function nx(s,e){return`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${e||"currentColor"}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${Ff[s]||Ff.box}</svg>`}var Na=class{constructor(e,t){this.el=e,this.app=t,this.filter="",this.collapsed=new Set(t.store.getPref("collapsed",[]))}render(){let e=this.app;In(this.el);let t=v("input",{class:"inp search",placeholder:"Search devices\u2026",value:this.filter,oninput:i=>{this.filter=i.target.value,this.renderList(n)}}),n=v("div",{class:"pal-list"});this.el.append(v("div",{class:"pal-head"},t),v("div",{class:"pal-actions"},v("button",{class:"btn small primary",onclick:()=>this.editTemplate(null),title:"Make a new device type"},"+ Custom object"),v("button",{class:"btn small",onclick:()=>this.importTemplates(),title:"Import templates from a .json file"},"Import"),v("button",{class:"btn small",onclick:()=>this.exportTemplates(),title:"Export your custom templates"},"Export")),n,v("div",{class:"pal-hint"},"Drag onto the canvas, or click then click a spot.")),this.renderList(n)}renderList(e){In(e);let t=this.filter.trim().toLowerCase(),n=this.app.library.all().filter(r=>!t||(r.name+" "+r.category+" "+(r.vendor||"")+" "+(r.model||"")).toLowerCase().includes(t)),i=[...new Set([...Ga,...n.map(r=>r.category)])];for(let r of i){let o=n.filter(l=>l.category===r);if(!o.length)continue;let a=t||!this.collapsed.has(r),c=v("button",{class:"pal-cat"+(a?" open":""),onclick:()=>{this.collapsed.has(r)?this.collapsed.delete(r):this.collapsed.add(r),this.app.store.setPref("collapsed",[...this.collapsed]),this.renderList(e)}},v("span",{class:"chev"},"\u25B8"),r,v("small",null,o.length));if(e.appendChild(c),!!a)for(let l of o){let h=this.app.library.isCustom(l.id),u=this.app.placingTpl===l.id,d=v("div",{class:"pal-item"+(u?" active":""),draggable:"true",title:l.name,onclick:()=>this.app.startPlacing(l.id),ondragstart:p=>{p.dataTransfer.setData("text/x-labtracer-template",l.id),p.dataTransfer.effectAllowed="copy"}},v("span",{class:"ico",html:nx(l.shape,l.color&&l.color.toLowerCase()!=="#1d1f24"?ix(l.color):null)}),v("span",{class:"nm"},l.name),h?v("span",{class:"badge"},"custom"):null,h?v("button",{class:"mini",title:"Edit",onclick:p=>{p.stopPropagation(),this.editTemplate(l)}},"\u270E"):null,h?v("button",{class:"mini",title:"Delete",onclick:async p=>{p.stopPropagation(),await Rn("Delete template",`Delete "${l.name}"? Devices already placed keep their settings.`,"Delete",!0)&&(this.app.library.setCustom(this.app.library.custom.filter(m=>m.id!==l.id)),await this.app.saveLibrary(),this.render())}},"\xD7"):null,h?null:v("button",{class:"mini",title:"Copy into a new custom object",onclick:p=>{p.stopPropagation();let m=js(l);delete m.id,m.name=l.name+" (custom)",this.editTemplate(m,!0)}},"\u29C9"));e.appendChild(d)}}}async importTemplates(){let e=await Ui(".json,application/json");if(e)try{let t=JSON.parse(await ns(e)),n=Array.isArray(t)?t:t.templates||[t],i=0;for(let r of n)!r||!r.name||!r.shape||(r.id="cus_"+wt("t").slice(2),this.app.library.custom.push(r),i++);await this.app.saveLibrary(),this.render(),Se(`Imported ${i} template(s)`,"ok")}catch(t){Se("Import failed: "+t.message,"err")}}exportTemplates(){if(!this.app.library.custom.length)return Se("No custom templates yet","warn");zn("labtracer-templates.json",JSON.stringify({templates:this.app.library.custom},null,1),"application/json")}editTemplate(e,t=!1){let n=!e||t,i=e?js(e):{name:"New device",category:"Custom",shape:"box",face:"plain",dims:{w:.3,h:.06,d:.25},color:"#4b5563",l2:!1,l3:!1,ports:at("eth",0,1),attrs:{}};i.portRows||=jh(i.ports||[]),i.attrs||={};let r=[...new Set([...Ga,"Custom",...this.app.library.all().map(x=>x.category)])],o=(x,M,R)=>v("label",{class:"fld"},v("span",null,x),M,R?v("small",null,R):null),a=(x,M,R)=>v("input",{class:"inp",type:"number",step:M,min:0,value:x,oninput:O=>{R(parseFloat(O.target.value)||0),u()}}),c=(x,M,R)=>v("select",{class:"inp",onchange:O=>{R(O.target.value),u()}},x.map(([O,F])=>v("option",{value:O,selected:O===M?"selected":null},F))),l=v("canvas",{width:300,height:200,class:"preview"}),h=null,u=()=>{i.ports=Bf(i.portRows);let x=ss({...i,id:i.id||"preview"});try{h?h.draw(x,i):h=Xs.preview(l,x,i)}catch{}d.textContent=`${i.ports.length} port(s): `+i.ports.slice(0,12).map(M=>M.name).join(", ")+(i.ports.length>12?"\u2026":"")},d=v("div",{class:"muted small"}),p=v("div",{class:"port-rows"}),m=()=>{In(p),p.appendChild(v("div",{class:"pr head"},v("span",null,"Prefix / name"),v("span",null,"Start"),v("span",null,"Count"),v("span",null,"Kind"),v("span",null,"Speed"),v("span"))),i.portRows.forEach((x,M)=>p.appendChild(v("div",{class:"pr"},v("input",{class:"inp",value:x.prefix,oninput:R=>{x.prefix=R.target.value,u()}}),v("input",{class:"inp",type:"number",min:0,value:x.start??"",placeholder:"\u2014",oninput:R=>{x.start=R.target.value===""?null:+R.target.value,u()}}),v("input",{class:"inp",type:"number",min:1,value:x.count,oninput:R=>{x.count=Math.max(1,+R.target.value||1),u()}}),v("select",{class:"inp",onchange:R=>{x.kind=R.target.value,u()}},Js.map(R=>v("option",{value:R,selected:R===x.kind?"selected":null},R))),v("input",{class:"inp",value:x.speed||"",oninput:R=>{x.speed=R.target.value}}),v("button",{class:"mini",onclick:()=>{i.portRows.splice(M,1),m(),u()}},"\xD7")))),p.appendChild(v("button",{class:"btn small",onclick:()=>{i.portRows.push({prefix:"eth",start:i.portRows.length,count:1,kind:"eth",speed:"1G"}),m(),u()}},"+ Port group"))};m();let _=v("textarea",{class:"inp mono",rows:4,placeholder:"One per line: Key: value",oninput:x=>{i.attrs={};for(let M of x.target.value.split(`
`)){let R=M.indexOf(":");R>0&&(i.attrs[M.slice(0,R).trim()]=M.slice(R+1).trim())}}},Object.entries(i.attrs).map(([x,M])=>`${x}: ${M}`).join(`
`)),g=v("span",{class:"muted small"},i.modelData?`3D model loaded (${Math.round(i.modelData.length/1024)} KB)`:"Using the built-in shape."),f=[["","Size presets\u2026"],["1u","1U rack (0.44 \xD7 0.044 \xD7 0.5)"],["2u","2U rack (0.44 \xD7 0.089 \xD7 0.6)"],["4u","4U rack (0.44 \xD7 0.178 \xD7 0.65)"],["desk","Desktop box (0.25 \xD7 0.05 \xD7 0.2)"],["mini","Mini PC (0.18 \xD7 0.035 \xD7 0.18)"],["tower","Tower (0.2 \xD7 0.45 \xD7 0.45)"]],y={"1u":[.44,.0445,.5,1],"2u":[.44,.089,.6,2],"4u":[.44,.178,.65,4],desk:[.25,.05,.2,0],mini:[.18,.035,.18,0],tower:[.2,.45,.45,0]},b=a(i.dims.w,.01,x=>i.dims.w=x),S=a(i.dims.h,.001,x=>i.dims.h=x),P=a(i.dims.d,.01,x=>i.dims.d=x),C=a(i.uHeight||0,1,x=>i.uHeight=Math.round(x)),I=v("div",{class:"tpl-editor"},v("div",{class:"col"},o("Name",v("input",{class:"inp",value:i.name,oninput:x=>{i.name=x.target.value}})),v("div",{class:"row2"},o("Category",v("input",{class:"inp",list:"catlist",value:i.category,oninput:x=>{i.category=x.target.value||"Custom"}}),"Pick one or type a new one"),o("Colour",v("input",{class:"inp color",type:"color",value:i.color,oninput:x=>{i.color=x.target.value,u()}}))),v("datalist",{id:"catlist"},r.map(x=>v("option",{value:x}))),v("div",{class:"row2"},o("Vendor",v("input",{class:"inp",value:i.vendor||"",oninput:x=>{i.vendor=x.target.value}})),o("Model",v("input",{class:"inp",value:i.model||"",oninput:x=>{i.model=x.target.value}}))),v("div",{class:"row2"},o("Base shape",c(gu,i.shape,x=>{i.shape=x})),o("Front panel",c(_u,i.face,x=>{i.face=x}))),v("div",{class:"row4"},o("Width m",b),o("Height m",S),o("Depth m",P),o("Rack U",C,"0 = not rack-mount")),v("select",{class:"inp",onchange:x=>{let M=y[x.target.value];M&&([i.dims.w,i.dims.h,i.dims.d,i.uHeight]=M,b.value=M[0],S.value=M[1],P.value=M[2],C.value=M[3],M[3]&&i.shape!=="rackmount"&&(i.shape="rackmount"),u())}},f.map(([x,M])=>v("option",{value:x},M))),v("div",{class:"row4"},o("Drive bays",a(i.bays||0,1,x=>i.bays=Math.round(x))),o("Rack units",a(i.rackUnits||0,1,x=>i.rackUnits=Math.round(x)),"racks only"),v("label",{class:"chk"},v("input",{type:"checkbox",checked:i.l2,onchange:x=>{i.l2=x.target.checked}}),"Bridges L2"),v("label",{class:"chk"},v("input",{type:"checkbox",checked:i.l3,onchange:x=>{i.l3=x.target.checked}}),"Routes IP")),v("div",{class:"row4"},v("label",{class:"chk"},v("input",{type:"checkbox",checked:i.virtual,onchange:x=>{i.virtual=x.target.checked}}),"Virtual (topology only)"),v("label",{class:"chk"},v("input",{type:"checkbox",checked:i.physicalOnly,onchange:x=>{i.physicalOnly=x.target.checked}}),"Room only"),v("label",{class:"chk"},v("input",{type:"checkbox",checked:i.passthrough,onchange:x=>{i.passthrough=x.target.checked}}),"Patch pass-through"),o("Surface heights m",v("input",{class:"inp",value:(i.levels||[]).join(", "),placeholder:"e.g. 0.75",oninput:x=>{let M=x.target.value.split(",").map(R=>parseFloat(R)).filter(Number.isFinite);i.levels=M.length?M:null}}))),v("h4",null,"Ports"),p,d,v("h4",null,"Default attributes"),_),v("div",{class:"col side"},l,v("div",{class:"btnrow"},v("button",{class:"btn small",onclick:async()=>{let x=await Ui(".glb,.gltf");x&&(x.size>8*1024*1024&&Se("Large model: this may slow down saving and old PCs.","warn",4e3),i.modelData=await pu(x),i.id&&La(i.id),g.textContent=`3D model loaded (${Math.round(x.size/1024)} KB)`,u())}},"Import .glb model"),v("button",{class:"btn small",onclick:()=>{delete i.modelData,i.id&&La(i.id),g.textContent="Using the built-in shape.",u()}},"Remove model")),g,v("p",{class:"muted small"},"A .glb model is scaled to fit the width, height and depth. Use a single-file .glb (not .gltf with separate files). Keep it low-poly for older PCs."),n?null:v("label",{class:"chk"},v("input",{type:"checkbox",id:"applyExisting"}),"Also update shape, size and colour of devices already placed from this template"))),L=On(n?"New custom object":"Edit custom object",I,[{label:"Cancel"},{label:n?"Add to library":"Save",primary:!0,onClick:async()=>{var x;if(i.ports=Bf(i.portRows),!i.name.trim())return Se("Name is required","err"),!0;if(n)i.id="cus_"+wt("t").slice(3),this.app.library.custom.push(i);else{let M=this.app.library.custom.findIndex(R=>R.id===i.id);this.app.library.custom[M]=i,La(i.id),(x=L.el.querySelector("#applyExisting"))!=null&&x.checked&&this.app.applyTemplateToDevices(i)}await this.app.saveLibrary(),this.render(),this.app.viewport.rebuildAll(),Se(`Saved "${i.name}"`,"ok")}}],{wide:!0,onClose:()=>h&&h.dispose()});setTimeout(u,30)}};function ix(s){let e=parseInt(s.slice(1),16),t=e>>16,n=e>>8&255,i=e&255,r=(t+n+i)/3;if(r<110){let o=110/Math.max(r,1);t=Math.min(255,t*o+40),n=Math.min(255,n*o+40),i=Math.min(255,i*o+40)}return`rgb(${t|0},${n|0},${i|0})`}function Bf(s){let e=[];for(let t of s||[]){let n=Math.max(1,t.count||1);if(t.start===null||t.start===void 0||t.start==="")for(let i=0;i<n;i++)e.push({name:n>1?`${t.prefix}${i}`:t.prefix,kind:t.kind,speed:t.speed||""});else e.push(...at(t.prefix,+t.start,n,t.kind,t.speed||""))}return e}function jh(s){let e=[];for(let t of s){let n=/^(.*?)(\d+)$/.exec(t.name),i=e[e.length-1];if(n&&i&&i.start!==null&&i.prefix===n[1]&&i.kind===t.kind&&(i.speed||"")===(t.speed||"")&&+n[2]===i.start+i.count){i.count++;continue}n?e.push({prefix:n[1],start:+n[2],count:1,kind:t.kind,speed:t.speed||""}):e.push({prefix:t.name,start:null,count:1,kind:t.kind,speed:t.speed||""})}return e}function $s(s){let e=[];for(let t of s.ports){if(!t.enabled||!t.ip||!er.has(t.kind))continue;if(t.kind==="sub"){let i=Mt(s,t.parent);if(!i||!i.enabled)continue}let n=Dt(t.ip);n&&e.push({port:t,cidr:n})}return e}var zf=(s,e)=>{if(!s.enabled||!s.ip)return!1;let t=Dt(s.ip);return!!t&&t.ip===e},sx=(s,e)=>$s(s).some(t=>t.cidr.ip===e);function Ua(s){let e=[];for(let t of $s(s))e.push({type:"C",dest:qt(t.cidr.net)+"/"+t.cidr.prefix,via:"",dev:t.port.name});for(let t of s.routes)e.push({type:"S",dest:t.dest,via:t.via||"",dev:t.dev||""});return e}function rx(s,e){let t=$s(s),n=null;for(let i of t)jr(e,i.cidr)&&(!n||i.cidr.prefix>n.prefix)&&(n={prefix:i.cidr.prefix,port:i.port,nexthop:e,type:"connected"});for(let i of s.routes){let r=Dt(i.dest);if(!(!r||!jr(e,r))&&!(n&&r.prefix<=n.prefix)){if(i.via){let o=$t(i.via);if(o===null)continue;let a=t.filter(c=>jr(o,c.cidr)).sort((c,l)=>l.cidr.prefix-c.cidr.prefix)[0];if(!a)continue;n={prefix:r.prefix,port:a.port,nexthop:o,type:"static",route:i}}else if(i.dev){let o=s.ports.find(a=>a.name===i.dev&&a.enabled);if(!o)continue;n={prefix:r.prefix,port:o,nexthop:null,type:"static-dev",route:i}}}}return n}function Vf(s){let e=new Map,t=(i,r)=>{e.has(i)||e.set(i,[]),e.get(i).push(r)};for(let i of s.links)t(i.a.dev+"|"+i.a.port,i),t(i.b.dev+"|"+i.b.port,i);let n=new Map(s.devices.map(i=>[i.id,i]));return{byEnd:e,devs:n}}var ox=new Set(["power","console","usb","tunnel"]),Jh=(s,e)=>s.l2&&Vn.has(e.kind)&&e.mode!=="routed"&&!ox.has(e.kind),Hf=s=>s.mode==="trunk"?s.nativeVlan||1:s.vlan||1;function ax(s,e,t,n=Vf(s)){let i=new Map,r=new Set,o=[],a=(d,p,m)=>{if(d.id===e.id&&p.id===t.id||!p.enabled||!p.ip)return;let _=d.id+"|"+p.id;i.has(_)||i.set(_,{dev:d,port:p,path:m})},c=(d,p,m,_,g)=>o.push({t:"wire",d,p,tag:m,path:_,skipLink:g}),l=(d,p,m,_,g)=>o.push({t:"sw",d,vlan:p,path:m,inPort:_,inLink:g});if(t.kind==="sub"){let d=Mt(e,t.parent);d&&d.enabled&&c(e,d,t.vlan||null,[])}else t.kind==="svi"?l(e,t.vlan||1,[],null,null):t.kind==="loop"||(Jh(e,t)?l(e,Hf(t),[],null,null):c(e,t,null,[]));let h=0;for(;o.length&&h++<2e4;){let d=o.shift();if(d.t==="wire"){if(!d.p.enabled)continue;for(let p of n.byEnd.get(d.d.id+"|"+d.p.id)||[]){if(p.id===d.skipLink)continue;let m=p.a.dev===d.d.id&&p.a.port===d.p.id?p.b:p.a,_=n.devs.get(m.dev),g=_&&Mt(_,m.port);if(!g||!g.enabled)continue;let f=_.id+"|"+g.id+"|"+d.tag;if(r.has(f))continue;r.add(f);let y=[...d.path,[p.id,d.d.id]];u(_,g,d.tag,y,p.id)}}else{let p=d.d.id+"|sw|"+d.vlan;if(r.has(p))continue;r.add(p);for(let m of d.d.ports){if(!m.enabled||(m.kind==="svi"&&(m.vlan||1)===d.vlan&&a(d.d,m,d.path),!Jh(d.d,m))||(m.ip&&Hf(m)===d.vlan&&m.mode!=="trunk"&&a(d.d,m,d.path),m.id===d.inPort&&!Fi.has(m.kind)))continue;let _=m.id===d.inPort?d.inLink:null;m.mode==="trunk"?Va(m.trunkVlans)(d.vlan)&&c(d.d,m,d.vlan===(m.nativeVlan||1)?null:d.vlan,d.path,_):(m.vlan||1)===d.vlan&&c(d.d,m,null,d.path,_)}}}function u(d,p,m,_,g){if(d.passthrough){let f=/^(.*?)([FR])$/i.exec(p.name);if(f){let y=d.ports.find(b=>b.name.toUpperCase()===(f[1]+(f[2].toUpperCase()==="F"?"R":"F")).toUpperCase());y&&y.enabled&&c(d,y,m,_)}return}if(Jh(d,p)){let f;if(p.mode==="trunk"){if(f=m===null?p.nativeVlan||1:m,!Va(p.trunkVlans)(f))return}else if(f=p.vlan||1,m!==null&&m!==f)return;l(d,f,_,p.id,g);return}if(m===null)p.ip&&p.kind!=="svi"&&p.kind!=="sub"&&a(d,p,_);else for(let f of d.ports)f.kind==="sub"&&f.parent===p.id&&(f.vlan||null)===m&&a(d,f,_)}return[...i.values()]}function ka(s,e,t,n=16){let i=typeof t=="number"?t:$t(t);if(i===null)return{ok:!1,reason:"invalid IPv4 address",hops:[]};let r=Vf(s),o=[],a=e,c=null;for(let l=0;l<n;l++){if(sx(a,i))return{ok:!0,hops:o,srcIp:c,dst:a};if(l>0&&!a.l3)return{ok:!1,hops:o,srcIp:c,at:a,reason:`${a.name} got the packet but does not route (IP forwarding is off)`};let h=rx(a,i);if(!h)return{ok:!1,hops:o,srcIp:c,at:a,reason:`${a.name}: no route to ${qt(i)}`};if(l===0){let p=Dt(h.port.ip);c=p?p.ip:null}let u=ax(s,a,h.port,r),d;if(h.nexthop!==null?d=u.find(p=>zf(p.port,h.nexthop)):d=u.find(p=>zf(p.port,i))||u.find(p=>p.dev.l3),!d){let p=h.nexthop===null?"no peer":h.nexthop===i?`host ${qt(i)}`:`next hop ${qt(h.nexthop)}`;return{ok:!1,hops:o,srcIp:c,at:a,reason:`${a.name}: ${p} not reachable out ${h.port.name} (no layer 2 path)`}}o.push({from:a,to:d.dev,egress:h.port.name,ingress:d.port.name,ip:d.port.ip,path:d.path,via:h.type}),a=d.dev}return{ok:!1,hops:o,srcIp:c,at:a,reason:"TTL expired (routing loop)"}}function Oa(s,e,t){let n=$t(t);if(n===null)return{ok:!1,reason:"invalid IPv4 address",fwd:null};let i=ka(s,e,n);if(!i.ok)return{ok:!1,reason:i.reason,fwd:i};if(i.hops.length===0)return{ok:!0,fwd:i,back:null,local:!0};if(i.srcIp===null)return{ok:!1,reason:"no source address",fwd:i};let r=ka(s,i.dst,i.srcIp);return r.ok?{ok:!0,fwd:i,back:r}:{ok:!1,reason:"reply lost: "+r.reason,fwd:i,back:r}}function Gf(s){let e=new Map,t=new Set;for(let n of s.devices)for(let i of $s(n)){let r=i.cidr.ip;e.has(r)&&e.get(r)!==n.id+i.port.id?t.add(r):e.set(r,n.id+i.port.id)}return t}var qs=new Set(["power","console","usb"]);function Ys(s,e){let t=[],n=i=>e.l2&&!["svi","sub","loop","tunnel"].includes(i.kind)&&i.mode!=="routed";t.push("! LabTracer running-config"),t.push(`! ${e.name}${e.vendor||e.model?"  ("+[e.vendor,e.model].filter(Boolean).join(" ")+")":""}`);for(let i of e.attrs)i.k&&t.push(`! ${i.k}: ${i.v}`);t.push("!",`hostname ${e.name}`,"!"),e.l3&&t.push("ip routing","!");for(let i of[...e.vlans].sort((r,o)=>r.id-o.id))t.push(`vlan ${i.id}`),i.name&&t.push(` name ${i.name}`),t.push("!");for(let i of e.ports)if(!(qs.has(i.kind)&&!i.desc)){if(t.push(`interface ${i.name}`),i.desc&&t.push(` description ${i.desc}`),i.kind==="sub"){let r=Mt(e,i.parent);t.push(` ! parent ${r?r.name:"?"}`,` encapsulation dot1q ${i.vlan}`)}if(i.kind==="svi"&&t.push(` ! vlan interface for VLAN ${i.vlan}`),i.kind==="tunnel"&&t.push(" ! tunnel interface"),i.speed&&!qs.has(i.kind)&&t.push(` speed ${i.speed}`),i.mac&&t.push(` mac-address ${i.mac}`),!qs.has(i.kind))if(n(i)?i.mode==="trunk"?(t.push(" switchport mode trunk",` switchport trunk native vlan ${i.nativeVlan||1}`),i.trunkVlans&&i.trunkVlans!=="all"&&t.push(` switchport trunk allowed vlan ${i.trunkVlans}`)):t.push(" switchport mode access",` switchport access vlan ${i.vlan||1}`):e.l2&&i.mode==="routed"&&er.has(i.kind)&&!["svi","sub","loop","tunnel"].includes(i.kind)&&t.push(" no switchport"),i.ip){let r=Dt(i.ip);t.push(r?` ip address ${qt(r.ip)} ${qt(Zr(r.prefix))}`:` ip address ${i.ip}`)}else!n(i)&&er.has(i.kind)&&t.push(" no ip address");t.push(i.enabled?" no shutdown":" shutdown","!")}for(let i of e.routes){let r=Dt(i.dest),o=r?`${qt(r.net)} ${qt(Zr(r.prefix))}`:i.dest;t.push(`ip route ${o} ${i.via||i.dev}`)}e.routes.length&&t.push("!");for(let i of e.services)t.push(`service ${i.name}${i.port?" "+i.port:""}${i.enabled===!1?" disabled":""}`);return e.services.length&&t.push("!"),t.push("end"),t.join(`
`)}var vt=(s,e)=>String(s).padEnd(e),Fa=class{constructor(e){this.app=e,this.state=new Map}st(e){return this.state.has(e.id)||this.state.set(e.id,{mode:"exec",iface:null}),this.state.get(e.id)}prompt(e){let t=this.st(e);return t.iface?`${e.name}(config-if)#`:t.mode==="config"?`${e.name}(config)#`:`${e.name}#`}exec(e,t){let n=this.app.lab,i=this.st(e),r=t.trim(),o={out:"",changed:!1};if(!r||r.startsWith("!"))return o;let a=r.split(/\s+/),c=f=>(a[f]||"").toLowerCase(),l=(f,y,b=2)=>!!f&&y.startsWith(f.toLowerCase())&&f.length>=Math.min(b,y.length),h=f=>{o.out+=(o.out?`
`:"")+f},u=f=>h("% "+f),d=i.iface?Mt(e,i.iface):null;if(i.iface&&!d&&(i.iface=null),r==="?"||l(c(0),"help",1))return h(lx),o;if(l(c(0),"clear",3))return o.clear=!0,o;if(l(c(0),"end",3))return i.iface=null,i.mode="exec",o;if(l(c(0),"exit",2)||l(c(0),"quit",2))return i.iface?i.iface=null:i.mode="exec",o;if(l(c(0),"configure",4))return i.mode="config",h("Enter configuration commands, one per line.  End with END."),o;if(l(c(0),"enable",2)||l(c(0),"disable",4))return o;if(c(0)==="do")return a=a.slice(1),this.exec(e,a.join(" "));if(l(c(0),"show",2)){let f=c(1),y=c(2);if(l(f,"running-config",3))return h(Ys(n,e)),o;if(l(f,"startup-config",3)){let b=e.files.find(S=>S.name==="startup-config");return h(b?b.content:'% startup-config is not present (use "write memory")'),o}return l(f,"ip",2)&&l(y,"interface",3)?(h(this.ifBrief(n,e)),o):l(f,"interfaces",3)?(h(this.ifBrief(n,e,!0)),o):l(f,"ip",2)&&l(y,"route",2)?(h(this.routes(e)),o):l(f,"route",2)?(h(this.routes(e)),o):l(f,"vlan",2)?(h(this.vlans(e)),o):l(f,"cdp",2)||l(f,"lldp",2)||l(f,"neighbors",3)?(h(this.neighbors(n,e)),o):l(f,"services",3)?(h(e.services.length?e.services.map(b=>`${vt(b.name,22)} ${vt(b.port||"",8)} ${b.enabled===!1?"disabled":"enabled"}  ${b.notes||""}`).join(`
`):"No services defined."),o):l(f,"attributes",2)||l(f,"inventory",3)||l(f,"version",3)?(h([`${e.name}  ${e.vendor} ${e.model}`.trim(),e.serial?`Serial: ${e.serial}`:null,...e.attrs.filter(b=>b.k).map(b=>`${b.k}: ${b.v}`)].filter(Boolean).join(`
`)||"No attributes."),o):(u("Unknown show command. Try: show running-config | interfaces | ip interface brief | ip route | vlan | neighbors | services | inventory"),o)}if(l(c(0),"ping",2)){if(!a[1])return u("usage: ping A.B.C.D"),o;let f=Oa(n,e,a[1]);return h(`Sending 5, 100-byte ICMP Echos to ${a[1]}:`),h(f.ok?"!!!!!":"....."),h(`Success rate is ${f.ok?100:0} percent (${f.ok?5:0}/5)`),f.ok&&!f.local&&h("path: "+[e.name,...f.fwd.hops.map(y=>y.to.name)].join(" -> ")),f.local&&h("(local address)"),f.ok||h("reason: "+f.reason),o.anim=f,o}if(l(c(0),"traceroute",4)||c(0)==="tracert"){if(!a[1])return u("usage: traceroute A.B.C.D"),o;let f=ka(n,e,a[1]);return h(`Tracing the route to ${a[1]}`),f.hops.forEach((y,b)=>h(`  ${b+1}  ${vt(y.to.name,18)} ${(y.ip||"").split("/")[0]}  (via ${y.egress} -> ${y.ingress})`)),f.ok||h(`  ${f.hops.length+1}  * * *   ${f.reason}`),o.anim={ok:f.ok,fwd:f,reason:f.reason},o}if(l(c(0),"write",2)&&(!c(1)||l(c(1),"memory",3))||l(c(0),"copy",2)&&l(c(1),"running-config",3)){let f=Ys(n,e),y=e.files.find(b=>b.name==="startup-config");return y||(y={id:wt("file"),name:"startup-config",content:"",snapshots:[]},e.files.unshift(y)),y.content=f,y.snapshots.unshift({ts:Date.now(),note:"write memory",content:f}),h(`Building configuration...
[OK]`),o.changed=!0,o.save=!0,o}let p=c(0)==="no",m=c(p?1:0),_=p?a.slice(2):a.slice(1),g=f=>(_[f]||"").toLowerCase();if(d&&!l(m,"interface",3)&&!l(m,"hostname",4)&&!l(m,"vlan",4)){if(l(m,"ip",2)&&l(g(0),"address",2)){if(p)return d.ip="",o.changed=!0,o;let f;if(g(1)==="dhcp")f="dhcp";else if(_[2]){let y=Kr(_[2]);if(y===null||$t(_[1])===null)return u("Invalid address or mask"),o;f=`${_[1]}/${y}`}else f=_[1];return f!=="dhcp"&&!Dt(f)?(u("Invalid address. Use A.B.C.D/NN or A.B.C.D M.M.M.M"),o):(d.ip=f,o.changed=!0,o)}if(l(m,"shutdown",2))return d.enabled=p,o.changed=!0,o;if(l(m,"description",4))return d.desc=p?"":_.join(" "),o.changed=!0,o;if(l(m,"speed",2))return d.speed=p?"":_[0]||"",o.changed=!0,o;if(l(m,"mac-address",3))return d.mac=p?"":_[0]||"",o.changed=!0,o;if(l(m,"encapsulation",3)){let f=parseInt(_[1]??_[0],10);return f?(d.vlan=f,o.changed=!0,o):(u("usage: encapsulation dot1q N"),o)}if(l(m,"switchport",3)){if(p&&!_.length)return d.mode="routed",o.changed=!0,o;if(l(g(0),"mode",2)){let f=g(1);return["access","trunk","routed"].includes(f)?(d.mode=f,o.changed=!0,o):(u("mode must be access, trunk or routed"),o)}if(l(g(0),"access",2)&&l(g(1),"vlan",2)){let f=parseInt(_[2],10);return f?(d.vlan=f,d.mode==="routed"&&(d.mode="access"),o.changed=!0,o):(u("VLAN id required"),o)}if(l(g(0),"trunk",2)&&l(g(1),"native",2))return d.nativeVlan=parseInt(_[3]??_[2],10)||1,o.changed=!0,o;if(l(g(0),"trunk",2)&&l(g(1),"allowed",2)){let f=_.slice(3).join("")||_.slice(2).join("");return f=f.replace(/^vlan/i,""),d.trunkVlans=p?"all":f||"all",o.changed=!0,o}return u("usage: switchport mode access|trunk | switchport access vlan N | switchport trunk native vlan N | switchport trunk allowed vlan LIST"),o}if(l(m,"vlan",2)&&(d.kind==="svi"||d.kind==="sub"))return d.vlan=parseInt(_[0],10)||1,o.changed=!0,o}if(l(m,"interface",3)){let f=_.join("");if(!f)return u("usage: interface NAME"),o;if(/^vlan\d+$/i.test(f)&&(f="vlan"+f.slice(4)),p){let b=pi(e,f);return b?["svi","sub","loop","tunnel"].includes(b.kind)?(this.app.removePortRaw(e,b.id),o.changed=!0,o):(u("Only virtual interfaces can be removed here (use the Ports tab for physical ports)"),o):(u("No such interface"),o)}let y=pi(e,f);if(!y){let b;(b=/^vlan(\d+)$/i.exec(f))?y=Rt({name:"vlan"+b[1],kind:"svi",vlan:+b[1]}):(b=/^(.+)\.(\d+)$/.exec(f))&&pi(e,b[1])?y=Rt({name:f,kind:"sub",parent:pi(e,b[1]).id,vlan:+b[2]}):/^(lo|loopback)\d*$/i.test(f)?y=Rt({name:f,kind:"loop"}):/^(wg|tun|tunnel|oet|ipsec)\d*$/i.test(f)?y=Rt({name:f,kind:"tunnel"}):/^(br|bridge)\d*$/i.test(f)?y=Rt({name:f,kind:"svi",vlan:1}):y=Rt({name:f,kind:"eth"}),e.ports.push(y),h(`% Created ${y.kind} interface ${y.name}`),o.changed=!0}return i.mode="config",i.iface=y.id,o}if(l(m,"hostname",4))return _[0]?(e.name=_[0],o.changed=!0,o.renamed=!0,o):(u("usage: hostname NAME"),o);if(l(m,"vlan",4)){let f=parseInt(_[0],10);if(!f||f<1||f>4094)return u("VLAN id 1-4094"),o;if(p)return e.vlans=e.vlans.filter(b=>b.id!==f),o.changed=!0,o;let y=e.vlans.find(b=>b.id===f);return y||(y={id:f,name:""},e.vlans.push(y)),l(g(1),"name",2)&&(y.name=_.slice(2).join(" ")),o.changed=!0,o}if(l(m,"ip",2)&&l(g(0),"routing",3))return e.l3=!p,o.changed=!0,o;if(l(m,"ip",2)&&l(g(0),"default-gateway",3)){if(e.routes=e.routes.filter(f=>f.dest!=="0.0.0.0/0"),!p){if($t(_[1])===null)return u("Invalid gateway"),o;e.routes.push({dest:"0.0.0.0/0",via:_[1],dev:""})}return o.changed=!0,o}if(l(m,"ip",2)&&l(g(0),"route",3)){let f,y;if(_[1]&&_[1].includes("/"))f=_[1],y=_[2];else{let P=Kr(_[2]||"");if(P===null)return u("usage: ip route DEST MASK NEXTHOP|IFACE"),o;f=`${_[1]}/${P}`,y=_[3]}let b=Dt(f);if(!b)return u("Invalid destination"),o;if(f=qt(b.net)+"/"+b.prefix,p)return e.routes=e.routes.filter(P=>!(P.dest===f&&(!y||P.via===y||P.dev===y))),o.changed=!0,o;if(!y)return u("Next hop or interface required"),o;let S=$t(y)!==null?{dest:f,via:y,dev:""}:{dest:f,via:"",dev:y};return!S.via&&!pi(e,y)?(u(`No interface ${y}`),o):(e.routes.push(S),o.changed=!0,o)}if(l(m,"service",3)){if(!_[0])return u("usage: service NAME [PORT]"),o;let f=_[0];if(p)return e.services=e.services.filter(b=>b.name!==f),o.changed=!0,o;let y=e.services.find(b=>b.name===f);return y||(y={name:f,port:"",enabled:!0,notes:""},e.services.push(y)),_[1]&&(y.port=_[1]),o.changed=!0,o}if(l(m,"set",3)){if(!_[0])return u("usage: set ATTRIBUTE VALUE"),o;let f=_[0],y=_.slice(1).join(" ");if(p)e.attrs=e.attrs.filter(b=>b.k!==f);else{let b=e.attrs.find(S=>S.k.toLowerCase()===f.toLowerCase());b?b.v=y:e.attrs.push({k:f,v:y})}return o.changed=!0,o}return u(`Unknown command "${r}". Type ? for help.`),o}ifBrief(e,t,n=!1){let i=[vt("Interface",14)+vt("Kind",7)+vt("IP-Address",20)+vt("L2",18)+vt("Status",9)+"Link"];for(let r of t.ports){if(!n&&qs.has(r.kind))continue;let o=mi(e,t.id,r.id),a=o.map(h=>{var p;let u=nr(h,t.id,r.id),d=He(e,u.dev);return`${d==null?void 0:d.name}:${(p=Mt(d,u.port))==null?void 0:p.name}`}).join(", "),c="";r.kind==="svi"?c=`vlan ${r.vlan}`:r.kind==="sub"?c=`dot1q ${r.vlan}`:t.l2&&r.mode==="trunk"?c=`trunk n${r.nativeVlan||1} ${r.trunkVlans||"all"}`:t.l2&&r.mode!=="routed"?c=`access ${r.vlan||1}`:t.l2&&(c="routed");let l=r.enabled?o.length||["svi","sub","loop"].includes(r.kind)?"up":"down":"admin-dn";i.push(vt(r.name,14)+vt(r.kind,7)+vt(r.ip||"unassigned",20)+vt(c,18)+vt(l,9)+a),n&&r.desc&&i.push("  description: "+r.desc)}return i.join(`
`)}routes(e){let t=Ua(e);return t.length?["Codes: C - connected, S - static",...t.map(n=>`${n.type}    ${vt(n.dest,20)} ${n.via?"via "+n.via:""}${n.dev?(n.via?", ":"is directly connected, ")+n.dev:""}`)].join(`
`)+(e.l3?"":`
(IP forwarding is off on this device: it will not route for others)`):"Routing table is empty."}vlans(e){if(!e.l2)return'% This device does not bridge (enable "Bridges L2" to use VLANs).';let t=[vt("VLAN",6)+vt("Name",20)+"Ports"],n=new Set([...e.vlans.map(r=>r.id),...e.ports.filter(r=>r.mode==="access"&&!qs.has(r.kind)).map(r=>r.vlan||1)]);for(let r of[...n].sort((o,a)=>o-a)){let o=e.vlans.find(c=>c.id===r),a=e.ports.filter(c=>c.mode==="access"&&!qs.has(c.kind)&&!["svi","sub","loop","tunnel"].includes(c.kind)&&(c.vlan||1)===r).map(c=>c.name);t.push(vt(r,6)+vt(o?o.name||"":"(not in database)",20)+a.join(", "))}let i=e.ports.filter(r=>r.mode==="trunk");return i.length&&t.push("","Trunks: "+i.map(r=>`${r.name} (native ${r.nativeVlan||1}, allowed ${r.trunkVlans||"all"})`).join("; ")),t.join(`
`)}neighbors(e,t){var i,r;let n=[vt("Local",12)+vt("Neighbor",20)+vt("Remote",12)+"Medium"];for(let o of e.links){let a,c;if(o.a.dev===t.id)a=o.a,c=o.b;else if(o.b.dev===t.id)a=o.b,c=o.a;else continue;let l=He(e,c.dev);n.push(vt((i=Mt(t,a.port))==null?void 0:i.name,12)+vt(l==null?void 0:l.name,20)+vt((r=Mt(l,c.port))==null?void 0:r.name,12)+o.medium)}return n.length>1?n.join(`
`):"No neighbors."}},lx=`Exec:
  show running-config | startup-config | interfaces | ip interface brief
  show ip route | vlan | neighbors | services | inventory
  ping A.B.C.D        traceroute A.B.C.D
  write memory        (saves a startup-config snapshot)
  clear  configure terminal  end  exit
Global config:
  hostname NAME
  interface NAME      (vlanN = SVI, NAME.N = subinterface, loN, wgN, brN)
  no interface NAME   (virtual interfaces only)
  vlan N [name TEXT]  |  no vlan N
  ip route DEST MASK NEXTHOP|IFACE   (or DEST/NN)
  ip default-gateway A.B.C.D
  ip routing | no ip routing
  service NAME [PORT] | no service NAME
  set ATTRIBUTE VALUE | no set ATTRIBUTE
Interface config:
  ip address A.B.C.D/NN | A.B.C.D M.M.M.M | dhcp   (no ip address)
  shutdown | no shutdown       description TEXT
  switchport mode access|trunk|routed   (no switchport = routed)
  switchport access vlan N
  switchport trunk native vlan N
  switchport trunk allowed vlan 10,20-30|all
  encapsulation dot1q N   speed X   mac-address X
Abbreviations work: sh run, sh ip int br, int, conf t, no sh, wr`;function Wf(s,e){let t=String(s??"").split(`
`),n=String(e??"").split(`
`),i=t.length,r=n.length;if(i*r>4e6)return[{t:"!",s:"Files are too large to diff here."}];let o=Array.from({length:i+1},()=>new Uint32Array(r+1));for(let h=i-1;h>=0;h--)for(let u=r-1;u>=0;u--)o[h][u]=t[h]===n[u]?o[h+1][u+1]+1:Math.max(o[h+1][u],o[h][u+1]);let a=[],c=0,l=0;for(;c<i&&l<r;)t[c]===n[l]?(a.push({t:" ",s:t[c]}),c++,l++):o[c+1][l]>=o[c][l+1]?a.push({t:"-",s:t[c++]}):a.push({t:"+",s:n[l++]});for(;c<i;)a.push({t:"-",s:t[c++]});for(;l<r;)a.push({t:"+",s:n[l++]});return a}var Xf={"Content-Type":"application/json","X-LabTracer":"1"};function $r(s){let e=s.ports.some(t=>t.enabled&&t.ip&&Dt(t.ip));return Object.assign({enabled:e&&!s.logical&&!s.physicalOnly,host:"",ping:!0,services:!0},s.monitor||{})}function Qh(s){let e=$r(s);if(e.host)return e.host.trim();let t=s.ports.find(n=>n.enabled&&n.ip&&Dt(n.ip));return t?t.ip.split("/")[0]:""}function cx(s){let e=[];for(let t of String(s||"").split(/[,\s]+/)){let n=/^(\d{1,5})(?:\/(tcp|udp))?$/i.exec(t.trim());if(n&&(!n[2]||n[2].toLowerCase()==="tcp")){let i=+n[1];i>=1&&i<=65535&&e.push(i)}}return e}function eu(s){let e=$r(s),t=Qh(s);if(!e.enabled||!t)return[];let n=[];if(e.ping&&n.push({type:"ping",host:t}),e.services){for(let i of s.services)if(i.enabled!==!1)for(let r of cx(i.port))n.push({type:"tcp",host:t,port:r,label:i.name})}return n}function hx(s){return s.devices.map(e=>({id:e.id,name:e.name,checks:eu(e)})).filter(e=>e.checks.length)}var Ba=class{constructor(e){this.app=e,this.config={agentUrl:"",hasToken:!1},this.status=null,this.error="",this.live=!1,this.timer=null,this.pushTimer=null}get available(){return this.app.store.mode==="server"}async loadConfig(){if(this.available)try{this.config=await(await fetch("/api/monitor/config",{cache:"no-store"})).json()}catch{}}async saveConfig(e){let t=await fetch("/api/monitor/config",{method:"PUT",headers:Xf,body:JSON.stringify(e)}),n=await t.json();if(!t.ok)throw new Error(n.error||t.statusText);await this.loadConfig()}async push(e=!1){let t=hx(this.app.lab),n=await fetch("/api/monitor/targets",{method:"POST",headers:Xf,body:JSON.stringify({targets:t})}),i=await n.json();if(!n.ok)throw new Error(i.error||n.statusText);return e||Se(`Agent now checks ${i.targets} device(s)`,"ok"),i}schedulePush(){this.live&&(clearTimeout(this.pushTimer),this.pushTimer=setTimeout(()=>this.push(!0).then(()=>setTimeout(()=>this.poll(),1500)).catch(e=>this.fail(e)),2500))}async poll(){try{let e=await fetch("/api/monitor/status",{cache:"no-store"}),t=await e.json();if(!e.ok)throw new Error(t.error||e.statusText);this.status=t,this.error=""}catch(e){this.fail(e,!0)}this.app.onMonitorStatus()}fail(e,t){this.error=e.message||String(e),t||Se("Monitoring: "+this.error,"err",4e3)}async start(){var t;if(!this.available)return Se("Live status needs server.py (it is not available when index.html is opened directly)","warn",4500),!1;if(!this.config.agentUrl)return Se("Set the agent address first: click empty space, then the Monitoring section","warn",4500),this.app.select(null),!1;try{await this.push(!0)}catch(n){return this.fail(n),this.app.onMonitorStatus(),!1}this.live=!0,await this.poll(),setTimeout(()=>{this.live&&this.poll()},3e3);let e=Math.max(5,Math.min(120,((t=this.status)==null?void 0:t.interval)||30))*1e3;return clearInterval(this.timer),this.timer=setInterval(()=>this.poll(),e),!0}stop(){this.live=!1,clearInterval(this.timer),this.timer=null,this.status=null,this.app.onMonitorStatus()}states(){let e=this.status,t=new Map;if(!this.live||!e)return t;let n=e.generated&&Date.now()/1e3-e.generated>3*(e.interval||30)+10;for(let[i,r]of Object.entries(e.devices||{}))t.set(i,n?"unknown":r.state);return t}device(e){var t;return this.live&&this.status&&((t=this.status.devices)==null?void 0:t[e])||null}};function $f(s,e=300,t=46){if(!s||s.length<2)return"";let n=s.map(l=>l[3]).filter(l=>l!==null),i=Math.max(1,...n),r=e/(s.length-1),o="",a=!1;s.forEach((l,h)=>{if(l[3]===null){a=!1;return}let u=t-8-l[3]/i*(t-14);o+=(a?"L":"M")+(h*r).toFixed(1)+" "+u.toFixed(1),a=!0});let c=s.map((l,h)=>{let u=l[2]===0?"#555":l[1]===l[2]?"#38e07a":l[1]===0?"#ff6b5c":"#ffb347";return`<rect x="${(h*r-r/2).toFixed(1)}" y="${t-4}" width="${Math.max(1,r).toFixed(1)}" height="4" fill="${u}"/>`}).join("");return`<svg viewBox="0 0 ${e} ${t}" width="100%" height="${t}" preserveAspectRatio="none"><path d="${o}" fill="none" stroke="#5ed69a" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${c}<text x="2" y="10" fill="#84a08c" font-size="9">${i.toFixed(1)} ms</text></svg>`}var ux=[["general","General"],["physical","Physical"],["ports","Ports"],["routing","Routing"],["services","Services"],["files","Configs"],["console","Console"],["monitor","Monitor"]],Pe=(s,...e)=>(s.append(...e.flat(1/0).filter(t=>t!=null&&t!==!1)),s),tu=new Set(["svi","sub","loop","tunnel"]),za=class{constructor(e,t){this.el=e,this.app=t,this.tab="general",this.expanded=new Set,this.fileSel=new Map,this.term=new Map,this.hist=new Map}commit(e,t){this.app.commit(e,t)}inp(e,t,n,i,r={}){let o=r.k||t,a,c=l=>{if(r.validate){let u=r.validate(l);u?(Se(u,"err"),a.classList.add("bad")):a.classList.remove("bad")}let h=e[t];e[t]=l,r.after&&r.after(l,h),this.commit(r.label||`Edit ${n||t}`,i)};return r.type==="check"?a=v("input",{type:"checkbox",checked:!!e[t],"data-k":o,onchange:l=>c(l.target.checked)}):r.type==="select"?a=v("select",{class:"inp","data-k":o,onchange:l=>c(r.num?Number(l.target.value):l.target.value)},r.options.map(([l,h])=>v("option",{value:l,selected:String(l)===String(e[t]??"")?"selected":null},h))):r.type==="area"?a=v("textarea",{class:"inp"+(r.mono?" mono":""),rows:r.rows||3,"data-k":o,placeholder:r.ph||"",onchange:l=>c(l.target.value)},e[t]||""):r.type==="number"?a=v("input",{class:"inp",type:"number",step:r.step||"any",min:r.min,max:r.max,value:e[t]??"","data-k":o,placeholder:r.ph||"",onchange:l=>c(l.target.value===""?r.empty??0:Number(l.target.value))}):r.type==="color"?a=v("input",{class:"inp color",type:"color",value:e[t]||"#888888","data-k":o,onchange:l=>c(l.target.value)}):a=v("input",{class:"inp"+(r.mono?" mono":""),value:e[t]??"","data-k":o,placeholder:r.ph||"",onchange:l=>c(r.trim===!1?l.target.value:l.target.value.trim())}),r.title&&(a.title=r.title),r.validate&&e[t]&&r.validate(e[t])&&a.classList.add("bad"),r.type==="check"?n?v("label",{class:"chk"},a,n):a:n?v("label",{class:"fld"},v("span",null,n),a,r.hint?v("small",null,r.hint):null):a}render(){let e=document.activeElement,t=e&&this.el.contains(e)?e.getAttribute("data-k"):null,n=[...this.el.querySelectorAll("[data-scroll]")].map(a=>[a.getAttribute("data-scroll"),a.scrollTop]);In(this.el);let i=this.app.selection,r=this.app.lab;i&&i.type==="device"&&He(r,i.id)?this.renderDevice(He(r,i.id)):i&&i.type==="link"&&Wa(r,i.id)?this.renderLink(Wa(r,i.id)):this.renderLab();for(let[a,c]of n){let l=this.el.querySelector(`[data-scroll="${a}"]`);l&&(l.scrollTop=c)}if(t){let a=this.el.querySelector(`[data-k="${CSS.escape(t)}"]`);a&&a.focus()}let o=this.el.querySelector(".term-out");o&&(o.scrollTop=o.scrollHeight)}renderDevice(e){let t=this.app,n=t.library.get(e.templateId),i=v("div",{class:"insp-head"},v("span",{class:"swatch",style:{background:e.color}}),v("div",{class:"grow"},v("div",{class:"title"},e.name),v("div",{class:"muted small"},[e.vendor,e.model].filter(Boolean).join(" ")||(n?n.name:e.category))),v("button",{class:"icon-btn",title:"Duplicate (Ctrl+D)",onclick:()=>t.duplicateSelected()},"\u29C9"),v("button",{class:"icon-btn danger",title:"Delete (Del)",onclick:()=>t.deleteSelection()},"\u{1F5D1}")),r=v("div",{class:"tabs"},ux.filter(([c])=>!(c==="physical"&&!1)).map(([c,l])=>v("button",{class:"tab"+(this.tab===c?" on":""),onclick:()=>{this.tab=c,this.render()}},l))),o=v("div",{class:"insp-body","data-scroll":"body"});Pe(this.el,i,r,o),(this["tab_"+this.tab]||this.tab_general).call(this,e,o)}tab_general(e,t){var i;let n={dev:e.id};Pe(t,this.inp(e,"name","Name / hostname","all",{validate:r=>r?"":"Name is required"}),v("div",{class:"row2"},this.inp(e,"vendor","Vendor",n),this.inp(e,"model","Model",n)),v("div",{class:"row2"},this.inp(e,"serial","Serial / asset tag",n),this.inp(e,"color","Colour",n,{type:"color"})),v("div",{class:"row2"},this.inp(e,"l2","Bridges L2 (switch / bridge)",n,{type:"check"}),this.inp(e,"l3","Routes IP (forwarding)",n,{type:"check"})),v("h4",null,"Attributes"),this.kvTable(e),this.inp(e,"notes","Notes","none",{type:"area",rows:4,trim:!1}),v("div",{class:"btnrow"},v("button",{class:"btn small",onclick:()=>this.app.saveDeviceAsTemplate(e)},"Save as custom object"),v("button",{class:"btn small",onclick:()=>{this.tab="console",this.render()}},"Open console")),v("p",{class:"muted small"},`Category: ${e.category} \xB7 Template: ${((i=this.app.library.get(e.templateId))==null?void 0:i.name)||e.templateId+" (missing)"} \xB7 ID ${e.id}`))}kvTable(e){let t=v("div",{class:"kv"});return e.attrs.forEach((n,i)=>Pe(t,v("div",{class:"kv-row"},this.inp(n,"k",null,"none",{k:`attr-k-${i}`,ph:"Key"}),this.inp(n,"v",null,"none",{k:`attr-v-${i}`,ph:"Value"}),v("button",{class:"mini",title:"Remove",onclick:()=>{e.attrs.splice(i,1),this.commit("Remove attribute","none")}},"\xD7")))),Pe(t,v("button",{class:"btn small",onclick:()=>{e.attrs.push({k:"",v:""}),this.commit("Add attribute","none")}},"+ Attribute")),t}tab_physical(e,t){var h;let n=this.app,i=n.lab,r={dev:e.id};if(e.virtual||e.logical){Pe(t,v("p",{class:"muted"},e.virtual?"Virtual device: it lives on a host, so it is not drawn in the room view. Use the Host attribute to record where it runs.":"Logical object (for example the Internet): shown only in the topology view."));return}let o=[["","\u2014 Not placed \u2014"],...i.rooms.map(u=>[u.id,u.name])],a=i.devices.filter(u=>Yt(u)&&u.id!==e.id),c=e.uHeight>0&&a.length>0,l=e.phys;if(l.mount==="rack"){let u=He(i,l.rackId);Pe(t,this.inp(l,"mount","Mounting","all",{type:"select",options:[["floor","Free standing"],["rack","In a rack"]],after:d=>{d==="floor"&&(l.roomId=u?u.phys.roomId:l.roomId,l.x=u?u.phys.x+.8:l.x,l.z=u?u.phys.z:l.z,l.rackId=null,l.rackU=null)}}),this.inp(l,"rackId","Rack","all",{type:"select",options:a.map(d=>[d.id,d.name]),after:d=>{let p=He(i,d);l.rackU=sr(i,p,e),l.rackU||Se("That rack is full","err")}}),this.inp(l,"rackU",`Bottom U (${e.uHeight||1}U tall)`,"all",{type:"number",min:1,max:u==null?void 0:u.rackUnits,step:1,validate:d=>u&&!to(i,u,e,d)?"Those rack units are taken or out of range":""}),v("p",{class:"muted small"},u?`Occupies U${l.rackU}${e.uHeight>1?"\u2013U"+(l.rackU+e.uHeight-1):""} in ${u.name} (${((h=i.rooms.find(d=>d.id===u.phys.roomId))==null?void 0:h.name)||"not placed"}).`:"Rack missing."))}else Pe(t,this.inp(l,"roomId","Room","all",{type:"select",options:o,after:(u,d)=>{if(l.roomId=u||null,u&&u!==d){let p=i.rooms.find(m=>m.id===u);l.x=p.w/2,l.z=p.d/2}}}),c?this.inp(l,"mount","Mounting","all",{type:"select",options:[["floor","Free standing"],["rack","In a rack"]],after:u=>{if(u==="rack"){let d=a[0];l.rackId=d.id,l.rackU=sr(i,d,e),l.rackU||(Se("Rack is full","err"),l.mount="floor",l.rackId=null)}}}):null,l.roomId?v("div",{class:"row4"},this.inp(l,"x","X m",r,{type:"number",step:.05}),this.inp(l,"z","Z m",r,{type:"number",step:.05}),this.inp(l,"rot","Rotate \xB0",r,{type:"number",step:90}),this.inp(l,"elev","Height m",r,{type:"number",step:.05,after:()=>{l.elevAuto=!1}})):null,l.roomId&&!Yt(e)&&!Gn(e)?this.inp(l,"elevAuto","Sit on furniture automatically when moved","none",{type:"check"}):null,l.roomId?this.levelButtons(e):null,l.roomId?v("p",{class:"muted small"},"Tip: drag in the room view. R rotates 90\xB0."):null);Pe(t,v("h4",null,"Size"),v("div",{class:"row4"},this.inp(e.dims,"w","Width m",r,{type:"number",step:.01,k:"dw"}),this.inp(e.dims,"h","Height m",r,{type:"number",step:.001,k:"dh"}),this.inp(e.dims,"d","Depth m",r,{type:"number",step:.01,k:"dd"}),Yt(e)?this.inp(e,"rackUnits","Rack units","all",{type:"number",step:1,min:1}):this.inp(e,"uHeight","Rack U","all",{type:"number",step:1,min:0}))),Gn(e)&&Pe(t,v("label",{class:"fld"},v("span",null,"Surface heights (m, comma separated)"),v("input",{class:"inp","data-k":"levels",value:(e.levels||[]).join(", "),onchange:u=>{e.levels=u.target.value.split(",").map(Number).filter(Number.isFinite),this.commit("Edit surfaces","all")}}))),Yt(e)&&Pe(t,v("h4",null,"Rack elevation"),this.rackElevation(e))}levelButtons(e){var n;let t=this.app.furnitureUnder(e);return!t||!((n=t.levels)!=null&&n.length)?null:v("div",{class:"btnrow"},v("span",{class:"muted small"},`On ${t.name}:`),t.levels.map((i,r)=>v("button",{class:"btn small",onclick:()=>{e.phys.elev=i,e.phys.elevAuto=!0,this.commit("Set shelf",{dev:e.id})}},`Level ${r+1} (${i} m)`)))}rackElevation(e){let t=this.app.lab,n=qa(t,e),i=v("div",{class:"rack-el","data-scroll":"rack"});for(let r=e.rackUnits;r>=1;r--){let o=n.get(r);if(o&&o.phys.rackU+Math.max(1,o.uHeight)-1!==r)continue;let a=o?Math.max(1,o.uHeight):1,c=v("div",{class:"ru"+(o?" used":""),style:{height:a*18+"px"}},v("span",{class:"un"},o&&a>1?`${r-a+1}\u2013${r}`:String(r)),o?v("button",{class:"ru-dev",style:{borderLeftColor:o.color},onclick:()=>this.app.select({type:"device",id:o.id})},o.name,v("small",null,o.model||"")):v("button",{class:"ru-empty",onclick:l=>this.mountMenu(e,r,l)},"+"));Pe(i,c)}return i}mountMenu(e,t,n){let i=this.app.lab,r=i.devices.filter(o=>o.uHeight>0&&!Yt(o)&&!(o.phys.mount==="rack"&&o.phys.rackId===e.id));Xr(n.clientX,n.clientY,`Mount at U${t}`,r.length?r.map(o=>{var a;return{label:o.name,sub:`${o.uHeight}U${o.phys.mount==="rack"?" \xB7 in "+(((a=He(i,o.phys.rackId))==null?void 0:a.name)||"rack"):""}`,disabled:!to(i,e,o,t),onClick:()=>{Object.assign(o.phys,{mount:"rack",rackId:e.id,rackU:t}),this.commit("Mount in rack","all")}}}):[{label:"No rack-mount devices (Rack U > 0)",disabled:!0}])}tab_ports(e,t){let n=this.app,i=n.lab,r={dev:e.id},o=e.l2,a=v("div",{class:"ports"+(o?" l2":"")});Pe(a,v("div",{class:"prow head"},v("span"),v("span",null,"Name"),v("span",null,"IP / CIDR"),o?v("span",null,"Mode"):null,o?v("span",null,"VLAN"):null,v("span",null,"On"),v("span",null,"Link")));for(let l of e.ports){let h=mi(i,e.id,l.id),u=this.expanded.has(l.id),d=tu.has(l.kind),p=o&&Vn.has(l.kind)&&!["power","console","usb","tunnel"].includes(l.kind),m=h.length?v("button",{class:"linkchip",title:h.map(_=>Xa(i,nr(_,e.id,l.id))).join(`
`),onclick:()=>n.select({type:"link",id:h[0].id})},h.length>1?`${h.length} peers`:Xa(i,nr(h[0],e.id,l.id))):v("span",{class:"muted small"},Vn.has(l.kind)?"\u2014":"virtual");Pe(a,v("div",{class:"prow"+(l.enabled?"":" off")},v("button",{class:"mini",title:"More",onclick:()=>{u?this.expanded.delete(l.id):this.expanded.add(l.id),this.render()}},u?"\u25BE":"\u25B8"),this.inp(l,"name",null,r,{k:`pn-${l.id}`,title:`${l.kind}${l.speed?" \xB7 "+l.speed:""}${l.desc?" \xB7 "+l.desc:""}`}),["power","console","usb"].includes(l.kind)?v("span",{class:"muted small"},l.kind):this.inp(l,"ip",null,"all",{k:`pi-${l.id}`,ph:"none",mono:!0,validate:_=>_&&_!=="dhcp"&&!Dt(_)?`"${_}" is not A.B.C.D/NN`:""}),o?p?this.inp(l,"mode",null,r,{k:`pm-${l.id}`,type:"select",options:[["access","access"],["trunk","trunk"],["routed","routed"]]}):v("span",{class:"muted small"},l.kind):null,o?p&&l.mode==="access"?this.inp(l,"vlan",null,r,{k:`pv-${l.id}`,type:"number",min:1,max:4094,step:1,empty:1}):p&&l.mode==="trunk"?v("button",{class:"linkchip",title:`native ${l.nativeVlan||1}, allowed ${l.trunkVlans||"all"} (click to edit)`,onclick:()=>{this.expanded.add(l.id),this.render()}},`${l.nativeVlan||1}/${l.trunkVlans||"all"}`):l.kind==="svi"||l.kind==="sub"?v("span",{class:"muted small"},`v${l.vlan}`):v("span"):null,this.inp(l,"enabled",null,{dev:e.id},{k:`pe-${l.id}`,type:"check",title:"Admin up"}),m)),u&&Pe(a,v("div",{class:"pdetail"},v("div",{class:"row4"},this.inp(l,"kind","Kind",r,{k:`pk-${l.id}`,type:"select",options:Js.map(_=>[_,_])}),this.inp(l,"desc","Description","none",{k:`pd-${l.id}`}),this.inp(l,"speed","Speed","none",{k:`ps-${l.id}`}),this.inp(l,"mac","MAC","none",{k:`pmac-${l.id}`,mono:!0})),p&&l.mode==="trunk"?v("div",{class:"row2"},this.inp(l,"nativeVlan","Native VLAN",r,{k:`pnv-${l.id}`,type:"number",min:1,max:4094,step:1,empty:1}),this.inp(l,"trunkVlans","Allowed VLANs",r,{k:`pat-${l.id}`,ph:"all or 10,20-30",mono:!0})):null,l.kind==="svi"||l.kind==="sub"?v("div",{class:"row2"},this.inp(l,"vlan",l.kind==="svi"?"VLAN (SVI / bridge)":"802.1Q tag","all",{k:`pvv-${l.id}`,type:"number",min:1,max:4094,step:1,empty:1}),l.kind==="sub"?this.inp(l,"parent","Parent port","all",{k:`ppar-${l.id}`,type:"select",options:[["","\u2014"],...e.ports.filter(_=>!tu.has(_.kind)&&_.id!==l.id).map(_=>[_.id,_.name])]}):v("span")):null,v("div",{class:"btnrow"},h.length?v("button",{class:"btn small",onclick:()=>{n.lab.links=n.lab.links.filter(_=>!h.includes(_)),this.commit("Disconnect","all")}},"Disconnect"):null,v("button",{class:"btn small danger",onclick:()=>{n.removePortRaw(e,l.id),this.commit("Remove port","all")}},"Remove port"))))}let c=v("select",{class:"inp","data-k":"newkind"},Js.map(l=>v("option",{value:l},l)));Pe(t,a,v("div",{class:"btnrow"},c,v("button",{class:"btn small",onclick:()=>{let l=c.value,h={eth:"eth",sfp:"sfp",wifi:"wlan",vport:"veth",tunnel:"wg",svi:"vlan",sub:"sub",loop:"lo",console:"con",usb:"usb",power:"psu"}[l],u=0;for(;e.ports.some(p=>p.name===h+u);)u++;let d=Rt({name:h+u,kind:l,mode:e.l2?"access":"routed"});if(l==="sub"){let p=e.ports.find(m=>!tu.has(m.kind));d.parent=(p==null?void 0:p.id)||null,d.vlan=10,d.name=((p==null?void 0:p.name)||"eth0")+".10"}e.ports.push(d),this.expanded.add(d.id),this.commit("Add port",{dev:e.id})}},"+ Add port")),v("p",{class:"muted small"},o?"This device bridges: access ports carry one VLAN, trunks carry tagged VLANs. Use an svi port (VLAN interface) for its own IP.":'IP format: 192.168.10.10/24. Turn on "Bridges L2" in General to get switchport modes and VLANs.'))}tab_routing(e,t){let n={dev:e.id},i=[["","\u2014"],...e.ports.filter(h=>!["power","console","usb"].includes(h.kind)).map(h=>[h.name,h.name])],r=v("div",{class:"routes"},v("div",{class:"rrow head"},v("span",null,"Destination"),v("span",null,"Next hop"),v("span",null,"or interface"),v("span")));e.routes.forEach((h,u)=>Pe(r,v("div",{class:"rrow"},this.inp(h,"dest",null,"none",{k:`rd-${u}`,mono:!0,ph:"0.0.0.0/0",validate:d=>Dt(d)?"":"Destination must be A.B.C.D/NN"}),this.inp(h,"via",null,"none",{k:`rv-${u}`,mono:!0,ph:"192.168.10.1",validate:d=>!d||$t(d)!==null?"":"Next hop must be an IPv4 address"}),this.inp(h,"dev",null,"none",{k:`rdev-${u}`,type:"select",options:i}),v("button",{class:"mini",onclick:()=>{e.routes.splice(u,1),this.commit("Remove route","none")}},"\xD7")))),Pe(r,v("div",{class:"btnrow"},v("button",{class:"btn small",onclick:()=>{e.routes.push({dest:"0.0.0.0/0",via:"",dev:""}),this.commit("Add route","none")}},"+ Static route")));let o=Ua(e);Pe(t,this.inp(e,"l3","Routes IP for other devices (IP forwarding)",n,{type:"check",k:"l3b"}),v("h4",null,"Static routes"),r,v("h4",null,"Routing table (live)"),v("pre",{class:"mono-box"},o.length?o.map(h=>`${h.type}  ${h.dest.padEnd(19)} ${h.via?"via "+h.via:""}${h.dev?(h.via?" ":"dev ")+h.dev:""}`).join(`
`):"empty"));let a=v("input",{class:"inp mono",placeholder:"ping target, e.g. 192.168.10.10","data-k":"pingtgt",value:this.lastPing||""}),c=v("div",{class:"ping-out"}),l=()=>{var u;this.lastPing=a.value.trim();let h=Oa(this.app.lab,e,this.lastPing);Pe(In(c),v("div",{class:h.ok?"ok":"err"},h.ok?`Reply from ${this.lastPing}`:`Failed: ${h.reason}`),h.fwd&&((u=h.fwd.hops)!=null&&u.length)?v("div",{class:"muted small"},"Path: "+[e.name,...h.fwd.hops.map(d=>d.to.name)].join(" \u2192 ")):null),this.app.animatePing(h)};if(a.addEventListener("keydown",h=>{h.key==="Enter"&&l()}),Pe(t,v("h4",null,"Test reachability"),v("div",{class:"btnrow"},a,v("button",{class:"btn small primary",onclick:l},"Ping")),c),e.l2){let h=v("div",{class:"routes"});e.vlans.sort((u,d)=>u.id-d.id).forEach((u,d)=>Pe(h,v("div",{class:"vrow"},this.inp(u,"id",null,"none",{k:`vid-${d}`,type:"number",min:1,max:4094,step:1}),this.inp(u,"name",null,"none",{k:`vnm-${d}`,ph:"name"}),v("button",{class:"mini",onclick:()=>{e.vlans.splice(d,1),this.commit("Remove VLAN","none")}},"\xD7")))),Pe(h,v("button",{class:"btn small",onclick:()=>{let u=Math.max(1,...e.vlans.map(d=>d.id))+1;e.vlans.push({id:u,name:""}),this.commit("Add VLAN","none")}},"+ VLAN")),Pe(t,v("h4",null,"VLAN database"),h)}}tab_services(e,t){let n=v("div",{class:"routes"},v("div",{class:"srow head"},v("span",null,"Service"),v("span",null,"Port"),v("span",null,"On"),v("span",null,"Notes"),v("span")));e.services.forEach((i,r)=>Pe(n,v("div",{class:"srow"},this.inp(i,"name",null,"none",{k:`sn-${r}`}),this.inp(i,"port",null,"none",{k:`sp-${r}`,mono:!0}),this.inp(i,"enabled",null,"none",{k:`se-${r}`,type:"check"}),this.inp(i,"notes",null,"none",{k:`so-${r}`}),v("button",{class:"mini",onclick:()=>{e.services.splice(r,1),this.commit("Remove service","none")}},"\xD7")))),Pe(n,v("button",{class:"btn small",onclick:()=>{e.services.push({name:"",port:"",enabled:!0,notes:""}),this.commit("Add service","none")}},"+ Service")),Pe(t,v("p",{class:"muted small"},'Record what runs on this device (DNS, AD DC, WireGuard, hypervisor\u2026). Shown by "show services" in the console.'),n)}tab_files(e,t){let n=this.app,i=this.fileSel.get(e.id)||"__run",r=v("div",{class:"file-list"},v("button",{class:"file"+(i==="__run"?" on":""),onclick:()=>{this.fileSel.set(e.id,"__run"),this.render()}},"running-config",v("small",null,"live")),e.files.map(a=>v("button",{class:"file"+(i===a.id?" on":""),onclick:()=>{this.fileSel.set(e.id,a.id),this.render()}},a.name,v("small",null,a.snapshots.length?`${a.snapshots.length} snap`:"")))),o=v("div",{class:"btnrow"},v("button",{class:"btn small",onclick:async()=>{let a=await Ni("New config file","File name (for example wg0.conf, netplan.yaml, smb.conf)","config.txt");if(!a)return;let c={id:wt("file"),name:a,content:"",snapshots:[]};e.files.push(c),this.fileSel.set(e.id,c.id),this.commit("New file","none")}},"+ New"),v("button",{class:"btn small",onclick:async()=>{let a=await Ui();if(!a)return;if(a.size>2*1024*1024)return Se("Text files up to 2 MB only","err");let c=await ns(a),l={id:wt("file"),name:a.name,content:c,snapshots:[{ts:Date.now(),note:"imported",content:c}]};e.files.push(l),this.fileSel.set(e.id,l.id),this.commit("Import file","none"),Se(`Imported ${a.name}`,"ok")}},"Import"),v("button",{class:"btn small",onclick:()=>n.exportConfigs([e])},"Export all"));Pe(t,v("div",{class:"files"},v("div",{class:"files-side"},r,o),this.fileView(e,i)))}fileView(e,t){let n=this.app;if(t==="__run"){let a=Ys(n.lab,e);return v("div",{class:"file-main"},v("div",{class:"muted small"},"Generated from the device model. Edit the device (or use the console) to change it."),v("pre",{class:"mono-box tall"},a),v("div",{class:"btnrow"},v("button",{class:"btn small primary",onclick:()=>{n.cli.exec(e,"write memory").changed&&(this.fileSel.set(e.id,e.files.find(l=>l.name==="startup-config").id),this.commit("write memory","none"),Se("Saved snapshot to startup-config","ok"))}},"Save as startup-config"),v("button",{class:"btn small",onclick:()=>zn(`${Pn(e.name)}-running-config.txt`,a)},"Download")))}let i=e.files.find(a=>a.id===t);if(!i)return this.fileSel.delete(e.id),v("div");let r=v("textarea",{class:"inp mono editor","data-k":`file-${i.id}`,spellcheck:"false",onchange:a=>{i.content=a.target.value,this.commit("Edit "+i.name,"none")}},i.content);r.addEventListener("keydown",a=>{if(a.key==="Tab"){a.preventDefault();let c=r.selectionStart;r.setRangeText("  ",c,r.selectionEnd,"end")}});let o=i.snapshots.length&&i.snapshots[0].content!==i.content;return v("div",{class:"file-main"},v("div",{class:"row2"},this.inp(i,"name",null,"none",{k:`fname-${i.id}`}),v("div",{class:"btnrow right"},v("button",{class:"btn small primary",title:"Keep a dated copy of this version",onclick:async()=>{r.dispatchEvent(new Event("change"));let a=await Ni("Save snapshot","Note (what changed?)","","Save");a!==null&&(i.content=r.value,i.snapshots.unshift({ts:Date.now(),note:a,content:i.content}),this.commit("Snapshot "+i.name,"none"),Se("Snapshot saved","ok"))}},"Snapshot"),v("button",{class:"btn small",onclick:()=>zn(Pn(i.name,"config.txt"),r.value)},"Download"),v("button",{class:"btn small danger",onclick:async()=>{await Rn("Delete file",`Delete ${i.name} and its ${i.snapshots.length} snapshot(s)?`,"Delete",!0)&&(e.files=e.files.filter(a=>a!==i),this.commit("Delete file","none"))}},"Delete"))),r,o?v("div",{class:"warn small"},"Changed since the last snapshot."):null,v("h4",null,`Snapshots (${i.snapshots.length})`),v("div",{class:"snaps","data-scroll":"snaps"},i.snapshots.length?i.snapshots.map((a,c)=>v("div",{class:"snap"},v("div",{class:"grow"},v("b",null,fi(a.ts))," ",v("span",{class:"muted"},a.note||"")),v("button",{class:"mini txt",onclick:()=>this.showDiff(a.content,i.content,`${i.name}: ${fi(a.ts)} \u2192 current`)},"diff"),c+1<i.snapshots.length?v("button",{class:"mini txt",onclick:()=>this.showDiff(i.snapshots[c+1].content,a.content,`${i.name}: previous \u2192 ${fi(a.ts)}`)},"vs prev"):null,v("button",{class:"mini txt",onclick:async()=>{await Rn("Restore",`Replace the current text with the snapshot from ${fi(a.ts)}?`,"Restore")&&(i.content=a.content,this.commit("Restore snapshot","none"))}},"restore"),v("button",{class:"mini",onclick:()=>{i.snapshots.splice(c,1),this.commit("Delete snapshot","none")}},"\xD7"))):v("p",{class:"muted small"},"No snapshots yet.")))}showDiff(e,t,n){let i=Wf(e,t),r=i.filter(a=>a.t==="+").length,o=i.filter(a=>a.t==="-").length;On(n,v("div",null,v("p",{class:"muted small"},`+${r}  \u2212${o}`),v("pre",{class:"diff"},i.map(a=>v("div",{class:a.t==="+"?"add":a.t==="-"?"del":""},`${a.t} ${a.s}`)))),[{label:"Close"}],{wide:!0})}tab_console(e,t){let n=this.app;this.term.has(e.id)||this.term.set(e.id,[{c:"muted",s:`${e.name} console. Type ? for help. Changes apply to the model at once.`}]);let i=this.term.get(e.id),r=this.hist.get(e.id)||[];this.hist.set(e.id,r);let o=r.length,a=v("div",{class:"term-out"},i.map(h=>v("div",{class:h.c||""},h.s))),c=v("input",{class:"term-in","data-k":`term-${e.id}`,spellcheck:"false",autocomplete:"off"});c.addEventListener("keydown",h=>{if(h.key==="ArrowUp")h.preventDefault(),o>0&&(c.value=r[--o]);else if(h.key==="ArrowDown")h.preventDefault(),o<r.length-1?c.value=r[++o]:(o=r.length,c.value="");else if(h.key==="Enter"){let u=c.value;c.value="",u.trim()&&(r.push(u),r.length>200&&r.shift()),i.push({c:"cmd",s:n.cli.prompt(e)+" "+u});let d=n.cli.exec(e,u);d.clear&&(i.length=0),d.out&&i.push({c:/^%/.test(d.out)?"err":"",s:d.out}),i.length>600&&i.splice(0,i.length-600),d.changed?n.commit("CLI: "+u.trim(),d.renamed?"all":{dev:e.id}):this.render(),d.save&&n.save(),d.anim&&n.animatePing(d.anim)}});let l=v("div",{class:"term",onclick:h=>{(h.target===l||h.target===a)&&c.focus()}},a,v("div",{class:"term-line"},v("span",{class:"prompt"},n.cli.prompt(e)),c));Pe(t,l),setTimeout(()=>{(!document.activeElement||document.activeElement===document.body)&&c.focus()},0)}tab_monitor(e,t){let n=this.app.monitor,i=$r(e),r=(h,u)=>{e.monitor={...$r(e),[h]:u},this.commit("Monitor settings",{dev:e.id})},o=(h,u)=>v("label",{class:"chk"},v("input",{type:"checkbox",checked:i[h],"data-k":"mon-"+h,onchange:d=>r(h,d.target.checked)}),u),a=eu(e);if(Pe(t,o("enabled","Monitor this device"),v("label",{class:"fld"},v("span",null,"Address to check"),v("input",{class:"inp mono","data-k":"mon-host",value:i.host,placeholder:Qh({...e,monitor:{...i,host:""}})||"no IP on this device",onchange:h=>r("host",h.target.value.trim())}),v("small",null,"Empty = first IP in the Ports tab. A DNS name also works.")),v("div",{class:"row2"},o("ping","Ping"),o("services","TCP connect to service ports")),v("h4",null,`Checks sent to the agent (${a.length})`),a.length?v("div",{class:"mono-box"},a.map(h=>h.type==="ping"?`ping  ${h.host}`:`tcp   ${h.host}:${h.port}  ${h.label||""}`).join(`
`)):v("p",{class:"muted small"},i.enabled?"Nothing to check: add an IP address, or service ports in the Services tab (for example 22, 443, 8006/tcp). UDP ports are skipped.":"Monitoring is off for this device.")),Pe(t,v("h4",null,"Live status")),!n.available){Pe(t,v("p",{class:"muted small"},"Live status needs server.py."));return}if(!n.live){Pe(t,v("p",{class:"muted small"},"Live status is off. Click Live in the toolbar."));return}n.error&&Pe(t,v("div",{class:"warn small"},"Agent: "+n.error));let c=n.device(e.id);if(!c){Pe(t,v("p",{class:"muted small"},"No result yet. The agent gets new targets a few seconds after a change."));return}let l=n.states().get(e.id)||c.state;Pe(t,v("div",{class:"stline"},v("span",{class:"stbadge st-"+l},l),v("span",{class:"muted small"},`since ${fi(c.since*1e3)}`)),v("div",{class:"checks"},c.checks.map(h=>v("div",{class:"chkrow"+(h.ok?"":" bad")},v("span",{class:"dot"}),v("span",{class:"mono"},h.type==="ping"?`ping ${h.host}`:`${h.host}:${h.port}`),v("span",{class:"muted"},h.label||""),v("span",{class:"mono"},h.ok?`${h.ms} ms`:h.err)))),v("h4",null,`Last ${c.history.length} runs`),v("div",{class:"spark",html:$f(c.history)||'<span class="muted small">Needs two runs.</span>'}))}renderLink(e){let t=this.app,n=t.lab,i=He(n,e.a.dev),r=He(n,e.b.dev),o=Mt(i,e.a.port),a=Mt(r,e.b.port),c=(h,u,d)=>{let p=Mt(u,h.port),m=(f,y)=>ir(n,f,y)&&y.kind==="power"==((p==null?void 0:p.kind)==="power"),_=n.devices.filter(f=>!f.physicalOnly&&f.id!==d.dev).sort((f,y)=>f.name.localeCompare(y.name)),g=f=>{let y=He(n,f),b=y.ports.find(P=>m(y,P));if(!b){Se(`${y.name} has no free ${(p==null?void 0:p.kind)==="power"?"power ":""}port. Add one in its Ports tab, then try again.`,"err",4e3),this.render();return}let S=u.name;h.dev=y.id,h.port=b.id,this.commit(`Move cable from ${S} to ${y.name}`,"all"),Se(`Cable moved to ${y.name}:${b.name}. Pick another port below if needed.`,"ok",3e3)};return v("div",{class:"row2"},v("label",{class:"fld"},v("span",null,"Device"),v("div",{class:"btnrow tight"},v("select",{class:"inp","data-k":"endd-"+h.dev,title:"Move this end of the cable to another device",onchange:f=>g(f.target.value)},_.map(f=>v("option",{value:f.id,selected:f.id===u.id?"selected":null},f.name))),v("button",{class:"mini",title:`Select ${u.name}`,onclick:()=>t.select({type:"device",id:u.id})},"\u2192"))),v("label",{class:"fld"},v("span",null,"Port"),v("select",{class:"inp","data-k":"endp-"+h.dev,onchange:f=>{h.port=f.target.value,this.commit("Move cable to another port","all")}},u.ports.filter(f=>Vn.has(f.kind)).map(f=>{let y=!Fi.has(f.kind)&&mi(n,u.id,f.id).some(b=>b.id!==e.id);return v("option",{value:f.id,selected:f.id===h.port?"selected":null,disabled:y?"disabled":null},f.name+(y?" (in use)":""))}))))},l=(o==null?void 0:o.enabled)&&(a==null?void 0:a.enabled);Pe(this.el,v("div",{class:"insp-head"},v("span",{class:"swatch line",style:{background:e.color||Zh[e.medium]||"#999"}}),v("div",{class:"grow"},v("div",{class:"title"},`${i.name} \u2194 ${r.name}`),v("div",{class:"muted small"},`${o==null?void 0:o.name} \u2194 ${a==null?void 0:a.name} \xB7 ${l?"up":"down (a port is shut)"}`)),v("button",{class:"icon-btn danger",title:"Delete link (Del)",onclick:()=>t.deleteSelection()},"\u{1F5D1}")),v("div",{class:"insp-body"},this.inp(e,"medium","Medium","all",{type:"select",options:Qr.filter(h=>h[0]!=="auto")}),this.inp(e,"label","Label","all",{ph:"e.g. trunk, DMZ, LACP-1"}),v("div",{class:"row2"},this.inp(e,"color","Colour override","all",{type:"color"}),v("label",{class:"fld"},v("span",null," "),v("button",{class:"btn small",onclick:()=>{delete e.color,this.commit("Reset colour","all")}},"Use medium colour"))),v("p",{class:"muted small"},"To move this cable, change the device or port on either end. The other end stays plugged in."),v("h4",null,"End A"),c(e.a,i,e.b),v("h4",null,"End B"),c(e.b,r,e.a),this.inp(e,"notes","Notes (cable ID, length, patch path\u2026)","none",{type:"area",rows:3,trim:!1})))}monitorSection(){let e=this.app,t=e.monitor;if(!t.available)return v("p",{class:"muted small"},"Live status needs server.py. It is not available when index.html is opened directly.");let n=v("input",{class:"inp mono","data-k":"mon-url",value:t.config.agentUrl||"",placeholder:"http://192.168.10.10:8766"}),i=v("input",{class:"inp mono","data-k":"mon-tok",type:"password",autocomplete:"off",placeholder:t.config.hasToken?"saved (leave empty to keep)":"paste the agent token"}),r=v("input",{class:"inp mono","data-k":"mon-ca",value:t.config.cafile||"",placeholder:"optional: path to your CA .pem (HTTPS)"}),o=v("input",{type:"checkbox",checked:t.config.insecure}),a=async()=>{let u={agentUrl:n.value.trim(),cafile:r.value.trim(),insecure:o.checked};i.value.trim()&&(u.token=i.value.trim()),await t.saveConfig(u),i.value=""},c=t.status,l={up:0,degraded:0,down:0,unknown:0};for(let u of t.states().values())l[u]=(l[u]||0)+1;let h=[...t.states()].filter(([,u])=>u==="down"||u==="degraded");return v("div",null,v("label",{class:"fld"},v("span",null,"Agent address"),n),v("div",{class:"row2"},v("label",{class:"fld"},v("span",null,"Token"),i),v("label",{class:"fld"},v("span",null,"CA file (HTTPS)"),r)),v("label",{class:"chk"},o,"Skip TLS certificate check (not recommended)"),v("div",{class:"btnrow"},v("button",{class:"btn small",onclick:async()=>{try{await a(),Se("Agent settings saved","ok")}catch(u){Se(u.message,"err")}}},"Save"),v("button",{class:"btn small",onclick:async()=>{try{await a();let u=await fetch("/api/monitor/status",{cache:"no-store"}),d=await u.json();if(!u.ok)throw new Error(d.error);Se(`Connected: ${d.host}, agent ${d.version}, ${d.targets} target(s), every ${d.interval}s`,"ok",4e3)}catch(u){Se("Test failed: "+u.message,"err",5e3)}}},"Test"),v("button",{class:"btn small",onclick:async()=>{try{await a(),await t.push()}catch(u){Se("Push failed: "+u.message,"err",5e3)}}},"Send targets"),v("button",{class:"btn small"+(t.live?"":" primary"),onclick:()=>e.toggleLive()},t.live?"Stop live":"Start live")),t.error?v("div",{class:"warn small"},"Agent: "+t.error):null,t.live&&c?v("div",null,v("p",{class:"small"},v("span",{class:"ok"},`${l.up} up`)," \xB7 ",v("span",{class:"warn"},`${l.degraded} degraded`)," \xB7 ",v("span",{class:"err"},`${l.down} down`),v("span",{class:"muted"},` \xB7 agent ${c.host}, last run ${c.generated?new Date(c.generated*1e3).toLocaleTimeString():"never"}`)),h.length?v("div",{class:"chips"},h.map(([u,d])=>{let p=He(e.lab,u);return p?v("span",{class:"chip st-"+d},v("button",{class:"chip-name",onclick:()=>{this.tab="monitor",e.select({type:"device",id:u})}},p.name)):null})):null):null,v("p",{class:"muted small"},"The agent pings each device and connects to TCP service ports. See agent/README.md to install it."))}renderLab(){let e=this.app,t=e.lab,n=v("div",{class:"insp-body","data-scroll":"lab"});Pe(this.el,v("div",{class:"insp-head"},v("div",{class:"grow"},v("div",{class:"title"},t.name),v("div",{class:"muted small"},`${t.devices.length} devices \xB7 ${t.links.length} links \xB7 ${t.rooms.length} rooms`))),n);let i=v("div",{class:"routes"},v("div",{class:"roomrow head"},v("span",null,"Room"),v("span",null,"W m"),v("span",null,"D m"),v("span",null,"H m"),v("span")));t.rooms.forEach((l,h)=>Pe(i,v("div",{class:"roomrow"+(l.id===e.roomId?" on":"")},this.inp(l,"name",null,"all",{k:`rn-${h}`}),this.inp(l,"w",null,"all",{k:`rw-${h}`,type:"number",step:.1,min:.5}),this.inp(l,"d",null,"all",{k:`rdd-${h}`,type:"number",step:.1,min:.5}),this.inp(l,"h",null,"all",{k:`rh-${h}`,type:"number",step:.1,min:1}),v("span",{class:"btnrow tight"},v("button",{class:"mini txt",title:"Show this room",onclick:()=>e.setRoom(l.id)},"view"),v("button",{class:"mini",title:"Delete room",onclick:async()=>{var u;if(await Rn("Delete room",`Delete "${l.name}"? Devices in it become unplaced.`,"Delete",!0)){for(let d of t.devices)d.phys.roomId===l.id&&(d.phys.roomId=null);t.rooms.splice(h,1),e.roomId===l.id&&(e.roomId=((u=t.rooms[0])==null?void 0:u.id)||null),this.commit("Delete room","all")}}},"\xD7"))))),Pe(i,v("button",{class:"btn small",onclick:()=>{t.rooms.push({id:wt("room"),name:`Room ${t.rooms.length+1}`,w:4,d:3,h:2.4}),this.commit("Add room","all")}},"+ Room")),Pe(n,this.inp(t,"notes","Lab notes","none",{type:"area",rows:3,trim:!1}),v("h4",null,"Rooms"),i),Pe(n,v("h4",null,"Monitoring agent"),this.monitorSection());let r=t.devices.filter(l=>!l.virtual&&!l.logical&&!gi(t,l));r.length&&Pe(n,v("h4",null,`Not placed in a room (${r.length})`),v("div",{class:"chips"},r.map(l=>v("span",{class:"chip"},v("button",{class:"chip-name",onclick:()=>e.select({type:"device",id:l.id})},l.name),e.roomId?v("button",{class:"chip-act",title:"Place in the current room",onclick:()=>e.placeInRoom(l)},"\uFF0B"):null))));let o=Gf(t),a=[];for(let l of t.devices)for(let h of $s(l))a.push({d:l,p:h.port,c:h.cidr});a.sort((l,h)=>l.c.ip-h.c.ip);let c=new Map;for(let l of a){let h=qt(l.c.net)+"/"+l.c.prefix;c.set(h,(c.get(h)||0)+1)}Pe(n,v("h4",null,`Address plan (${a.length})`),o.size?v("div",{class:"warn"},`Duplicate address: ${[...o].map(qt).join(", ")}`):null,v("div",{class:"ipplan","data-scroll":"ipplan"},v("div",{class:"iprow head"},v("span",null,"Address"),v("span",null,"Device"),v("span",null,"Interface"),v("span",null,"VLAN")),a.map(l=>v("button",{class:"iprow"+(o.has(l.c.ip)?" dup":""),onclick:()=>e.select({type:"device",id:l.d.id})},v("span",{class:"mono"},l.p.ip),v("span",null,l.d.name),v("span",null,l.p.name),v("span",null,l.p.kind==="svi"||l.p.kind==="sub"||l.d.l2&&l.p.mode!=="routed"&&!["tunnel","loop"].includes(l.p.kind)?l.p.vlan:"")))),v("h4",null,"Subnets in use"),v("div",{class:"chips"},[...c].sort().map(([l,h])=>v("span",{class:"chip mono"},`${l} \xB7 ${h}`))),v("p",{class:"muted small"},"Click a device or link to see its properties. Double-click a device to open its console."))}};var dx=s=>Qs.find(e=>e.id===s);function nu(){let s=tr("example-lab");s.notes="Example lab. Every name and address is a placeholder. Edit the devices, or start a new lab from File > New lab.";let e=s.rooms[0];e.name="Lab room",e.w=4,e.d=3.5,e.h=2.4;let t=e.id,n=(M,R,O={})=>{let F=ss(dx(M),{name:R,x:O.x??0,z:O.z??0});return O.vendor&&(F.vendor=O.vendor),O.model&&(F.model=O.model),O.notes&&(F.notes=O.notes),O.attrs&&(F.attrs=Object.entries(O.attrs).map(([V,Z])=>({k:V,v:Z}))),O.phys&&Object.assign(F.phys,{roomId:t},O.phys),s.devices.push(F),F},i=(M,R)=>pi(M,R),r=(M,R,O)=>{i(M,R).ip=O},o=(M,R,O,F,V="copper",Z="")=>{s.links.push({id:wt("ln"),a:{dev:M.id,port:i(M,R).id},b:{dev:O.id,port:i(O,F).id},medium:V,label:Z,notes:""})},a=[[1,"mgmt"],[20,"servers"],[30,"storage"],[40,"wifi"],[50,"iot"]],c="1,20,30,40,50",l=n("inf-rack-42","rack-01",{phys:{x:.6,z:.6}});n("inf-desk","desk",{phys:{x:2.6,z:.42}}),n("inf-shelf","shelf",{phys:{x:3.72,z:2.4,rot:-90}});let h=n("wan-internet","internet",{x:0,z:-11.5}),u=n("net-gateway","isp-gateway",{x:0,z:-7.5,notes:"ISP modem or ONT. The edge router uses its LAN side.",phys:{x:3.72,z:2.1,elev:1.05,rot:-90}});u.ports.push(Rt({name:"lan",kind:"svi",vlan:1,ip:"192.168.1.1/24"}));let d=n("net-router-home","edge-router",{x:0,z:-4,notes:"Edge router: WAN, inter-VLAN routing, VPN endpoint.",attrs:{Firmware:"",Firewall:""},phys:{x:2.95,z:.38,elev:.75}});Object.assign(i(d,"lan1"),{mode:"trunk",nativeVlan:1,trunkVlans:"all",desc:"trunk to core-switch p1"}),Object.assign(i(d,"lan3"),{mode:"trunk",nativeVlan:1,trunkVlans:"all",desc:"trunk to rack-switch Gi0/48"}),i(d,"wan").ip="192.168.1.2/24",d.routes.push({dest:"0.0.0.0/0",via:"192.168.1.1",dev:""}),d.vlans=a.map(([M,R])=>({id:M,name:R}));let p=(M,R,O)=>d.ports.push(Rt({name:M,kind:"svi",vlan:R,ip:O}));p("br0",1,"192.168.10.1/24"),p("vlan20",20,"192.168.20.1/24"),p("vlan30",30,"192.168.30.1/24"),p("vlan40",40,"192.168.40.1/24"),p("vlan50",50,"192.168.50.1/24"),d.ports.push(Rt({name:"wg0",kind:"tunnel",ip:"10.99.0.1/24",desc:"WireGuard"})),d.services=[{name:"wireguard",port:"51820/udp",enabled:!0,notes:""},{name:"dns-forwarder",port:"53",enabled:!0,notes:""}];let m=n("net-switch-8","core-switch",{x:0,z:-1,phys:{x:3.72,z:2.4,elev:.6,rot:-90}});m.vlans=a.map(([M,R])=>({id:M,name:R})),Object.assign(i(m,"p1"),{mode:"trunk",nativeVlan:1,trunkVlans:c,desc:"uplink from edge-router"}),Object.assign(i(m,"p3"),{mode:"trunk",nativeVlan:1,trunkVlans:c,desc:"ap-01"}),Object.assign(i(m,"p4"),{vlan:30}),Object.assign(i(m,"p5"),{vlan:30}),m.ports.push(Rt({name:"vlan1",kind:"svi",vlan:1,ip:"192.168.10.2/24",desc:"management"})),m.routes.push({dest:"0.0.0.0/0",via:"192.168.10.1",dev:""});let _=n("net-ap","ap-01",{x:4.5,z:1.5,notes:"Ceiling mounted.",phys:{x:2,z:1.9,elev:2.36,elevAuto:!1}});Object.assign(i(_,"wlan0"),{vlan:40,desc:"main SSID (VLAN 40)"}),_.ports.push(Rt({name:"wlan1",kind:"wifi",vlan:50,desc:"IoT SSID (VLAN 50)"}));let g=n("cmp-sbc","dc-01",{x:-4.5,z:2,notes:"Directory, DNS and NTP.",attrs:{OS:"",Role:"DC, DNS, NTP"},phys:{x:2.25,z:.35,elev:.75}});r(g,"eth0","192.168.10.10/24"),g.routes.push({dest:"0.0.0.0/0",via:"192.168.10.1",dev:""}),g.services=[{name:"ldap",port:"389,636",enabled:!0,notes:""},{name:"kerberos",port:"88",enabled:!0,notes:""},{name:"dns",port:"53",enabled:!0,notes:""},{name:"ntp",port:"123/udp",enabled:!0,notes:""}];let f=n("sto-nas2","nas-01",{x:-2,z:4,attrs:{OS:"",Drives:""},phys:{x:3.72,z:2.6,elev:.15,rot:-90}});r(f,"eth0","192.168.30.10/24"),r(f,"eth1","192.168.30.11/24"),f.routes.push({dest:"0.0.0.0/0",via:"192.168.30.1",dev:""}),f.services=[{name:"smb",port:"445",enabled:!0,notes:""}];let y=n("cmp-tower","desktop-01",{x:1.5,z:4,attrs:{OS:"",CPU:"",RAM:"",GPU:""},phys:{x:1.45,z:.5}});r(y,"eth0","192.168.10.20/24"),y.routes.push({dest:"0.0.0.0/0",via:"192.168.10.1",dev:""});let b=n("cmp-laptop","laptop-01",{x:6,z:-4,notes:"Roaming client on the VPN."});r(b,"wg0","10.99.0.10/32"),b.routes.push({dest:"0.0.0.0/0",via:"",dev:"wg0"});let S=(M,R)=>Object.assign(M.phys,{roomId:t,mount:"rack",rackId:l.id,rackU:R}),P=n("net-switch-l3-48","rack-switch",{x:4,z:6});P.vlans=a.map(([M,R])=>({id:M,name:R})),Object.assign(i(P,"Gi0/48"),{mode:"trunk",nativeVlan:1,trunkVlans:c,desc:"to edge-router lan3"}),Object.assign(i(P,"Gi0/2"),{vlan:20,desc:"srv-01 eno1"}),S(P,36);let C=["srv-01","srv-02","srv-03","srv-04"].map((M,R)=>{let O=n("cmp-1u",M,{x:-3.75+R*2.5,z:9.5});return S(O,10+R),O}),I=C[0];I.attrs=[{k:"OS",v:"hypervisor"},...I.attrs.filter(M=>M.k!=="OS")],r(I,"eno1","192.168.20.10/24"),I.routes.push({dest:"0.0.0.0/0",via:"192.168.20.1",dev:""}),I.services=[{name:"ssh",port:"22",enabled:!0,notes:""},{name:"web-ui",port:"8006",enabled:!0,notes:""}];let L=n("net-patch-24","patch-01",{x:-7,z:2});S(L,38);let x=n("pwr-ups-rack","rack-ups",{x:-7,z:5});S(x,1);for(let M of C){let R=M.ports.find(F=>F.name==="psu1"),O=x.ports.find(F=>F.kind==="power"&&/^out/.test(F.name)&&!s.links.some(V=>V.a.port===F.id||V.b.port===F.id));R&&O&&s.links.push({id:wt("ln"),a:{dev:x.id,port:O.id},b:{dev:M.id,port:R.id},medium:"power",label:"",notes:""})}return o(h,"wan1",u,"pon","fiber"),o(u,"lan1",d,"wan","copper"),o(d,"lan1",m,"p1","copper","trunk"),o(m,"p2",g,"eth0"),o(m,"p3",_,"eth0"),o(m,"p4",f,"eth0"),o(m,"p5",f,"eth1"),o(m,"p6",y,"eth0"),o(d,"lan3",P,"Gi0/48","copper","trunk"),o(P,"Gi0/2",I,"eno1"),o(d,"wg0",b,"wg0","tunnel","WireGuard"),s}var iu={antialias:!0,pixelCap:1.25,labels:!0,portLabels:!0,cables:!0,powerLinks:!0,rackLabels:!1,snap:!0,autosave:!0,lockLayout:!1,portAnchors:!0,gridColor:"#2b4a35",bgColor:"#0c130e"},su=class{constructor(){this.store=dt,this.library=new eo,this.settings={...iu,...dt.getPref("settings",{})},this.lab=null,this.labName=null,this.selection=null,this.tool="select",this.placingTpl=null,this.linkMedium="auto",this.linkStart=null,this.undoStack=[],this.redoStack=[],this.snap=null,this.dirty=!1,this.roomId=null}async init(){await dt.init();try{this.library.setCustom((await dt.loadLibrary()).templates)}catch(i){Se("Could not load the custom library: "+i.message,"err")}this.viewport=new Xs(document.getElementById("viewport"),this),this.palette=new Na(document.getElementById("palette"),this),this.inspector=new za(document.getElementById("inspector"),this),this.cli=new Fa(this),this.monitor=new Ba(this),await this.monitor.loadConfig(),this.bindToolbar(),this.bindKeys(),this.palette.render();let e=[];try{e=await dt.listLabs()}catch{}let t=dt.getPref("lastLab",null),n=e.find(i=>i.name===t)||e[0];n?await this.openLab(n.name):(this.loadLab(nu(),"example-lab"),await this.save(!0),Se("Created an example lab. Edit it, or start a new one from File > New lab.","info",5e3)),setInterval(()=>{this.dirty&&this.settings.autosave&&dt.mode==="server"&&this.save(!0)},3e4),window.addEventListener("beforeunload",i=>{this.dirty&&(i.preventDefault(),i.returnValue="")}),this.updateStatus(),document.getElementById("mode-badge").textContent=dt.mode==="server"?"Saved to disk":"Browser storage",document.getElementById("mode-badge").title=dt.mode==="server"?`Data folder: ${dt.dataPath}`:"Opened without server.py: labs live in this browser. Use File > Export to keep copies."}loadLab(e,t){var n,i;this.lab=Eu(e),this.labName=Pn(t||e.name||"lab"),this.lab.name=this.labName,this.roomId=this.lab.view.roomId&&this.lab.rooms.some(r=>r.id===this.lab.view.roomId)?this.lab.view.roomId:((n=this.lab.rooms[0])==null?void 0:n.id)||null,this.selection=null,this.undoStack=[],this.redoStack=[],this.snap=JSON.stringify(this.lab),this.dirty=!1,this.cancelTools(),this.viewport.camState={},this.viewport.mode=this.lab.view.mode==="room"?"room":"topo",this.syncModeButtons(),this.viewport.rebuildAll(),this.viewport.fit(),this.inspector.render(),this.renderRoomSelect(),dt.setPref("lastLab",this.labName),(i=this.monitor)!=null&&i.live&&this.monitor.schedulePush(),document.getElementById("lab-name").textContent=this.labName,document.title=`${this.labName} \xB7 LabTracer`,this.updateStatus()}async openLab(e){try{this.loadLab(await dt.loadLab(e),e)}catch(t){Se(`Could not open ${e}: ${t.message}`,"err")}}async save(e=!1){if(!this.lab)return;let t=document.activeElement;!e&&t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName)&&!t.classList.contains("term-in")&&t.dispatchEvent(new Event("change"));try{this.lab.view.mode=this.viewport.mode,this.lab.view.roomId=this.roomId,await dt.saveLab(this.labName,this.lab),this.dirty=!1,this.lastSaved=Date.now(),this.updateStatus(),e||Se(dt.mode==="server"?`Saved ${this.labName}`:`Saved ${this.labName} in this browser`,"ok")}catch(n){Se("Save failed: "+n.message,"err",5e3)}}async saveLibrary(){try{await dt.saveLibrary({templates:this.library.custom})}catch(e){Se("Library save failed: "+e.message,"err",5e3)}}commit(e,t="all"){var i;let n=JSON.stringify(this.lab);if(n===this.snap){this.inspector.render();return}this.undoStack.push({s:this.snap,label:e}),this.undoStack.length>80&&this.undoStack.shift(),this.redoStack=[],this.snap=n,this.dirty=!0,t==="all"?this.viewport.rebuildAll():t==="links"?this.viewport.refreshLinks():t&&t.dev&&this.viewport.refreshDevice(t.dev),this.selection&&!this.selectionExists()&&(this.selection=null),this.inspector.render(),this.renderRoomSelect(),this.updateStatus(e),(i=this.monitor)!=null&&i.live&&this.monitor.schedulePush()}selectionExists(){let e=this.selection;return e&&(e.type==="device"?!!He(this.lab,e.id):this.lab.links.some(t=>t.id===e.id))}undo(){let e=this.undoStack.pop();if(!e)return Se("Nothing to undo","warn",1200);this.redoStack.push({s:this.snap,label:e.label}),this.restore(e.s),Se("Undo: "+e.label,"info",1400)}redo(){let e=this.redoStack.pop();e&&(this.undoStack.push({s:this.snap,label:e.label}),this.restore(e.s),Se("Redo: "+e.label,"info",1400))}restore(e){var t;this.lab=JSON.parse(e),this.snap=e,this.dirty=!0,this.selectionExists()||(this.selection=null),this.lab.rooms.some(n=>n.id===this.roomId)||(this.roomId=((t=this.lab.rooms[0])==null?void 0:t.id)||null),this.viewport.rebuildAll(),this.inspector.render(),this.renderRoomSelect(),this.updateStatus()}select(e){this.selection=e,this.viewport.setSelection(e),e&&e.type==="device"&&this.inspector.tab,this.inspector.render()}setTool(e){this.cancelTools(e),this.tool=e,this.viewport.tool=e,document.querySelectorAll("[data-tool]").forEach(t=>t.classList.toggle("on",t.dataset.tool===e)),this.updateStatus()}cancelTools(e){e!=="place"&&(this.placingTpl=null,this.palette&&this.palette.render()),this.linkStart=null,this.viewport&&this.viewport.setLinkSource(null),Wr(),e||(this.tool="select",this.viewport&&(this.viewport.tool="select"),document.querySelectorAll("[data-tool]").forEach(t=>t.classList.toggle("on",t.dataset.tool==="select")))}startPlacing(e){if(this.placingTpl===e){this.setTool("select");return}this.setTool("place"),this.placingTpl=e,this.palette.render(),this.updateStatus()}placeAt(e){this.placingTpl&&this.placeTemplate(this.placingTpl,e)}placeTemplate(e,t){let n=this.library.get(e);if(!n)return;let i=this.lab,r=this.viewport.mode;if(r==="topo"&&n.physicalOnly){Se(`${n.name} is a room object. Switch to the room view to place it.`,"warn");return}if(r==="room"&&(n.virtual||n.logical)){Se(`${n.name} is logical only. Place it in the topology view.`,"warn");return}if(r==="room"&&!this.roomId){Se("Add a room first (Lab panel)","warn");return}let o=ss(n,{name:$a(i,px(n))}),a=c=>this.viewport.snap(c);if(r==="topo")o.topo.x=a(t.x),o.topo.z=a(t.z);else{o.phys.roomId=this.roomId,o.phys.x=a(t.x),o.phys.z=a(t.z);let c=i.devices.filter(l=>!l.physicalOnly);o.topo.x=c.length?Math.round(c.reduce((l,h)=>l+h.topo.x,0)/c.length)+2:0,o.topo.z=c.length?Math.max(...c.map(l=>l.topo.z))+2:0,this.autoRack(o)||this.autoElevate(o)}i.devices.push(o),this.selection={type:"device",id:o.id},this.commit("Add "+o.name,"all"),this.placeMulti||this.setTool("select")}placeInRoom(e){let t=this.currentRoom();t&&(Object.assign(e.phys,{roomId:t.id,mount:"floor",rackId:null,rackU:null,x:t.w/2,z:t.d/2}),this.autoElevate(e),this.commit("Place "+e.name,"all"),this.viewport.mode!=="room"&&this.setMode("room"))}afterDrag(e){if(this.viewport.mode==="room"&&!Yt(e)&&!Gn(e)){if(this.autoRack(e)){this.commit("Mount "+e.name,"all");return}this.autoElevate(e)}this.commit("Move "+e.name,{dev:e.id})}furnitureUnder(e){let t=gi(this.lab,e);for(let n of this.lab.devices){if(!Gn(n)||n.phys.roomId!==t||n.id===e.id)continue;let i=((n.phys.rot||0)%180+180)%180,r=(i===90?n.dims.d:n.dims.w)/2,o=(i===90?n.dims.w:n.dims.d)/2;if(Math.abs(e.phys.x-n.phys.x)<=r&&Math.abs(e.phys.z-n.phys.z)<=o)return n}return null}autoRack(e){if(!(e.uHeight>0)||Yt(e)||e.phys.mount==="rack")return!1;for(let t of this.lab.devices){if(!Yt(t)||t.phys.roomId!==e.phys.roomId)continue;let n=((t.phys.rot||0)%180+180)%180,i=(n===90?t.dims.d:t.dims.w)/2,r=(n===90?t.dims.w:t.dims.d)/2;if(Math.abs(e.phys.x-t.phys.x)>i||Math.abs(e.phys.z-t.phys.z)>r)continue;let o=sr(this.lab,t,e);return o?(Object.assign(e.phys,{mount:"rack",rackId:t.id,rackU:o}),Se(`Mounted ${e.name} in ${t.name} at U${o}`,"ok",1800),!0):(Se(`${t.name} is full`,"warn"),!1)}return!1}autoElevate(e){var i;if(!e.phys.elevAuto||Yt(e)||Gn(e)||e.phys.mount==="rack")return;let t=this.furnitureUnder(e);if(!t||!((i=t.levels)!=null&&i.length)){e.phys.elev=0;return}let n=t.levels;e.phys.elev=n.includes(e.phys.elev)?e.phys.elev:n[n.length===1?0:Math.min(1,n.length-1)]}linkClick(e,t,n){let i=this.lab,r=He(i,e);if(this.linkStart&&this.linkStart.dev===e){this.cancelLink();return}let o=h=>{if(!this.linkStart)this.linkStart={dev:e,port:h},this.viewport.setLinkSource(e),this.updateStatus();else{let u=this.linkStart,d={dev:e,port:h},p=Mt(He(i,u.dev),u.port),m=Mt(r,h);if(p.kind==="power"!=(m.kind==="power")){Se("Power ports only connect to power ports","err");return}let _=this.linkMedium!=="auto"?this.linkMedium:fx(p,m);i.links.push({id:wt("ln"),a:u,b:d,medium:_,label:"",notes:""}),this.linkStart=null,this.viewport.setLinkSource(null),this.commit(`Link ${r.name}`,"all"),Se(`Linked ${He(i,u.dev).name}:${p.name} \u2194 ${r.name}:${m.name}`,"ok",1800)}},a=r.ports.filter(h=>Vn.has(h.kind)),c=a.filter(h=>ir(i,r,h)),l=[];c.length&&l.push({label:"First free port",sub:c[0].name,cls:"accent",onClick:()=>o(c[0].id)},"-");for(let h of a){let u=mi(i,r.id,h.id),d=ir(i,r,h);l.push({label:h.name,sub:`${h.kind}${h.speed?" "+h.speed:""}${u.length?Fi.has(h.kind)?` \xB7 ${u.length} peer(s)`:" \xB7 in use":""}`,disabled:!d,onClick:()=>o(h.id)})}l.push("-",{label:"New port\u2026",sub:"add a port to this device",onClick:async()=>{let h=await Ni("New port",`Port name on ${r.name}`,mx(r));if(!h)return;let u=Rt({name:h,kind:h.startsWith("wg")?"tunnel":h.startsWith("wl")?"wifi":r.virtual?"vport":"eth",mode:r.l2?"access":"routed"});r.ports.push(u),o(u.id)}}),Xr(t,n,this.linkStart?`To ${r.name}`:`From ${r.name}`,l)}cancelLink(){this.linkStart=null,this.viewport.setLinkSource(null),this.updateStatus()}removePortRaw(e,t){Su(this.lab,e,t)}deleteSelection(){let e=this.selection;if(e)if(e.type==="device"){let t=He(this.lab,e.id);Mu(this.lab,e.id),this.selection=null,this.commit("Delete "+((t==null?void 0:t.name)||"device"),"all")}else this.lab.links=this.lab.links.filter(t=>t.id!==e.id),this.selection=null,this.commit("Delete link","all")}duplicateSelected(){let e=this.selection;if(!e||e.type!=="device")return;let t=wu(this.lab,He(this.lab,e.id));this.selection={type:"device",id:t.id},this.commit("Duplicate","all")}rotateSelected(e=90){let t=this.selection;if(!t||t.type!=="device")return;let n=He(this.lab,t.id);n.phys.mount==="rack"&&(n=He(this.lab,n.phys.rackId)||n),n.phys.rot=(((n.phys.rot||0)+e)%360+360)%360,this.commit("Rotate","all")}applyTemplateToDevices(e){let t=0;for(let n of this.lab.devices)n.templateId===e.id&&(Object.assign(n,{shape:e.shape,face:e.face,bays:e.bays||0,dims:{...e.dims},color:e.color,uHeight:e.uHeight||0}),t++);t&&this.commit(`Update ${t} device(s) from template`,"all")}async saveDeviceAsTemplate(e){let t=await Ni("Save as custom object","Template name",[e.vendor,e.model].filter(Boolean).join(" ")||e.name);if(!t)return;let n={id:"cus_"+wt("t").slice(3),name:t,category:e.category==="Custom"?"Custom":e.category,shape:e.shape,face:e.face,bays:e.bays,dims:{...e.dims},uHeight:e.uHeight,rackUnits:e.rackUnits,levels:e.levels,color:e.color,l2:e.l2,l3:e.l3,virtual:e.virtual,physicalOnly:e.physicalOnly,logical:e.logical,passthrough:e.passthrough,vendor:e.vendor,model:e.model,ports:e.ports.filter(r=>!["svi","sub","loop"].includes(r.kind)).map(r=>({name:r.name,kind:r.kind,speed:r.speed,mode:r.mode})),attrs:Object.fromEntries(e.attrs.filter(r=>r.k).map(r=>[r.k,""]))},i=this.library.get(e.templateId);i!=null&&i.modelData&&(n.modelData=i.modelData),n.portRows=jh(n.ports),this.library.custom.push(n),await this.saveLibrary(),this.palette.render(),Se(`Added "${t}" to the library`,"ok")}setMode(e){e!==this.viewport.mode&&(this.cancelTools(),this.viewport.setMode(e),this.lab.view.mode=e,this.syncModeButtons(),this.updateStatus())}syncModeButtons(){document.querySelectorAll("[data-mode]").forEach(e=>e.classList.toggle("on",e.dataset.mode===this.viewport.mode)),document.getElementById("room-select").style.display=this.viewport.mode==="room"?"":"none",document.getElementById("tg-cables").style.display=this.viewport.mode==="room"?"":"none",document.getElementById("tg-ports").style.display=this.viewport.mode==="topo"?"":"none"}currentRoom(){return this.lab.rooms.find(e=>e.id===this.roomId)||null}setRoom(e){this.roomId=e,this.lab.view.roomId=e,this.renderRoomSelect(),this.viewport.mode!=="room"?this.setMode("room"):(this.viewport.rebuildAll(),this.viewport.fit()),this.inspector.render()}renderRoomSelect(){let e=document.getElementById("room-select");In(e);for(let t of this.lab.rooms)e.appendChild(v("option",{value:t.id,selected:t.id===this.roomId?"selected":null},t.name));this.lab.rooms.length||e.appendChild(v("option",{value:""},"(no rooms)"))}openConsole(e){this.selection={type:"device",id:e},this.inspector.tab="console",this.viewport.setSelection(this.selection),this.inspector.render()}async toggleLive(){this.monitor.live?this.monitor.stop():await this.monitor.start()&&Se("Live status on","ok",1500),this.onMonitorStatus()}onMonitorStatus(){let e=this.monitor;this.viewport.applyStatus(e.states());let t=document.getElementById("tg-live");t.classList.toggle("on",e.live),t.classList.toggle("err",e.live&&!!e.error);let n="Live";if(e.live&&e.status){let o={up:0,degraded:0,down:0};for(let a of e.states().values())a in o&&o[a]++;n=`Live ${o.up}\u2191`+(o.degraded?` ${o.degraded}!`:"")+(o.down?` ${o.down}\u2193`:""),t.title=e.error?"Agent error: "+e.error:`Agent ${e.status.host}: ${o.up} up, ${o.degraded} degraded, ${o.down} down`}else t.title="Live status from the check agent";t.textContent=n;let i=document.activeElement;i&&document.getElementById("inspector").contains(i)&&/INPUT|TEXTAREA|SELECT/.test(i.tagName)||this.inspector.render()}animatePing(e){var n,i,r;if(!e)return;let t=[];for(let o of((n=e.fwd)==null?void 0:n.hops)||[])t.push(...o.path);if(e.ok&&e.back)for(let o of e.back.hops)t.push(...o.path);this.viewport.animatePacket(t,e.ok,()=>{var o;!e.ok&&((o=e.fwd)!=null&&o.at)&&this.viewport.flashDevice(e.fwd.at.id)}),!e.ok&&((i=e.back)!=null&&i.at)&&this.viewport.flashDevice(e.back.at.id),!e.ok&&!t.length&&((r=e.fwd)!=null&&r.at)&&this.viewport.flashDevice(e.fwd.at.id)}fileMenu(e){let t=e.getBoundingClientRect();Xr(t.left-6,t.bottom-2,null,[{label:"New lab\u2026",sub:"empty",onClick:()=>this.newLabDialog()},{label:"Open lab\u2026",sub:"Ctrl+O",onClick:()=>this.openDialog()},{label:"Save",sub:"Ctrl+S",onClick:()=>this.save()},{label:"Save as\u2026",onClick:()=>this.saveAs()},"-",{label:"Import lab (.json)\u2026",onClick:()=>this.importLab()},{label:"Export lab (.json)",onClick:()=>zn(`${this.labName}.labtracer.json`,JSON.stringify(this.lab,null,1),"application/json")},{label:"Export all configs",sub:dt.mode==="server"?"to data/export/":".tar download",onClick:()=>this.exportConfigs(this.lab.devices)},{label:"Export inventory (.csv)",onClick:()=>this.exportCsv()},"-",{label:"Load example lab\u2026",onClick:async()=>{await Rn("Example lab",'Open the example lab as a new lab called "example-lab"?')&&(this.loadLab(nu(),"example-lab"),this.dirty=!0,this.updateStatus())}},{label:"Delete this lab\u2026",cls:"danger",onClick:()=>this.deleteLab()},"-",{label:"Settings\u2026",onClick:()=>this.settingsDialog()},{label:"Keyboard and help\u2026",sub:"?",onClick:()=>this.helpDialog()}])}async newLabDialog(){if(this.dirty&&!await Rn("Unsaved changes","Discard unsaved changes to the current lab?","Discard",!0))return;let e=await Ni("New lab","Lab name","new-lab","Create");e&&(this.loadLab(tr(Pn(e)),e),await this.save(!0))}async openDialog(){let e=[];try{e=await dt.listLabs()}catch(i){return Se(i.message,"err")}let t=v("div",{class:"lab-list"},e.length?e.map(i=>v("button",{class:"lab-item"+(i.name===this.labName?" on":""),onclick:async()=>{this.dirty&&i.name!==this.labName&&!await Rn("Unsaved changes","Discard unsaved changes to the current lab?","Discard",!0)||(n.close(),await this.openLab(i.name))}},v("b",null,i.name),v("small",null,`${Math.round(i.size/1024)} KB${i.modified?" \xB7 "+fi(i.modified*1e3):""}`))):v("p",{class:"muted"},"No labs saved yet.")),n=On("Open lab",t,[{label:"Close"}])}async saveAs(){let e=await Ni("Save as","New lab name",this.labName+"-copy","Save");e&&(this.labName=Pn(e),this.lab.name=this.labName,document.getElementById("lab-name").textContent=this.labName,dt.setPref("lastLab",this.labName),await this.save())}async importLab(){let e=await Ui(".json,application/json");if(e)try{let t=JSON.parse(await ns(e));if(!t.devices)throw new Error("not a LabTracer lab");let n=Pn(t.name||e.name.replace(/\..*$/,""));this.loadLab(t,n),this.dirty=!0,this.updateStatus(),Se(`Imported ${n}. Press Ctrl+S to save it.`,"ok",4e3)}catch(t){Se("Import failed: "+t.message,"err")}}async deleteLab(){if(!await Rn("Delete lab",`Delete "${this.labName}"? ${dt.mode==="server"?"A copy stays in data/labs/.history.":"This cannot be undone."}`,"Delete",!0))return;await dt.deleteLab(this.labName);let e=await dt.listLabs();e[0]?await this.openLab(e[0].name):this.loadLab(tr("new-lab"),"new-lab")}async exportConfigs(e){let t=[];for(let n of e)if(!n.physicalOnly){t.push({device:n.name,name:"running-config.txt",content:Ys(this.lab,n)});for(let i of n.files)t.push({device:n.name,name:i.name,content:i.content})}if(!t.length)return Se("No configs to export","warn");try{let n=await dt.exportConfigs(this.labName,t);if(n){Se(`Wrote ${n.files.length} file(s) to ${n.folder}`,"ok",5e3);return}}catch(n){Se("Export failed: "+n.message,"err");return}zn(`${this.labName}-configs.tar`,mu(t.map(n=>({path:`${this.labName}/${Pn(n.device)}/${Pn(n.name)}`,content:n.content}))))}exportCsv(){var t,n;let e=[["name","category","vendor","model","serial","room","rack","U","addresses","notes"]];for(let i of this.lab.devices){let r=((t=this.lab.rooms.find(a=>a.id===gi(this.lab,i)))==null?void 0:t.name)||"",o=i.phys.mount==="rack"&&((n=He(this.lab,i.phys.rackId))==null?void 0:n.name)||"";e.push([i.name,i.category,i.vendor,i.model,i.serial,r,o,i.phys.rackU||"",i.ports.filter(a=>a.ip).map(a=>`${a.name}=${a.ip}`).join(" "),i.notes])}zn(`${this.labName}-inventory.csv`,e.map(i=>i.map(r=>`"${String(r??"").replace(/"/g,'""')}"`).join(",")).join(`
`),"text/csv")}settingsDialog(){let e=this.settings,t=(n,i,r)=>v("label",{class:"chk"},v("input",{type:"checkbox",checked:e[n],onchange:o=>{e[n]=o.target.checked,this.applySettings()}}),i,r?v("small",{class:"muted"}," "+r):null);On("Settings",v("div",{class:"settings"},v("h4",null,"Performance"),t("antialias","Smooth edges (antialiasing)","needs reload; turn off on slow PCs"),v("label",{class:"fld"},v("span",null,"Render resolution cap"),v("select",{class:"inp",onchange:n=>{e.pixelCap=+n.target.value,this.applySettings()}},[[.75,"0.75\xD7 (fastest)"],[1,"1\xD7"],[1.25,"1.25\xD7 (default)"],[1.5,"1.5\xD7"],[2,"2\xD7 (sharpest)"]].map(([n,i])=>v("option",{value:n,selected:e.pixelCap===n?"selected":null},i))),v("small",null,"needs reload")),v("h4",null,"Display"),v("div",{class:"row2"},v("label",{class:"fld"},v("span",null,"Grid colour"),v("div",{class:"btnrow tight"},v("input",{class:"inp color",type:"color",value:e.gridColor,oninput:n=>{e.gridColor=n.target.value,this.applyColors()}}),v("button",{class:"btn small",onclick:n=>{e.gridColor=iu.gridColor,n.target.previousSibling.value=e.gridColor,this.applyColors()}},"Reset"))),v("label",{class:"fld"},v("span",null,"3D background"),v("div",{class:"btnrow tight"},v("input",{class:"inp color",type:"color",value:e.bgColor,oninput:n=>{e.bgColor=n.target.value,this.applyColors()}}),v("button",{class:"btn small",onclick:n=>{e.bgColor=iu.bgColor,n.target.previousSibling.value=e.bgColor,this.applyColors()}},"Reset")))),t("labels","Device labels"),t("portLabels","Port names on links (topology)"),t("powerLinks","Power links (topology)"),t("cables","Cables (room)"),t("portAnchors","Cables plug into their real port position","off = cables meet at the device centre"),t("rackLabels","Labels for rack-mounted devices (room)"),v("h4",null,"Editing"),t("snap","Snap to grid"),t("lockLayout","Lock layout (no dragging)"),t("autosave","Autosave every 30 s",dt.mode==="server"?"":"(server mode only)")),[{label:"Reload now",onClick:()=>{location.reload()}},{label:"Done",primary:!0}])}applySettings(){dt.setPref("settings",this.settings),this.syncToggles(),this.viewport.rebuildAll()}applyColors(){dt.setPref("settings",this.settings),this.viewport.rebuildEnv()}syncToggles(){var t;let e={"tg-labels":"labels","tg-ports":"portLabels","tg-cables":"cables","tg-snap":"snap"};for(let[n,i]of Object.entries(e))(t=document.getElementById(n))==null||t.classList.toggle("on",!!this.settings[i])}helpDialog(){On("Keyboard and mouse",v("div",null,v("table",{class:"keys"},[["V","Select / move tool"],["L","Link tool (click device, pick port, click second device)"],["Esc","Cancel tool or close popup"],["Del / Backspace","Delete selection"],["Ctrl+D","Duplicate device"],["R / Shift+R","Rotate in room view"],["F","Fit view"],["T","Top-down view"],["1 / 2","Topology / room view"],["Ctrl+Z / Ctrl+Y","Undo / redo"],["Ctrl+S","Save"],["Double-click","Open device console"],["Left drag","Orbit (or move a device)"],["Right drag","Pan"],["Wheel","Zoom"]].map(([t,n])=>v("tr",null,v("td",null,v("kbd",null,t)),v("td",null,n)))),v("p",{class:"muted small"},'Console: type ? in a device console for commands. "write memory" keeps a dated startup-config snapshot.')),[{label:"Close"}])}bindToolbar(){let e=i=>document.getElementById(i);e("btn-file").onclick=i=>this.fileMenu(i.currentTarget),e("btn-save").onclick=()=>this.save(),e("btn-undo").onclick=()=>this.undo(),e("btn-redo").onclick=()=>this.redo(),e("btn-fit").onclick=()=>this.viewport.fit(),e("btn-top").onclick=()=>this.viewport.top(),e("btn-help").onclick=()=>this.helpDialog(),e("tg-live").onclick=()=>this.toggleLive(),document.querySelectorAll("[data-mode]").forEach(i=>i.onclick=()=>this.setMode(i.dataset.mode)),document.querySelectorAll("[data-tool]").forEach(i=>i.onclick=()=>this.setTool(i.dataset.tool)),e("room-select").onchange=i=>this.setRoom(i.target.value);let t=e("link-medium");for(let[i,r]of Qr)t.appendChild(v("option",{value:i},r));t.onchange=i=>{this.linkMedium=i.target.value,this.tool!=="link"&&this.setTool("link")};let n=(i,r)=>{e(i).onclick=()=>{this.settings[r]=!this.settings[r],this.applySettings()}};n("tg-labels","labels"),n("tg-ports","portLabels"),n("tg-cables","cables"),n("tg-snap","snap"),this.syncToggles()}bindKeys(){document.addEventListener("keydown",e=>{var i,r;let t=/INPUT|TEXTAREA|SELECT/.test((i=document.activeElement)==null?void 0:i.tagName)||((r=document.activeElement)==null?void 0:r.isContentEditable),n=e.ctrlKey||e.metaKey;if(n&&e.key.toLowerCase()==="s"){e.preventDefault(),this.save();return}if(n&&e.key.toLowerCase()==="o"){e.preventDefault(),this.openDialog();return}if(!(t||document.querySelector(".modal-back"))){if(n&&e.key.toLowerCase()==="z"){e.preventDefault(),e.shiftKey?this.redo():this.undo();return}if(n&&e.key.toLowerCase()==="y"){e.preventDefault(),this.redo();return}if(n&&e.key.toLowerCase()==="d"){e.preventDefault(),this.duplicateSelected();return}if(!n)switch(e.key){case"Escape":this.tool!=="select"||this.linkStart?this.setTool("select"):this.select(null);break;case"Delete":case"Backspace":e.preventDefault(),this.deleteSelection();break;case"v":case"V":this.setTool("select");break;case"l":case"L":this.setTool("link");break;case"f":case"F":this.viewport.fit();break;case"t":case"T":this.viewport.top();break;case"r":this.rotateSelected(90);break;case"R":this.rotateSelected(-90);break;case"1":this.setMode("topo");break;case"2":this.setMode("room");break;case"?":this.helpDialog();break}}})}updateStatus(e){var r,o,a;let t=document.getElementById("status-left"),n="";this.tool==="place"?n=`Placing ${((r=this.library.get(this.placingTpl))==null?void 0:r.name)||""}: click on the floor. Esc to stop.`:this.tool==="link"?n=this.linkStart?"Click the second device.":"Link tool: click the first device. Esc to stop.":n=((o=this.viewport)==null?void 0:o.mode)==="room"?"Room view \xB7 drag to move \xB7 R rotates \xB7 racks: select one, see Physical tab":"Topology view \xB7 drag to move \xB7 double-click for console",t&&(t.textContent=n);let i=document.getElementById("status-right");i&&this.lab&&(i.textContent=`${this.dirty?"\u25CF unsaved":this.lastSaved?"saved "+new Date(this.lastSaved).toLocaleTimeString():"saved"}${e?" \xB7 "+e:""}`),(a=document.getElementById("btn-save"))==null||a.classList.toggle("dirty",!!this.dirty)}};function fx(s,e){let t=new Set([s.kind,e.kind]);return t.has("power")?"power":t.has("tunnel")?"tunnel":t.has("console")||t.has("usb")?"console":t.has("wifi")?"wireless":t.has("vport")?"virtual":t.has("sfp")?"fiber":"copper"}function px(s){let e={Network:"net",Compute:"host",Storage:"nas",Virtual:"vm",Endpoints:"client",Power:"ups",WAN:"wan",Infrastructure:s.shape};return s.shape==="rack"?"Rack":s.shape==="desk"?"Desk":s.shape==="shelf"?"Shelf":(e[s.category]||"dev")+"-01"}function mx(s){let e=s.ports.length;for(;s.ports.some(t=>t.name==="eth"+e);)e++;return"eth"+e}var qf=new su;window.labtracer=qf;qf.init().catch(s=>{console.error(s),Se("Startup failed: "+s.message,"err",1e4)});})();
/*! Bundled license information:

three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2024 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
