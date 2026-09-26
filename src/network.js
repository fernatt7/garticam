import './style.css';
import { Peer } from 'peerjs';

const peer = new Peer();
let conn = null;

const strokes = {
    color:"red",
    width:10,
    x:200,
    y:220
}

// open happened when we have connected to signalling server (server not client) and we get our id back
peer.on("open", (id) => {
    document.getElementById("my-id").textContent = id;
});

function setConnection(conn){
    conn.on("open", () => {
        console.log("connected!");
    });

    conn.on("data", data => {
        console.log("COLOR: ", data.color);
        console.log("WIDTH: ", data.width);
        console.log("X: ", data.x);
        console.log("Y: ", data.y);

    })
}

// connect button clicked => get the other peer-id and try to establish connection
document.getElementById("connect-btn").addEventListener(
    "click",
    () => {
        const otherPeerId =
            document.getElementById("peer-id").value;

        // establish connection to other peer
        conn = peer.connect(otherPeerId);

        // if succesful print connected in console
        setConnection(conn);
    }
);

// detect incoming connection
peer.on("connection", (incomingConnection) => {
    conn = incomingConnection;
    
    setConnection(conn);
});

document.getElementById("send-btn").addEventListener(
    "click",
    () => {
        const message = strokes;

        // only send when there is connection
        if (conn === null) {
            console.log("Not connected!");
            return;
        }

        console.log("sent:", message);
        conn.send(message);
    }
);