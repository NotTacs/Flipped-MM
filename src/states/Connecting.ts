export function Connecting(socket: WebSocket) {
    socket.send(
      JSON.stringify({
        payload: {
          state: "Connecting",
        },
        name: "StatusUpdate",
      }),
    );
  }