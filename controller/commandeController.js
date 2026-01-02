const Commandeapi = require("../models/paiementmodel");
const Product = require("../models/produits");

// Générer une référence unique pour chaque étape de paiement
const generateReference = (commandeId, step) => {
  return `${commandeId}-STEP${step}-${Date.now()}`;
};

/* =========================
   CREATION COMMANDE
   ========================= */
const creerCommande = async (req, res) => {
  try {
    const { client, panier, modePaiement, servicePaiement } = req.body;

    if (!client || !panier || !servicePaiement) {
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
          images: product.images,
          quantite: item.quantite,
          couleur: item.couleur,
          taille: item.taille,
        };
      })
    );

    // Calcul du total depuis les produits pour éviter incohérences
    const totalCalculated = panierSnapshot.reduce(
      (acc, item) => acc + item.prix * item.quantite,
      0
    );

    const nouvelleCommande = new Commandeapi({
      client: { userId: req.auth.userId, ...client },
      panier: panierSnapshot,
      total: totalCalculated,
      modePaiement,
      servicePaiement,
      paiements: [],
      paiementsRecus: [],
      statusCommande: "PENDING",
    });

    // Créer les étapes de paiement
    if (modePaiement === "installments") {
      const montantParEtape = totalCalculated / 3;
      for (let i = 1; i <= 3; i++) {
        nouvelleCommande.paiements.push({
          step: i,
          amountExpected: montantParEtape,
          status: "UNPAID",
          reference: generateReference(nouvelleCommande._id, i),
          validatedAt: null,
        });
      }
    } else {
      nouvelleCommande.paiements.push({
        step: 1,
        amountExpected: totalCalculated,
        status: "UNPAID",
        reference: generateReference(nouvelleCommande._id, 1),
        validatedAt: null,
      });
    }

    await nouvelleCommande.save();

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
      .limit(limit);

    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      commandes,
    });
  } catch (err) {
    console.error(err);
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

    const paiementStep = commande.paiements.find(
      (p) => p.step === Number(step)
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

    // Récupérer la commande
    const commande = await Commandeapi.findById(id).session(session);
    if (!commande) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Commande introuvable" });
    }

    // Récupérer le paiement reçu
    const paiementRecu = commande.paiementsRecus.id(paiementRecuId);
    if (!paiementRecu) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Paiement non trouvé" });
    }

    if (paiementRecu.status === "CONFIRMED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Paiement déjà confirmé" });
    }

    // Vérifier le stock pour tous les produits avant confirmation
    for (const item of commande.panier) {
      const produit = await Product.findById(item.produitId).session(session);
      if (!produit) continue;

      const stockVariation =
        produit.stockParVariation?.[item.couleur]?.[item.taille] ??
        produit.stock;

      if (stockVariation < item.quantite) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Stock insuffisant pour ${item.nom} (${item.couleur}/${item.taille})`,
        });
      }
    }

    // Confirmer le paiement
    paiementRecu.status = "CONFIRMED";
    paiementRecu.confirmedAt = new Date();
    paiementRecu.adminComment = adminComment || "";

    // Mettre à jour l'étape correspondante
    const paiementStep = commande.paiements.find(
      (p) => p.step === paiementRecu.step
    );
    if (paiementStep) {
      paiementStep.status = "PAID";
      paiementStep.validatedAt = new Date();
    }

    // Décrémenter le stock pour chaque produit
    for (const item of commande.panier) {
      const produit = await Product.findById(item.produitId).session(session);
      if (!produit) continue;

      if (
        produit.stockParVariation?.[item.couleur] &&
        produit.stockParVariation[item.couleur][item.taille] != null
      ) {
        produit.stockParVariation[item.couleur][item.taille] -= item.quantite;
        if (produit.stockParVariation[item.couleur][item.taille] < 0)
          produit.stockParVariation[item.couleur][item.taille] = 0;
      }

      produit.stock -= item.quantite;
      if (produit.stock < 0) produit.stock = 0;

      await produit.save({ session });
    }

    // Mettre à jour le statut global de la commande
    if (commande.paiements.every((p) => p.status === "PAID")) {
      commande.statusCommande = "PAID";
    } else {
      commande.statusCommande = "PARTIALLY_PAID";
    }

    await commande.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Paiement confirmé et stock mis à jour",
      commande,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ confirmerPaiementAdmin:", err.message);
    return res.status(500).json({
      message: "Erreur lors de la confirmation du paiement",
      error: err.message,
    });
  }
};

module.exports = { confirmerPaiementAdmin };

////rejeter paiement admin//////////////////

const rejeterPaiementAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { paiementRecuId, adminComment } = req.body;

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    const paiementRecu = commande.paiementsRecus.id(paiementRecuId);
    if (!paiementRecu)
      return res.status(404).json({ message: "Paiement non trouvé" });

    if (paiementRecu.status === "REJECTED") {
      return res.status(400).json({ message: "Paiement déjà rejeté" });
    }

    // Mettre à jour le paiement comme rejeté
    paiementRecu.status = "REJECTED";
    paiementRecu.adminComment = adminComment || "";
    paiementRecu.confirmedAt = null;

    // Mettre à jour l'étape correspondante si besoin
    const paiementStep = commande.paiements.find(
      (p) => p.step === paiementRecu.step
    );
    if (paiementStep) {
      paiementStep.status = "UNPAID"; // on remet l'étape comme non payée
      paiementStep.validatedAt = null;
    }

    // Mettre à jour le statut global de la commande
    if (commande.paiements.every((p) => p.status === "PAID")) {
      commande.statusCommande = "PAID";
    } else if (commande.paiements.some((p) => p.status === "PENDING")) {
      commande.statusCommande = "PARTIALLY_PAID";
    } else {
      commande.statusCommande = "PENDING";
    }

    await commande.save();

    res.status(200).json({ message: "Paiement rejeté", commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({
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
