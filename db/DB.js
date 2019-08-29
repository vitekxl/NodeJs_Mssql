var sql = require("mssql");

class DB{
     constructor(config) {

         this.tables = [];
         this.tables.names = [];
         this.poolPromise = new sql.ConnectionPool(config)
             .connect()
             .then(pool => {
                 console.log('Connected to MSSQL')
                 return pool
             })
             .catch(err => console.log('Database Connection Failed! Bad Config: ', err));

         this.loadAll = async () => {
             for (const tname of this.tables.names){
                 await this.loadTable(tname);
             }
            // console.log(this.tables);
         }

         this.getTable = async(tableName) => {
             var table = this.tables[tableName];
             if(typeof table === 'undefined'){
                 throw new Error("error name of Table: "+tableName);
             }

             for (const cname of table.columnsName){
                 if(!table[cname].isActual){
                    await this.loadColumn(tableName, cname);
                 }
             }
             return table;
         };

         this.getColumn = async (tableName, columnName) =>{
             var column = this.tables[tableName][columnName];
             if(typeof column === 'undefined'){
                 throw new Error("error name of Table: "+tableName+" or column: " + columnName);
             }
             if(!column.isActual) {
                 await this.loadColumn(tableName, columnName);
             }
             return column.values;
         }

         this.loadTable = async (tableName) =>{
             var table = this.tables[tableName];
             var sql = 'SELECT * FROM %TABLE%'.replace(/%TABLE%/, tableName);

             if(typeof table === 'undefined'){
               //  throw new Error("error name of Table: "+tableName+" or column: " + columnName);
             }

             await this.RetrieveFromDb(sql).then(function (result) {
                 result.recordset.forEach(function (set) {
                     var keys = Object.keys(set);
                     keys.forEach(function (key) {
                         if(typeof table[key] !== "undefined") {
                             table[key].values.push(set[key]);
                             table[key].isActual = true;
                         }
                     })
                 });
             });
         };

         this.loadColumn = async (tableName, columnName) => {
             var table = this.tables[tableName];
             var sql = 'SELECT %COLUMN% FROM %TABLE%'.replace(/%TABLE%/, tableName).replace(/%COLUMN%/, columnName);

             if(typeof table === 'undefined'){
               //  throw new Error("error name of Table: "+tableName+" or column: " + columnName);
             }
             await this.RetrieveFromDb(sql).then(function (result) {
                 result.recordset.forEach(function (set) {
                     table[columnName].values.push(set[columnName]);
                 });
                 table[columnName].isActual = true;
             });
         }
    }

    async init(config){
        let sqlReq = "Select TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='%DBNAME%';"
        sqlReq = sqlReq.replace(/%DBNAME%/, config.database);
        var tables = {};
        var tablesNames = [];
        var _this = this;


         await _this.RetrieveFromDb(sqlReq).then(function(result) {
            result.recordset.forEach(function (column) {
                tables[column['TABLE_NAME']] = { columnsName: [], foreignColName : []};
                tablesNames.push(column['TABLE_NAME']);
            })
        }).then(async () => {
             // console.log(Object.keys(tables));
             for (const table of Object.keys(tables)) {
                 let getAllInfo = "sp_help '%Table_Name%'".replace(/%Table_Name%/, table);

                 await _this.RetrieveFromDb(getAllInfo).then(function (data) {

                     let colnames = [];

                     for (const set of data.recordsets[1]) {
                         colnames.push(set["Column_name"]);
                     }
                     for (const set of data.recordsets[6]) {
                         if (set["constraint_type"] === 'FOREIGN KEY') {
                             colnames = colnames.filter(function (value) {
                                 return value !== set["constraint_keys"];
                             });
                             tables[table].foreignColName.push(set["constraint_keys"]);
                         }
                     }
                     // console.log(tables)
                     for (const cname of colnames) {
                         tables[table][cname] = {values: [], isActual: false};
                         tables[table].columnsName.push(cname);
                     }
                 });
             }
             _this.tables = tables;
            // _this.tables.names = tablesNames;
         })

    }

    async RetrieveFromDb(sqlReq, res){
        try {
            console.log("-> " + sqlReq);
            const pool = await this.poolPromise;
            const result = await pool.request()
                .query(sqlReq);
            return result;

        } catch (err) {
            if(res) {
                res.status(500);
                res.send(err.message);
            }else {
                console.log(err);
            }
        }
    }

}

module.exports = DB;