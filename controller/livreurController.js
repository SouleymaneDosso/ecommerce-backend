const Livreur = require("../models/livreur");
const Commandeapi = require("../models/paiementmodel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// =====================================================
// INSCRIPTION LIVREUR
// =====================================================

exports.signup = async (req, res) => {
  try {
    const { username, email, password, telephone } = req.body;

    if (!username || !email || !password || !telephone) {
      return res.status(400).json({
        message: "Tous les champs sont requis",
      });
    }

    const existingLivreur = await Livreur.findOne({
      $or: [{ username }, { email }, { telephone }],
    });

    if (existingLivreur) {
      return res.status(400).json({
        message: "Ce livreur existe déjà",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const livreur = await Livreur.create({
      username,
      email,
      password: hashedPassword,
      telephone,
    });

    const token = jwt.sign(
      {
        userId: livreur._id,
      },
      process.env.JWT_SECRET_LIVREUR,
      {
        expiresIn: "7d",
      },
    );

    return res.status(201).json({
      message: "Compte livreur créé",
      livreurId: livreur._id,
      username: livreur.username,
      token,
    });
  } catch (error) {
    console.error("LIVREUR SIGNUP ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// CONNEXION LIVREUR
// =====================================================

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Identifiant et mot de passe requis",
      });
    }

    const livreur = await Livreur.findOne({ username });

    if (!livreur) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // COMPTE BLOQUÉ PAR ADMIN
    if (livreur.bloque) {
      return res.status(403).json({
        message: "Votre compte est bloqué par l'administrateur",
      });
    }

    // COMPTE DÉSACTIVÉ PAR ADMIN
    if (!livreur.actif) {
      return res.status(403).json({
        message: "Compte livreur désactivé",
      });
    }

    const passwordCorrect = await livreur.comparePassword(password);

    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    const token = jwt.sign(
      {
        userId: livreur._id,
      },
      process.env.JWT_SECRET_LIVREUR,
      {
        expiresIn: "7d",
      },
    );

    return res.status(200).json({
      message: "Connexion réussie",
      token,

      livreur: {
        id: livreur._id,
        username: livreur.username,
        email: livreur.email,
        telephone: livreur.telephone,

        actif: livreur.actif,
        bloque: livreur.bloque,

        limiteCoursesParJour: livreur.limiteCoursesParJour,

        statut: livreur.statut,

        localisation: livreur.localisation,

        commandeActuelle: livreur.commandeActuelle,
      },
    });
  } catch (error) {
    console.error("LIVREUR LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// PROFIL LIVREUR
// =====================================================

exports.profil = async (req, res) => {
  try {
    const livreur = req.livreur;

    return res.status(200).json({
      message: "Profil livreur",

      livreur: {
        id: livreur._id,
        username: livreur.username,
        email: livreur.email,
        telephone: livreur.telephone,

        actif: livreur.actif,
        bloque: livreur.bloque,

        limiteCoursesParJour: livreur.limiteCoursesParJour,

        statut: livreur.statut,

        localisation: livreur.localisation,

        commandeActuelle: livreur.commandeActuelle,
      },
    });
  } catch (error) {
    console.error("PROFIL LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// CHANGER STATUT LIVREUR
// =====================================================
// Le statut opérationnel est contrôlé par le livreur.
// OFFLINE / AVAILABLE / BUSY

exports.changerStatut = async (req, res) => {
  try {
    const { statut } = req.body;

    const statutsAutorises = ["OFFLINE", "AVAILABLE", "BUSY"];

    if (!statutsAutorises.includes(statut)) {
      return res.status(400).json({
        message: "Statut invalide",
      });
    }

    const livreur = await Livreur.findById(req.livreur._id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    // UN LIVREUR BLOQUÉ OU DÉSACTIVÉ
    // NE PEUT PAS DEVENIR DISPONIBLE
    if (statut === "AVAILABLE") {
      if (livreur.bloque) {
        return res.status(403).json({
          message: "Votre compte est bloqué par l'administrateur",
        });
      }

      if (!livreur.actif) {
        return res.status(403).json({
          message: "Votre compte est désactivé",
        });
      }

      if (livreur.commandeActuelle) {
        return res.status(400).json({
          message:
            "Vous avez déjà une commande en cours. Vous ne pouvez pas devenir disponible.",
        });
      }
    }

    // UN LIVREUR AVEC UNE COMMANDE
    // NE PEUT PAS PASSER OFFLINE
    if (statut === "OFFLINE" && livreur.commandeActuelle) {
      return res.status(400).json({
        message:
          "Vous avez une commande en cours. Vous devez terminer la commande avant de passer hors ligne.",
      });
    }

    livreur.statut = statut;

    await livreur.save();

    return res.status(200).json({
      message: "Statut mis à jour",
      statut: livreur.statut,
    });
  } catch (error) {
    console.error("CHANGEMENT STATUT LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// METTRE À JOUR LOCALISATION GPS
// =====================================================

exports.mettreAJourLocalisation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      latitude === undefined ||
      longitude === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return res.status(400).json({
        message: "Latitude et longitude valides requises",
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        message: "Coordonnées GPS invalides",
      });
    }

    const livreur = await Livreur.findById(req.livreur._id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    const maintenant = new Date();

    livreur.localisation = {
      latitude: lat,
      longitude: lng,
      derniereMiseAJour: maintenant,
    };

    await livreur.save();

    // =================================================
    // DIFFUSION TEMPS RÉEL
    // =================================================

    const io = req.app.get("io");

    if (io && livreur.commandeActuelle) {
      io.to(`commande:${livreur.commandeActuelle}`).emit(
        "livreur_position",
        {
          commandeId: livreur.commandeActuelle.toString(),

          livreurId: livreur._id.toString(),

          latitude: lat,

          longitude: lng,

          derniereMiseAJour: maintenant,
        },
      );
    }

    return res.status(200).json({
      message: "Localisation mise à jour",

      localisation: livreur.localisation,
    });
  } catch (error) {
    console.error("GPS LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// COMMANDES DU LIVREUR
// =====================================================

exports.mesCommandes = async (req, res) => {
  try {
    const commandes = await Commandeapi.find({
      "livraison.livreurId": req.livreur._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      commandes,
    });
  } catch (error) {
    console.error("COMMANDES LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ACCEPTER UNE COMMANDE
// SEARCHING → ACCEPTED
// =====================================================

exports.accepterCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const livreur = await Livreur.findById(req.livreur._id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    // =================================================
    // COMPTE ACTIF
    // =================================================

    if (!livreur.actif) {
      return res.status(403).json({
        message: "Votre compte livreur est désactivé",
      });
    }

    // =================================================
    // COMPTE NON BLOQUÉ
    // =================================================

    if (livreur.bloque) {
      return res.status(403).json({
        message: "Votre compte est bloqué par l'administrateur",
      });
    }

    // =================================================
    // LIMITE JOURNALIÈRE
    // =================================================

    if (
      livreur.limiteCoursesParJour !== null &&
      livreur.limiteCoursesParJour !== undefined
    ) {
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);

      const finJour = new Date();
      finJour.setHours(23, 59, 59, 999);

      const nombreCoursesAujourdHui = await Commandeapi.countDocuments({
        "livraison.livreurId": livreur._id,

        createdAt: {
          $gte: debutJour,
          $lte: finJour,
        },
      });

      if (nombreCoursesAujourdHui >= livreur.limiteCoursesParJour) {
        return res.status(403).json({
          message: `Vous avez atteint votre limite de ${livreur.limiteCoursesParJour} course(s) pour aujourd'hui.`,

          limite: livreur.limiteCoursesParJour,

          coursesAujourdHui: nombreCoursesAujourdHui,
        });
      }
    }

    // =================================================
    // UNE SEULE COMMANDE À LA FOIS
    // =================================================

    if (livreur.commandeActuelle) {
      return res.status(400).json({
        message: "Vous avez déjà une commande en cours",
      });
    }

    // =================================================
    // LE LIVREUR DOIT ÊTRE DISPONIBLE
    // =================================================

    if (livreur.statut !== "AVAILABLE") {
      return res.status(400).json({
        message: "Vous devez être disponible pour accepter une commande",
      });
    }

    // =================================================
    // ATTRIBUTION ATOMIQUE
    // =================================================

    const maintenant = new Date();

    const commande = await Commandeapi.findOneAndUpdate(
      {
        _id: id,

        // ADMIN A CONFIRMÉ
        statusCommande: "CONFIRMED",

        // CLIENT RECHERCHE UN LIVREUR
        "livraison.statut": "SEARCHING",

        // AUCUN LIVREUR ATTRIBUÉ
        $or: [
          {
            "livraison.livreurId": null,
          },
          {
            "livraison.livreurId": {
              $exists: false,
            },
          },
        ],
      },
      {
        $set: {
          "livraison.livreurId": livreur._id,

          "livraison.assigneeAt": maintenant,

          "livraison.accepteAt": maintenant,

          "livraison.statut": "ACCEPTED",
        },
      },
      {
        new: true,
      },
    );

    // =================================================
    // COMMANDE DÉJÀ PRISE
    // =================================================

    if (!commande) {
      return res.status(409).json({
        message:
          "Cette commande n'est plus disponible. Elle a probablement déjà été prise par un autre livreur.",
      });
    }

    // =================================================
    // OCCUPER LE LIVREUR
    // =================================================

    livreur.statut = "BUSY";

    livreur.commandeActuelle = commande._id;

    await livreur.save();

    // =================================================
    // SOCKET.IO
    // =================================================

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      const clientId = commande.client.userId.toString();

      const notification = {
        id: commande._id.toString(),

        statutLivraison: "ACCEPTED",

        livreurId: livreur._id.toString(),

        livreur: {
          id: livreur._id.toString(),

          username: livreur.username,

          telephone: livreur.telephone,

          localisation: livreur.localisation,
        },
      };

      // CLIENT
      io.to(`user:${clientId}`).emit(
        "commande_update",
        notification,
      );

      // ROOM COMMANDE
      io.to(`commande:${commande._id}`).emit(
        "commande_update",
        notification,
      );
    }

    return res.status(200).json({
      message: "Commande acceptée",

      commande,
    });
  } catch (error) {
    console.error("ACCEPTER COMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// LANCER LA RECHERCHE D'UN LIVREUR
// CONFIRMED + NOT_STARTED → SEARCHING
// =====================================================

exports.rechercherLivreur = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    // =================================================
    // COMMANDE DU CLIENT CONNECTÉ
    // =================================================

    if (
      !commande.client?.userId ||
      commande.client.userId.toString() !==
        req.auth.userId.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous appartient pas",
      });
    }

    // =================================================
    // ADMIN DOIT AVOIR CONFIRMÉ
    // =================================================

    if (commande.statusCommande !== "CONFIRMED") {
      return res.status(403).json({
        message:
          "La livraison ne peut pas être demandée avant la confirmation de la commande par l'administrateur. Veuillez patienter. Vous pouvez voir votre commande dans votre espace compte. Pour choisir un livreur, cliquez sur la commande dans votre compte client.",

        statusCommande: commande.statusCommande,
      });
    }

    // =================================================
    // RECHERCHE UNE SEULE FOIS
    // =================================================

    if (commande.livraison.statut !== "NOT_STARTED") {
      return res.status(400).json({
        message: "La recherche d'un livreur est déjà lancée",

        statut: commande.livraison.statut,
      });
    }

    // =================================================
    // CALCUL SÉCURISÉ DU TOTAL
    // =================================================

    if (
      commande.totalProduits === undefined ||
      commande.totalProduits === null
    ) {
      commande.totalProduits = commande.panier.reduce(
        (total, item) =>
          total +
          Number(item.prix || 0) * Number(item.quantite || 0),
        0,
      );
    }

    // =================================================
    // LANCER LA RECHERCHE
    // =================================================

    commande.livraison.statut = "SEARCHING";

    await commande.save();

    // =================================================
    // NOTIFICATION LIVREURS
    // =================================================

    const io = req.app.get("io");

    if (io) {
      io.emit("nouvelle_commande_livraison", {
        commandeId: commande._id.toString(),

        ville: commande.client.ville,

        adresse: commande.client.adresse,

        totalProduits: commande.totalProduits,

        panier: commande.panier,
      });
    }

    return res.status(200).json({
      message: "Recherche de livreur lancée",

      commande,
    });
  } catch (error) {
    console.error("RECHERCHE LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// COMMANDES DISPONIBLES
// =====================================================

exports.commandesDisponibles = async (req, res) => {
  try {
    const commandes = await Commandeapi.find({
      // ADMIN A CONFIRMÉ
      statusCommande: "CONFIRMED",

      // CLIENT RECHERCHE UN LIVREUR
      "livraison.statut": "SEARCHING",

      // AUCUN LIVREUR
      $or: [
        {
          "livraison.livreurId": null,
        },
        {
          "livraison.livreurId": {
            $exists: false,
          },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      commandes,
    });
  } catch (error) {
    console.error("COMMANDES DISPONIBLES ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// COMMENCER LA RÉCUPÉRATION
// ACCEPTED → PICKING_UP
// =====================================================

exports.commencerRecuperation = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    // =================================================
    // VÉRIFIER LE LIVREUR
    // =================================================

    if (
      !commande.livraison?.livreurId ||
      commande.livraison.livreurId.toString() !==
        req.livreur._id.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous est pas attribuée",
      });
    }

    // =================================================
    // VÉRIFIER LE STATUT
    // =================================================

    if (commande.livraison.statut !== "ACCEPTED") {
      return res.status(400).json({
        message:
          "La commande ne peut pas commencer la récupération",

        statut: commande.livraison.statut,
      });
    }

    commande.livraison.statut = "PICKING_UP";

    await commande.save();

    // =================================================
    // SOCKET.IO
    // =================================================

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      const clientRoom = `user:${commande.client.userId}`;

      const commandeRoom = `commande:${commande._id}`;

      io.to(clientRoom).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "PICKING_UP",
      });

      io.to(commandeRoom).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "PICKING_UP",
      });
    }

    return res.status(200).json({
      message: "Récupération de la commande commencée",

      commande,
    });
  } catch (error) {
    console.error("COMMENCER RECUPERATION ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// COMMANDE RÉCUPÉRÉE
// PICKING_UP → IN_DELIVERY
// =====================================================

exports.recupererCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    // =================================================
    // VÉRIFIER LE LIVREUR
    // =================================================

    if (
      !commande.livraison?.livreurId ||
      commande.livraison.livreurId.toString() !==
        req.livreur._id.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous est pas attribuée",
      });
    }

    // =================================================
    // VÉRIFIER LE STATUT
    // =================================================

    if (commande.livraison.statut !== "PICKING_UP") {
      return res.status(400).json({
        message: "La commande n'est pas en cours de récupération",

        statut: commande.livraison.statut,
      });
    }

    commande.livraison.statut = "IN_DELIVERY";

    await commande.save();

    // =================================================
    // SOCKET.IO
    // =================================================

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      const clientRoom = `user:${commande.client.userId}`;

      const commandeRoom = `commande:${commande._id}`;

      io.to(clientRoom).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "IN_DELIVERY",
      });

      io.to(commandeRoom).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "IN_DELIVERY",
      });
    }

    return res.status(200).json({
      message: "Commande récupérée",

      commande,
    });
  } catch (error) {
    console.error("RECUPERER COMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// LIVRER LA COMMANDE
// IN_DELIVERY → DELIVERED
// =====================================================

exports.livrerCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    // =================================================
    // VÉRIFIER LE LIVREUR
    // =================================================

    if (
      !commande.livraison?.livreurId ||
      commande.livraison.livreurId.toString() !==
        req.livreur._id.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous est pas attribuée",
      });
    }

    // =================================================
    // VÉRIFIER LE STATUT
    // =================================================

    if (commande.livraison.statut !== "IN_DELIVERY") {
      return res.status(400).json({
        message: "Cette commande n'est pas en cours de livraison",

        statut: commande.livraison.statut,
      });
    }

    commande.livraison.statut = "DELIVERED";

    commande.livraison.livreAt = new Date();

    // =================================================
    // LIBÉRER LE LIVREUR
    // =================================================

    const livreur = await Livreur.findById(req.livreur._id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.commandeActuelle = null;

    livreur.statut = "AVAILABLE";

    await commande.save();

    await livreur.save();

    // =================================================
    // SOCKET.IO
    // =================================================

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      const notification = {
        id: commande._id.toString(),

        statutLivraison: "DELIVERED",

        livreurId: livreur._id.toString(),
      };

      io.to(`user:${commande.client.userId}`).emit(
        "commande_update",
        notification,
      );

      io.to(`commande:${commande._id}`).emit(
        "commande_update",
        notification,
      );
    }

    return res.status(200).json({
      message: "Commande livrée avec succès",

      commande,
    });
  } catch (error) {
    console.error("LIVRER COMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ADMIN — LISTE DES LIVREURS
// =====================================================

exports.adminGetLivreurs = async (req, res) => {
  try {
    const livreurs = await Livreur.find()
      .populate({
        path: "commandeActuelle",

        select:
          "_id statusCommande livraison client total totalProduits",
      })
      .sort({ createdAt: -1 })
      .lean();

    // =================================================
    // AJOUT DU NOMBRE DE COURSES DU JOUR
    // =================================================

    const debutJour = new Date();

    debutJour.setHours(0, 0, 0, 0);

    const finJour = new Date();

    finJour.setHours(23, 59, 59, 999);

    const livreursAvecStats = await Promise.all(
      livreurs.map(async (livreur) => {
        const coursesAujourdHui =
          await Commandeapi.countDocuments({
            "livraison.livreurId": livreur._id,

            createdAt: {
              $gte: debutJour,
              $lte: finJour,
            },
          });

        return {
          ...livreur,

          coursesAujourdHui,

          nombreCoursesAujourdHui: coursesAujourdHui,
        };
      }),
    );

    return res.status(200).json({
      livreurs: livreursAvecStats,
    });
  } catch (error) {
    console.error("ADMIN GET LIVREURS ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ADMIN — BLOQUER UN LIVREUR
// =====================================================

exports.adminBloquerLivreur = async (req, res) => {
  try {
    const { id } = req.params;

    const { raison } = req.body;

    const livreur = await Livreur.findById(id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.bloque = true;

    livreur.actif = false;

    livreur.raisonRestriction =
      raison || "Compte bloqué par l'administrateur";

    // IMPORTANT :
    // L'ADMIN NE MODIFIE PAS LE STATUT OPÉRATIONNEL.
    // Le statut reste sous le contrôle du livreur.

    await livreur.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("livreur_admin_update", {
        livreurId: livreur._id.toString(),

        bloque: true,

        actif: false,

        limiteCoursesParJour:
          livreur.limiteCoursesParJour,

        statut: livreur.statut,
      });
    }

    return res.status(200).json({
      message: "Livreur bloqué",

      livreur,
    });
  } catch (error) {
    console.error("ADMIN BLOQUER LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ADMIN — DÉBLOQUER UN LIVREUR
// =====================================================

exports.adminDebloquerLivreur = async (req, res) => {
  try {
    const { id } = req.params;

    const livreur = await Livreur.findById(id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.bloque = false;

    livreur.actif = true;

    livreur.raisonRestriction = "";

    // IMPORTANT :
    // On ne touche pas au statut opérationnel.
    // Le livreur choisira lui-même AVAILABLE/OFFLINE.

    await livreur.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("livreur_admin_update", {
        livreurId: livreur._id.toString(),

        bloque: false,

        actif: true,

        limiteCoursesParJour:
          livreur.limiteCoursesParJour,

        statut: livreur.statut,
      });
    }

    return res.status(200).json({
      message: "Livreur débloqué",

      livreur,
    });
  } catch (error) {
    console.error("ADMIN DEBLOQUER LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ADMIN — ACTIVER / DÉSACTIVER
// =====================================================

exports.adminChangerActif = async (req, res) => {
  try {
    const { id } = req.params;

    const { actif } = req.body;

    if (typeof actif !== "boolean") {
      return res.status(400).json({
        message: "La valeur actif doit être true ou false",
      });
    }

    const livreur = await Livreur.findById(id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.actif = actif;

    // IMPORTANT :
    // On ne modifie PAS livreur.statut ici.

    await livreur.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("livreur_admin_update", {
        livreurId: livreur._id.toString(),

        bloque: livreur.bloque,

        actif: livreur.actif,

        limiteCoursesParJour:
          livreur.limiteCoursesParJour,

        statut: livreur.statut,
      });
    }

    return res.status(200).json({
      message: actif
        ? "Livreur activé"
        : "Livreur désactivé",

      livreur,
    });
  } catch (error) {
    console.error("ADMIN ACTIF LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ADMIN — LIMITER UN LIVREUR
// =====================================================

exports.adminLimiterLivreur = async (req, res) => {
  try {
    const { id } = req.params;

    const { limite } = req.body;

    if (
      limite === undefined ||
      limite === null ||
      limite === ""
    ) {
      return res.status(400).json({
        message: "La limite de courses est obligatoire",
      });
    }

    const nouvelleLimite = Number(limite);

    if (
      !Number.isInteger(nouvelleLimite) ||
      nouvelleLimite < 0
    ) {
      return res.status(400).json({
        message:
          "La limite doit être un nombre entier supérieur ou égal à 0",
      });
    }

    const livreur = await Livreur.findById(id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.limiteCoursesParJour = nouvelleLimite;

    await livreur.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("livreur_admin_update", {
        livreurId: livreur._id.toString(),

        bloque: livreur.bloque,

        actif: livreur.actif,

        limiteCoursesParJour:
          livreur.limiteCoursesParJour,

        statut: livreur.statut,
      });
    }

    return res.status(200).json({
      message: "Limite de courses mise à jour",

      livreur,
    });
  } catch (error) {
    console.error("ADMIN LIMITER LIVREUR ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// =====================================================
// ADMIN — RETIRER LA LIMITE
// =====================================================

exports.adminRetirerLimiteLivreur = async (req, res) => {
  try {
    const { id } = req.params;

    const livreur = await Livreur.findById(id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.limiteCoursesParJour = null;

    await livreur.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("livreur_admin_update", {
        livreurId: livreur._id.toString(),

        bloque: livreur.bloque,

        actif: livreur.actif,

        limiteCoursesParJour: null,

        statut: livreur.statut,
      });
    }

    return res.status(200).json({
      message: "Limite de courses retirée",

      livreur,
    });
  } catch (error) {
    console.error("ADMIN RETIRER LIMITE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};