const Conversation = require("../models/conversation");
const Commandeapi = require("../models/paiementmodel");

// =====================================================
// UTILITAIRE : RÉCUPÉRER L'UTILISATEUR CONNECTÉ
// =====================================================

const getUtilisateurConnecte = (req) => {
  // Client
  if (req.auth?.userId) {
    return {
      id: req.auth.userId,
      type: "client",
    };
  }

  // Livreur
  if (req.livreur?._id) {
    return {
      id: req.livreur._id,
      type: "livreur",
    };
  }

  return null;
};

// =====================================================
// CRÉER / RÉCUPÉRER UNE CONVERSATION
// =====================================================

exports.creerConversation = async (req, res) => {
  try {
    const utilisateur = getUtilisateurConnecte(req);

    if (!utilisateur) {
      return res.status(401).json({
        message: "Utilisateur non authentifié.",
      });
    }

    const { commandeId } = req.body;

    if (!commandeId) {
      return res.status(400).json({
        message: "L'identifiant de la commande est obligatoire.",
      });
    }

    // ---------------------------------------------
    // RÉCUPÉRER LA COMMANDE
    // ---------------------------------------------

    const commande = await Commandeapi.findById(commandeId);

    if (!commande) {
      return res.status(404).json({
        message: "Commande introuvable.",
      });
    }

    const clientId = commande.client.userId;
    const livreurId = commande.livraison?.livreurId;

    // ---------------------------------------------
    // VÉRIFIER QUE LE LIVREUR EST ASSIGNÉ
    // ---------------------------------------------

    if (!livreurId) {
      return res.status(400).json({
        message: "Aucun livreur n'est encore assigné à cette commande.",
      });
    }

    // ---------------------------------------------
    // VÉRIFIER QUE L'UTILISATEUR PARTICIPE
    // À CETTE COMMANDE
    // ---------------------------------------------

    const estClient =
      utilisateur.type === "client" &&
      clientId.toString() === utilisateur.id.toString();

    const estLivreur =
      utilisateur.type === "livreur" &&
      livreurId.toString() === utilisateur.id.toString();

    if (!estClient && !estLivreur) {
      return res.status(403).json({
        message: "Vous ne participez pas à cette commande.",
      });
    }

    // ---------------------------------------------
    // CHERCHER LA CONVERSATION
    // ---------------------------------------------

    const conversationExiste = await Conversation.findOne({
      clientId,
      livreurId,
      commandeId,
    });

    if (conversationExiste) {
      return res.status(200).json({
        message: "La conversation existe déjà.",
        conversation: conversationExiste,
      });
    }

    // ---------------------------------------------
    // CRÉER LA CONVERSATION
    // ---------------------------------------------

    const conversation = await Conversation.create({
      clientId,
      livreurId,
      commandeId,
      messages: [],
      derniermessage: "",
    });

    return res.status(201).json({
      message: "Conversation créée avec succès.",
      conversation,
    });
  } catch (error) {
    console.error("CREER CONVERSATION ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
    });
  }
};

// =====================================================
// ENVOYER UN MESSAGE
// =====================================================

exports.envoyerMessage = async (req, res) => {
  try {
    const utilisateur = getUtilisateurConnecte(req);

    if (!utilisateur) {
      return res.status(401).json({
        message: "Utilisateur non authentifié.",
      });
    }

    const { conversationId } = req.params;
    const { message } = req.body;

    // ---------------------------------------------
    // VÉRIFIER LE MESSAGE
    // ---------------------------------------------

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Le message est obligatoire.",
      });
    }

    // ---------------------------------------------
    // RÉCUPÉRER LA CONVERSATION
    // ---------------------------------------------

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation introuvable.",
      });
    }

    // ---------------------------------------------
    // VÉRIFIER QUE L'UTILISATEUR PARTICIPE
    // ---------------------------------------------

    const estClient =
      utilisateur.type === "client" &&
      conversation.clientId.toString() === utilisateur.id.toString();

    const estLivreur =
      utilisateur.type === "livreur" &&
      conversation.livreurId.toString() === utilisateur.id.toString();

    if (!estClient && !estLivreur) {
      return res.status(403).json({
        message: "Vous ne faites pas partie de cette conversation.",
      });
    }

    // ---------------------------------------------
    // AJOUTER LE MESSAGE
    // ---------------------------------------------

    const nouveauMessage = {
      message: message.trim(),

      expediteur: {
        id: utilisateur.id,
        type: utilisateur.type,
      },

      lu: false,

      date: new Date(),
    };

    conversation.messages.push(nouveauMessage);

    conversation.derniermessage = message.trim();

    await conversation.save();

    // ---------------------------------------------
    // RÉCUPÉRER LE MESSAGE AJOUTÉ
    // ---------------------------------------------

    const messageAjoute =
      conversation.messages[conversation.messages.length - 1];

    // ---------------------------------------------
    // NOTIFICATION SOCKET
    // ---------------------------------------------

    const io = req.app.get("io");

    if (io) {
      const destinataireId =
        utilisateur.type === "client"
          ? conversation.livreurId
          : conversation.clientId;

      io.to(`user:${destinataireId}`).emit("nouveau_message", {
        conversationId: conversation._id,
        commandeId: conversation.commandeId,
        message: messageAjoute,
      });
    }

    return res.status(201).json({
      message: "Message envoyé avec succès.",
      nouveauMessage: messageAjoute,
    });
  } catch (error) {
    console.error("ENVOYER MESSAGE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
    });
  }
};

// =====================================================
// RÉCUPÉRER LES MESSAGES
// =====================================================

exports.recupererMessages = async (req, res) => {
  try {
    const utilisateur = getUtilisateurConnecte(req);

    if (!utilisateur) {
      return res.status(401).json({
        message: "Utilisateur non authentifié.",
      });
    }

    const { conversationId } = req.params;

    // ---------------------------------------------
    // RÉCUPÉRER LA CONVERSATION
    // ---------------------------------------------

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation introuvable.",
      });
    }

    // ---------------------------------------------
    // VÉRIFIER L'ACCÈS
    // ---------------------------------------------

    const estClient =
      utilisateur.type === "client" &&
      conversation.clientId.toString() === utilisateur.id.toString();

    const estLivreur =
      utilisateur.type === "livreur" &&
      conversation.livreurId.toString() === utilisateur.id.toString();

    if (!estClient && !estLivreur) {
      return res.status(403).json({
        message: "Vous ne faites pas partie de cette conversation.",
      });
    }

    // ---------------------------------------------
    // RETOURNER LES MESSAGES
    // ---------------------------------------------

    return res.status(200).json({
      conversationId: conversation._id,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error("RECUPERER MESSAGES ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
    });
  }
};

// =====================================================
// MARQUER LES MESSAGES COMME LUS
// =====================================================

exports.marquerMessagesCommeLus = async (req, res) => {
  try {
    const utilisateur = getUtilisateurConnecte(req);

    if (!utilisateur) {
      return res.status(401).json({
        message: "Utilisateur non authentifié.",
      });
    }

    const { conversationId } = req.params;

    // ---------------------------------------------
    // RÉCUPÉRER LA CONVERSATION
    // ---------------------------------------------

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation introuvable.",
      });
    }

    // ---------------------------------------------
    // VÉRIFIER L'ACCÈS
    // ---------------------------------------------

    const estClient =
      utilisateur.type === "client" &&
      conversation.clientId.toString() === utilisateur.id.toString();

    const estLivreur =
      utilisateur.type === "livreur" &&
      conversation.livreurId.toString() === utilisateur.id.toString();

    if (!estClient && !estLivreur) {
      return res.status(403).json({
        message: "Vous ne faites pas partie de cette conversation.",
      });
    }

    // ---------------------------------------------
    // MARQUER COMME LUS
    // ---------------------------------------------

    let nombreModifie = 0;

    conversation.messages.forEach((msg) => {
      // On marque uniquement les messages
      // envoyés par l'autre personne.
      if (msg.expediteur.type !== utilisateur.type && !msg.lu) {
        msg.lu = true;
        nombreModifie++;
      }
    });

    await conversation.save();

    return res.status(200).json({
      message: "Messages marqués comme lus.",
      nombreModifie,
    });
  } catch (error) {
    console.error("MARQUER MESSAGES LUS ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
    });
  }
};

// =====================================================
// SUPPRIMER UN MESSAGE
// =====================================================

exports.supprimerMessage = async (req, res) => {
  try {
    const utilisateur = getUtilisateurConnecte(req);

    if (!utilisateur) {
      return res.status(401).json({
        message: "Utilisateur non authentifié.",
      });
    }

    const { conversationId, messageId } = req.params;

    // ---------------------------------------------
    // RÉCUPÉRER LA CONVERSATION
    // ---------------------------------------------

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation introuvable.",
      });
    }

    // ---------------------------------------------
    // VÉRIFIER L'ACCÈS
    // ---------------------------------------------

    const estClient =
      utilisateur.type === "client" &&
      conversation.clientId.toString() === utilisateur.id.toString();

    const estLivreur =
      utilisateur.type === "livreur" &&
      conversation.livreurId.toString() === utilisateur.id.toString();

    if (!estClient && !estLivreur) {
      return res.status(403).json({
        message: "Vous ne faites pas partie de cette conversation.",
      });
    }

    // ---------------------------------------------
    // RÉCUPÉRER LE MESSAGE
    // ---------------------------------------------

    const message = conversation.messages.id(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message introuvable.",
      });
    }

    // ---------------------------------------------
    // VÉRIFIER QUE C'EST SON MESSAGE
    // ---------------------------------------------

    if (message.expediteur.id.toString() !== utilisateur.id.toString()) {
      return res.status(403).json({
        message: "Vous ne pouvez pas supprimer ce message.",
      });
    }

    // ---------------------------------------------
    // SUPPRIMER
    // ---------------------------------------------

    message.deleteOne();

    // ---------------------------------------------
    // METTRE À JOUR DERNIER MESSAGE
    // ---------------------------------------------

    if (conversation.messages.length > 0) {
      const dernier = conversation.messages[conversation.messages.length - 1];

      conversation.derniermessage = dernier.message;
    } else {
      conversation.derniermessage = "";
    }

    await conversation.save();

    return res.status(200).json({
      message: "Message supprimé avec succès.",
      conversation,
    });
  } catch (error) {
    console.error("SUPPRIMER MESSAGE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
    });
  }
};
