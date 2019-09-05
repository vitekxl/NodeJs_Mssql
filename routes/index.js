var express = require('express');
var router = express.Router();
var sql = require("mssql");
var DB = require("../db/DB");
var logger = require('morgan');



var redirect = function (res, path) {
    var http =  'http://localhost:3000/';
    console.log("redirect => " + http + path);
    res.redirect(http + path);
}

var config = {
  user: 'sa',
  password: 'SQLSyskron2019!',
  server: 'localhost',
  database: 'TestDB'
};


const db = new DB(config);
db.init(config);


const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
      console.log('Connected to MSSQL')
      return pool
    })
    .catch(err => console.log('Database Connection Failed! Bad Config: ', err));


router.get('/', async (req, res) => {
    res.redirect('http://localhost:3000/sql')
    return ;

   // res.render('index', { title: 'Express' });
});


router.get('/r', async  (req, res) => {
  res.render('makeRequest', { list: Object.keys(db.tables)});
});
router.post('/r', async  (req, res) => {
    console.log(req.body);
    await renderAddR(req, res, [])

});


var renderAddR = async (req, res) =>{


    let tablename = req.body.tableName;
    let table = {};
    table.artikelArt  = await db.getColumn("ARTIKEL_ART", 'ARTIKEL_ART_NAME' );
    table.artikel     = await db.getColumn("ARTIKEL", 'ARTIKEL_NAME' );
    table.artikel_join = await db.selectRequest("Select ARTIKEL_ART_NAME , ARTIKEL_NAME from ARTIKEL_ART join ARTIKEL A on ARTIKEL_ART.ARTIKEL_ART_ID = A.ARTIKEL_ART_ID");
    table.firma       = await db.getColumn("FIRMA", 'FIRMA_NAME' );
    table.geraetID    = await db.getColumn("GERAET", 'GERAET_ID' );
    table.colName     = await Object.keys(db.tables[tablename]);
    table.zustandName = await db.getColumn("ZUSTAND", 'ZUSTAND_NAME' );
    table.tart        = await db.getColumn("TRANSAKTIONSART", 'T_ART_NAME' );

    table.artikel_join = JSON.stringify(table.artikel_join);

    let needSQLReq = true;
    let sqlreq = "";

    switch (tablename) {
        case 'ARTIKEL':
            sqlreq = "SELECT ARTIKEL_ID, ARTIKEL_NAME AS ARTIKEL, ARTIKEL_ART_NAME AS ARTIKEL_ART, ANZAHL_AUF_LAGER  from ARTIKEL Join ARTIKEL_ART AA on ARTIKEL.ARTIKEL_ART_ID = AA.ARTIKEL_ART_ID"
            keys = ['ARTIKEL_ID', 'ARTIKEL', 'ARTIKEL_ART', 'ANZAHL_AUF_LAGER'];
            break;
        case 'GERAET':
            sqlreq = "Select GERAET_ID, ARTIKEL_NAME AS ARTIKEL, ZUSTAND_NAME as ZUSTAND, IST_AUF_LAGER from GERAET join ARTIKEL A on GERAET.ARTIKEL_ID = A.ARTIKEL_ID join ZUSTAND Z on GERAET.ZUSTAND_ID = Z.ZUSTAND_ID"
            keys = ['GERAET_ID', 'ARTIKEL', 'ZUSTAND', 'IST_AUF_LAGER'];
            break;
        case 'MITARBEITER':
            sqlreq = "Select K_NUMMER, MA_VORNAME AS VORNAME, MA_NACHNAME AS NACHNAME, FIRMA_NAME AS FIRMA from MITARBEITER join FIRMA F on MITARBEITER.FIRMA_ID = F.FIRMA_ID";
            keys = ['K_NUMMER', 'VORNAME', 'NACHNAME', 'FIRMA'];
            break;
        case 'TRANSAKTION':
            let ma = await db.getColumns("MITARBEITER", ['MA_VORNAME', 'MA_NACHNAME']);
            ma = await db.transpose(ma);
            table.ma = [];
            for (const value of ma.values) {
                table.ma.push(value[0] + " " + value[1])
            }

            sqlreq = "SELECT\n" +
                "       TRANSAKTION_ID,\n" +
                "       MA_1,\n" +
                "       CONCAT( M1.MA_VORNAME, M1.MA_NACHNAME) as M1_name,\n" +
                "       MA_2,\n" +
                "       CONCAT( ISNULL(M2.MA_VORNAME, NULL), ISNULL(M2.MA_NACHNAME, NULL)) as M2_name,\n" +
                "       TRANSAKTION.GERAET_ID,\n" +
                "       T.T_ART_NAME as TRANSAKTION_NAME,\n" +
                "       IST_AKTUEL, BESCHREIBUNG,\n" +
                "       DATUM\n" +
                "\n" +
                "from TRANSAKTION\n" +
                "    left join MITARBEITER M2 on TRANSAKTION.MA_2 = M2.K_NUMMER\n" +
                "    join TRANSAKTIONSART T on TRANSAKTION.TRANSAKTION_ART_ID = T.T_ART_ID\n" +
                "    join MITARBEITER M1 on TRANSAKTION.MA_1 = M1.K_NUMMER\n" +
                "    join GERAET G on TRANSAKTION.GERAET_ID = G.GERAET_ID\n".replace(/\n/, '');

            keys = ['TRANSAKTION_ID', 'MA_1', 'M1_name', 'MA_2', "M2_name", "GERAET_ID", "TRANSAKTION", "IST_AKTUEL", "BESCHREIBUNG", "DATUM"];
            break;
        default:
            values  = await db.getTable(req.body['tableName']);
            let trans     = await values.transpose();
            values  = trans.values;
            needSQLReq = false;
            keys = db.tables[tablename].keys;
            break;
    }
    if(needSQLReq) {
        let result = await db.selectRequest(sqlreq);
        if (result.length === 0) {
            values = [];
        } else {
            result = await db.transpose(result);
            values = result.values;
        }
    }
    res.render('enterValues',
        {
            href: 'stylesheets/table.css',
            title: 'add value',
            tablename: tablename,
            keys: keys,
            values: values,
            table: table
        });
}

router.get('/add', async (req, res)=>{
    console.log(req.body);
    await renderAddR(req, res, [])
})

router.post('/add', async (req, res) => {

    console.dir(req.body);

    let table = req.body.tableName;

    switch (table) {
        case 'ARTIKEL_ART'    :
            await db.insertRequest(table, ['ARTIKEL_ART_NAME'], [`'${req.body.artikelArt.trim()}'`]);
            break;
        case 'ZUSTAND'        :
            await db.insertRequest(table, ['ZUSTAND_NAME'], [`'${req.body.zustandName.trim()}'`]);
            break;
        case 'TRANSAKTIONSART':
            await db.insertRequest(table, ['T_ART_NAME'], [`'${req.body.transart.trim()}'`]);
            break;
        case 'FIRMA'          :
            await db.insertRequest(table, ['FIRMA_NAME'], [`'${req.body.firmaName.trim()}'`]);
            break;
        case 'ARTIKEL'        :
            console.log('hi')
            let id = await db.selectRequest(`Select ARTIKEL_ART_ID from ARTIKEL_ART WHERE ARTIKEL_ART_NAME='${req.body.artikelArt}';`);
            console.log(id);
            id = id.pop()['ARTIKEL_ART_ID'];
            await db.insertRequest(table,
                ['ARTIKEL_ART_ID', 'ARTIKEL_NAME', 'ANZAHL_AUF_LAGER'],
                [id, `'${req.body.artikelName.trim()}'`, req.body.anzahl]);
            break;
        case 'GERAET':
            let artikelId = await db.selectRequest(`SELECT ARTIKEL_ID FROM ARTIKEL WHERE ARTIKEL_NAME='${req.body.artikelName}';`);
            let artikelartId = await db.selectRequest(`Select ARTIKEL_ART_ID from ARTIKEL_ART WHERE ARTIKEL_ART_NAME = '${req.body.artikelArt}';`);
            let zustandId = await db.selectRequest(`SELECT ZUSTAND_ID FROM ZUSTAND WHERE ZUSTAND_NAME='${req.body.zustandName}';`);
            let aufLager = req.body.isAufLager ? 1 : 0;

            artikelartId = artikelartId.pop()['ARTIKEL_ART_ID'];
            artikelId = artikelId.pop()['ARTIKEL_ID'];
            zustandId = zustandId.pop()['ZUSTAND_ID'];


            await db.insertRequest(table,
                ['GERAET_ID', 'ARTIKEL_ID', 'ZUSTAND_ID', 'IST_AUF_LAGER'],
                [`'${req.body.geraet_ID.trim()}'`, artikelId, zustandId, aufLager]);
            break;

        case 'MITARBEITER':
            let firmaId = await db.selectRequest(`SELECT FIRMA_ID FROM FIRMA WHERE FIRMA_NAME='${req.body.firmaName}';`);
            firmaId = firmaId.pop()['FIRMA_ID'];
            await db.insertRequest(table,
                ['K_NUMMER, MA_VORNAME, MA_NACHNAME, FIRMA_ID'],
                [`'${req.body.maID.trim()}'`, `'${req.body.maVname.trim()}'`, `'${req.body.maNname.trim()}'`, firmaId]);
            break;
        case 'TRANSAKTION':
            let ma1name = req.body.ma1name.trim();
            let ma2name = req.body.ma2name.trim();
            let geraetId = req.body.gerateName.trim();
            let description = req.body.descr.trim();
            let isActual = req.body.isActual ? 1 : 0;

            let tartId = await db.selectRequest(`SELECT T_ART_ID FROM TRANSAKTIONSART WHERE T_ART_NAME='${req.body.tart}';`);
            tartId = tartId.pop()['T_ART_ID'];

            ma1name = ma1name.split(" ");

            let ma1Id = await db.selectRequest(`SELECT K_NUMMER FROM MITARBEITER WHERE MA_VORNAME='${ma1name[0]}' AND MA_NACHNAME='${ma1name[1]}';`);
            ma1Id = ma1Id.pop()['K_NUMMER'];
            ma1Id = `'${ma1Id}'`;
            let ma2Id = "NULL";

            if (ma2name !== "[NULL]") {
                ma2name = ma2name.split(" ");
                ma2Id = await db.selectRequest(`SELECT K_NUMMER FROM MITARBEITER WHERE MA_VORNAME='${ma2name[0]}' AND MA_NACHNAME='${ma2name[1]}';`);
                ma2Id = ma2Id.pop()['K_NUMMER'];
                ma2Id = `'${ma2Id}'`;
            }
            await db.insertRequest(table,
                ['TRANSAKTION_ART_ID', 'MA_1', 'MA_2', 'GERAET_ID', 'IST_AKTUEL', 'BESCHREIBUNG'],
                [tartId, ma1Id, ma2Id, `'${geraetId}'`, isActual, `'${description}'`]);
            break;
        default:
            res.status(500);
            res.send("unrecognised table")
            return;
    }
    await renderAddR(req, res);

});

router.get('/sql', async (req, res) => {


  res.render('runSql', {text : ""})
});

router.post('/sql', async (req, res) => {
  console.log(req.body);

  let request = req.body.sqlrequest;
  let message = "";

  let firstword = request.split(' ');

  let result = undefined;

  if(firstword[0].toLowerCase() === 'select'){
    try {
      message += "=> " + request + " <br> ";

      result = await db.selectRequest(request);
      console.log(result);
      message += "OK! <br>";
      message += "result: <br> ";


      let resmessage = JSON.stringify(result);
      resmessage = resmessage.replace(/},{/g, "},<br>&emsp;{");
      resmessage = resmessage.replace(/{"/g, "{ \"");
      resmessage = resmessage.replace(/":/g, "\": ");
      resmessage = resmessage.replace(/,"/g, ",\" ");
      resmessage = resmessage.replace(/}/g, " }");
      message += resmessage;

    } catch (err) {
      message += "ERROR: <br> ";
      message +=  err.message;
    }
  }else if(firstword[0].toLowerCase() === 'insert' || firstword[0].toLowerCase() === 'delete')  {

        db.makeTransaction(request).then(function (){
              message += "OK! <br>";
            })
  }


  res.render('runSql', {answer: message})
});


let renderSearchT = async (req, res, values) => {
    let table = {

        geraetID : await db.getColumn("GERAET", 'GERAET_ID' ),
        tart     : await db.getColumn("TRANSAKTIONSART", 'T_ART_NAME' ),
        artikelArt  : await db.getColumn("ARTIKEL_ART", 'ARTIKEL_ART_NAME' ),
        artikel_join : await db.selectRequest("Select ARTIKEL_ART_NAME , ARTIKEL_NAME from ARTIKEL_ART join ARTIKEL A on ARTIKEL_ART.ARTIKEL_ART_ID = A.ARTIKEL_ART_ID"),
        geraet_join : await db.selectRequest("Select ARTIKEL_NAME, GERAET_ID from ARTIKEl join GERAET G on ARTIKEL.ARTIKEL_ID = G.ARTIKEL_ID"),

    };

    table.artikel_join = JSON.stringify(table.artikel_join);
    table.geraet_join = JSON.stringify(table.geraet_join);


    let ma = await db.getColumns("MITARBEITER", ['MA_VORNAME', 'MA_NACHNAME']);
    ma = await db.transpose(ma);
    table.ma = [];
    for (const value of ma.values) {
        table.ma.push(value[0] + " " + value[1])
    }

    var keys =  ['transaktion_id',  'MA 1 id', 'M1 NAME',  'MA2 NAME', 'MA 2 id', 'Geraet id', 'Transaktionsart', 'ist aktuel', 'Beschreibung', 'Datum'];


    res.render('searchT', {
        table: table,
        head: keys,
        values: values,
        href: 'stylesheets/table.css'
    })
}

router.get('/searchT', async (req, res) =>{

    console.log(req.body);
    renderSearchT(req,res,[]);

});

router.post('/searchT', async (req, res) => {

    console.log(req.body);


    let answer = {};
    for (const key of Object.keys(req.body)){
        answer[key] = req.body[key];
    }

    answer.ma1nameCB            = typeof req.body.ma1nameCB !== 'undefined';
    answer.ma2nameCB            = typeof req.body.ma2nameCB !== 'undefined';
    answer.artikelArtSelectorCB = typeof req.body.artikelArtSelectorCB !== 'undefined';
    answer.artikelSelectorCB    = typeof req.body.artikelSelectorCB !== 'undefined';
    answer.geraeteSelectorCB     = typeof req.body.geraeteSelectorCB !== 'undefined';
    answer.isActualCB           = typeof req.body.isActualCB !== 'undefined';
    answer.idInputCB            = typeof req.body.idInputCB !== 'undefined';
    answer.idTransCB            = typeof req.body.idTransCB !== 'undefined';
    answer.maAllCB              = typeof req.body.MaAllCB  !== 'undefined';


    answer.isActual             = typeof req.body.isActual !== 'undefined' ? 1: 0;
    answer.tartCB               = typeof req.body.tartCB !== 'undefined';

    let createrequest = function(operator, key1, key2, val1, val2 ){

        if(operator.toLowerCase().trim() === 'like'){
            val1 = val1 === '' ? '' : `%${val1}%`;
            val2 = val2 === '' ? '' : `%${val2}%`;
        }

        val1 = val1 === '' ? '' : `'${val1}'`;
        val2 = val2 === '' ? '' : `'${val2}'`;

        let res = "";
        if(val1 !== '' && val2 !== '')  res += `${key1} ${operator} ${val1} AND  ${key2} ${operator} ${val2}`;
        else if(val1 !== '') res += `${key1} ${operator} ${val1}`;
        else res += `${key2} ${operator} ${val2}`;
        return res;
    };

    let where = "";

    if(answer.idTransCB){
        where = ` TRANSAKTION.transaktion_id = '${answer.idTrans}'`
    }else {
        if(answer.tartCB){
            where = `T.t_art_name='${answer.tart}'`;
        }
        if(answer.ma1nameCB){
            if(where !== '') where += " AND ";
            if(answer.ma1name !== '') {
                let name = answer.ma1name.split(" ");
                where += createrequest("=", 'M1.ma_vorname', 'M1.ma_nachname',name[0], name[1]);
                if (answer.maAllCB) {
                    where += " OR ";
                    where += createrequest("=", 'M2.ma_vorname', 'M2.ma_nachname', name[0], name[1] );
                }
            }else{
                where += createrequest("LIKE", 'M1.ma_vorname', 'M1.ma_nachname', answer.ma1Vname, answer.ma1Nname);
                if (answer.maAllCB) {
                    where += " OR ";
                    where += createrequest("LIKE", 'M2.ma_vorname', 'M2.ma_nachname', answer.ma1Vname, answer.ma1Nname);
                }
            }
        }
        if(answer.ma2nameCB){
            if(where !== '') where += " AND ";
            if(answer.ma2name === 'null'){
                where += "M2.ma_vorname IS NULL AND M2.ma_nachname IS NULL"
            }
            else if(answer.ma2name !== '') {
                let name = answer.ma2name.split(" ");
                where += createrequest("=", 'M2.ma_vorname', 'M2.ma_nachname',name[0], name[1]);
                if (answer.maAllCB) {
                    where += " OR ";
                    where += createrequest("=", 'M1.ma_vorname', 'M1.ma_nachname', name[0], name[1] );
                }
            }else{
                where += createrequest("LIKE", 'M2.ma_vorname', 'M2.ma_nachname', answer.ma1Vname, answer.ma1Nname);
                if (answer.maAllCB) {
                    where += " OR ";
                    where += createrequest("LIKE", 'M1.ma_vorname', 'M1.ma_nachname', answer.ma1Vname, answer.ma1Nname);
                }
            }
        }
        if(answer.idInputCB){
            if(where !== '') where += " AND ";
            where += `TRANSAKTION.geraet_id LIKE '%${answer.idInput}%'`;
        }else if(answer.geraeteSelectorCB){
            if(where !== '') where += " AND ";
            where += `TRANSAKTION.geraet_id='${answer.geraeteName}'`;
        }

        if(answer.isActualCB){
            if(where !== '') where += " AND ";
            where += `TRANSAKTION.ist_aktuel=${answer.isActual}`
        }
    }

    let sql = `select TRANSAKTION.transaktion_id, TRANSAKTION.ma_1, CONCAT(M1.ma_vorname, M1.ma_nachname) AS MA1_NAME,  CONCAT(M2.ma_vorname, M2.ma_nachname) AS MA2_NAME, TRANSAKTION.ma_2, TRANSAKTION.geraet_id, T.t_art_name, TRANSAKTION.ist_aktuel, TRANSAKTION.beschreibung, TRANSAKTION.datum
    from TRANSAKTION
    join TRANSAKTIONSART T on TRANSAKTION.TRANSAKTION_ART_ID = T.T_ART_ID
    join MITARBEITER M1 on TRANSAKTION.MA_1 = M1.K_NUMMER
    left join  MITARBEITER M2 on TRANSAKTION.MA_2 = M2.K_NUMMER 
    WHERE ${where}`;

    let result = await db.selectRequest(sql);
    console.log(result);
    if(result.length === 0){
        result.values = [];
    }
    else result = await db.transpose(result);

    await renderSearchT(req, res, result.values);
})

router.get('/searchG', async (req, res) => {

    let table = {
        artikelArt : await db.getColumn("ARTIKEL_ART", 'ARTIKEL_ART_NAME'),
        artikel : await db.getColumn("ARTIKEL", 'ARTIKEL_NAME'),
        artikel_join : await db.selectRequest("Select ARTIKEL_ART_NAME , ARTIKEL_NAME from ARTIKEL_ART join ARTIKEL A on ARTIKEL_ART.ARTIKEL_ART_ID = A.ARTIKEL_ART_ID"),
        geraetID : await db.getColumn("GERAET", 'GERAET_ID'),
        zustandName : await db.getColumn("ZUSTAND", 'ZUSTAND_NAME' ),

    };
    table.artikel_join = JSON.stringify(table.artikel_join);

    var keys = ['GERAET_ID', 'ARTIKEL_NAME', 'ARTIKEL_ART_NAME', 'ZUSTAND_NAME', 'IST_AUF_LAGER'];

    res.render('searchG', {table: table, head: keys, values: [], href: 'stylesheets/table.css'})

});

router.post('/searchG', async (req, res) => {
    console.log(req.body);
    let where = "";
    let values = {};
    let Geraet = {
        artikelArt  : req.body.artikelArt   === 'unselected' ? undefined : req.body.artikelArt,
        artikelName : req.body.artikelName  === 'unselected' ? undefined : req.body.artikelName,
        zustandName : req.body.zustandName  === 'unselected' ? undefined : req.body.zustandName ,
        geraetID    : req.body.geraetID     === '' ? undefined : req.body.geraetID,
        isAufLager      : typeof req.body.isAufLager    !== 'undefined' ? 1 : 0,

        artikelArtCB    : typeof req.body.artikelArtCB  !== "undefined",
        artikelCB       : typeof req.body.artikelCB     !== "undefined",
        zustandCB       : typeof req.body.zustandCB     !== "undefined",
        geraeteIdCB     : typeof req.body.geraeteIdCB   !== "undefined",
        lagerCB         : typeof req.body.lagerCB   !== "undefined",

    };

    if(typeof Geraet.geraetID !== "undefined"){
        where = `GERAET_ID=${Geraet.geraetID}`;
    }

    if( Geraet.artikelArtCB || Geraet.artikelCB || Geraet.zustandCB || Geraet.geraeteIdCB || Geraet.lagerCB){
        let where = "";
        if(Geraet.geraeteIdCB){
            where = `GERAET_ID='${Geraet.geraetID}'`;
        }else{

            if(Geraet.artikelCB)          where = `A.ARTIKEL_NAME='${Geraet.artikelName}'`
            else if(Geraet.artikelArtCB)  where = `AA.ARTIKEL_ART_NAME='${Geraet.artikelArt}'`

            if(Geraet.zustandCB){
                if(where !== "") where += " AND ";
                where += `Z.ZUSTAND_NAME='${Geraet.zustandName}'`;
            }
            if(Geraet.lagerCB){
                if(where !== "") where += " AND ";
                where += `IST_AUF_LAGER=${Geraet.isAufLager}`;
            }
        }

        let sql = `Select GERAET_ID, ARTIKEL_NAME, ARTIKEL_ART_NAME, ZUSTAND_NAME, IST_AUF_LAGER From GERAET join ZUSTAND Z on GERAET.ZUSTAND_ID = Z.ZUSTAND_ID join ARTIKEL A on GERAET.ARTIKEL_ID = A.ARTIKEL_ID join ARTIKEL_ART AA on A.ARTIKEL_ART_ID = AA.ARTIKEL_ART_ID where ${where};`;
        let result = await db.selectRequest(sql);
        console.log(result);
        if (typeof result === 'undefined') {
            values = [];
        } else {
            values = await db.transpose(result);
            values = values.values;
        }
    }

    let table = {
        artikelArt : await db.getColumn("ARTIKEL_ART", 'ARTIKEL_ART_NAME'),
        artikel : await db.getColumn("ARTIKEL", 'ARTIKEL_NAME'),
        artikel_join : await db.selectRequest("Select ARTIKEL_ART_NAME , ARTIKEL_NAME from ARTIKEL_ART join ARTIKEL A on ARTIKEL_ART.ARTIKEL_ART_ID = A.ARTIKEL_ART_ID"),
        geraetID : await db.getColumn("GERAET", 'GERAET_ID'),
        zustandName : await db.getColumn("ZUSTAND", 'ZUSTAND_NAME' ),

    };
    table.artikel_join = JSON.stringify(table.artikel_join);

    var keys = ['GERAET_ID', 'ARTIKEL_NAME', 'ARTIKEL_ART_NAME', 'ZUSTAND_NAME', 'IST_AUF_LAGER'];

    res.render('searchG',
        {
            table:  table,
            head:   keys,
            values: values,
            href: 'stylesheets/table.css'
        })

});

router.get('/search', function (req, res) {
  res.render('search', {elements: ['Geraet', 'Transaktion', 'Mitarbeiter']})
});

router.get('/searchMA', async (req, res) => {
    console.log(req.body)
    let table = {};
    table.firma = await db.getColumn("FIRMA", "FIRMA_NAME");
    table.keys = ['K_NUMMER', 'MA_VORNAME', 'MA_NACHNAME', 'FIRMA_NAME'];
    res.render('searchMA', {table: table, head: table.keys, values: [], href: 'stylesheets/table.css'})

});

router.post('/searchMA', async (req, res) => {
    let table = {};
    console.log(req.body)
    table.firma = await db.getColumn("FIRMA", "FIRMA_NAME");
    table.values = [];
    let MA = {
        firma:  req.body.firmaName === '' ? undefined : req.body.firmaName,
        id:     req.body.maID === '' ? undefined : req.body.maID,
        vname:  req.body.maVname === '' ? undefined : req.body.maVname,
        nname:  req.body.maNname === '' ? undefined : req.body.maNname,
        firmaCB: typeof req.body.firmaCB    !== "undefined",
        vnameCB: typeof req.body.vnameCB    !== "undefined",
        nnameCB: typeof req.body.nnameCB    !== "undefined",
        maCB:    typeof req.body.maCB       !== "undefined",
    };

    console.log(MA);

    let beginSearch = MA.firmaCB || MA.vnameCB || MA.nnameCB || MA.maCB ;

    if (beginSearch) {
        let where = "";
        if (MA.maCB) {
            where = `K_NUMMER='${MA.id}'`
        } else {
            if(MA.firmaCB) {
                where += `F.FIRMA_NAME = '${MA.firma}'`;
            }
            if (MA.vnameCB && MA.nnameCB ) {
                if(where !== "") where += " AND ";
                where += `MA_VORNAME LIKE '%${MA.vname}%' AND MA_NACHNAME LIKE '%${MA.nname}%'`
            } else if (MA.vnameCB) {
                if(where !== "") where += " AND ";
                where += `MA_VORNAME LIKE '%${MA.vname}%'`
            } else if(MA.nnameCB) {
                if(where !== "") where += " AND ";
                where += `MA_NACHNAME LIKE '%${MA.nname}%'`
            }
        }
        let sql = `Select K_NUMMER, MA_VORNAME, MA_NACHNAME, FIRMA_NAME From MITARBEITER join FIRMA F on MITARBEITER.FIRMA_ID = F.FIRMA_ID where ${where} ;`;
        let result = await db.selectRequest(sql);
        if (typeof result === 'undefined') {
            table.values.values = [];
        } else {
            table.values = await db.transpose(result);
        }
    }

    table.keys = ['K_NUMMER', 'MA_VORNAME', 'MA_NACHNAME', 'FIRMA_NAME'];

    table.firma = await db.getColumn("FIRMA", "FIRMA_NAME");
    res.render('searchMA', {table: table, head: table.keys, values: table.values.values, href: 'stylesheets/table.css'})

});


router.post('/search' , async (req, res) => {
  var search = req.body.search.toLowerCase();
    switch (search) {
         case 'mitarbeiter':    redirect(res, 'searchMA'); break;
         case 'geraet':          redirect(res, 'searchG' ); break;
         case 'transaktion':     redirect(res, 'searchT' ); break;
    }
});

module.exports = router;
