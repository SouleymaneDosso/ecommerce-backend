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
      utilisateurs.map((user) => [user._id.toString(), user]),
    );

    const resultats = clients.map((client) => {
      const utilisateur = utilisateursMap.get(client._id.toString());

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
    console.error("❌ Erreur statistiques clients :", error);

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
    console.error("❌ Erreur statistiques pages :", error);

    res.status(500).json({
      message: "Erreur lors du calcul des statistiques pages",
    });
  }
};
const obtenirFunnelStatistiques = async (req, res) => {
  try {
    const visiteursUniques = await Visite.distinct("visitorId");

    const visiteursIdentifies = await Visite.distinct("visitorId", {
      userId: { $ne: null },
    });

    const utilisateursInscrits = await User.countDocuments();

    const clientsAvecCommande = await Commande.distinct("client.userId", {
      "client.userId": { $ne: null },
    });

    res.json({
      visiteursUniques: visiteursUniques.length,

      visiteursIdentifies: visiteursIdentifies.length,

      utilisateursInscrits,

      clientsAvecCommande: clientsAvecCommande.length,
    });
  } catch (error) {
    console.error("❌ Erreur statistiques funnel :", error);

    res.status(500).json({
      message: "Erreur lors du calcul du funnel",
    });
  }
};

// =====================================================
// ÉVOLUTION DES VISITES - 30 DERNIERS JOURS
// =====================================================

const obtenirEvolutionStatistiques = async (req, res) => {
  try {
    const maintenant = new Date();

    const debut = new Date(maintenant);
    debut.setDate(debut.getDate() - 29);

    debut.setHours(0, 0, 0, 0);

    const evolution = await Visite.aggregate([
      {
        $match: {
          visitedAt: {
            $gte: debut,
          },
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$visitedAt",
            },
          },

          visites: {
            $sum: 1,
          },

          visiteurs: {
            $addToSet: "$visitorId",
          },

          sessions: {
            $addToSet: "$sessionId",
          },

          utilisateurs: {
            $addToSet: "$userId",
          },
        },
      },

      {
        $project: {
          _id: 0,

          date: "$_id",

          visites: 1,

          visiteursUniques: {
            $size: "$visiteurs",
          },

          sessionsUniques: {
            $size: "$sessions",
          },

          utilisateursIdentifies: {
            $size: {
              $filter: {
                input: "$utilisateurs",
                as: "userId",
                cond: {
                  $ne: ["$$userId", null],
                },
              },
            },
          },
        },
      },

      {
        $sort: {
          date: 1,
        },
      },
    ]);

    res.json({
      evolution,
    });
  } catch (error) {
    console.error("❌ Erreur évolution statistiques :", error);

    res.status(500).json({
      message: "Erreur lors du calcul de l'évolution",
    });
  }
};

// =====================================================
// VISITEURS
// =====================================================

const obtenirStatistiquesVisiteurs = async (req, res) => {
  try {
    const visiteurs = await Visite.aggregate([
      {
        $group: {
          _id: "$visitorId",

          userIds: {
            $addToSet: "$userId",
          },

          sessions: {
            $addToSet: "$sessionId",
          },

          pages: {
            $addToSet: "$page",
          },

          nombreVisites: {
            $sum: 1,
          },

          premiereVisite: {
            $min: "$visitedAt",
          },

          derniereVisite: {
            $max: "$visitedAt",
          },
        },
      },

      {
        $sort: {
          derniereVisite: -1,
        },
      },

      {
        $limit: 500,
      },
    ]);

    const resultats = visiteurs.map((visiteur) => {
      const utilisateur = visiteur.userIds.find((id) => id !== null);

      return {
        visitorId: visiteur._id,

        userId: utilisateur || null,

        sessions: visiteur.sessions.length,

        pages: visiteur.pages.length,

        nombreVisites: visiteur.nombreVisites,

        premiereVisite: visiteur.premiereVisite,

        derniereVisite: visiteur.derniereVisite,

        identifie: Boolean(utilisateur),
      };
    });

    res.json({
      visiteurs: resultats,
    });
  } catch (error) {
    console.error("❌ Erreur statistiques visiteurs :", error);

    res.status(500).json({
      message: "Erreur lors du calcul des visiteurs",
    });
  }
};

// =====================================================
// TOUS LES UTILISATEURS
// =====================================================

const obtenirStatistiquesUtilisateurs = async (req, res) => {
  try {
    const utilisateurs = await User.find({})
      .select("username email createdAt updatedAt")
      .sort({ createdAt: -1 });

    const userIds = utilisateurs.map((user) => user._id);

    const commandes = await Commande.aggregate([
      {
        $match: {
          "client.userId": {
            $in: userIds,
          },
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

          derniereCommande: {
            $max: "$createdAt",
          },
        },
      },
    ]);

    const commandesMap = new Map(
      commandes.map((commande) => [commande._id.toString(), commande]),
    );

    const resultats = utilisateurs.map((user) => {
      const statistiques = commandesMap.get(user._id.toString());

      return {
        userId: user._id,

        username: user.username,

        email: user.email,

        createdAt: user.createdAt,

        updatedAt: user.updatedAt,

        nombreCommandes: statistiques?.nombreCommandes || 0,

        montantTotal: statistiques?.montantTotal || 0,

        derniereCommande: statistiques?.derniereCommande || null,
      };
    });

    res.json({
      utilisateurs: resultats,
    });
  } catch (error) {
    console.error("❌ Erreur statistiques utilisateurs :", error);

    res.status(500).json({
      message: "Erreur lors du calcul des statistiques utilisateurs",
    });
  }
};

// =====================================================
// FIDÉLITÉ CLIENT
// =====================================================

const obtenirStatistiquesFidelite = async (req, res) => {
  try {
    const clients = await Commande.aggregate([
      {
        $match: {
          "client.userId": {
            $ne: null,
          },
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
      _id: {
        $in: clientIds,
      },
    }).select("username email");

    const utilisateursMap = new Map(
      utilisateurs.map((user) => [user._id.toString(), user]),
    );

    const resultats = clients.map((client) => {
      const utilisateur = utilisateursMap.get(client._id.toString());

      const premiere = client.premiereCommande
        ? new Date(client.premiereCommande)
        : null;

      const derniere = client.derniereCommande
        ? new Date(client.derniereCommande)
        : null;

      let joursClient = 0;

      if (premiere && derniere) {
        joursClient = Math.max(
          0,
          Math.round((derniere - premiere) / (1000 * 60 * 60 * 24)),
        );
      }

      return {
        userId: client._id,

        username: utilisateur?.username || "Utilisateur inconnu",

        email: utilisateur?.email || "",

        nombreCommandes: client.nombreCommandes,

        montantTotal: client.montantTotal,

        panierMoyen:
          client.nombreCommandes > 0
            ? client.montantTotal / client.nombreCommandes
            : 0,

        premiereCommande: client.premiereCommande,

        derniereCommande: client.derniereCommande,

        joursClient,
      };
    });

    res.json({
      clients: resultats,
    });
  } catch (error) {
    console.error("❌ Erreur statistiques fidélité :", error);

    res.status(500).json({
      message: "Erreur lors du calcul des statistiques de fidélité",
    });
  }
};

module.exports = {
  enregistrerVisite,

  obtenirResumeStatistiques,

  obtenirStatistiquesClients,

  obtenirStatistiquesPages,

  obtenirFunnelStatistiques,

  obtenirEvolutionStatistiques,

  obtenirStatistiquesVisiteurs,

  obtenirStatistiquesUtilisateurs,

  obtenirStatistiquesFidelite,
};
