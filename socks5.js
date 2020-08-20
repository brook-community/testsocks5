import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { decodeString as hexdecode } from "https://deno.land/std/encoding/hex.ts";
import { varnum } from "https://deno.land/std/encoding/binary.ts";
import { equal } from "https://deno.land/std/bytes/mod.ts";

if(Deno.args.length != 1 || Deno.args[0] == "help" || Deno.args[0] == "h" || Deno.args[0] == "--help" || Deno.args[0] == "-h"){
    console.log("$ deno run -A https://git.io/testsocks5.js SOCKS5_HOST:SOCKS5_PORT");
    Deno.exit(0);
}

var l = Deno.args[0].split(":");
if(l.length != 2 || isNaN(new Number(l[1]))){
    console.log("Invalid socks5 server");
    Deno.exit(0);
}
var host = l[0];
var port = new Number(l[1]);

try{
    console.log("Info:\t", "Testing TCP")
    var c = await Deno.connect({ hostname: host, port: port, transport: "tcp" });
    var r = await new BufReader(c);
    // For convenience, we create a new buffer every time
    var b = new Uint8Array([0x05, 0x01, 0x00]);
    await c.write(b);
    b = new Uint8Array(2);
    await r.readFull(b);
    if (b[0] != 0x05){
        console.log("Error:\t", "server is not socks version 5");
        Deno.exit(1);
    }
    if (b[1] != 0x00){
        console.log("Error:\t", "It looks like your socks5 server require auth, this script does not support it yet");
        Deno.exit(1);
    }
    b = new Uint8Array([0x05, 0x01, 0x00, 0x01, 0x08, 0x08, 0x08, 0x08, 0x00, 0x35]);
    await c.write(b);
    b = new Uint8Array(4);
    await r.readFull(b);
    if(b[1] != 0x00){
        console.log("Error:\t", "Rep is not success");
        Deno.exit(1);
    }
    if(b[3] == 0x01){
        var b1 = new Uint8Array(6);
        await r.readFull(b1);
    }
    if(b[3] == 0x04){
        console.log("Error:\t", "This script does not support IPv6");
        Deno.exit(1);
    }
    if(b[3] == 0x03){
        var b1 = new Uint8Array(1);
        await r.readFull(b1);
        b1 = new Uint8Array(b1[0]+2);
        await r.readFull(b1);
    }
    b = hexdecode("00200001010000010000000000000a74787468696e6b696e6703636f6d0000010001");
    await c.write(b);
    b = new Uint8Array(65537);
    var i = await r.read(b);
    c.close();
    if(equal(b.slice(i-4, i), new Uint8Array([0x68, 0xc7, 0x8b, 0x17]))){
        console.log("OK:\t", "TCP response is OK");
    }else{
        console.log("Warning", "TCP response is not expected");
    }
}catch(e){
    console.log("Error:\t", e)
    Deno.exit(1);
}

try{
    console.log("Info:\t", "Testing UDP")
    var c = await Deno.connect({ hostname: host, port: port, transport: "tcp" });
    var r = await new BufReader(c);
    var b = new Uint8Array([0x05, 0x01, 0x00]);
    await c.write(b);
    b = new Uint8Array(2);
    await r.readFull(b);
    if (b[0] != 0x05){
        console.log("Error:\t", "server is not socks version 5");
        Deno.exit(1);
    }
    if (b[1] != 0x00){
        console.log("Error:\t", "Unsupport method");
        Deno.exit(1);
    }
    b = new Uint8Array([0x05, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await c.write(b);
    b = new Uint8Array(4);
    await r.readFull(b);
    if(b[1] != 0x00){
        console.log("Error:\t", "Rep is not success");
        Deno.exit(1);
    }
    var h, p;
    if(b[3] == 0x01){
        var b1 = new Uint8Array(4);
        await r.readFull(b1);
        h = b1.join(".");
        b1 = new Uint8Array(2);
        await r.readFull(b1);
        p = varnum(b1, {dataType: "uint16", endian: "big"});
    }
    if(b[3] == 0x04){
        console.log("Error:\t", "This script does not support IPv6");
        Deno.exit(1);
    }
    if(b[3] == 0x03){
        var b1 = new Uint8Array(1);
        await r.readFull(b1);
        b1 = new Uint8Array(b1[0]);
        await r.readFull(b1);
        h = new TextDecoder("utf-8").decode(b1);
        b1 = new Uint8Array(2);
        await r.readFull(b1);
        p = varnum(b1, {dataType: "uint16", endian: "big"});
    }
    var c1 = Deno.listenDatagram({hostname: c.localAddr.hostname, port: c.localAddr.port, transport: "udp"});
    b = hexdecode("000000010808080800350001010000010000000000000a74787468696e6b696e6703636f6d0000010001");
    await c1.send(b, {transport: "udp", hostname: h, port: p});
    b = new Uint8Array(65537);
    var l = await c1.receive(b);
    c1.close();
    c.close();
    if(equal(l[0].slice(-4), new Uint8Array([0x68, 0xc7, 0x8b, 0x17]))){
        console.log("OK:\t", "UDP response is OK");
    }else{
        console.log("Warning", "UDP response is not expected");
    }
}catch(e){
    console.log("Error:\t", e)
}
