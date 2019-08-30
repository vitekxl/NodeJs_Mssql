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


async function RetrieveFromDb(sqlReq, res)
{
  try {
    console.log("-> " + sqlReq);
    const pool = await poolPromise;
    const result = await pool.request()
        .query(sqlReq);
    return result;

  } catch (err) {
    res.status(500);
    res.send(err.message);
  }
}


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


async function makeTransaction(sqlReq, res, req){
  console.log("make=> " + sqlReq)
  try {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    return transaction.begin().then(function () {
          pool.request().query(sqlReq).then(function (){
            transaction.commit(error => {
              if(error) throw error;
              else console.log("commit")
            });
          }
      );
    });
  } catch (err) {
    res.status(500);
    res.send(err.message)
  }
}

router.post('/confirmation', async (req, res, next) => {
  console.dir(req.body);

  var table = req.body.tableName;
  let values = undefined;
  var sqlreq = "INSERT INTO %table_name%(%column%) VALUES (%values%)";

  sqlreq = sqlreq.replace(/%table_name%/, table);

  if(table === 'TEST_TABLE'){
    sqlreq = sqlreq.replace(/%column%/, "TEXT");
    values = "'" + req.body.text.trim() +"'";
  }else if(table === 'ARTIKEL_ART'){
    sqlreq = sqlreq.replace(/%column%/, "ARTIKEL_ART_NAME");
    values = "'" + req.body.artikelArtName.trim() +"'";
  }else if(table === 'ZUSTAND'){
    sqlreq = sqlreq.replace(/%column%/, "ZUSTAND_NAME");
    values = "'" + req.body.zustandName.trim() +"'";
  }else if(table === 'TRANSAKTIONSART'){
    sqlreq = sqlreq.replace(/%column%/, "T_NAME");
    values = "'" + req.body.transart.trim() +"'";
  }else if(table === 'FIRMA'){
    sqlreq = sqlreq.replace(/%column%/, "FIRMA_NAME");
    values = "'" + req.body.firmaName.trim() +"'";
  }else if(table === "ARTIKEL"){
    sqlreq = sqlreq.replace(/%column%/, "ARTIKEL_ART_ID, ARTIKEL_NAME, ANZAHL_AUF_LAGER");

    let aasql = "Select ARTIKEL_ART_ID from ARTIKEL_ART WHERE ARTIKEL_ART_NAME = '" + req.body.artikelArt + "';";
    var id = undefined;
    await RetrieveFromDb(aasql, res)
        .then( function (result) {
          id = result.recordset[0]['ARTIKEL_ART_ID']
          values = "" + id + ", '"+ req.body.artikelName.trim() + "', "+ req.body.anzahl.trim();
        })
  }else if(table === "GERAET") {
    sqlreq = sqlreq.replace(/%column%/, "GERAET_ID, ARTIKEL_ID, ZUSTAND_ID, IST_AUF_LAGER");

    let artikelsql = "SELECT ARTIKEL_ID FROM ARTIKEL WHERE ARTIKEL_NAME='" + req.body.artikelName + "';";
    let artikelartsql = "Select ARTIKEL_ART_ID from ARTIKEL_ART WHERE ARTIKEL_ART_NAME = '" + req.body.artikelArt + "';";
    let zustandsql = "SELECT ZUSTAND_ID FROM ZUSTAND WHERE ZUSTAND_NAME='" + req.body.zustandName + "';";

    let artikelartId = undefined;
    let artikelId = undefined;
    let zustandID = undefined;
    let aufLager = req.body.isAufLager ? 1 : 0;


    await RetrieveFromDb(artikelartsql, res)
        .then(function (result) {
          artikelartId = result.recordset[0]['ARTIKEL_ART_ID'];
        });

    await RetrieveFromDb(artikelsql, res)
        .then(function (result) {
          artikelId = result.recordset[0]['ARTIKEL_ID'];
        });

    await RetrieveFromDb(zustandsql, res)
        .then(function (result) {
          zustandID = result.recordset[0]['ZUSTAND_ID'];
        });


    values = "'" + req.body.geraet_ID.trim() + "', " + artikelId + ", " + zustandID + ", " + aufLager;

  }else if(table === 'MITARBEITER'){
    sqlreq = sqlreq.replace(/%column%/, "K_NUMMER, MA_VORNAME, MA_NACHNAME, FIRMA_ID");

    let firmasql = "SELECT FIRMA_ID FROM FIRMA WHERE FIRMA_NAME='" + req.body.firmaName + "';";
    let firmaID = undefined;

    await RetrieveFromDb(firmasql, res)
        .then(function (result) {
          firmaID = result.recordset[0]['FIRMA_ID'];
        });
    values = "'" + req.body.maID + "', '" + req.body.maVname + "', '" + req.body.maNname + "', " + firmaID;

  }else if(table === 'TRANSAKTION'){
    sqlreq = sqlreq.replace(/%column%/, "TRANSAKTION_ART_ID, MA_1, MA_2, GERAET_ID, IST_AKTUEL, BESCHREIBUNG");


    let ma1name     = req.body.ma1name.trim();
    let ma2name     = req.body.ma2name.trim();
    let geratId     = req.body.gerateName;
    let description = req.body.descr.trim();
    let isActual    = req.body.isActual ? 1 : 0;

    if(ma2name === '[NULL]') ma2name = undefined;
    ma1name = ma1name.split(' ');
    if(ma2name) ma2name = ma2name.split(' ');

    let tartId = undefined;
    let tartsql = "SELECT T_ART_ID FROM TRANSAKTIONSART WHERE T_NAME='" + req.body.tart + "';";
    let masql = "SELECT K_NUMMER FROM MITARBEITER WHERE MA_VORNAME='%VNAME%' AND MA_NACHNAME='%NNAME%';";

    let ma1Id = undefined;
    let ma2Id = "NULL";

    console.log(ma1name);

      await RetrieveFromDb(tartsql, res)
          .then(function (result) {
            tartId = result.recordset[0]['T_ART_ID'];
          });

      let ma1_sql = masql.replace(/%VNAME%/, ma1name[0] ).replace(/%NNAME%/,ma1name[1]);
      await RetrieveFromDb(ma1_sql, res)
          .then(function (result) {
            ma1Id = result.recordset[0]['K_NUMMER'];
            ma1Id = "'" + ma1Id + "'";
          });
      if(ma2name){
        let ma2_sql = masql.replace(/%VNAME%/, ma2name[0] ).replace(/%NNAME%/,ma2name[1]);
        await RetrieveFromDb(ma2_sql, res)
            .then(function (result) {
              ma2Id = result.recordset[0]['K_NUMMER'];
              ma2Id = "'" + ma2Id + "'";
            });
      }
      values = "" + tartId + ", " + ma1Id+ ", " + ma2Id + ", '" + geratId+ "', " + isActual + ", '" + description +"'";
  }
  else {
    res.status(500);
    res.send("unrecognised table")
    return;
  }

  res.render("confirmation");
  sqlreq = sqlreq.replace(/%values%/, values);
  //await console.log("-> " + sqlreq);
  await makeTransaction(sqlreq,res ,req);

/*  var json = {'tableName' : 'FIRMA'};
  request.post({
    url: 'http://localhost:3000/r',
    body: json,
    json: true
  }, function (err, res, body) {

  })*/

});

router.get('/sql', async (req, res) => {

  console.log("")
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

  if(firstword.length > 0 && firstword[0].toLowerCase() === 'select'){
    try {
      message += "=> " + request + " <br> ";
      result = await pool.request()
          .query(request);
      result = result.recordset;
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
  }else {
    try {
      const transaction = pool.transaction();
      await transaction.begin().then(function () {
        pool.request().query(request).then(function (){
              transaction.commit(error => {
                if(error) throw error;
                else console.log("commit")
              });
              message += "OK! <br>";

            }
        );
      });
    } catch (err) {
      message += "ERROR: <br> ";
      message +=  err.message;
    }
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
