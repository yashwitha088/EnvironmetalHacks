import fs from 'node:fs/promises';
import path from 'node:path';

export const seed = {
  locations: [
    {id:'D-04',name:'Lake North outfall',city:'Hyderabad',state:'Telangana',region:'South India',lat:17.385,lon:78.486,waterBody:'Lake North',catchment:88,traffic:82,construction:73,waste:61,base:79,confidence:72,source:'Fallback seed record'},
    {id:'D-11',name:'Bellandur edge outfall',city:'Bengaluru',state:'Karnataka',region:'South India',lat:12.935,lon:77.624,waterBody:'Bellandur Lake',catchment:84,traffic:77,construction:62,waste:73,base:76,confidence:68,source:'Fallback seed record'},
    {id:'D-02',name:'Yamuna link drain',city:'Delhi',state:'Delhi',region:'North India',lat:28.613,lon:77.209,waterBody:'Yamuna floodplain',catchment:69,traffic:91,construction:65,waste:58,base:72,confidence:81,source:'Fallback seed record'},
    {id:'D-07',name:'Mithi corridor outfall',city:'Mumbai',state:'Maharashtra',region:'West India',lat:19.076,lon:72.878,waterBody:'Mithi River',catchment:80,traffic:86,construction:52,waste:68,base:70,confidence:77,source:'Fallback seed record'},
    {id:'D-15',name:'Adyar approach drain',city:'Chennai',state:'Tamil Nadu',region:'South India',lat:13.047,lon:80.209,waterBody:'Adyar River',catchment:74,traffic:71,construction:60,waste:56,base:67,confidence:65,source:'Fallback seed record'},
    {id:'D-21',name:'East Canal drain',city:'Kolkata',state:'West Bengal',region:'East India',lat:22.572,lon:88.363,waterBody:'East Kolkata Wetlands',catchment:72,traffic:63,construction:54,waste:79,base:64,confidence:61,source:'Fallback seed record'},
    {id:'D-31',name:'Jaipur market inlet',city:'Jaipur',state:'Rajasthan',region:'North India',lat:26.912,lon:75.787,waterBody:'Amanishah drain',catchment:60,traffic:70,construction:49,waste:66,base:57,confidence:56,source:'Fallback seed record'},
    {id:'D-42',name:'Guwahati lowland drain',city:'Guwahati',state:'Assam',region:'East India',lat:26.144,lon:91.736,waterBody:'Bharalu River',catchment:63,traffic:45,construction:42,waste:58,base:52,confidence:49,source:'Fallback seed record'}
  ], observations: [], actions: []
};

export async function readStore(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { await fs.mkdir(path.dirname(file), {recursive:true}); await fs.writeFile(file, JSON.stringify(seed, null, 2)); return structuredClone(seed); }
}
export async function writeStore(file, data) { await fs.mkdir(path.dirname(file), {recursive:true}); await fs.writeFile(file, JSON.stringify(data, null, 2)); return data; }
