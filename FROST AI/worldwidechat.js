import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, doc, query, orderBy, limit, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyBfpeqUE8Dau5ZV5qNszWKoey1Cl4R5zIQ",authDomain:"frostgpt-4e3fa.firebaseapp.com",databaseURL:"https://frostgpt-4e3fa-default-rtdb.firebaseio.com",projectId:"frostgpt-4e3fa",storageBucket:"frostgpt-4e3fa.firebasestorage.app",messagingSenderId:"650451428263",appId:"1:650451428263:web:ce4dd9ea1678d2686c0c82",measurementId:"G-7EGCH66DG6"};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const status=$("status"),list=$("messages"),form=$("composer"),input=$("messageInput"),send=$("send"),notice=$("signInNotice"),preview=$("replyPreview"),replyText=$("replyText");
let user=null,unsubscribe=null,replyTarget=null;
function displayName(account){try{const n=localStorage.getItem(`frostgpt_nickname_${account.uid}`)?.trim();if(n)return n.slice(0,30)}catch{}return(account.displayName?.trim()?.split(/\s+/)[0]||account.email?.split("@")[0]||"User").slice(0,30)}
function cancelReply(){replyTarget=null;preview.hidden=true;replyText.textContent=""}
function stop(){if(unsubscribe)unsubscribe();unsubscribe=null}
function start(){
 stop();const q=query(collection(db,"worldwideMessages"),orderBy("createdAt","desc"),limit(50));
 unsubscribe=onSnapshot(q,snapshot=>{
  const docs=[...snapshot.docs].reverse(),byId=new Map(docs.map(d=>[d.id,d.data()]));list.replaceChildren();
  for(const d of docs){const data=d.data(),card=document.createElement("article");card.className="message";
   const meta=document.createElement("div");meta.className="meta";const name=document.createElement("strong");name.textContent=String(data.displayName||"User").slice(0,30);const time=document.createElement("time");
   if(data.createdAt?.toDate){const date=data.createdAt.toDate();time.dateTime=date.toISOString();time.textContent=date.toLocaleString()}else time.textContent="Just now";meta.append(name,time);
   if(data.replyToId){const ref=document.createElement("div");ref.className="reply-reference";const original=byId.get(data.replyToId);ref.textContent=original?`↪ Replying to ${String(data.replyToName||"user").slice(0,30)}: ${String(original.text||"").slice(0,120)}`:`↪ Replying to ${String(data.replyToName||"a message").slice(0,30)}`;card.append(ref)}
   const body=document.createElement("p");body.textContent=String(data.text||"").slice(0,500);const actions=document.createElement("div");actions.className="actions";
   const reply=document.createElement("button");reply.type="button";reply.textContent="↩ Reply";reply.addEventListener("click",()=>{replyTarget={id:d.id,name:String(data.displayName||"User").slice(0,30)};replyText.textContent=`Replying to ${replyTarget.name}`;preview.hidden=false;input.focus()});
   const report=document.createElement("button");report.type="button";report.textContent="Report";report.addEventListener("click",async()=>{const reason=window.prompt("Why are you reporting this message? (Maximum 300 characters)");if(!reason?.trim())return;try{await setDoc(doc(collection(db,"worldwideReports")),{reporterUid:user.uid,messageId:d.id,reason:reason.trim().slice(0,300),createdAt:serverTimestamp()});status.textContent="Report submitted."}catch(e){console.error(e);status.textContent="Report could not be submitted."}});
   actions.append(reply,report);card.append(meta,body,actions);list.append(card)
  }status.textContent=`${docs.length} recent messages · Live`;list.scrollTop=list.scrollHeight
 },e=>{console.error(e);status.textContent="Could not load messages. Check Firestore Rules."})
}
form.addEventListener("submit",async e=>{e.preventDefault();if(!user||user.isAnonymous){status.textContent="Sign in with a regular account to post.";return}const text=input.value.trim();if(!text)return;send.disabled=true;try{const payload={uid:user.uid,displayName:displayName(user),text,createdAt:serverTimestamp()};if(replyTarget){payload.replyToId=replyTarget.id;payload.replyToName=replyTarget.name}await setDoc(doc(collection(db,"worldwideMessages")),payload);input.value="";cancelReply();status.textContent="Message sent."}catch(e){console.error(e);status.textContent="Message could not be sent. Check Firestore Rules."}finally{send.disabled=false}});
$("cancelReply").addEventListener("click",cancelReply);
onAuthStateChanged(auth,account=>{user=account;if(!account||account.isAnonymous){stop();form.hidden=true;notice.hidden=false;status.textContent="Sign in required.";return}form.hidden=false;notice.hidden=true;start()});
