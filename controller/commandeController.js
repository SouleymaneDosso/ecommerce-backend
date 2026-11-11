const Commandeapi = require("../models/paiementmodel");
const Product = require("../models/produits");
const User = require("../models/User");

const {
  sendNewOrderEmail,
  sendPaymentSubmittedEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
  sendOrderDeliveredEmail,
  sendConfirmationEmail,
} = require("../controller/notificationController");

// ==========================================
// OUTILS
// ==========================================

const generateReference = (commandeId, step) => {
  return `${commandeId}-STEP${step}-${Date.now()}`;
};

const creerErreur = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const notifierClient = (req, commande, donnees = {}) => {
  const io = req.app.get("io");

  if (io) {
    io.to(`user:${commande.client.userId}`).emit("commande_update", {
      id: commande._id.toString(),
      statusCommande: commande.statusCommande,
      ...donnees,
    });
  }
};

const envoyerEmailSansBloquer = async (callback) => {
  try {
    await callback();
  } catch (error) {
    console.error("Erreur envoi email:", error);
  }
};

// Gestion des Maps Mongoose et des objets classiques
const lireValeurMap = (map, key) => {
  if (map instanceof Map || map?.get) {
    return map.get(key);
  }

  return map?.[key];
};

const definirValeurMap = (map, key, value) => {
  if (map instanceof Map || map?.set) {
    map.set(key, value);
  } else {
    map[key] = value;
  }
};

const mapNonVide = (map) => {
  if (!map) return false;

  if (map instanceof Map || map?.entries) {
    return map.size > 0;
  }

  return Object.keys(map).length > 0;
};

// ==========================================
// GESTION DU STOCK
// ==========================================

const modifierStockProduit = (produit, item, sens) => {
  const quantite = Number(item.quantite);

  if (!Number.isInteger(quantite) || quantite <= 0) {
    throw creerErreur("Quantité invalide", 400);
  }

  const variations = produit.stockParVariation;
  const possedeVariations = mapNonVide(variations);

  // CAS 1 : PRODUIT AVEC VARIATIONS
  if (possedeVariations) {
    if (!item.couleur || !item.taille) {
      throw creerErreur(
        `Veuillez choisir une couleur et une taille pour ${item.nom}`,
        400,
      );
    }

    const normaliser = (valeur) => String(valeur).trim().toLowerCase();

    // Retrouver la vraie clé, sans tenir compte des majuscules
    const trouverCle = (map, valeur) => {
      if (!map) return undefined;

      const entrees =
        map instanceof Map ? [...map.entries()] : Object.entries(map);

      const entree = entrees.find(
        ([cle]) => normaliser(cle) === normaliser(valeur),
      );

      return entree ? entree[0] : undefined;
    };

    const couleurCle = trouverCle(variations, item.couleur);

    if (couleurCle === undefined) {
      throw creerErreur(
        `Couleur ${item.couleur} introuvable pour ${item.nom}`,
        409,
      );
    }

    const taillesMap = lireValeurMap(variations, couleurCle);

    const tailleCle = trouverCle(taillesMap, item.taille);

    if (tailleCle === undefined) {
      throw creerErreur(
        `Taille ${item.taille} introuvable pour ${item.nom}`,
        409,
      );
    }

    const stockVariation = Number(lireValeurMap(taillesMap, tailleCle) || 0);

    if (sens === -1 && stockVariation < quantite) {
      throw creerErreur(
        `Stock insuffisant pour ${item.nom} (${item.couleur} / ${item.taille}). Stock disponible : ${stockVariation}`,
        409,
      );
    }

    const nouveauStock = stockVariation + sens * quantite;

    if (nouveauStock < 0) {
      throw creerErreur("Stock insuffisant", 409);
    }

    definirValeurMap(taillesMap, tailleCle, nouveauStock);
    definirValeurMap(variations, couleurCle, taillesMap);

    // Important : on ne touche pas au stock global ici.
    return;
  }

  // CAS 2 : PRODUIT SANS VARIATIONS
  const stockGlobal = Number(produit.stock || 0);

  if (sens === -1 && stockGlobal < quantite) {
    throw creerErreur(
      `Stock insuffisant pour ${item.nom}. Stock disponible : ${stockGlobal}`,
      409,
    );
  }

  const nouveauStock = stockGlobal + sens * quantite;

  if (nouveauStock < 0) {
    throw creerErreur("Stock insuffisant", 409);
  }

  produit.stock = nouveauStock;
};

const appliquerStockCommande = async (commande, session, sens) => {
  if (sens !== -1 && sens !== 1) {
    throw creerErreur("Sens de modification du stock invalide", 400);
  }

  if (!Array.isArray(commande.panier) || commande.panier.length === 0) {
    throw creerErreur("Le panier de la commande est vide", 400);
  }

  const produitsIds = [
    ...new Set(commande.panier.map((item) => String(item.produitId))),
  ];

  const produits = await Product.find({
    _id: { $in: produitsIds },
  }).session(session);

  const produitsMap = new Map(
    produits.map((produit) => [String(produit._id), produit]),
  );

  for (const item of commande.panier) {
    const produit = produitsMap.get(String(item.produitId));

    if (!produit) {
      throw creerErreur(`Produit introuvable : ${item.nom}`, 404);
    }

    modifierStockProduit(produit, item, sens);

    await produit.save({ session });
  }
};

// ==========================================
// CRÉATION COMMANDE
// ==========================================

const creerCommande = async (req, res) => {
  const session = await Commandeapi.startSession();

  try {
    const { client, panier, modePaiement, servicePaiement } = req.body;

    if (!client || !Array.isArray(panier) || panier.length === 0) {
      throw creerErreur("Client et panier requis");
    }

    if (!["full", "installments", "cod"].includes(modePaiement)) {
      throw creerErreur("Mode de paiement invalide");
    }

    // 1. Création du snapshot du panier
    const panierSnapshot = await Promise.all(
      panier.map(async (item) => {
        const product = await Product.findById(item.produitId);

        if (!product) {
          throw creerErreur(`Produit introuvable : ${item.produitId}`);
        }

        const quantite = Number(item.quantite);

        if (!Number.isInteger(quantite) || quantite <= 0) {
          throw creerErreur(`Quantité invalide pour ${product.title}`);
        }

        return {
          produitId: product._id,
          nom: product.title,
          prix: Number(product.price),
          image: product.images?.find((img) => img.isMain)?.url || "",
          quantite,
          couleur: item.couleur,
          taille: item.taille,
        };
      }),
    );

    // 2. Calcul du total
    const totalProduits = panierSnapshot.reduce(
      (total, item) => total + item.prix * item.quantite,
      0,
    );

    const fraisLivraison = 0;
    const total = totalProduits;

    let nouvelleCommande;

    // 3. Réservation du stock et création de commande
    // Tout est exécuté dans la même transaction.
    await session.withTransaction(async () => {
      nouvelleCommande = new Commandeapi({
        client: {
          userId: req.auth.userId,
          ...client,
        },

        panier: panierSnapshot,

        totalProduits,
        fraisLivraison,
        total,

        modePaiement,

        servicePaiement: modePaiement === "cod" ? "livraison" : servicePaiement,

        paiements: [],
        paiementsRecus: [],

        // COD est automatiquement confirmé.
        statusCommande: modePaiement === "cod" ? "CONFIRMED" : "PENDING",

        // Indicateurs de réservation et de restitution.
        stockReserve: true,
        stockRestitue: false,

        username: client.username || "Client",
        numero: client.numero || 0,
      });

      nouvelleCommande.numeroCommande = `NUMA-${new Date().getFullYear()}-${nouvelleCommande._id
        .toString()
        .slice(-8)
        .toUpperCase()}`;

      // 4. Création des étapes de paiement
      if (modePaiement === "installments") {
        const montantParEtape = Math.ceil(total / 3);

        for (let i = 1; i <= 3; i++) {
          const montant =
            i === 3 ? total - montantParEtape * 2 : montantParEtape;

          nouvelleCommande.paiements.push({
            step: i,
            amountExpected: montant,
            status: "UNPAID",
            reference: generateReference(nouvelleCommande._id, i),
          });
        }
      } else if (modePaiement === "full") {
        nouvelleCommande.paiements.push({
          step: 1,
          amountExpected: total,
          status: "UNPAID",
          reference: generateReference(nouvelleCommande._id, 1),
        });
      }

      // 5. Réserver immédiatement le stock
      await appliquerStockCommande(nouvelleCommande, session, -1);

      // 6. Sauvegarder la commande
      await nouvelleCommande.save({ session });
    });

    // 7. Notifications après validation de la transaction
    const user = await User.findById(req.auth.userId);

    if (user?.email) {
      await envoyerEmailSansBloquer(() =>
        sendNewOrderEmail(user.email, nouvelleCommande),
      );

      if (modePaiement === "cod") {
        const username =
          `${client.prenom || ""} ${client.nom || ""}`.trim() ||
          user.username ||
          "Client";

        await envoyerEmailSansBloquer(() =>
          sendConfirmationEmail(user.email, nouvelleCommande._id, username),
        );
      }
    }

    notifierClient(req, nouvelleCommande);

    return res.status(201).json({
      message:
        modePaiement === "cod"
          ? "Commande créée et confirmée. Stock réservé."
          : "Commande créée. Stock réservé.",
      commande: nouvelleCommande,
    });
  } catch (err) {
    console.error("CREATION COMMANDE ERROR:", err);

    return res.status(err.status || 500).json({
      message: err.message || "Erreur lors de la création de la commande",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// GET COMMANDE PAR ID
// ==========================================

const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findOne({
      _id: id,
      "client.userId": req.auth.userId,
    }).populate({
      path: "livraison.livreurId",
      select: "username telephone statut localisation commandeActuelle",
    });

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    const commandeData = commande.toObject();

    if (commandeData.livraison) {
      commandeData.livraison.livreur = commandeData.livraison.livreurId || null;
    }

    return res.status(200).json({
      commande: commandeData,
    });
  } catch (err) {
    console.error("GET COMMANDE ERROR:", err);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ==========================================
// GET COMMANDES ADMIN
// ==========================================

const getCommandesAdmin = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const total = await Commandeapi.countDocuments();

    const commandes = await Commandeapi.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      commandes: commandes.map((cmd) => ({
        ...cmd,
        panier: cmd.panier || [],
      })),
    });
  } catch (err) {
    console.error("getCommandesAdmin:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// PAIEMENT SEMI-MANUEL CLIENT
// ==========================================

const paiementSemi = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, numeroClient, montantEnvoye, reference, service } = req.body;

    if (!step || !numeroClient || !montantEnvoye || !reference || !service) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    const commande = await Commandeapi.findOne({
      _id: id,
      "client.userId": req.auth.userId,
    });

    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    if (commande.statusCommande === "CANCELLED") {
      return res.status(400).json({
        message: "Cette commande a été annulée.",
      });
    }

    if (commande.modePaiement === "cod") {
      return res.status(400).json({
        message: "Paiement non requis avant la livraison pour une commande COD",
      });
    }

    const prochainPaiement = commande.paiements.find(
      (p) => p.status !== "PAID",
    );

    if (!prochainPaiement) {
      return res.status(400).json({
        message: "Tous les paiements sont déjà réglés.",
      });
    }

    if (Number(step) !== prochainPaiement.step) {
      return res.status(400).json({
        message: `Vous devez payer la tranche ${prochainPaiement.step}.`,
      });
    }

    if (prochainPaiement.status === "PENDING") {
      return res.status(400).json({
        message: "Cette tranche est déjà en attente de validation.",
      });
    }

    const montant = Number(montantEnvoye);

    if (!Number.isFinite(montant) || montant <= 0) {
      return res.status(400).json({ message: "Montant invalide." });
    }

    if (montant < prochainPaiement.amountExpected) {
      return res.status(400).json({
        message: `Le montant attendu est de ${prochainPaiement.amountExpected} FCFA.`,
      });
    }

    commande.paiementsRecus.push({
      step: Number(step),
      service,
      numeroClient,
      reference,
      montantEnvoye: montant,
      status: "PENDING",
      submittedAt: new Date(),
    });

    prochainPaiement.status = "PENDING";

    await commande.save();

    const clientUser = await User.findById(commande.client.userId);

    if (clientUser?.email) {
      await envoyerEmailSansBloquer(() =>
        sendPaymentSubmittedEmail(
          clientUser.email,
          step,
          montant,
          commande._id,
          clientUser.username || "Client",
        ),
      );
    }

    return res.status(200).json({
      message: "Paiement soumis, en attente de validation admin",
      commande,
    });
  } catch (err) {
    console.error("PAIEMENT SEMI ERROR:", err);

    return res.status(500).json({
      message: "Erreur paiement semi-manuel",
    });
  }
};

// ==========================================
// CONFIRMER PAIEMENT ADMIN
// IMPORTANT : AUCUNE MODIFICATION DU STOCK ICI
// ==========================================

const confirmerPaiementAdmin = async (req, res) => {
  const session = await Commandeapi.startSession();

  try {
    const { id } = req.params;
    const { paiementRecuId, adminComment } = req.body;

    let commande;

    await session.withTransaction(async () => {
      commande = await Commandeapi.findById(id).session(session);

      if (!commande) {
        throw creerErreur("Commande introuvable", 404);
      }

      if (commande.statusCommande === "CANCELLED") {
        throw creerErreur("Cette commande a été annulée.", 400);
      }

      if (commande.modePaiement === "cod") {
        throw creerErreur("Cette commande est payable à la livraison.", 400);
      }

      const paiementRecu = commande.paiementsRecus.id(paiementRecuId);

      if (!paiementRecu) {
        throw creerErreur("Paiement non trouvé", 404);
      }

      if (paiementRecu.status !== "PENDING") {
        throw creerErreur("Ce paiement n'est plus en attente de validation.");
      }

      const paiementStep = commande.paiements.find(
        (p) => p.step === paiementRecu.step,
      );

      if (!paiementStep || paiementStep.status !== "PENDING") {
        throw creerErreur("Étape de paiement invalide.");
      }

      paiementRecu.status = "CONFIRMED";
      paiementRecu.confirmedAt = new Date();
      paiementRecu.adminComment = adminComment || "";

      paiementStep.status = "PAID";
      paiementStep.validatedAt = new Date();

      const tousLesPaiementsSontRegles = commande.paiements.every(
        (p) => p.status === "PAID",
      );

      if (tousLesPaiementsSontRegles) {
        commande.statusCommande = "CONFIRMED";
        commande.isPaid = true;
        commande.paidAt = new Date();
      } else {
        commande.statusCommande = "PARTIALLY_PAID";
        commande.isPaid = false;
        commande.paidAt = null;
      }

      // Le stock a déjà été réservé lors de la création.
      // Ne surtout pas le décrémenter ici.

      await commande.save({ session });
    });

    notifierClient(req, commande, {
      paiements: commande.paiements,
    });

    const clientUser = await User.findById(commande.client.userId);

    if (clientUser?.email) {
      const paiementRecu = commande.paiementsRecus.id(paiementRecuId);

      await envoyerEmailSansBloquer(() =>
        sendPaymentConfirmedEmail(
          clientUser.email,
          paiementRecu.step,
          paiementRecu.montantEnvoye,
          commande._id,
          clientUser.username || "Client",
        ),
      );
    }

    return res.status(200).json({
      message: "Paiement confirmé. Le stock était déjà réservé.",
      commande,
    });
  } catch (err) {
    console.error("confirmerPaiementAdmin:", err);

    return res.status(err.status || 500).json({
      message: err.message || "Erreur lors de la confirmation du paiement",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// REJETER PAIEMENT ADMIN
// AUCUNE RESTITUTION DE STOCK ICI
// ==========================================

const rejeterPaiementAdmin = async (req, res) => {
  const session = await Commandeapi.startSession();

  try {
    const { id } = req.params;
    const { paiementRecuId, adminComment } = req.body;

    let commande;

    await session.withTransaction(async () => {
      commande = await Commandeapi.findById(id).session(session);

      if (!commande) {
        throw creerErreur("Commande introuvable", 404);
      }

      if (commande.statusCommande === "CANCELLED") {
        throw creerErreur("Cette commande a été annulée.");
      }

      const paiementRecu = commande.paiementsRecus.id(paiementRecuId);

      if (!paiementRecu) {
        throw creerErreur("Paiement non trouvé", 404);
      }

      if (paiementRecu.status !== "PENDING") {
        throw creerErreur("Seul un paiement en attente peut être rejeté.");
      }

      paiementRecu.status = "REJECTED";
      paiementRecu.adminComment = adminComment || "";
      paiementRecu.confirmedAt = null;

      const paiementStep = commande.paiements.find(
        (p) => p.step === paiementRecu.step,
      );

      if (paiementStep) {
        paiementStep.status = "UNPAID";
        paiementStep.validatedAt = null;
      }

      const tousPayes = commande.paiements.every((p) => p.status === "PAID");

      const auMoinsUnPaye = commande.paiements.some((p) => p.status === "PAID");

      const autrePaiementEnAttente = commande.paiements.some(
        (p) => p.status === "PENDING",
      );

      if (tousPayes) {
        commande.statusCommande = "CONFIRMED";
        commande.isPaid = true;
        commande.paidAt = commande.paidAt || new Date();
      } else if (auMoinsUnPaye || autrePaiementEnAttente) {
        commande.statusCommande = "PARTIALLY_PAID";
        commande.isPaid = false;
      } else {
        commande.statusCommande = "PENDING";
        commande.isPaid = false;
        commande.paidAt = null;
      }

      // Le stock reste réservé malgré le rejet d'un paiement.
      await commande.save({ session });
    });

    const paiementRecu = commande.paiementsRecus.id(paiementRecuId);

    notifierClient(req, commande, {
      paiementRejete: {
        _id: paiementRecu._id.toString(),
        step: paiementRecu.step,
        status: paiementRecu.status,
        adminComment: paiementRecu.adminComment,
        montantEnvoye: paiementRecu.montantEnvoye,
        submittedAt: paiementRecu.submittedAt,
      },
    });

    const clientUser = await User.findById(commande.client.userId);

    if (clientUser?.email) {
      const reason =
        "Le paiement a été rejeté par l'administrateur. Veuillez vérifier les informations fournies ou contacter le support.";

      await envoyerEmailSansBloquer(() =>
        sendPaymentRejectedEmail(
          clientUser.email,
          paiementRecu.step,
          paiementRecu.montantEnvoye,
          commande._id,
          paiementRecu.adminComment,
          clientUser.username || "Client",
          reason,
        ),
      );
    }

    return res.status(200).json({
      message: "Paiement rejeté. Le stock reste réservé.",
      commande,
    });
  } catch (err) {
    console.error("rejeterPaiementAdmin:", err);

    return res.status(err.status || 500).json({
      message: err.message || "Erreur lors du rejet du paiement",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// CONFIRMATION COD
// COD EST DÉJÀ CONFIRMÉ À LA CRÉATION
// ==========================================

const confirmerCommandeCOD = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    if (commande.modePaiement !== "cod") {
      return res.status(400).json({ message: "Pas une commande COD" });
    }

    if (commande.statusCommande === "CANCELLED") {
      return res.status(400).json({
        message: "Cette commande a été annulée.",
      });
    }

    // La commande est automatiquement confirmée à sa création.
    if (commande.statusCommande !== "CONFIRMED") {
      commande.statusCommande = "CONFIRMED";
      await commande.save();
    }

    notifierClient(req, commande);

    return res.status(200).json({
      message: "Commande COD confirmée.",
      commande,
    });
  } catch (err) {
    console.error("CONFIRMATION COD ERROR:", err);

    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// MARQUER COMME EXPÉDIÉ
// ==========================================

const marquerCommeExpedie = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    if (commande.statusCommande === "CANCELLED") {
      return res.status(400).json({
        message: "Une commande annulée ne peut pas être expédiée.",
      });
    }

    if (commande.statusCommande !== "CONFIRMED") {
      return res.status(400).json({
        message: "La commande doit être confirmée avant expédition.",
      });
    }

    commande.statusCommande = "SHIPPED";

    await commande.save();

    notifierClient(req, commande);

    return res.status(200).json({
      message: "Commande en cours de livraison",
      commande,
    });
  } catch (err) {
    console.error("EXPEDITION ERROR:", err);

    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// MARQUER COMME LIVRÉ
// AUCUNE MODIFICATION DU STOCK ICI
// ==========================================

const marquerCommeLivre = async (req, res) => {
  const session = await Commandeapi.startSession();

  try {
    const { id } = req.params;

    let commande;

    await session.withTransaction(async () => {
      commande = await Commandeapi.findById(id).session(session);

      if (!commande) {
        throw creerErreur("Commande introuvable", 404);
      }

      if (commande.statusCommande === "DELIVERED") {
        throw creerErreur("Cette commande est déjà livrée.");
      }

      if (commande.statusCommande === "CANCELLED") {
        throw creerErreur("Cette commande a été annulée.");
      }

      if (commande.statusCommande !== "SHIPPED") {
        throw creerErreur("La commande doit être expédiée avant livraison.");
      }

      if (commande.modePaiement === "cod") {
        // Paiement COD réglé à la livraison.
        commande.isPaid = true;
        commande.paidAt = new Date();
      } else {
        const tousLesPaiementsSontRegles = commande.paiements.every(
          (p) => p.status === "PAID",
        );

        if (!tousLesPaiementsSontRegles || !commande.isPaid) {
          throw creerErreur(
            "La commande ne peut être livrée avant la confirmation de tous les paiements.",
          );
        }
      }

      commande.statusCommande = "DELIVERED";

      // Le stock a été réservé à la création.
      // Aucune décrémentation à la livraison.

      await commande.save({ session });
    });

    notifierClient(req, commande);

    const clientUser = await User.findById(commande.client.userId);

    if (clientUser?.email) {
      await envoyerEmailSansBloquer(() =>
        sendOrderDeliveredEmail(
          clientUser.email,
          commande._id,
          clientUser.username || "Client",
        ),
      );
    }

    return res.status(200).json({
      message: "Commande livrée et paiement validé si nécessaire.",
      commande,
    });
  } catch (err) {
    console.error("LIVRAISON ERROR:", err);

    return res.status(err.status || 500).json({
      message: err.message || "Erreur lors de la livraison",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// ANNULER COMMANDE ADMIN
// RESTITUTION DU STOCK UNE SEULE FOIS
// ==========================================

const annulerCommandeAdmin = async (req, res) => {
  const session = await Commandeapi.startSession();

  try {
    const { id } = req.params;
    const { raison } = req.body;

    let commande;

    await session.withTransaction(async () => {
      commande = await Commandeapi.findById(id).session(session);

      if (!commande) {
        throw creerErreur("Commande introuvable", 404);
      }

      if (commande.statusCommande === "CANCELLED") {
        throw creerErreur("Cette commande est déjà annulée.");
      }

      if (commande.statusCommande === "DELIVERED") {
        throw creerErreur("Une commande déjà livrée ne peut pas être annulée.");
      }

      if (commande.statusCommande === "SHIPPED") {
        throw creerErreur(
          "Une commande déjà expédiée ne peut plus être annulée ici.",
        );
      }

      // Restituer uniquement si le stock avait bien été réservé
      // et n'a pas déjà été restitué.
      if (commande.stockReserve === true && commande.stockRestitue !== true) {
        await appliquerStockCommande(commande, session, 1);

        commande.stockRestitue = true;
      }

      commande.statusCommande = "CANCELLED";

      if (raison) {
        commande.commentaireAnnulation = raison;
      }

      await commande.save({ session });
    });

    notifierClient(req, commande, {
      raisonAnnulation: raison || "",
    });

    return res.status(200).json({
      message:
        commande.stockReserve === true
          ? "Commande annulée et stock restitué."
          : "Commande annulée. Aucun stock n'a été restitué car cette ancienne commande n'avait pas de réservation enregistrée.",
      commande,
    });
  } catch (err) {
    console.error("ANNULATION COMMANDE ERROR:", err);

    return res.status(err.status || 500).json({
      message: err.message || "Erreur lors de l'annulation de la commande",
    });
  } finally {
    await session.endSession();
  }
};

// ==========================================
// POSITION GPS CLIENT
// ==========================================

const mettreAJourLocalisationClient = async (req, res) => {
  try {
    const { id } = req.params;
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

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable",
      });
    }

    if (commande.client.userId.toString() !== req.auth.userId.toString()) {
      return res.status(403).json({
        message: "Cette commande ne vous appartient pas",
      });
    }

    const maintenant = new Date();

    commande.client.localisation = {
      latitude: lat,
      longitude: lng,
      derniereMiseAJour: maintenant,
    };

    await commande.save();

    const io = req.app.get("io");

    if (io) {
      io.to(`commande:${commande._id}`).emit("client_position", {
        commandeId: commande._id.toString(),
        clientId: commande.client.userId.toString(),
        latitude: lat,
        longitude: lng,
        derniereMiseAJour: maintenant,
      });
    }

    return res.status(200).json({
      message: "Position client mise à jour",
      localisation: commande.client.localisation,
    });
  } catch (error) {
    console.error("GPS CLIENT ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

// ==========================================
// RECHERCHER COMMANDE PAR NUMÉRO
// ==========================================

const rechercherCommandeParNumero = async (req, res) => {
  try {
    const numeroCommande = req.params.numeroCommande.trim().toUpperCase();

    if (!numeroCommande) {
      return res.status(400).json({
        message: "Numéro de commande requis",
      });
    }

    const commande = await Commandeapi.findOne({
      numeroCommande,
      "client.userId": req.auth.userId,
    }).select(
      "numeroCommande client panier total totalProduits fraisLivraison statusCommande createdAt",
    );

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable. Vérifiez votre numéro de commande.",
      });
    }

    return res.status(200).json({
      message: "Commande retrouvée",
      commande,
    });
  } catch (error) {
    console.error("RECHERCHE COMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la recherche de la commande",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  paiementSemi,
  marquerCommeExpedie,
  confirmerPaiementAdmin,
  rejeterPaiementAdmin,
  confirmerCommandeCOD,
  marquerCommeLivre,
  annulerCommandeAdmin,
  mettreAJourLocalisationClient,
  rechercherCommandeParNumero,
};
