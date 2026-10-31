import {MAX_FILE_BYTES,validateProject} from './project.js';
export function readDataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Η εικόνα δεν διαβάστηκε.'));r.readAsDataURL(blob);});}
export async function loadImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Επιλέξτε εικόνα JPG, PNG ή WebP.');
 if(file.size>15*1024*1024)throw Error('Κάθε εικόνα πρέπει να είναι έως 15 MB.');
 const src=await readDataURL(file);const img=new Image();img.src=src;await img.decode();
 if(img.width*img.height>60000000)throw Error('Η εικόνα είναι πολύ μεγάλη. Μειώστε την ανάλυσή της.');
 const scale=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9);
}
export async function portableProject(project){
 const copy=structuredClone(project);const cache=new Map();
 async function embed(src){if(!src||src.startsWith('data:'))return src;if(!cache.has(src))cache.set(src,(async()=>{const r=await fetch(src);if(!r.ok)throw Error('Μία εικόνα δεν φορτώθηκε. Το έργο δεν αποθηκεύτηκε.');return readDataURL(await r.blob());})());return cache.get(src);}
 copy.presentation.logo=await embed(copy.presentation.logo);
 await Promise.all(copy.properties.flatMap(p=>p.photos.map(async ph=>{ph.src=await embed(ph.src);})));return copy;
}
export async function saveFile(project){
 const portable=await portableProject(project);const json=JSON.stringify(portable);const blob=new Blob([json],{type:'application/json'});if(blob.size>MAX_FILE_BYTES)throw Error('Το έργο ξεπερνά τα 60 MB. Αφαιρέστε μερικές εικόνες.');
 if(window.leafDesktop)return window.leafDesktop.saveProject(json,project.presentation.title);
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(project.presentation.title||'LEAF-Presentation').replace(/[<>:"/\\|?*]/g,'-')+'.leaf.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return true;
}
export async function openFile(file){if(file.size>MAX_FILE_BYTES)throw Error('Το αρχείο ξεπερνά τα 60 MB.');let raw;try{raw=JSON.parse(await file.text());}catch{throw Error('Το αρχείο δεν είναι έγκυρο JSON.');}return validateProject(raw,{portable:true});}
const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('leaf-presentation-builder',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function readDraft(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('projects');const req=tx.objectStore('projects').get('draft');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();});}
export async function writeDraft(project){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(project,'draft');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};});}
