const Commandeapi = require("../models/paiementmodel");
const Product = require("../models/produits");
const User = require("../models/User");
const {
  sendNewOrderEmail,
  sendPaymentSubmittedEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
} = require("../controller/notificationController");

// Générer une référence unique pour chaque étape de paiement
const generateReference = (commandeId, step) => {
  return `${commandeId}-STEP${step}-${Date.now()}`;
};

/* =========================
   CREATION COMMANDE
   ========================= */
const creerCommande = async (req, res) => {
  try {
    const {
      client,
      panier,
      modePaiement,
      servicePaiement,
      fraisLivraison,
      total,
    } = req.body;

    if (!client || !panier) {
      return res.status(400).json({ message: "Champs requis manquants" });
    }

    // Créer snapshot du panier
    const panierSnapshot = await Promise.all(
      panier.map(async (item) => {
        const product = await Product.findById(item.produitId);
        if (!product) throw new Error(`Produit introuvable: ${item.produitId}`);

        return {
          produitId: product._id,
          nom: product.title,
          prix: product.price,
          image: product.images.find((img) => img.isMain)?.url || "", // image principale
          quantite: item.quantite,
          couleur: item.couleur,
          taille: item.taille,
        };
      }),
    );

    // Calcul du total depuis les produits pour éviter incohérences
    const totalCalculated = panierSnapshot.reduce(
      (acc, item) => acc + item.prix * item.quantite,
      0,
    );

    const nouvelleCommande = new Commandeapi({
      client: { userId: req.auth.userId, ...client },
      panier: panierSnapshot,
      total: totalCalculated + (fraisLivraison || 0),
      fraisLivraison: fraisLivraison || 0,
      modePaiement,
      servicePaiement: modePaiement === "cod" ? "livraison" : servicePaiement,
      paiements: [],
      paiementsRecus: [],
      statusCommande: "PENDING",
      username: client.username || "Client",
    });

    // Créer les étapes de paiement
    // 🔥 Calcul final sécurisé
    const totalFinal = totalCalculated + (fraisLivraison || 0);

    // Créer les étapes de paiement
    if (modePaiement === "cod") {
      // 🚚 Paiement à la livraison → aucun paiement maintenant
      nouvelleCommande.paiements = [];
      nouvelleCommande.statusCommande = "CONFIRMED";
    } else if (modePaiement === "installments") {
      const montantParEtape = Math.ceil(totalFinal / 3);

      for (let i = 1; i <= 3; i++) {
        let montant = montantParEtape;

        if (i === 3) {
          montant = totalFinal - montantParEtape * 2;
        }

        nouvelleCommande.paiements.push({
          step: i,
          amountExpected: montant,
          status: "UNPAID",
          reference: generateReference(nouvelleCommande._id, i),
        });
      }
    } else {
      nouvelleCommande.paiements.push({
        step: 1,
        amountExpected: totalFinal,
        status: "UNPAID",
        reference: generateReference(nouvelleCommande._id, 1),
      });
    }
    await nouvelleCommande.save();

    const user = await User.findById(req.auth.userId);
    const clientEmail = user.email;

    try {
      await sendNewOrderEmail(clientEmail, nouvelleCommande);
      console.log("✅ Email nouvelle commande envoyé");
    } catch (err) {
      console.error("❌ Erreur envoi email nouvelle commande:", err);
    }

    res.status(201).json({
      message: "Commande créée avec succès",
      commande: nouvelleCommande,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erreur lors de la création de la commande",
      error: err.message,
    });
  }
};

/* =========================
   GET COMMANDE PAR ID
   ========================= */
const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;
    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });
    res.status(200).json(commande);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================
   GET COMMANDES ADMIN
   ========================= */
const getCommandesAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Commandeapi.countDocuments();

    const commandes = await Commandeapi.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // renvoie des objets JS simples

    // Assurer que le panier existe
    const commandesWithPanier = commandes.map((cmd) => ({
      ...cmd,
      panier: cmd.panier || [],
    }));

    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      commandes: commandesWithPanier,
    });
  } catch (err) {
    console.error("❌ getCommandesAdmin:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================
   PAIEMENT SEMI-MANUEL (CLIENT)
   ========================= */
const paiementSemi = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, numeroClient, montantEnvoye, reference, service } = req.body;

    if (!step || !numeroClient || !montantEnvoye || !reference || !service) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    if (commande.modePaiement === "cod") {
      return res.status(400).json({
        message: "Paiement non requis pour livraison",
      });
    }

    const paiementStep = commande.paiements.find(
      (p) => p.step === Number(step),
    );
    if (!paiementStep)
      return res.status(404).json({ message: "Étape invalide" });

    // Ajouter paiement reçu en PENDING
    commande.paiementsRecus.push({
      step: Number(step),
      service,
      numeroClient,
      reference,
      montantEnvoye,
      status: "PENDING",
      submittedAt: new Date(),
    });

    // Marquer l'étape comme PENDING si elle était UNPAID
    if (paiementStep.status === "UNPAID") paiementStep.status = "PENDING";

    await commande.save();
    const clientUser = await User.findById(commande.client.userId);
    const clientEmail = clientUser?.email;

    if (clientEmail) {
      await sendPaymentSubmittedEmail(
        clientEmail,
        step,
        montantEnvoye,
        commande._id,
        clientUser?.username || "Client",
      );
      console.log("✅ Email paiement soumis envoyé");
    } else {
      console.error("❌ Impossible d'envoyer l'email: email client manquant");
    }

    res.status(200).json({
      message: "Paiement soumis, en attente de validation admin",
      commande,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur paiement semi-manuel" });
  }
};

/* =========================
   CONFIRMER PAIEMENT (ADMIN)
   ========================= */
const confirmerPaiementAdmin = async (req, res) => {
  const session = await Commandeapi.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { paiementRecuId, adminComment } = req.body;

    const commande = await Commandeapi.findById(id).session(session);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    const paiementRecu = commande.paiementsRecus.id(paiementRecuId);
    if (!paiementRecu)
      return res.status(404).json({ message: "Paiement non trouvé" });

    if (paiementRecu.status === "CONFIRMED")
      return res.status(400).json({ message: "Paiement déjà confirmé" });

    // ---------- Charger tous les produits du panier ----------
    const produitIds = commande.panier.map((item) => item.produitId);
    const produits = await Product.find({ _id: { $in: produitIds } }).session(
      session,
    );
    const produitsMap = {};
    produits.forEach((p) => (produitsMap[p._id.toString()] = p));

    // ---------- Vérification du stock ----------
    for (const item of commande.panier) {
      const produit = produitsMap[item.produitId.toString()];
      if (!produit) continue;

      const couleur = item.couleur.toLowerCase();
      const taille = item.taille.toLowerCase();

      // Récupérer ou créer la Map pour la couleur
      let colorMap = produit.stockParVariation.get(couleur) || new Map();

      // Stock actuel de la taille
      let stockVariation = colorMap.get(taille) || 0;

      if (stockVariation < item.quantite) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Stock insuffisant pour ${item.nom} (${item.couleur}/${item.taille})`,
        });
      }
    }

    // ---------- Confirmer le paiement ----------
    paiementRecu.status = "CONFIRMED";
    paiementRecu.confirmedAt = new Date();
    paiementRecu.adminComment = adminComment || "";

    const paiementStep = commande.paiements.find(
      (p) => p.step === paiementRecu.step,
    );
    if (paiementStep) {
      paiementStep.status = "PAID";
      paiementStep.validatedAt = new Date();
    }

    // ---------- Décrémenter le stock ----------
    for (const item of commande.panier) {
      const produit = produitsMap[item.produitId.toString()];
      if (!produit) continue;

      const couleur = item.couleur.toLowerCase();
      const taille = item.taille.toLowerCase();

      // Récupérer ou créer la Map pour la couleur
      let colorMap = produit.stockParVariation.get(couleur) || new Map();

      // Décrémenter le stock
      let currentStock = colorMap.get(taille) || 0;
      currentStock -= item.quantite;
      if (currentStock < 0) currentStock = 0;

      colorMap.set(taille, currentStock); // Mettre à jour la taille
      produit.stockParVariation.set(couleur, colorMap); // Mettre à jour la couleur entière

      produit.markModified("stockParVariation"); // 🔑 Indique à Mongoose que la Map a changé

      // Décrémenter le stock global
      produit.stock -= item.quantite;
      if (produit.stock < 0) produit.stock = 0;

      await produit.save({ session });
    }

    // ---------- Mettre à jour le statut global ----------
    if (commande.paiements.every((p) => p.status === "PAID")) {
      commande.statusCommande = "PAID";
    } else {
      commande.statusCommande = "PARTIALLY_PAID";
    }

    await commande.save({ session });
    const clientUser = await User.findById(commande.client.userId);
    const clientEmail = clientUser?.email;

    if (clientEmail) {
      await sendPaymentConfirmedEmail(
        clientEmail,
        paiementRecu.step,
        paiementRecu.montantEnvoye,
        commande._id,
        clientUser?.username || "Client",
      );
      console.log("✅ Email paiement confirmé envoyé");
    } else {
      console.error("❌ Impossible d'envoyer l'email: email client manquant");
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Paiement confirmé et stock mis à jour",
      commande,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ confirmerPaiementAdmin:", err);
    return res.status(500).json({
      message: "Erreur lors de la confirmation du paiement",
      error: err.message,
    });
  }
};

///rejeter paiement////
const rejeterPaiementAdmin = async (req, res) => {
  const session = await Commandeapi.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { paiementRecuId, adminComment } = req.body;

    const commande = await Commandeapi.findById(id).session(session);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    const paiementRecu = commande.paiementsRecus.id(paiementRecuId);
    if (!paiementRecu)
      return res.status(404).json({ message: "Paiement non trouvé" });

    if (paiementRecu.status === "REJECTED")
      return res.status(400).json({ message: "Paiement déjà rejeté" });

    // ---------- Charger tous les produits du panier ----------
    const produitIds = commande.panier.map((item) => item.produitId);
    const produits = await Product.find({ _id: { $in: produitIds } }).session(
      session,
    );
    const produitsMap = {};
    produits.forEach((p) => (produitsMap[p._id.toString()] = p));

    // ---------- Remettre le stock si le paiement était confirmé ----------
    if (paiementRecu.status === "CONFIRMED") {
      for (const item of commande.panier) {
        const produit = produitsMap[item.produitId.toString()];
        if (!produit) continue;

        const couleur = item.couleur.toLowerCase();
        const taille = item.taille.toLowerCase();

        let colorMap = produit.stockParVariation.get(couleur) || new Map();
        let currentStock = colorMap.get(taille) || 0;

        currentStock += item.quantite; // Remettre la quantité
        colorMap.set(taille, currentStock);
        produit.stockParVariation.set(couleur, colorMap);

        produit.markModified("stockParVariation");

        // Remettre le stock global
        produit.stock += item.quantite;

        await produit.save({ session });
      }
    }

    // ---------- Mettre le paiement comme rejeté ----------
    paiementRecu.status = "REJECTED";
    paiementRecu.adminComment = adminComment || "";
    paiementRecu.confirmedAt = null;

    const paiementStep = commande.paiements.find(
      (p) => p.step === paiementRecu.step,
    );
    if (paiementStep) {
      paiementStep.status = "UNPAID"; // l'étape redevient non payée
      paiementStep.validatedAt = null;
    }

    // ---------- Mettre à jour le statut global ----------
    if (commande.paiements.every((p) => p.status === "PAID")) {
      commande.statusCommande = "PAID";
    } else if (commande.paiements.some((p) => p.status === "PENDING")) {
      commande.statusCommande = "PARTIALLY_PAID";
    } else {
      commande.statusCommande = "PENDING";
    }

    await commande.save({ session });
    const clientUser = await User.findById(commande.client.userId);
    const clientEmail = clientUser?.email;

    if (clientEmail) {
      await sendPaymentRejectedEmail(
        clientEmail,
        paiementRecu.step,
        paiementRecu.montantEnvoye,
        commande._id,
        paiementRecu.adminComment,
        clientUser?.username || "Client",
        (reason =
          "Le paiement a été rejeté par l'administrateur. Veuillez vérifier les informations fournies ou contacter le support pour plus d'assistance."),
      );
      console.log("✅ Email paiement rejeté envoyé");
    } else {
      console.error("❌ Impossible d'envoyer l'email: email client manquant");
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Paiement rejeté et stock mis à jour si nécessaire",
      commande,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ rejeterPaiementAdmin:", err);
    return res.status(500).json({
      message: "Erreur lors du rejet du paiement",
      error: err.message,
    });
  }
};

module.exports = {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  paiementSemi,
  confirmerPaiementAdmin,
  rejeterPaiementAdmin,
};
