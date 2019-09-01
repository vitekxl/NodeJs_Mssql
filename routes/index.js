var express = require('express');
var router = express.Router();
var sql = require("mssql");

var DB = require("../db/DB");



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
    res.render('index', { title: 'Express' });
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
  table.firma       = await db.getColumn("FIRMA", 'FIRMA_NAME' );
  table.geraetID    = await db.getColumn("GERAET", 'GERAET_ID' );
  table.colName     = await Object.keys(db.tables[tablename]);
  table.zustandName = await db.getColumn("ZUSTAND", 'ZUSTAND_NAME' );
  table.tart        = await db.getColumn("TRANSAKTIONSART", 'T_NAME' );

  let ma          = await db.getColumns("MITARBEITER", ['MA_VORNAME', 'MA_NACHNAME']  );
  ma = await db.transpose(ma);
  table.ma = [];
  for (const value of ma.values){
      table.ma.push(value[0] + " " +value[1])
  }

  let trans = await table.values.transpose();
  table.values = trans.values;
  table.keys = trans.keys;


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

  //await console.log("-> " + sqlreq);
//  await makeTransaction(sqlreq,res ,req);

/*  var json = {'tableName' : 'FIRMA'};
  request.post({
    url: 'http://localhost:3000/r',
    body: json,
    json: true
  }, function (err, res, body) {

  })*/

});

router.get('/sql', async (req, res) => {

  //await db.loadColumn("ZUSTAND", "ZUSTAND_ID")

  console.log(await db.getColumn("ZUSTAND", "ZUSTAND_ID"));
  res.render('runSql', {text : ""})
});

router.post('/sql', async (req, res) => {
  console.log(req.body);

  let request = req.body.sqlrequest;
  let message = "";

  let firstword = request.split(' ');

  let result = undefined;
  const pool = await poolPromise;

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

router.get('/search', function (req, res) {
  res.render('search', {elements: ['Geraet', 'Transaktion', 'Mitarbeiter']})
})

router.post('/search' , function (req, res) {
  var search = req.body.search;
  if(search === 'Mitarbeiter'){
    res.render('searchMA', {})
  }
})

module.exports = router;
