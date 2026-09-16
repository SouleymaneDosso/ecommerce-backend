const Visite = require("../models/visiteModel");
const Commande = require("../models/paiementmodel");
const User = require("../models/User");

const enregistrerVisite = async (req, res) => {
  try {
    const { visitorId, sessionId, page } = req.body;

    if (!visitorId || !sessionId || !page) {
      return res.status(400).json({
        message: "visitorId, sessionId et page sont requis",
      });
    }

    const visite = await Visite.create({
      visitorId,
      sessionId,
      page,
      userId: req.auth?.userId || null,
    });

    res.status(201).json({
      message: "Visite enregistrée",
      visiteId: visite._id,
    });
  } catch (error) {
    console.error("❌ Erreur enregistrement visite :", error);

    res.status(500).json({
      message: "Erreur lors de l'enregistrement de la visite",
    });
  }
};

const obtenirResumeStatistiques = async (req, res) => {
  try {
    const [
      visiteursUniques,
      visites,
      sessions,
      utilisateursIdentifies,
      commandes,
      clientsAyantCommande,
      commandesLivrees,
      chiffreAffaires,
    ] = await Promise.all([
      Visite.distinct("visitorId"),

      Visite.countDocuments(),

      Visite.distinct("sessionId"),

      Visite.distinct("userId", {
        userId: { $ne: null },
      }),

      Commande.countDocuments(),

      Commande.distinct("client.userId"),

      Commande.countDocuments({
        statusCommande: "DELIVERED",
      }),

      Commande.aggregate([
        {
          $match: {
            statusCommande: {
              $in: ["CONFIRMED", "SHIPPED", "DELIVERED"],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$total",
            },
          },
        },
      ]),
    ]);

    res.json({
      visiteursUniques: visiteursUniques.length,
      visites,
      sessions: sessions.length,
      utilisateursIdentifies: utilisateursIdentifies.length,

      commandes,

      clientsAyantCommande: clientsAyantCommande.filter((id) => id !== null)
        .length,

      commandesLivrees,

      chiffreAffaires:
        chiffreAffaires.length > 0 ? chiffreAffaires[0].total : 0,
    });
  } catch (error) {
    console.error("❌ Erreur statistiques résumé :", error);

    res.status(500).json({
      message: "Erreur lors du calcul des statistiques",
    });
  }
};

const obtenirStatistiquesClients = async (req, res) => {
  try {
    const clients = await Commande.aggregate([
      {
        $match: {
          "client.userId": { $ne: null },
        },
      },

      {
        $group: {
          _id: "$client.userId",

          nombreCommandes: {
            $sum: 1,
          },

          montantTotal: {
            $sum: "$total",
          },

          premiereCommande: {
            $min: "$createdAt",
          },

          derniereCommande: {
            $max: "$createdAt",
          },
        },
      },

      {
        $sort: {
          montantTotal: -1,
        },
      },
    ]);

    const clientIds = clients.map((client) => client._id);

    const utilisateurs = await User.find({
      _id: { $in: clientIds },
    }).select("username email");

    const utilisateursMap = new Map(
      utilisateurs.map((user) => [
        user._id.toString(),
        user,
      ]),
    );

    const resultats = clients.map((client) => {
      const utilisateur = utilisateursMap.get(
        client._id.toString(),
      );

      return {
        userId: client._id,

        username: utilisateur?.username || "Utilisateur inconnu",

        email: utilisateur?.email || "",

        nombreCommandes: client.nombreCommandes,

        montantTotal: client.montantTotal,

        premiereCommande: client.premiereCommande,

        derniereCommande: client.derniereCommande,
      };
    });

    res.json({
      clients: resultats,
    });
  } catch (error) {
    console.error(
      "❌ Erreur statistiques clients :",
      error,
    );

    res.status(500).json({
      message: "Erreur lors du calcul des statistiques clients",
    });
  }
};
const obtenirStatistiquesPages = async (req, res) => {
  try {
    const pages = await Visite.aggregate([
      {
        $group: {
          _id: "$page",

          visites: {
            $sum: 1,
          },

          visiteursUniques: {
            $addToSet: "$visitorId",
          },

          sessionsUniques: {
            $addToSet: "$sessionId",
          },
        },
      },

      {
        $project: {
          _id: 0,

          page: "$_id",

          visites: 1,

          visiteursUniques: {
            $size: "$visiteursUniques",
          },

          sessionsUniques: {
            $size: "$sessionsUniques",
          },
        },
      },

      {
        $sort: {
          visites: -1,
        },
      },
    ]);

    res.json({
      pages,
    });
  } catch (error) {
    console.error(
      "❌ Erreur statistiques pages :",
      error,
    );

    res.status(500).json({
      message: "Erreur lors du calcul des statistiques pages",
    });
  }
};
module.exports = {
  enregistrerVisite,
  obtenirResumeStatistiques,
  obtenirStatistiquesClients,
  obtenirStatistiquesPages,
};
