var sql = require("mssql");

class DB{

     constructor(config) {
         this.tables = [];
         this.tables.names = [];
         this._poolPromise = new sql.ConnectionPool(config)
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

             for (const cname of table.keys){
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
         };

         this.loadTable = async (tableName) =>{
             var table = this.tables[tableName];
             var sql = `SELECT * FROM ${tableName};`;

             if(typeof table === 'undefined'){
                 throw new Error("error name of Table: "+tableName+" or column: " + columnName);
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

         this.loadColumn = async (tableName, key) => {
             let table = this.tables[tableName];
             table[key].values = [];
             let sql = `SELECT ${key} FROM ${tableName};`

             if(typeof table === 'undefined'){
                 throw new Error("error name of Table: "+tableName+" or column: " + columnName);
             }
             await this.RetrieveFromDb(sql).then(function (result) {
                 let cnt = 0;
                 result.recordset.forEach(function (set) {
                     table[key].values.push(set[key]);
                     cnt++;
                 });
                 table.rowsCnt = cnt;
                 table[key].isActual = true;
             });
         };

         this.selectRequest =   async (slqRequest) => {
             var res= undefined;
             await this.RetrieveFromDb(slqRequest).then(function (result) {
                 res = result.recordset;
             });
             return res;
         }

         this.getColumns = async (tableName, keys) =>{
             var sql = `Select ${keys.join(", ")} from ${tableName}`;
             return this.selectRequest(sql);
         }

         this.transpose = async (rows) => {
             if(rows.length === 0 )return undefined;
            // let table = _this.tables[tableName];
             let res = { keys:Object.keys(rows[0]), values: [] };

             for (const set of rows){
                 res.values.push(Object.values(set));
             }
             return res;
         };

         this.insertRequest= async (table, keys, values) => {
             var sql  = `INSERT INTO ${table}(${keys.join(", ")}) VALUES (${values.join(", ")});`;
             await this.makeTransaction(sql);
             await this.setActualStateFalse(table);

         };
         this.deleteRequest = async (table, where) => {
             var sql  = `delete from ${table} where ${where}`;
             await this.makeTransaction(sql);
             await this.setActualStateFalseCascade(table, 'delete');
         };

         this.updateRequest = async (table, set, where) => {
             var sql  = `update ${table} set ${set} where ${where}`;
             await this.makeTransaction(sql);
             await this.setActualStateFalseCascade(table, 'update');
         };

         this.setActualStateFalseCascade = async (table, action) =>{
             this.setActualStateFalse(table);
             action = action.toLowerCase().trim();
                if(action !== "update" || action !== 'delete')
                    throw new Error('Unrecognised action :' + action);

             for(let foreignKey of table.foreignKeys){
                 let actionType = "";

                 if(action === 'update')   actionType = foreignKey.updateAction.toLowerCase();
                 else                      actionType = foreignKey.deleteAction.toLowerCase();

                 if(actionType === 'cascade'){
                     this.setActualStateFalseCascade(foreignKey.refTable, action);
                 }
             }
         };

         this.setActualStateFalse = async (table) => {
            for(const key of this.tables[table].keys){
                this.tables[table][key].isActual = false;
            }
         };



          this.makeTransaction = async (sqlReq) =>{

             console.log("make=> " + sqlReq)

             const pool = await this._poolPromise;
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
         }

    }

    async init(config){
        let sqlReq = `Select TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='${config.database}';`

        var tables = {};
        var _this = this;

         await _this.RetrieveFromDb(sqlReq).then(function(result) {
            result.recordset.forEach(function (tableNameSet) {
                var tableName = tableNameSet['TABLE_NAME'];
                tables[tableName] = { keys: [], foreignKeys : [], primaryKey: "", ownKeys: [], rowsCnt: undefined};

            })
        }).then(async () => {
             // console.log(Object.keys(tables));
             for (const table of Object.keys(tables)) {
                 let getAllInfo = `sp_help '${table}'`

                 await _this.RetrieveFromDb(getAllInfo).then(function (data) {

                    // console.log(data.recordsets[6]);

                     for (const set of data.recordsets[1]) {
                         tables[table].keys.push(set["Column_name"]);
                         tables[table][set["Column_name"]] = {values: [], isActual: false};
                     }
                     for (const set of data.recordsets[6]) {
                       //  console.log(set);
                        // console.log(" ");

                         if (set["constraint_type"] === 'FOREIGN KEY') {
                             tables[table].foreignKeys.push({key: set["constraint_keys"], refTable: "", updateAction: set.update_action, deleteAction: set.delete_action });
                         }
                         else if(set["constraint_type"].match('PRIMARY KEY')){
                             tables[table].primaryKey = set["constraint_keys"];
                         }
                         else if(set["constraint_keys"].match('REFERENCES')){
                             var mess = set["constraint_keys"];
                             mess = mess.split( RegExp("\[(*?)\]") );
                             var key = mess[1];
                             var tablename = mess[0].split(RegExp("\w*dbo."))[1];

                             tables[table].foreignKeys[tables[table].foreignKeys.length-1].refTable = tablename;


                         }
                     }
                     tables[table].ownKeys = tables[table].keys.filter(function (value) {
                         return !tables[table].foreignKeys.includes(value);
                     })

                 });

             }
             _this.tables = tables;
         }).then( async () => {

             for (const tableName of Object.keys(_this.tables)) {
                 _this.tables[tableName].getColumn = function(columnName){
                     return _this.getColumn(tableName, columnName);
                 };

                 _this.tables[tableName].transpose = async () => {

                     let table = _this.tables[tableName];
                     let res = { keys:table.keys, values: [] };

                     if(table.rowsCnt === 0){
                         return res;
                     }

                     for (let i = 0; i < table.rowsCnt; i++) {
                         res.values.push([]);
                     }

                     for (let j = 0; j < res.keys.length; j++) {
                         for (let i = 0; i < table.rowsCnt; i++) {
                             res.values[i].push(
                                 table[res.keys[j]].values[i]
                             );
                         }
                     }
                     return res;
                 }
             }
         })
    }

    async RetrieveFromDb(sqlReq, res){
        try {
            console.log("-> " + sqlReq);
            const pool = await this._poolPromise;
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