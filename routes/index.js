var express = require('express');
var router = express.Router();
var sql = require("mssql");
var request = require('request');
var app = express();


var config = {
  user: 'sa',
  password: 'SQLSyskron2019!',
  server: 'localhost',
  database: 'TestDB'
};


function objToArr(arr){
  var res = {};
  if(arr.length === 0){
    res.head = [];
    res.values = [];
    return res;
  }
  var head = Object.keys(arr[0]);
  var values = [];

  arr.forEach( function (obj) {
    values.push(Object.values(obj));
  });

  res.head = head;
  res.values = values;

  return res;
}

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
      console.log('Connected to MSSQL')
      return pool
    })
    .catch(err => console.log('Database Connection Failed! Bad Config: ', err))


router.get('/', async (req, res) => {
  try {
    const pool = await poolPromise
    const result = await pool.request()
        .input('input_parameter', sql.Int, req.query.input_parameter)
        .query('select * from ZUSTAND')
    console.log(result);
    res.render('index', { title: 'Express' });

  } catch (err) {
    res.status(500)
    res.send(err.message)
  }
});

router.get('/second', function(req, res, next) {
  res.render('second', { text: 'what are you doing here?', title: 'second' });
  sql.connect(config, function (err) {
    if (err) console.log(err);

    var request = new sql.Request();
    var sqlReq = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Test_table'";
    request.query(sqlReq, function (err, recordset) {
      if (err) console.log(err);
        console.log(recordset);
        sql.close();
      })
  });
});

router.get('/r', async  (req, res, next) => {

    var sqlReq = "Select TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='TestDB';"

    try {
      const pool = await poolPromise;
      const result = await pool.request()
          .query(sqlReq)

      var conlumnlist = [];
      result.recordset.forEach(function (column){
        conlumnlist.push(column['TABLE_NAME']);
      });
      res.render('makeRequest', { list: conlumnlist});

    } catch (err) {
      res.status(500)
      res.send(err.message)
    }
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
    res.status(500)
    res.send(err.message)
  }
}




router.post('/r', async (req, res) => {
  console.log("R POST");
  console.log(req.body);
  var input = {};
  input.recordset = {};
  input.tablename = req.body['tableName'];
  input.type = "";

  let table = {};
  table.artikelArt = [];
  table.artikel = [];
  table.firma = [];
  table.ma = [];
  table.geraetID = [];
  table.colName = [];
  table.zustandName = [];
  table.tart = [];

  var sqlReq1 = 'Select ARTIKEL_ART_NAME From ARTIKEL_ART';
  var sqlReq2 = 'Select ARTIKEL_NAME From ARTIKEL';
  var sqlReq3 = 'Select FIRMA_NAME From FIRMA';
  var sqlReq4 = 'Select MA_VORNAME, MA_NACHNAME From MITARBEITER';
  var sqlReq5 = 'Select GERAET_ID From GERAET';
  var sqlReq6 = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + input.tablename+ "';";
  var sqlReq7 = "SELECT ZUSTAND_NAME FROM ZUSTAND";
  var sqlReq8 = "SELECT T_NAME FROM TRANSAKTIONSART";

  var promises = [];

    promises.push(RetrieveFromDb(sqlReq1, res).then(function (data) {
      data.recordset.forEach(function (art) {
        table.artikelArt.push(art['ARTIKEL_ART_NAME']);
      })
    }));

  promises.push(RetrieveFromDb(sqlReq2, res).then(function (data) {
      data.recordset.forEach(function (art) {
        table.artikel.push(art['ARTIKEL_NAME']);
      })
    }));

  promises.push(RetrieveFromDb(sqlReq3, res).then(function (data) {
    data.recordset.forEach(function (art) {
      table.firma.push(art['FIRMA_NAME']);
    })
  }));

  promises.push(RetrieveFromDb(sqlReq4, res).then(function (data) {
    data.recordset.forEach(function (art) {
      table.ma.push(art['MA_VORNAME'] + " " + art['MA_NACHNAME'] );
    })
  }));

  promises.push(RetrieveFromDb(sqlReq5, res).then(function (data) {
    data.recordset.forEach(function (art) {
      table.geraetID.push(art['GERAET_ID'] );
    })
  }));

  promises.push(RetrieveFromDb(sqlReq6, res).then(function (data) {
    data.recordset.forEach(function (art) {
      table.colName.push(art['COLUMN_NAME'] );
    })
  }));

  promises.push(RetrieveFromDb(sqlReq7, res).then(function (data) {
    data.recordset.forEach(function (art) {
      table.zustandName.push(art['ZUSTAND_NAME'] );
    })
  }));

  promises.push(RetrieveFromDb(sqlReq8, res).then(function (data) {
    data.recordset.forEach(function (art) {
      table.tart.push(art['T_NAME'] );
    })
  }));


  var sqlReq = 'Select * From ' + input.tablename + ";";
  console.log(sqlReq);
  promises.push(RetrieveFromDb(sqlReq, res).then(function (f) {
       input.recordset = f.recordset;
  }));

  Promise.all(promises).then(function () {
    var arr = {};

    if ( input.recordset.length === 0) {
      arr.head = [];
      arr.values = [];
      table.colName.forEach(function (colName) {
        arr.head.push(colName);
      })
      //console.log(arr)
    } else {
      arr = objToArr(input.recordset );
    }
    // console.log(table);
    res.render('enterValues',
        {
          href: 'stylesheets/table.css',
          title: 'table',
          tablename: input.tablename,
          head: arr.head,
          values: arr.values,
          table: table
        });
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

module.exports = router;
