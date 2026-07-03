/*
   Виправлено помилку: розділювач skip: було "\r\n", виправлено на /\r*\n/
   Кодування файлу змінено на UTF-8
   2026-03-24 20:09

   Додано перевірку наявності тега $time=xx в другому рядку (підзаголовок "Бліц-тест")
   console.log замінено на console.error
   2026-03-10 14:28
   
   choice <num>
   ranking
   text
*/
const cntOptionsMAX = 10;
function exit_error(msg) { console.error("\x1b[1m\x1b[31m"+msg+"\x1b[0m"); process.exit(1); }

const fs = require("fs");
let s = fs.readFileSync(0).toString().trim();

let lines = s.split(/\r*\n/);
//console.log(lines);
skipComment = false;
state = "title";
let res = [];
let cntLinesQuestion = 0;
let cntOptions = 0;
let iRes = 0;
let iCntQ = 0;
let iCntOpt = 0;
let questionCnt = 0;
for(let i=0; i<lines.length; ++i)
{
   let line = lines[i].trim();
   //console.log(`DEBUG: state="${state}" line="${line}"`);

   // w/o output
   if(skipComment)
   {
      if(line[0]=='*' && line[1]=='/') skipComment = false;
      continue;
   }
//   if(line[0]=='#') continue;
   if(line[0]=='/' && line[1]=='/') continue;
   if(line[0]=='/' && line[1]=='*') { skipComment = true; continue; }
   if(line=="" && state != "question" && state != "prequestion") continue;

   // make output
   if     (state == "title")       state = "subtitle";
   else if(state == "subtitle")  { state = "questionType"; if( ! /\$time\s*?=\s*?\d+/.test(line) ) exit_error("no time duration set"); }
   else if(state == "questionType"){
      if(line=="text" || line=="ranking" || ([t,n] = line.split(/\s+/), t=="choice" && Number.isInteger(Number(n)))) {
         state = "prequestion";
      }
      else exit_error(`wrong questionType: '${line}' in line ${i+1}`);
   }
   else if(state == "prequestion") { state = "question"; cntLinesQuestion = 1; iCntQ = iRes++; res.push("EMPTY"); }
   else if(state == "question")
      if(line == "<begin>")        { state = "option"; res[iCntQ] = cntLinesQuestion;  cntOptions = 0; iCntOpt = iRes++; res.push("EMPTY"); continue; }
      else cntLinesQuestion++;
   else if(state == "option")
      if(line == "<end>") {
         //console.log(`${cntOptions} ${cntOptionsMAX}`);
         questionCnt++;
         if(cntOptions>cntOptionsMAX) exit_error(`wrong cntOptions: '${cntOptions}' in the question #${questionCnt} (must be cntOptions<= ${cntOptionsMAX})`);
         else { state = "questionType"; res[iCntOpt] = cntOptions; continue; }
      }
      else cntOptions++;

   res.push(line); iRes++;
   //console.log(line);
}
//console.log("Result:");
for(let i=0; i<res.length; ++i)
   console.log(res[i]);
