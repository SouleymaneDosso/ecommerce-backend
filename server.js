const http = require("http");
const app = require("./app");

const portNormal = (val) => {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
};

const port = portNormal(process.env.PORT || "3000");
app.set("port", port);

const server = http.createServer(app);

// ⚡ Socket.IO
const { Server } = require("socket.io");

const io = new Server(server, {
 cors: { origin: "*" }
});

app.set("io", io);

// ✅ AJOUT ICI
io.on("connection", (socket) => {
  console.log("🟢 Nouveau client connecté :", socket.id);

  socket.on("join_room", (userId) => {
    socket.join(userId);
    console.log(`✅ User ${userId} a rejoint sa room`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client déconnecté :", socket.id);
  });
});

// Gestion des erreurs
const erreur = (error) => {
  if (error.syscall !== "listen") throw error;
  const address = server.address();
  const message =
    typeof address === "string" ? "pipe " + address : "port " + port;

  switch (error.code) {
    case "EACCES":
      console.log(message + " vous avez besoin de vous authentifier");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.log(message + " Ce server est occupé");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

server.on("error", erreur);

server.on("listening", () => {
  const address = server.address();
  const message =
    typeof address === "string" ? "pipe " + address : "port " + port;
  console.log("le server est lancé sur " + message);
});

server.listen(port);