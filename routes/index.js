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
  password: 'Prizma1994!',
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


router.get('/r', async  (req, res, next) => {
  res.render('makeRequest', { list: Object.keys(db.tables)});
});



router.post('/r', async (req, res) => {


  var tablename = req.body['tableName'];

  //console.log(db);
  let table = {};
  table.values      = await db.getTable(req.body['tableName']);



  table.artikelArt  = await db.getColumn("ARTIKEL_ART", 'ARTIKEL_ART_NAME' );
  table.artikel     = await db.getColumn("ARTIKEL", 'ARTIKEL_NAME' );
  table.artikel_join = await db.selectRequest("Select ARTIKEL_ART_NAME , ARTIKEL_NAME from ARTIKEL_ART join ARTIKEL A on ARTIKEL_ART.ARTIKEL_ART_ID = A.ARTIKEL_ART_ID");
  table.firma       = await db.getColumn("FIRMA", 'FIRMA_NAME' );
  table.geraetID    = await db.getColumn("GERAET", 'GERAET_ID' );
  table.colName     = await Object.keys(db.tables[tablename]);
  table.zustandName = await db.getColumn("ZUSTAND", 'ZUSTAND_NAME' );
  table.tart        = await db.getColumn("TRANSAKTIONSART", 'T_NAME' );

  console.log(table.artikel_join);

  table.artikel_join = JSON.stringify(table.artikel_join);

  switch (tablename) {
      case 'ARTIKEL':
          var sqlreq = "SELECT ARTIKEL_ID, ARTIKEL_NAME AS ARTIKEL, ARTIKEL_ART_NAME AS ARTIKEL_ART, ANZAHL_AUF_LAGER  from ARTIKEL Join ARTIKEL_ART AA on ARTIKEL.ARTIKEL_ART_ID = AA.ARTIKEL_ART_ID"
          var result=  await db.selectRequest(sqlreq);
          result = await db.transpose(result);
          table.values = result.values;
          table.keys = result.keys;
          break;
      case 'GERAET':
          var sqlreq = "Select GERAET_ID, ARTIKEL_NAME AS ARTIKEL, ZUSTAND_NAME as ZUSTAND, IST_AUF_LAGER from GERAET join ARTIKEL A on GERAET.ARTIKEL_ID = A.ARTIKEL_ID join ZUSTAND Z on GERAET.ZUSTAND_ID = Z.ZUSTAND_ID"
          var result=  await db.selectRequest(sqlreq);
          result = await db.transpose(result);
          table.values = result.values;
          table.keys = result.keys;
          break;
      case 'MITARBEITER':
          var sqlreq = "Select K_NUMMER, MA_VORNAME AS VORNAME, MA_NACHNAME AS NACHNAME, FIRMA_NAME AS FIRMA from MITARBEITER join FIRMA F on MITARBEITER.FIRMA_ID = F.FIRMA_ID";
          var result=  await db.selectRequest(sqlreq);
          result = await db.transpose(result);
          table.values = result.values;
          table.keys = result.keys;
          break;
      case 'TRANSAKTION':
          let ma = await db.getColumns("MITARBEITER", ['MA_VORNAME', 'MA_NACHNAME']);
          ma = await db.transpose(ma);
          table.ma = [];
          for (const value of ma.values) {
              table.ma.push(value[0] + " " + value[1])
          }

          var sqlreq = "SELECT\n" +
              "       TRANSAKTION_ID,\n" +
              "       MA_1,\n" +
              "       CONCAT( M1.MA_VORNAME, M1.MA_NACHNAME) as M1_name,\n" +
              "       MA_2,\n" +
              "       CONCAT( ISNULL(M2.MA_VORNAME, NULL), ISNULL(M2.MA_NACHNAME, NULL)) as M2_name,\n" +
              "       TRANSAKTION.GERAET_ID,\n" +
              "       T.T_NAME as TRANSAKTION_NAME,\n" +
              "       IST_AKTUEL, BESCHREIBUNG,\n" +
              "       DATUM\n" +
              "\n" +
              "from TRANSAKTION\n" +
              "    left join MITARBEITER M2 on TRANSAKTION.MA_2 = M2.K_NUMMER\n" +
              "    join TRANSAKTIONSART T on TRANSAKTION.TRANSAKTION_ART_ID = T.T_ART_ID\n" +
              "    join MITARBEITER M1 on TRANSAKTION.MA_1 = M1.K_NUMMER\n" +
              "    join GERAET G on TRANSAKTION.GERAET_ID = G.GERAET_ID\n".replace(/\n/, '');
          var result=  await db.selectRequest(sqlreq);
          result = await db.transpose(result);
          table.values = result.values;
          table.keys = result.keys;
          break;
      default:
          let trans = await table.values.transpose();
          table.values = trans.values;
          table.keys = trans.keys;
          break;

  }

  //console.log(db.tables[tablename]);

    res.render('enterValues',
        {
          href: 'stylesheets/table.css',
          title: 'table',
          tablename: tablename,
          keys: table.keys,
          values: table.values,
          table: table
        });

});


router.post('/confirmation', async (req, res) => {
  console.dir(req.body);

  let table = req.body.tableName;

  switch (table) {
      case 'TEST_TABLE'     :   await db.insertRequest(table, ['TEXT'], [`'${req.body.text.trim()}'`]); break;
      case 'ARTIKEL_ART'    :   await db.insertRequest(table, ['ARTIKEL_ART_NAME'], [`'${req.body.artikelArt.trim()}'`]); break;
      case 'ZUSTAND'        :   await db.insertRequest(table, ['ZUSTAND_NAME'], [`'${req.body.zustandName.trim()}'`]); break;
      case 'TRANSAKTIONSART':   await db.insertRequest(table, ['T_NAME'], [`'${req.body.transart.trim()}'`]); break;
      case 'FIRMA'          :   await db.insertRequest(table, ['FIRMA_NAME'], [`'${req.body.firmaName.trim()}'`]); break;
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
          let zustandId = await db.selectRequest(`SELECT ZUSTAND_ID FROM ZUSTAND WHERE ZUSTAND_NAME='${ req.body.zustandName }';`);
          let aufLager = req.body.isAufLager ? 1 : 0;

          artikelartId = artikelartId.pop()['ARTIKEL_ART_ID'];
          artikelId = artikelId.pop()['ARTIKEL_ID'];
          zustandId = zustandId.pop()['ZUSTAND_ID'];


          await db.insertRequest(table,
              ['GERAET_ID', 'ARTIKEL_ID', 'ZUSTAND_ID', 'IST_AUF_LAGER'],
              [`'${req.body.geraet_ID.trim()}'`, artikelId, zustandId , aufLager] );
          break;

      case 'MITARBEITER':
          let firmaId = await db.selectRequest(`SELECT FIRMA_ID FROM FIRMA WHERE FIRMA_NAME='${req.body.firmaName}';`);
          firmaId = firmaId.pop()['FIRMA_ID'];
          await db.insertRequest(table,
              ['K_NUMMER, MA_VORNAME, MA_NACHNAME, FIRMA_ID'],
              [`'${req.body.maID.trim()}'`, `'${req.body.maVname.trim()}'`, `'${req.body.maNname.trim()}'`, firmaId] );
          break;
      case 'TRANSAKTION':
          let ma1name     = req.body.ma1name.trim();
          let ma2name     = req.body.ma2name.trim();
          let geraetId     = req.body.gerateName;
          let description = req.body.descr.trim();
          let isActual    = req.body.isActual ? 1 : 0;

          let tartId = await db.selectRequest(`SELECT T_ART_ID FROM TRANSAKTIONSART WHERE T_NAME='${req.body.tart}';`);
          tartId = tartId.pop()['T_ART_ID'];

          ma1name = ma1name.split(" ");

          let ma1Id = await db.selectRequest(`SELECT K_NUMMER FROM MITARBEITER WHERE MA_VORNAME='${ma1name[0]}' AND MA_NACHNAME='${ma1name[1]}';`);
          ma1Id = ma1Id.pop()['K_NUMMER'];
          ma1Id = `'${ma1Id}'`;
          let ma2Id = "NULL";

          if(ma2name !== "[NULL]") {
              ma2name = ma2name.split(" ");
              ma2Id = await db.selectRequest(`SELECT K_NUMMER FROM MITARBEITER WHERE MA_VORNAME='${ma2name[0]}' AND MA_NACHNAME='${ma2name[1]}';`);
              ma2Id = ma2Id.pop()['K_NUMMER'];
              ma2Id = `'${ma2Id}'`;
          }
          await db.insertRequest(table,
              ['TRANSAKTION_ART_ID', 'MA_1', 'MA_2', 'GERAET_ID', 'IST_AKTUEL', 'BESCHREIBUNG' ],
              [tartId, ma1Id, ma2Id, `'${geraetId}'`, isActual, `'${description}'` ] );
          break;
      default:
          res.status(500);
          res.send("unrecognised table")
          return;

  }



  res.render("confirmation");

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

router.get('/searchG', async (req, res) => {

    let table = {
        artikelArt : await db.getColumn("ARTIKEL_ART", 'ARTIKEL_ART_NAME'),
        artikel : await db.getColumn("ARTIKEL", 'ARTIKEL_NAME'),
        artikel_join : await db.selectRequest("Select ARTIKEL_ART_NAME , ARTIKEL_NAME from ARTIKEL_ART join ARTIKEL A on ARTIKEL_ART.ARTIKEL_ART_ID = A.ARTIKEL_ART_ID"),
        geraetID : await db.getColumn("GERAET", 'GERAET_ID'),
        zustandName : await db.getColumn("ZUSTAND", 'ZUSTAND_NAME' ),

    };
    table.artikel_join = JSON.stringify(table.artikel_join);
    res.render('searchG', {table: table, head: db.tables['GERAET'].keys, values: [], href: 'stylesheets/table.css'})

});

router.post('/searchG', async (req, res) => {
    console.log(req.body);
    let where = "";

    let Geraet = {
        artikelArt  : req.body.artikelArt   === 'unselected' ? undefined: req.body.artikelArt,
        artikelName : req.body.artikelName  === 'unselected' ? undefined: req.body.artikelName,
        zustandName : req.body.zustandName  === 'unselected' ? undefined: req.body.zustandName ,
        geraetID    : req.body.geraetID     === '' ? undefined: req.body.geraetID,
        isAufLager  : typeof req.body.isAufLager  === 'undefined' ? 0: 1,
    };

    if(typeof Geraet.geraetID !== "undefined"){
        where = `GERAET_ID=${Geraet.geraetID}`;
    }



    let sql = `Select GERAET_ID, ARTIKEL_NAME, ZUSTAND_NAME, IST_AUF_LAGER From GERAET join ZUSTAND Z on GERAET.ZUSTAND_ID = Z.ZUSTAND_ID join ARTIKEL A on GERAET.ARTIKEL_ID = A.ARTIKEL_ID where ${where};`

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
                let firmaid = await db.selectRequest(`select FIRMA_ID from FIRMA where FIRMA_NAME='${MA.firma}'`);
                firmaid = firmaid.pop()['FIRMA_ID'];
                where += `F.FIRMA_ID = ${firmaid}`;
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
