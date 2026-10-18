import {GoogleGenAI} from '@google/genai';
import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
try {
 const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY,httpOptions:{timeout:60000}});
 const response=await ai.models.generateContent({model:process.env.GEMINI_MODEL,contents:'هذه تجربة اتصال فقط بدون بيانات شخصية. أجب بصيغة JSON فقط: {"reply":"جاهز","proposal":null}',config:{responseMimeType:'application/json',maxOutputTokens:1024}});
 const result=JSON.parse(response.text);
 console.log(JSON.stringify({ok:typeof result.reply==='string',model:process.env.GEMINI_MODEL,reply:result.reply,proposal:result.proposal}));
} catch(e) {
 console.log(JSON.stringify({ok:false,status:e.status??null,reason:e.status===429?'quota_or_rate_limit':e.status===400?'request_rejected':'generation_failed'}));
 process.exitCode=1;
}
