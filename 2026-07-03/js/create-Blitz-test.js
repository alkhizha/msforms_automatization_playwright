/*

Читаємо скомпільований бліц-тест з текстового файлу.
Для кожного питання бліц-тесту
   Розпізнаємо тип питання (t)
   Вибір типу:
      choice?
      ranking
      text
Виводимо повідомлення про закінчення створення тесту ("quiz" MS Forms)
*/

function log(title,s) {
   console.log(title,s);
}

class Question {
   #type
   #text = ""
   #options = []
   #answCnt

   constructor (type) { let a = type.split(/\s+/); this.#type   = a[0]; this.#answCnt   = Number(a[1]); }
   get type() { return this.#type; }
   get text() { return this.#text; }
   get answCnt() { return this.#answCnt; }
   get options() { return this.#options; }
   addToText(line)    { this.#text  += ((this.#text=="")? "" : "\n")+line.trim();  }
   addToOpts(line)    { this.#options.push( line.trim()); }
   log() {
      log("Log question:","");
      log("   type:",this.#type);
      log("   text:",this.#text);
      log("   opts:",this.#options);
   }
   publish() {
   }
}

class Quiz {
   #PAUSE       = 250
   #PAUSE_SHORT = 250
   #page
   #page2
   #browser
   #questions = []

   constructor() {   }
   /*************************** Helper Functions ************************************************************************/
   async clickByRole(page, role, name) {
     await page.getByRole(role, { name: name , exact: true }).click();
   }

   async clickButton(page, name) {
     await this.clickByRole(page, 'button', name);
   }

   async clickCheckbox(page, name) {
     await this.clickByRole(page, 'checkbox', name);
   }

   async typeByRole(page, role, name, text) {
     await page.getByRole(role, { name: name , exact: true  }).type(text);
   }

   async countByRole(page, role, name, text) {
      return await page.getByRole(role, { name: name , exact: true  }).count();
   }
   
   async fillByRole(page, role, name, text) {
     await page.getByRole(role, { name: name , exact: true  }).fill(text);
   }

   async setElem(page, role, label, desiredOn, timeout = 5_000) {
     const elem = await page.getByRole(role, { name: label, exact: true });
     //console.log(await elem.isVisible());

     // 1) дождаться, что switch есть
     //console.log(`(${await elem.getAttribute('aria-label')}).visible = `);
     await elem.waitFor({ state: 'visible', timeout: timeout} );


     // 2) убедиться, что он не disabled
     const disabled = await elem.getAttribute('aria-disabled');
     if (disabled === 'true') {
       throw new Error(`Switch "${label}" is disabled (aria-disabled=true).`);
     }

     // 3) текущее состояние
     const currentOn = (await elem.getAttribute('aria-checked')) === 'true';
     if (currentOn === desiredOn) return; // уже как нужно

     // 4) клик
     await elem.click();
     if(await elem.isHidden()) return;

     // 5) дождаться изменения состояния
     const elemHandle = await elem.elementHandle();

     await page.waitForFunction(
       ({ el, want }) => el.getAttribute('aria-checked') === (want ? 'true' : 'false'),
       { el: elemHandle, want: desiredOn },
       { timeout }
     );
   }

   async setSwitch(page, label, desiredOn) {
      await this.setElem(page, 'switch', label, desiredOn);
   }

   async setCheckBox(page, label, desiredOn) {
      await this.setElem(page, 'checkbox', label, desiredOn);
   }

   async press(page,key) {
    await page.keyboard.press(key);
    await page.waitForTimeout(this.#PAUSE_SHORT);
   }

   async pressTAB(page,cnt) {
    while(cnt-->0) {
        await this.press(page,'Tab');
    }
   }
   async pressShiftTAB(page,cnt) {
    while(cnt-->0) {
        await this.press(page,'Shift+Tab');
    }
   }
   /*********************************************************************************************************************/
   async init(ft,fd, ftime) {
      const { chromium } = require('playwright');
      // 1) Подключаемся к уже запущенному Edge (CDP)
      this.#browser = await chromium.connectOverCDP('http://127.0.0.1:9222');

      // 2) Берём первый контекст (для CDP обычно один)
      const context = this.#browser.contexts()[0];
      if (!context) throw new Error('No browser context found. Is Edge running with --remote-debugging-port?');

      // 3) Идём в Forms: авторизация уже есть в профиле
      // 
      // Следующая проверка связана с тем, что почему-то
      // иногда MS Forms требует повторной авторизации
      // и слишком медленно проходит повторная авторизация (?)
      // (временное) решение:
      // вручную открываем страницу MS Forms с кнопкой "New Quiz"
      // и запускаем эту программу
      let is_Button_NewQuiz_Available = true;
      if(is_Button_NewQuiz_Available) {
         let pp = await context.pages();
         this.#page = await pp[pp.length-1];
      } else {
         this.#page = await context.newPage();
         await this.#page.goto('https://forms.office.com', { waitUntil: 'domcontentloaded' });
      }

      // 4) Дальше — ваши шаги (пока просто проверка, что мы в Forms)
      console.log('Current URL:', this.#page.url());

      [this.#page2] = await Promise.all([
        context.waitForEvent('page'),
        this.#page.getByRole('button', { name: 'Create a new quiz' }).click()
      ]);

      await this.#page2.waitForLoadState('domcontentloaded');
      console.log('New tab URL:', this.#page2.url());

      await this.#page2.bringToFront(); // опционально

      // Settings
      // <div class="-pK-574 -Ug-571" tabindex="0"
      //    role="switch" type="button" aria-label="Practice mode"
      //    aria-checked="false" aria-disabled="false"><div class="-yw-575"></div></div>
      await this.clickButton(this.#page2, 'Settings');
      await this.setSwitch(this.#page2, 'Practice mode', false); // выключить
      await this.setSwitch(this.#page2, 'Show results automatically', false);
      await this.setCheckBox(this.#page2, 'Allow respondents to save their responses', false);

      await this.setCheckBox(this.#page2, 'Set time duration', true);
      await this.fillByRole (this.#page2, 'textbox', /^Set time duration \d+ minutes/, ftime);
      await this.setCheckBox(this.#page2, 'Shuffle questions', true);
      await this.clickButton(this.#page2, 'Settings');
    
      // Заголовок формы
      await this.clickButton(this.#page2, 'Form title Untitled quiz');
      await this.typeByRole(this.#page2, 'textbox', 'Form title', ft);
      // Подзаголовок
      await this.typeByRole(this.#page2, 'textbox', 'Form description', fd);
   }
   async addToQuestions(q) {
      
      //await this.#page2.pause();         // откроет Inspector

      this.#questions.push(q);
      // Questions
      // getByRole('button', { name: 'Quick start with' })
      if(await this.countByRole(this.#page2, "button", 'Quick start with')>0)
         await this.clickButton(this.#page2, 'Quick start with');
      else
         await this.clickButton(this.#page2, 'Add new question');
      switch(q.type) {
         case("choice"):
                  await this.choice(q);
                  break;
         case("ranking"):
                  await this.ranking(q);
                  break;
         case("text"):
                  await this.text(q);
                  break;
         default:
      }
   }
   async choice(q) {
      await this.clickButton(this.#page2, 'Choice');
      // Choice Settings
      // getByRole('switch', { name: 'Multiple answers' })
      if(q.answCnt>1)
         await this.setSwitch(this.#page2, 'Multiple answers', true); // включить
      await this.setSwitch(this.#page2, 'Required', true); // включить
      await this.fillByRole (this.#page2, 'textbox', 'Points', '1');
      await this.clickButton(this.#page2, 'More settings for question');
      await this.setElem(this.#page2, 'menuitemcheckbox', 'Shuffle options', true); // включить
      // .getByText('Question', { exact: true }) или getByRole('textbox', { name: 'Question title 1 Input your' })
      // .getByRole('button', { name: 'Correct answer' })
      // .getByRole('textbox', { name: 'Choice Option Text Please' })

      // Добавляем текст вопроса
      const question = await this.#page2.getByRole('textbox', { name: /Question title/ });
      await question.click();
      await question.type(q.text);

      // Удаляем присутствующие по умолчанию строки (элементы списка items)
      let list  = await this.#page2.getByRole('list');
      let items = await list.getByRole('listitem');
      while (await items.count() > 0) {
         const firstItem = items.first();
         await firstItem.getByRole('textbox').click(); // чтобы появилась кнопка "Delete..."
         await firstItem.getByRole('button', { name: /delete/i }).click();
      }
      // Добавляем нужное количество строк (ответов)
      for( let cnt=0; cnt<q.options.length; ++cnt) {
        // Добавляем строку
         await this.clickButton(this.#page2, 'Add option');
         await this.#page2.waitForFunction(
            (el, prev) => el.querySelectorAll('[role="listitem"]').length !== prev,
            await list.elementHandle(),
            cnt,
            { timeout: 5_000 }
         );
        // Заполняем значением
        let tb = await items.nth(cnt).getByRole('textbox');
        await tb.click();
        await tb.fill(q.options[cnt]);
        // Помечаем как правильный ответ
        if(cnt+1<=q.answCnt)
           await items.nth(cnt).getByLabel('Correct answer').click();
        await this.#page2.waitForTimeout(this.#PAUSE);      // увы... всё другое навороченное работает не стабильно (см. предыд. версию)
      }
   }
   async ranking(q) {
    // Параметры теста
    await this.clickButton(this.#page2, 'Ranking');
    await this.setSwitch(this.#page2, 'Required', true); // включить
    await this.fillByRole (this.#page2, 'textbox', 'Points', '1');
    // Текст вопроса
    const question = await this.#page2.getByRole('textbox', { name: /Question title/ });
    await question.click();
    await question.type(q.text);
    await this.pressTAB(this.#page2,3);
    // Удаляем умалчиваемые Строки ответа (две!)
    // 1
    await this.press(this.#page2,'Control+A');
    await this.press(this.#page2,'Backspace');
    await this.press(this.#page2,'Tab');
    await this.press(this.#page2,'Space');
    // 3
    await this.pressShiftTAB(this.#page2,3);
    await this.press(this.#page2,'Control+A');
    await this.press(this.#page2,'Backspace');
    await this.press(this.#page2,'Tab');
    await this.press(this.#page2,'Space');
    // 2
    await this.press(this.#page2,'Shift+Tab');
    await this.press(this.#page2,'Control+A');
    await this.press(this.#page2,'Backspace');
    await this.press(this.#page2,'Tab');
    await this.press(this.#page2,'Space');

    // Строки ответа (которые требуется переупорядочить)
    for(let i=0; i<q.options.length; ++i) {
        await this.press(this.#page2,'Space');
        await this.press(this.#page2,'Control+A');
        await this.press(this.#page2,'Backspace');
        await this.#page2.keyboard.type(q.options[i]);
        if(i==0)        await this.pressTAB(this.#page2,2);
        else            await this.pressTAB(this.#page2,3);
     }
   }
   async text(q) {
      await this.clickButton(this.#page2, 'Text');
      await this.fillByRole (this.#page2, 'textbox', 'Points', '1');
      // Добавляем текст вопроса
      const question = await this.#page2.getByRole('textbox', { name: /Question title/ });
      await question.click();
      await question.type(q.text);
      // Добавляем текст ответа
      // getByRole('button', { name: 'Add answer' })
      await this.clickButton(this.#page2,'Add answer')
      await this.#page2.keyboard.type(q.options[0]);
      // getByRole('button', { name: 'Add', exact: true })
      await this.clickButton(this.#page2,'Add')
   }
   async close() {
      //await this.#page.pause();         // откроет Inspector
      // ВАЖНО: закрываем только CDP-соединение, а не Edge
      await this.#browser.close();
   }
}

//*************************************************************************************

(async()=>{
const pr = require("process");
//console.log(pr.argv.length,pr.argv);
if(pr.argv.length<3) { console.log("\x1b[1m\x1b[31m"+"Error: no params"+"\x1b[0m"); pr.exit(1); }


const fs = require("fs");
const txt = fs.readFileSync(pr.argv[2]).toString().trim().split(/\r?\n/);
//console.log(txt);


let lineNum = 0;

let formTitle = txt[lineNum++];  			log("      Form title:", formTitle);
let formDescription = txt[lineNum++];		log("Form description:", formDescription);
let formTime = formDescription.match(/\$time.*?(\d+)/); formTime = formTime? formTime[1] : '""';
let qz = new Quiz();
await qz.init(formTitle, formDescription, formTime);

while(lineNum<txt.length) {
   let questionType = txt[lineNum++];		log("   Question type:", questionType);
   let q = new Question(questionType);
   let cnt = Number(txt[lineNum++]);		log(" Lines in quest.:", cnt);
   while(cnt-->0) {
      let line = txt[lineNum++];
      q.addToText(line);						log(" : ", line);
   }
   cnt = Number(txt[lineNum++]);		log(" Lines in answr.:", cnt);
   while(cnt-->0) {
      let line = txt[lineNum++];
      q.addToOpts(line);			log(" : ", line);
   }
                                                q.log();
   await qz.addToQuestions(q);
}

await qz.close();

})();
