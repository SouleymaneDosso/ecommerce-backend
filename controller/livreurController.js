const Livreur = require("../models/livreur");
const Commandeapi = require("../models/paiementmodel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ===============================
// INSCRIPTION LIVREUR
// ===============================
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
      { userId: livreur._id },
      process.env.JWT_SECRET_LIVREUR,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "Compte livreur créé",
      livreurId: livreur._id,
      username: livreur.username,
      token,
    });
  } catch (error) {
    console.error("Livreur signup error:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ===============================
// CONNEXION LIVREUR
// ===============================
exports.login = async (req, res) => {
  try {
    // Récupérer les données envoyées par le frontend
    const { username, password } = req.body;

    // Vérifier que les deux champs existent
    if (!username || !password) {
      return res.status(400).json({
        message: "Identifiant et mot de passe requis",
      });
    }

    // Chercher le livreur avec son username
    const livreur = await Livreur.findOne({ username });

    // Aucun livreur trouvé
    if (!livreur) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // Vérifier si le compte est actif
    if (!livreur.actif) {
      return res.status(403).json({
        message: "Compte livreur désactivé",
      });
    }

    // Comparer le mot de passe avec le hash enregistré
    const passwordCorrect = await livreur.comparePassword(password);

    // Mauvais mot de passe
    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // Créer le token JWT
    const token = jwt.sign(
      {
        userId: livreur._id,
      },
      process.env.JWT_SECRET_LIVREUR,
      {
        expiresIn: "7d",
      },
    );

    // Envoyer les informations au frontend
    return res.status(200).json({
      message: "Connexion réussie",
      token,
      livreur: {
        id: livreur._id,
        username: livreur.username,
        email: livreur.email,
        telephone: livreur.telephone,
        actif: livreur.actif,
        statut: livreur.statut,
        localisation: livreur.localisation,
        commandeActuelle: livreur.commandeActuelle,
      },
    });
  } catch (error) {
    console.error("Livreur login error:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ===============================
// PROFIL LIVREUR
// ===============================
exports.profil = async (req, res) => {
  try {
    const livreur = req.livreur;

    res.status(200).json({
      message: "Profil livreur",
      livreur: {
        id: livreur._id,
        username: livreur.username,
        email: livreur.email,
        telephone: livreur.telephone,
        actif: livreur.actif,
        statut: livreur.statut,
        localisation: livreur.localisation,
        commandeActuelle: livreur.commandeActuelle,
      },
    });
  } catch (error) {
    console.error("PROFIL LIVREUR ERROR:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ===============================
// CHANGER STATUT LIVREUR
// ===============================
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

    livreur.statut = statut;

    await livreur.save();

    res.status(200).json({
      message: "Statut mis à jour",
      statut: livreur.statut,
    });
  } catch (error) {
    console.error("CHANGEMENT STATUT LIVREUR ERROR:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ===============================
// METTRE À JOUR LOCALISATION GPS
// ===============================
exports.mettreAJourLocalisation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    // Vérification
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

    // Vérification coordonnées
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

    // ==================================================
    // SAUVEGARDE GPS
    // ==================================================

    const maintenant = new Date();

    livreur.localisation = {
      latitude: lat,
      longitude: lng,
      derniereMiseAJour: maintenant,
    };

    await livreur.save();

    // ==================================================
    // DIFFUSION TEMPS RÉEL
    // ==================================================

    const io = req.app.get("io");

    if (io && livreur.commandeActuelle) {
      io.to(`commande:${livreur.commandeActuelle}`).emit("livreur_position", {
        commandeId: livreur.commandeActuelle.toString(),

        livreurId: livreur._id.toString(),

        latitude: lat,

        longitude: lng,

        derniereMiseAJour: maintenant,
      });
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

// ===============================
// COMMANDES DU LIVREUR
// ===============================
exports.mesCommandes = async (req, res) => {
  try {
    const commandes = await Commandeapi.find({
      "livraison.livreurId": req.livreur._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      commandes,
    });
  } catch (error) {
    console.error("COMMANDES LIVREUR ERROR:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ACCEPTER UNE COMMANDE
// ===============================
// ===============================
// ACCEPTER UNE COMMANDE
// SEARCHING → ACCEPTED
// ===============================
exports.accepterCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const livreur = await Livreur.findById(req.livreur._id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    if (!livreur.actif) {
      return res.status(403).json({
        message: "Votre compte livreur est désactivé",
      });
    }

    if (livreur.commandeActuelle) {
      return res.status(400).json({
        message: "Vous avez déjà une commande en cours",
      });
    }

    if (livreur.statut !== "AVAILABLE") {
      return res.status(400).json({
        message: "Vous devez être disponible pour accepter une commande",
      });
    }

    // ==========================================
    // ATTRIBUTION ATOMIQUE
    // ==========================================

    const commande = await Commandeapi.findOneAndUpdate(
      {
        _id: id,

        // 🔒 L'ADMIN DOIT AVOIR CONFIRMÉ
        statusCommande: "CONFIRMED",

        // 🔒 LA COMMANDE DOIT ÊTRE DISPONIBLE
        "livraison.statut": "SEARCHING",

        // 🔒 AUCUN AUTRE LIVREUR
        $or: [
          { "livraison.livreurId": null },
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
          "livraison.assigneeAt": new Date(),
          "livraison.accepteAt": new Date(),
          "livraison.statut": "ACCEPTED",
        },
      },
      {
        new: true,
      },
    );

    if (!commande) {
      return res.status(409).json({
        message:
          "Cette commande n'est plus disponible. Elle a probablement déjà été prise par un autre livreur.",
      });
    }

    // ==========================================
    // OCCUPER LE LIVREUR
    // ==========================================

    livreur.statut = "BUSY";
    livreur.commandeActuelle = commande._id;

    await livreur.save();

    // ======================================================
    // NOTIFICATION CLIENT + ROOM COMMANDE
    // ======================================================

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      const clientId = commande.client.userId.toString();

      // Notification personnelle du client
      io.to(`user:${clientId}`).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "ACCEPTED",

        livreurId: livreur._id.toString(),

        livreur: {
          id: livreur._id.toString(),

          username: livreur.username,

          telephone: livreur.telephone,

          localisation: livreur.localisation,
        },
      });

      // Notification dans la room de la commande
      io.to(`commande:${commande._id}`).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "ACCEPTED",

        livreurId: livreur._id.toString(),

        livreur: {
          id: livreur._id.toString(),

          username: livreur.username,

          telephone: livreur.telephone,

          localisation: livreur.localisation,
        },
      });
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
// ===============================
// LANCER LA RECHERCHE D'UN LIVREUR
// UNIQUEMENT APRÈS CONFIRMATION ADMIN
// CONFIRMED + NOT_STARTED → SEARCHING
// ===============================
exports.rechercherLivreur = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    // ==========================================
    // SÉCURITÉ : LA COMMANDE DOIT APPARTENIR
    // AU CLIENT CONNECTÉ
    // ==========================================

    if (commande.client.userId.toString() !== req.auth.userId.toString()) {
      return res.status(403).json({
        message: "Cette commande ne vous appartient pas",
      });
    }

    // ==========================================
    // 🔒 SÉCURITÉ PRINCIPALE
    // L'ADMIN DOIT AVOIR CONFIRMÉ LA COMMANDE
    // ==========================================

    if (commande.statusCommande !== "CONFIRMED") {
      return res.status(403).json({
        message:
          "La livraison ne peut pas être demandée avant la confirmation de la commande par l'administrateur Veuillez patienter. Vous pouvez voir votre commande dans votre espace compte. Pour choisir un livreur  il suffit de cliquer sur la commande. RDV dans votre compte client.",
        statusCommande: commande.statusCommande,
      });
    }

    // ==========================================
    // LA RECHERCHE NE PEUT ÊTRE LANCÉE
    // QU'UNE SEULE FOIS
    // ==========================================

    if (commande.livraison.statut !== "NOT_STARTED") {
      return res.status(400).json({
        message: "La recherche d'un livreur est déjà lancée",
        statut: commande.livraison.statut,
      });
    }

    // ==========================================
    // CALCUL DE SÉCURITÉ DU TOTAL
    // ==========================================

    if (
      commande.totalProduits === undefined ||
      commande.totalProduits === null
    ) {
      commande.totalProduits = commande.panier.reduce(
        (total, item) =>
          total + Number(item.prix || 0) * Number(item.quantite || 0),
        0,
      );
    }

    // ==========================================
    // LANCER LA RECHERCHE
    // ==========================================

    commande.livraison.statut = "SEARCHING";

    await commande.save();

    // ==========================================
    // NOTIFICATION TEMPS RÉEL AUX LIVREURS
    // ==========================================

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

exports.commandesDisponibles = async (req, res) => {
  try {
    const commandes = await Commandeapi.find({
      // 🔒 UNIQUEMENT LES COMMANDES CONFIRMÉES PAR L'ADMIN
      statusCommande: "CONFIRMED",

      // 🔒 LE CLIENT A DEMANDÉ UN LIVREUR
      "livraison.statut": "SEARCHING",

      // 🔒 AUCUN LIVREUR ATTRIBUÉ
      $or: [
        { "livraison.livreurId": null },
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

// ===============================
// COMMENCER LA RÉCUPÉRATION
// ACCEPTED → PICKING_UP
// ===============================
exports.commencerRecuperation = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    if (
      !commande.livraison?.livreurId ||
      commande.livraison.livreurId.toString() !== req.livreur._id.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous est pas attribuée",
      });
    }

    if (commande.livraison.statut !== "ACCEPTED") {
      return res.status(400).json({
        message: "La commande ne peut pas commencer la récupération",
        statut: commande.livraison.statut,
      });
    }

    commande.livraison.statut = "PICKING_UP";

    await commande.save();

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      io.to(`user:${commande.client.userId}`).emit("commande_update", {
        id: commande._id.toString(),
        statutLivraison: "PICKING_UP",
      });

      io.to(`commande:${commande._id}`).emit("commande_update", {
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

// ===============================
// COMMANDE RÉCUPÉRÉE
// PICKING_UP → IN_DELIVERY
// ===============================
exports.recupererCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    if (
      !commande.livraison?.livreurId ||
      commande.livraison.livreurId.toString() !== req.livreur._id.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous est pas attribuée",
      });
    }

    if (commande.livraison.statut !== "PICKING_UP") {
      return res.status(400).json({
        message: "La commande n'est pas en cours de récupération",
        statut: commande.livraison.statut,
      });
    }

    commande.livraison.statut = "IN_DELIVERY";

    await commande.save();

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      io.to(`user:${commande.client.userId}`).emit("commande_update", {
        id: commande._id.toString(),
        statutLivraison: "IN_DELIVERY",
      });

      io.to(`commande:${commande._id}`).emit("commande_update", {
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

// ===============================
// LIVRER LA COMMANDE
// IN_DELIVERY → DELIVERED
// ===============================
exports.livrerCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    if (
      !commande.livraison?.livreurId ||
      commande.livraison.livreurId.toString() !== req.livreur._id.toString()
    ) {
      return res.status(403).json({
        message: "Cette commande ne vous est pas attribuée",
      });
    }

    if (commande.livraison.statut !== "IN_DELIVERY") {
      return res.status(400).json({
        message: "Cette commande n'est pas en cours de livraison",
        statut: commande.livraison.statut,
      });
    }

    commande.livraison.statut = "DELIVERED";
    commande.livraison.livreAt = new Date();

    // Libérer le livreur
    req.livreur.commandeActuelle = null;
    req.livreur.statut = "AVAILABLE";

    await commande.save();
    await req.livreur.save();

    const io = req.app.get("io");

    if (io && commande.client?.userId) {
      io.to(`user:${commande.client.userId}`).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "DELIVERED",

        livreurId: req.livreur._id.toString(),
      });

      io.to(`commande:${commande._id}`).emit("commande_update", {
        id: commande._id.toString(),

        statutLivraison: "DELIVERED",

        livreurId: req.livreur._id.toString(),
      });
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
