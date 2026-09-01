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
// METTRE À JOUR LOCALISATION
// ===============================
exports.mettreAJourLocalisation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "Latitude et longitude requises",
      });
    }

    const livreur = await Livreur.findById(req.livreur._id);

    if (!livreur) {
      return res.status(404).json({
        message: "Livreur introuvable",
      });
    }

    livreur.localisation = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      derniereMiseAJour: new Date(),
    };

    await livreur.save();

    res.status(200).json({
      message: "Localisation mise à jour",
      localisation: livreur.localisation,
    });
  } catch (error) {
    console.error("GPS LIVREUR ERROR:", error);

    res.status(500).json({
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

// ===============================
// ACCEPTER UNE COMMANDE
// ===============================
exports.accepterCommande = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    // Vérifier que la commande est bien attribuée à ce livreur
   // ===============================
// ACCEPTER UNE COMMANDE
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

    // Un livreur ne peut avoir qu'une seule livraison active
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

    /*
     * IMPORTANT :
     * On cherche uniquement une commande :
     * - encore en recherche
     * - sans livreur
     *
     * findOneAndUpdate permet d'éviter que deux livreurs
     * prennent la même commande simultanément.
     */
    const commande = await Commandeapi.findOneAndUpdate(
      {
        _id: id,
        "livraison.statut": "SEARCHING",
        "livraison.livreurId": null,
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

    // Le livreur devient occupé
    livreur.statut = "BUSY";
    livreur.commandeActuelle = commande._id;

    await livreur.save();

    // ===============================
    // NOTIFICATION CLIENT
    // ===============================

    const io = req.app.get("io");

    if (io) {
      io.to(commande.client.userId.toString()).emit(
        "commande_update",
        {
          id: commande._id,
          statutLivraison: "ACCEPTED",
          livreurId: livreur._id,
          livreur: {
            id: livreur._id,
            username: livreur.username,
            telephone: livreur.telephone,
            localisation: livreur.localisation,
          },
        },
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

    // Vérifier si le livreur a déjà une commande
    if (req.livreur.commandeActuelle) {
      return res.status(400).json({
        message: "Vous avez déjà une commande en cours",
      });
    }

    // Vérifier le statut de la livraison
    if (commande.livraison.statut !== "REQUESTED") {
      return res.status(400).json({
        message: "Cette commande ne peut pas être acceptée",
      });
    }

    // ===============================
    // ACCEPTER
    // ===============================

    commande.livraison.accepteAt = new Date();
    commande.livraison.statut = "ACCEPTED";

    // Livreurr occupé
    req.livreur.statut = "BUSY";
    req.livreur.commandeActuelle = commande._id;

    await commande.save();
    await req.livreur.save();

    // ===============================
    // NOTIFIER LE CLIENT
    // ===============================

    const io = req.app.get("io");

    if (io) {
      io.to(commande.client.userId.toString()).emit("commande_update", {
        id: commande._id,
        statutLivraison: "ACCEPTED",
        livreurId: req.livreur._id,
      });
    }

    res.status(200).json({
      message: "Commande acceptée",
      commande,
    });
  } catch (error) {
    console.error("ACCEPTER COMMANDE ERROR:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ===============================
// LANCER LA RECHERCHE D'UN LIVREUR
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

    // Vérifier que la commande appartient bien au client connecté
    if (commande.client.userId.toString() !== req.auth.userId.toString()) {
      return res.status(403).json({
        message: "Cette commande ne vous appartient pas",
      });
    }

    // La recherche ne peut être lancée qu'une seule fois
    if (commande.livraison.statut !== "NOT_STARTED") {
      return res.status(400).json({
        message: "La recherche d'un livreur est déjà lancée",
        statut: commande.livraison.statut,
      });
    }
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
    // Lancer la recherche
    commande.livraison.statut = "SEARCHING";

    await commande.save();

    // Notification temps réel
    const io = req.app.get("io");

    if (io) {
      io.emit("nouvelle_commande_livraison", {
        commandeId: commande._id,
        ville: commande.client.ville,
        adresse: commande.client.adresse,
        totalProduits: commande.totalProduits,
        panier: commande.panier,
      });
    }

    res.status(200).json({
      message: "Recherche de livreur lancée",
      commande,
    });
  } catch (error) {
    console.error("RECHERCHE LIVREUR ERROR:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};


exports.commandesDisponibles = async (req, res) => {
  try {
    const commandes = await Commandeapi.find({
      "livraison.statut": "SEARCHING",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      commandes,
    });
  } catch (error) {
    console.error("COMMANDES DISPONIBLES ERROR:", error);

    res.status(500).json({
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
      commande.livraison.livreurId.toString() !==
        req.livreur._id.toString()
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

    if (io) {
      io.to(commande.client.userId.toString()).emit(
        "commande_update",
        {
          id: commande._id,
          statutLivraison: "PICKING_UP",
        }
      );
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
      commande.livraison.livreurId.toString() !==
        req.livreur._id.toString()
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

    if (io) {
      io.to(commande.client.userId.toString()).emit(
        "commande_update",
        {
          id: commande._id,
          statutLivraison: "IN_DELIVERY",
        }
      );
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
      commande.livraison.livreurId.toString() !==
        req.livreur._id.toString()
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

    if (io) {
      io.to(commande.client.userId.toString()).emit(
        "commande_update",
        {
          id: commande._id,
          statutLivraison: "DELIVERED",
          livreurId: req.livreur._id,
        }
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