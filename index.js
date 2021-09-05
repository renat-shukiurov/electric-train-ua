const TelegramApi = require('node-telegram-bot-api')
const fs = require('fs');
const got = require('got');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const PrettyTable = require('prettytable');
const dotenv = require('dotenv');


dotenv.config()
const token = process.env.TOKEN || "";

const bot = new TelegramApi(token, {polling: true});

var rozklad_msg_id = ''

const directions = {
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{text: "Тарасівка - Київ", callback_data: 'tarasovka-kyiv'},],
            [{text: "Київ - Тарасівка", callback_data: 'kyiv-tarasovka'}],
        ]
    })
}

const directions_now = {
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{text: "Тарасівка - Київ", callback_data: 'tarasovka-kyiv_now'},],
            [{text: "Київ - Тарасівка", callback_data: 'kyiv-tarasovka_now'}],
        ]
    })
}

const getHtml = async (url) => {
    const res = await got(url);
    const dom = new JSDOM(res.body);
    const table = dom.window.document.getElementsByClassName('schedule_table')[0]

    if (!table) return

    return table;

}

const shortRoute = (route) => {
    if(route.length <= 4){
        return route;
    }

    return route.substr(0,4) + "."
}

const parseData = (table) => {
    let schedule = [];
    var rows = table.rows;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i].classList.contains('blbalcar')) {
            continue;
        }

        let cells = rows[i].cells;
        let holiday_img = cells[6].getElementsByTagName('img')[0].getAttribute('src');
        let routeFrom = cells[2].getElementsByTagName('a')[0].textContent.trim();
        let routeTo = cells[2].getElementsByTagName('a')[1].textContent.trim();
        schedule.push({
            "num": cells[1].getElementsByTagName('a')[0].textContent,
            "route": `${shortRoute(routeFrom)}-${shortRoute(routeTo)}`,
            "departure": cells[3].getElementsByClassName("_time")[0].textContent,
            "arrivals": cells[4].getElementsByClassName("_time")[0].textContent,
            "all_day": holiday_img === "/img/chart1.png",
        })
    }

    return schedule;

}

const sendRozklad = async (chatId, table, route) => {

    pt = new PrettyTable();

    pt.fieldNames(["Маршрут", "Відп.", "Приб."]);

    if (rozklad_msg_id!==''){
        bot.deleteMessage(chatId, rozklad_msg_id)
    }


    let rozklad = `Електропоїзди у напрямку <b>${route}</b>:\n`;
    const obj = parseData(table);
    obj.map( item => {

        // pt.addRow([item["num"],item["route"], item["departure"], item["arrivals"],item["all_day"]]);
        // if (item["all_day"]==="Окрім вихідних"){
        //     console.log(1)
        //     pt.addRow([`<i><b>${item["route"]}</b></i>`, `<i><b>${item["departure"]}</b></i>`, `<i><b>${item["arrivals"]}</b></i>`]);
        // }
        // else{
        //     pt.addRow([item["route"], item["departure"], item["arrivals"]]);
        // }

        let item_route = item["all_day"] ? item["route"] : item["route"] + "*"

        pt.addRow([item_route, item["departure"], item["arrivals"]]);


    })
    rozklad += `<pre>${pt.toString()}</pre>`;
    rozklad += "<i><b>* - тільки у будні</b></i>\n\nДоступні напрямки: ";
    let msg = await bot.sendMessage(chatId, rozklad, directions);

    rozklad_msg_id = msg.message_id;

}

const checkHoursDiff = (dep, now) => {
    d1 = new Date(dep);
    d2 = new Date(now);

    return d1.getHours() - d2.getHours() <= 1;
}

const checkWeekends = (now, flag) => {
    d2 = new Date(now).getDay();
    return (d2 !== 0 && d2 !== 6) ? true : flag;
}

const sendNow = async (chatId, table, route) => {

    pt = new PrettyTable();

    pt.fieldNames(["Маршрут", "Відп.", "Приб."]);

    if (rozklad_msg_id!==''){
        bot.deleteMessage(chatId, rozklad_msg_id)
    }

    let rozklad = `Найближчі електропоїзди у напрямку <b>${route}</b>:\n`;
    const obj = parseData(table);
    let is_found = false;
    obj.map( item => {
        const date = new Date();
        const dangqian=date.toLocaleTimeString('chinese',{hour12:false})
        const dq=dangqian.split(":");
        const a = item["departure"].split(".");

        const date_now=date.setHours(dq[0],dq[1]);
        const date_dep=date.setHours(a[0],a[1]);

        if (date_dep > date_now &&
            checkHoursDiff(date_dep, date_now) &&
            checkWeekends(date_now, item["all_day"])
        ){
            pt.addRow([item["route"], item["departure"], item["arrivals"]]);
            is_found = true;
        }

    });

    if (is_found){
        rozklad += `<pre>${pt.toString()}</pre>`;
        let msg = await bot.sendMessage(chatId, rozklad, {parse_mode: 'HTML'});
        rozklad_msg_id = msg.message_id;
    }else {
        let msg = await bot.sendMessage(chatId, "Наступної години електропоїздів немає :(");
        rozklad_msg_id = msg.message_id;
    }


}

const start = () => {
    bot.setMyCommands([
        {command: "/start", description: "Початкове привітання"},
        {command: "/rozklad", description: "Повний розклад потягів"},
        {command: "/now", description: "Найближчі потяги"},
    ])

    bot.on('message', async msg => {
        const text = msg.text
        const chatId = msg.chat.id

        if (text === "/start" || text === "/start@ElectricTrainSchedule_Bot"){
            return bot.sendMessage(chatId, `Привіт, ${msg.from.first_name}, я можу показати тобі розклад руху деяких електропоїздів (:
Доступні команди:
/rozklad - Повний розклад,
/now - Найближчі потяги
        `);
        }
        if (text === "/rozklad" || text === "/rozklad@ElectricTrainSchedule_Bot"){
            return bot.sendMessage(chatId, `Вибери напрямок нижче:`, directions);
        }

        if (text === "/now" || text === "/now@ElectricTrainSchedule_Bot"){
            return bot.sendMessage(chatId, `Вибери напрямок нижче:`, directions_now);
        }

        return bot.sendMessage(chatId, `Я тебе не розумію, спробуй ще раз)`);

    });

    bot.on('callback_query', msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id;

        if (data === 'tarasovka-kyiv'){
            getHtml('https://poizdato.net/rozklad-poizdiv/tarasivka,kyivska-obl--kyiv-pas/')
                .then((table) => {
                    sendRozklad(chatId, table, "Тарасівка - Київ")
                });
        }

        if (data === 'kyiv-tarasovka'){
            getHtml('https://poizdato.net/rozklad-poizdiv/kyiv-pas--tarasivka,kyivska-obl/')
                .then((table) => {
                    sendRozklad(chatId, table, "Київ - Тарасівка")
                });
        }

        if (data === 'tarasovka-kyiv_now'){
            getHtml('https://poizdato.net/rozklad-poizdiv/tarasivka,kyivska-obl--kyiv-pas/')
                .then((table) => {
                    sendNow(chatId, table, "Тарасівка - Київ")
                });
        }

        if (data === 'kyiv-tarasovka_now'){
            getHtml('https://poizdato.net/rozklad-poizdiv/kyiv-pas--tarasivka,kyivska-obl/')
                .then((table) => {
                    sendNow(chatId, table, "Київ - Тарасівка")
                });
        }
    })
}

start();
