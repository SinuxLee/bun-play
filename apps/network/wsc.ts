const socket = new WebSocket("ws://localhost:3000/chat?username=John", {
  headers: {
    /* custom headers */
  },
});

// message is received
socket.addEventListener("message", event => {
    const message = event.data;
    console.log("Received message:", message);
});

// socket opened
socket.addEventListener("open", event => {
    console.log("Socket opened");
});

// socket closed
socket.addEventListener("close", event => {
    console.log("Socket closed");
});

// error handler
socket.addEventListener("error", event => {
    console.error("WebSocket error");
});
