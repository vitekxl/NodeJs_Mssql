var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

var sql = require("mssql");

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
  var columns = new Array(head.length);

  arr.forEach( function (obj) {
    values.push(Object.values(obj));
  });

  res.head = head;
  res.values = values;

  return res;
}

if (!Object.prototype.watch) {
  Object.defineProperty(Object.prototype, "watch", {
    enumerable: false
    , configurable: true
    , writable: false
    , value: function (prop, handler) {
      var
          oldval = this[prop]
          , newval = oldval
          , getter = function () {
            return newval;
          }
          , setter = function (val) {
            oldval = newval;
            return newval = handler.call(this, prop, oldval, val);
          }
      ;

      if (delete this[prop]) { // can't watch constants
        Object.defineProperty(this, prop, {
          get: getter
          , set: setter
          , enumerable: true
          , configurable: true
        });
      }
    }
  });
}

// object.unwatch
if (!Object.prototype.unwatch) {
  Object.defineProperty(Object.prototype, "unwatch", {
    enumerable: false
    , configurable: true
    , writable: false
    , value: function (prop) {
      var val = this[prop];
      delete this[prop]; // remove accessors
      this[prop] = val;
    }
  });
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


async function RetrieveFromDb(sqlReq)
{
  try {
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

  var input = {};
  input.recordset = {};
  input.tablename = req.body['table'];
  input.type = "";

  let table = {};
  table.artikelArt = [];
  table.artikel = [];
  table.firma = [];
  table.ma = [];
  table.geraetID = [];
  table.colName = [];

  input.watch('recordset', function (id, oldval, newval) {
    var arr = {};

    if (newval.length === 0) {
      arr.head = [];
      arr.values = [];
      table.colName.forEach(function (colName) {
        arr.head.push(colName);
      })
      //console.log(arr)
    } else {
      arr = objToArr(newval);
    }
   // console.log(table);
    res.render('enterValues',
        {
          href: 'stylesheets/table.css',
          title: 'tible',
          tablename: input.tablename,
          head: arr.head,
          values: arr.values,
          table: table
        });
    return newval;
  });


  var sqlReq1 = 'Select ARTIKEL_ART_NAME From ARTIKEL_ART';
  var sqlReq2 = 'Select ARTIKEL_NAME From ARTIKEL';
  var sqlReq3 = 'Select FIRMA_NAME From FIRMA';
  var sqlReq4 = 'Select MA_VORNAME, MA_NACHNAME From MITARBEITER';
  var sqlReq5 = 'Select GERAET_ID From GERAET';
  var sqlReq6 = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + input.tablename+ "';";

    RetrieveFromDb(sqlReq1).then(function (data) {
      data.recordset.forEach(function (art) {
        table.artikelArt.push(art['ARTIKEL_ART_NAME']);
      })
    });

    RetrieveFromDb(sqlReq2).then(function (data) {
      data.recordset.forEach(function (art) {
        table.artikel.push(art['ARTIKEL_NAME']);
      })
    });

  RetrieveFromDb(sqlReq3).then(function (data) {
    data.recordset.forEach(function (art) {
      table.firma.push(art['FIRMA_NAME']);
    })
  });

  RetrieveFromDb(sqlReq4).then(function (data) {
    data.recordset.forEach(function (art) {
      table.ma.push(art['MA_VORNAME'] + " " + art['MA_NACHNAME'] );
    })
  });

  RetrieveFromDb(sqlReq5).then(function (data) {
    data.recordset.forEach(function (art) {
      table.geraetID.push(art['GERAET_ID'] );
    })
  });

  RetrieveFromDb(sqlReq6).then(function (data) {
    data.recordset.forEach(function (art) {
      table.colName.push(art['COLUMN_NAME'] );
    })
  });


  var sqlReq = 'Select * From ' + input.tablename + ";";
  RetrieveFromDb(sqlReq).then(function (f) {
       input.recordset = f.recordset;
  });

});


router.post('/confirmation', function(req, res, next) {
  res.render('confirmation', { href: 'stylesheet/confirmation.css' });
  console.dir(req.body);

  var table = req.body.tableName;

  if(table === 'ZUSTAND' && req.body.zustandName !== '' ){

  }
  //res.send('what are you doing here?');
});


module.exports = router;
