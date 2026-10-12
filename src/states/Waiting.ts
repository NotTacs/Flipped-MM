export function Waiting(socket: WebSocket) {
  socket.send(
    JSON.stringify({
      payload: {
        totalPlayers: 2,
        connectedPlayers: 2,
        state: "Waiting",
      },
      name: "StatusUpdate",
    }),
  );
}