const assert=require('node:assert/strict'),fs=require('node:fs');const {PrismaClient}=require('@prisma/client');
const url=new URL(process.env.DATABASE_URL),base=process.env.QA_API_URL||'http://127.0.0.1:15031/api';if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/university_qa_\d+$/.test(url.pathname)||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('API et base QA locales obligatoires');
const db=new PrismaClient();
(async()=>{let evaluation;try{
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'scolarite@unipresence.gn',password:'Passer@2026'})});assert.equal(login.status,201);const {token}=await login.json();
 const ref=await db.promotion.findFirstOrThrow();const matiere=await db.matiere.findFirstOrThrow();evaluation=await db.evaluation.create({data:{intitule:'Épreuve QA de traduction',type:'EXAMEN',statut:'CLOTUREE',promotionId:ref.id,anneeId:ref.anneeId,matiereId:matiere.id}});
 const checks=[];
 for(const language of ['fr-FR','en-US']){
  const response=await fetch(base+'/notes/saisie',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept-Language':language},body:JSON.stringify({evaluationId:evaluation.id,notes:[]})});
  assert.equal(response.status,400);const result=await response.json();assert.match(result.message,language==='fr-FR'?/clôturée/:/closed/);assert.ok(result.message.includes(evaluation.intitule));assert.ok(!/[{}]/.test(result.message));checks.push({language,status:response.status,message:result.message,result:'OK'});
 }
 fs.writeFileSync(process.env.QA_REPORT||'/tmp/university-langues-backend.json',JSON.stringify({date:new Date().toISOString(),checks},null,2));console.log(JSON.stringify(checks));
}finally{if(evaluation)await db.evaluation.delete({where:{id:evaluation.id}});await db.$disconnect();}})().catch(error=>{console.error(error);process.exitCode=1;});
