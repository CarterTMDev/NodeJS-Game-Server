var endString = Buffer.from('00', 'hex');

module.exports = packet = {
    // values is an array of data to turn into a buffer
    build: function(values){
        var bufferData = [];
        var bufferSize = 0;
        values.forEach(function(value){
            var buffer;
            if(typeof value === 'number'){
                buffer = Buffer.alloc(2);
                buffer.writeInt16LE(value, 0);
            }else if(typeof value === 'string'){
                buffer = Buffer.from(value);
                buffer = Buffer.concat([buffer, endString], buffer.length + 1);
            }else{
                console.log('ERROR: Invalid data type');
            }
            bufferSize += buffer.length;
            bufferData.push(buffer);
        });
        var lastBuffer = Buffer.concat(bufferData, bufferSize);
        var buffSize = Buffer.alloc(1);
        buffSize.writeUInt8(lastBuffer.length + 1, 0);
        var finalBuffer = Buffer.concat([buffSize, lastBuffer], buffSize.length + lastBuffer.length);
        //console.log('SENT data: ' + JSON.stringify(finalBuffer, ['data']));
        return finalBuffer;
        /* Example: send "HELLO"
            sends buffer 6HELLO
        */
    }
}