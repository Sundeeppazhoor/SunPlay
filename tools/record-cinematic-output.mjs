// Copies an actual imagegen output unchanged and records its native resolution.
import fs from 'node:fs';
import crypto from 'node:crypto';
const [id,variant,source]=process.argv.slice(2);
const jobs=JSON.parse(fs.readFileSync('assets/cinematic/prompts.json','utf8'));
const job=jobs.find(j=>j.id===id&&j.variant===variant);
if(!job||!source)throw Error('Unknown production image');
const image=fs.readFileSync(source);
if(image.subarray(1,4).toString()!=='PNG')throw Error('Expected actual PNG output');
const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
if(width<1900||width/height<2.7||width/height>3.3)throw Error(`Unexpected output resolution ${width}x${height}`);
fs.mkdirSync('deploy/app/art/cinematic',{recursive:true});
fs.copyFileSync(source,job.output);
const record={id,variant,title:job.title,output:job.output,source,width,height,sha256:crypto.createHash('sha256').update(image).digest('hex'),method:'built-in imagegen; original pixels copied without resampling',recordedAt:new Date().toISOString()};
fs.appendFileSync('assets/cinematic/provenance.jsonl',JSON.stringify(record)+'\n');
console.log(`${job.title} ${variant}: saved original ${width}x${height}`);
