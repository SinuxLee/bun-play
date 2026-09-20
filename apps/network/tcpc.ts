import { ArrayBufferSink } from "bun";

type SocketData = { sessionId: string };

// The client
const socket = await Bun.connect<SocketData>({
    hostname: "localhost",
    port: 8080,

    socket: {
        data(socket, data) { 
            console.log("Received data from server:", new TextDecoder().decode(data));
        },
        open(socket) {
            socket.data = { sessionId: "abcd" };
            const sink = new ArrayBufferSink();
            sink.start({
                stream: true,
                highWaterMark: 1024,
            });

            sink.write("h");
            sink.write("e");
            sink.write("l");
            sink.write("l");
            sink.write("o");

            queueMicrotask(() => {
                const data = sink.flush() as Uint8Array<ArrayBuffer>;
                const wrote = socket.write(data);
                if (wrote < data.byteLength) {
                    // put it back in the sink if the socket is full
                    sink.write(data.subarray(wrote));
                }
            });
        },
        close(socket, error) { },
        drain(socket) { },
        error(socket, error) { },

        // client-specific handlers
        connectError(socket, error) { }, // connection failed
        end(socket) { }, // connection closed by server
        timeout(socket) { }, // connection timed out
    },
});