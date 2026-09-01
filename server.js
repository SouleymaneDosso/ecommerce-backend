const http = require("http");
const app = require("./app");
const { Server } = require("socket.io");

const portNormal = (val) => {
  const port = parseInt(val, 10);

  if (isNaN(port)) return val;
  if (port >= 0) return port;

  return false;
};

const port = portNormal(process.env.PORT || "3000");

app.set("port", port);

const server = http.createServer(app);

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

app.set("io", io);

// ======================================================
// CONNEXION SOCKET
// ======================================================

io.on("connection", (socket) => {
  console.log("🟢 Socket connecté :", socket.id);

  // ====================================================
  // ROOM UTILISATEUR
  // ====================================================

  socket.on("join_room", (userId) => {
    if (!userId) return;

    const room = `user:${userId}`;

    socket.join(room);

    console.log(`👤 ${socket.id} rejoint ${room}`);
  });

  // ====================================================
  // ROOM COMMANDE
  // ====================================================

  socket.on("join_commande", (commandeId) => {
    if (!commandeId) return;

    const room = `commande:${commandeId}`;

    socket.join(room);

    console.log(`📦 ${socket.id} rejoint ${room}`);
  });

  // ====================================================
  // QUITTER COMMANDE
  // ====================================================

  socket.on("leave_commande", (commandeId) => {
    if (!commandeId) return;

    const room = `commande:${commandeId}`;

    socket.leave(room);

    console.log(`📦 ${socket.id} quitte ${room}`);
  });

  // ====================================================
  // DECONNEXION
  // ====================================================

  socket.on("disconnect", () => {
    console.log("🔴 Socket déconnecté :", socket.id);
  });
});

// ======================================================
// ERREURS SERVEUR
// ======================================================

const erreur = (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const address = server.address();

  const message =
    typeof address === "string"
      ? "pipe " + address
      : "port " + port;

  switch (error.code) {
    case "EACCES":
      console.log(
        message + " vous avez besoin de vous authentifier",
      );
      process.exit(1);
      break;

    case "EADDRINUSE":
      console.log(
        message + " Ce server est occupé",
      );
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
    typeof address === "string"
      ? "pipe " + address
      : "port " + port;

  console.log("🚀 Serveur lancé sur " + message);
});

server.listen(port);

