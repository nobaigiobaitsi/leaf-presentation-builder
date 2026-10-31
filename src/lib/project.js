export const MAX_PROPERTIES=40;
export const MAX_FILE_BYTES=60*1024*1024;
export const uid=()=>globalThis.crypto.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const string=(v,max=650)=>typeof v==='string'?v.slice(0,max):'';
const num=(v,max)=>v===''||v==null?'':(Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):'');
export const imageSource=v=>typeof v==='string'&&(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)||/^assets\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(v))?v:'';
export function validateProject(raw,{portable=false}={}){
 if(!raw||raw.format!=='leaf-presentation'||raw.version!==1||!Array.isArray(raw.properties)||!raw.presentation)throw Error('Το αρχείο δεν είναι έργο LEAF έκδοσης 1.');
 if(raw.properties.length>MAX_PROPERTIES)throw Error('Υποστηρίζονται έως 40 ακίνητα ανά έργο.');
 const p=raw.presentation;const presentation={};
 for(const [k,max]of Object.entries({title:60,subtitle:100,date:40,brand:65,email:90,phone:50,website:90}))presentation[k]=string(p[k],max);
 const source=v=>{const s=imageSource(v);if(v&&!s)throw Error('Μη έγκυρη εικόνα στο αρχείο έργου.');if(portable&&s&&!s.startsWith('data:'))throw Error('Το έργο περιέχει εξωτερικές εικόνες. Αποθηκεύστε το ξανά από την εφαρμογή.');return s;};
 presentation.logo=source(p.logo);for(const k of ['overview','comparison','closing'])presentation[k]=p[k]!==false;
 const properties=raw.properties.map((p,i)=>{
  if(!p||typeof p!=='object')throw Error('Μη έγκυρο ακίνητο.');
  const o={id:`property-${i}`,included:p.included!==false,isRender:!!p.isRender,price:num(p.price,1e10),sqm:num(p.sqm,1e6)};
  for(const [k,max]of Object.entries({title:60,area:60,floor:18,year:18,bedrooms:12,energy:12,description:650,note:180}))o[k]=string(p[k],max);
  if(!Array.isArray(p.features)||p.features.length>8)throw Error('Κάθε ακίνητο υποστηρίζει έως 8 χαρακτηριστικά.');
  o.features=p.features.map(f=>string(f,90)).filter(Boolean);
  if(!Array.isArray(p.photos)||p.photos.length>3)throw Error('Κάθε ακίνητο υποστηρίζει έως 3 φωτογραφίες.');
  o.photos=p.photos.map((ph,j)=>({id:`photo-${i}-${j}`,src:source(ph.src),caption:string(ph.caption,50)}));return o;
 });return {format:'leaf-presentation',version:1,presentation,properties};
}
export const newProperty=()=>({id:uid(),included:true,title:'Νέο ακίνητο',area:'',price:'',sqm:'',floor:'',year:'',bedrooms:'',energy:'',description:'',features:[],note:'',isRender:false,photos:[]});
export function moveItem(items,from,to){if(to<0||to>=items.length)return items;const copy=[...items];const [item]=copy.splice(from,1);copy.splice(to,0,item);return copy;}
export const money=n=>n===''||n==null?'—':new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
export function buildPages(project){
 const ps=project.properties.filter(p=>p.included);let pages=[{type:'cover'}];
 if(project.presentation.overview)for(let i=0;i<ps.length;i+=8)pages.push({type:'overview',items:ps.slice(i,i+8),offset:i});
 if(project.presentation.comparison)for(let i=0;i<ps.length;i+=8)pages.push({type:'comparison',items:ps.slice(i,i+8),offset:i});
 ps.forEach((p,i)=>{pages.push({type:'property',property:p,index:i});if(p.photos.length)pages.push({type:'photos',property:p,index:i});});
 if(project.presentation.closing)pages.push({type:'closing'});return pages;
}
export const pageLabel=p=>({cover:'Εξώφυλλο',overview:'Επισκόπηση',comparison:'Σύγκριση',closing:'Επικοινωνία'}[p.type]||`${String(p.index+1).padStart(2,'0')} · ${p.type==='photos'?'Φωτογραφίες':'Χαρακτηριστικά'}`);
export const createEmptyProject = () => ({
  format: 'leaf-presentation',
  version: 1,
  presentation: {
    title: 'Επιλεγμένα Ακίνητα',
    subtitle: '',
    date: new Intl.DateTimeFormat('el-GR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
    brand: 'LEAF Properties & Partners',
    email: 'leafproperties.info@gmail.com',
    phone: '698 586 8836',
    website: 'leafproperties.net',
    logo: 'assets/logo.jpg',
    overview: true,
    comparison: true,
    closing: true,
  },
  properties: [],
});