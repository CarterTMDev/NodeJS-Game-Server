const net = require('net');
const mysql = require('mysql');
require('./packet.js');
const port = 6510;
var clients = [];
var dbConfig = {
    host:"localhost",
    user: "root",
    password: "root",
    database: "game_database"
};

function queryDatabase(sql){
    return new Promise(function(resolve, reject){
        var db = mysql.createConnection(dbConfig);
        db.connect(function(err){
            if(err){
                reject([]);
                throw err;
            }else{
                console.log("Database connected");
                db.query(sql, function(error, values){
                    if(error){
                        reject([]);
                        throw error;
                    }else{
                        console.log("Values: "+JSON.stringify(values));
                        resolve(values);
                        db.end();
                        console.log("Database disconnected");
                    }
                });
            }
        });
    });
}
async function login(username, indx){
    var playerData = await queryDatabase("SELECT name, lastX, lastY, inventory FROM user WHERE name = "+mysql.escape(username));
    if (playerData.length == 0) {
        console.log("NOT VALID: USER "+username+" DOES NOT EXIST");
    }else{
        playerJoin(playerData, indx);
    }
}
function playerJoin(playerInfo, indx){
    clients[indx].name = playerInfo[0].name;
    clients[indx].x = playerInfo[0].lastX;
    clients[indx].y = playerInfo[0].lastY;
    clients[indx].inventory = playerInfo[0].inventory;
    var allPlayers = [2, playerInfo[0].lastX, playerInfo[0].lastY, playerInfo[0].inventory];
    var pData = [];
    var pCount = 0;
    for(var i = 0; i < clients.length; i++){
        if(i != indx && clients[i].name !== "-"){
            pCount++;
            pData.push(clients[i].name, clients[i].x, clients[i].y);
            clients[i].sock.write(packet.build([2, 1, playerInfo[0].name, playerInfo[0].lastX, playerInfo[0].lastY]));
        }
    }
    allPlayers.push(pCount);
    if(pCount > 0){
        clients[indx].sock.write(packet.build(allPlayers.concat(pData)));
    }else{
        clients[indx].sock.write(packet.build(allPlayers));
    }
    console.log(playerInfo[0].name+" has joined the game");
}

console.log("Checking in with the database...");
queryDatabase("SELECT name FROM user WHERE name=\'test\';");

const server = net.createServer(function(socket){
    // Player connects
    var player = {sock:socket, name:"-", x:32, y:32};
    clients.push(player);
    socket.write(packet.build([0]));
    console.log('Player connected! %s players online', clients.length);
    
    // Player disconnects
    socket.on('end', function(){
        // Needs to notify the other players
        var indx;
        for(var i = 0; i < clients.length; i++){
            if(clients[i].sock == socket){
                indx = i;
                break;
            }
        }
        if(clients[indx].name !== "-"){
            for(var i = 0; i < clients.length; i++){
                if(i !== indx && clients[i].name !== "-"){
                    clients[i].sock.write(packet.build([3, clients[indx].name]));
                }
            }
            queryDatabase("UPDATE user SET lastX="+clients[indx].x+", lastY="+clients[indx].y+" WHERE name="+mysql.escape(clients[indx].name));
        }
        clients.splice(indx, 1);
        console.log('Player disconnected. %s players online', clients.length);
    });
    
    // Server recieves data
    socket.on('data', function(data){
        var indx;
        for(var i = 0; i < clients.length; i++){
            if(clients[i].sock == socket){
                indx = i;
                break;
            }
        }
        if(clients[indx].name === "-"){
            var valid = true;
            if(data[1] === 1){
                console.log("Recieved data: "+JSON.stringify(data, ['data'])+" | Length: "+data.length);
                var nm = data.toString("utf8", 3, data.readUInt8(0)-1);// data[0] = length, data[1 and 2] = code, data[data.length-1] = string terminator
                if(nm.length > 0 && nm.length <= 20){
                    console.log("NAME: "+nm);
                    login(nm, indx);
                }else{
                    valid = false;
                }
            }else{
                // TODO: add a registration condition
                valid = false;
            }
            if(!valid){
                socket.write(packet.build([1]));
            }
        }else{
            var i = 0;
            var len;
            //console.log('Movement: ' + JSON.stringify(data, ['data']));
            while(true){
                len = data[i];
                switch(data[i+1]){
                    case 4:
                        clients[indx].x = data.readUInt16LE(i+len-4);
                        clients[indx].y = data.readUInt16LE(i+len-2);
                        //console.log(clients[indx].name+" MOVED to X: "+clients[indx].x+" Y: "+clients[indx].y);
                    break;
                    case 6:
                        clients[indx].inventory = data.toString("utf8", i+3, i+len-1);
                        console.log("INVENTORY: "+clients[indx].inventory);
                        queryDatabase("UPDATE user SET inventory="+mysql.escape(clients[indx].inventory)+" WHERE name="+mysql.escape(clients[indx].name));
                    break;
                }
                i += len;
                if(data.length == i){
                    break;
                }
            }
            for(i = 0; i < clients.length; i++){
                if(i !== indx && clients[i].name !== "-"){
                    clients[i].sock.write(data);
                    //console.log('PASSED data: ' + JSON.stringify(data, ['data']));
                }
            }
        }
    });
    
    // Error (OH NO!)
    socket.on('error', function(err){
        console.log('Socket ERROR ' + err.name);
        // TODO: Remove from clients when error is ECONNRESET
    });
});
server.listen(port);

console.log('Server running!');