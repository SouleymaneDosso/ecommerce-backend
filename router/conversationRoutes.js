const express = require("express");

const router = express.Router();

const authConversation = require("../authentification/authConversation");

const conversationController = require("../controller/conversation");

// =====================================================
// CRÉER / RÉCUPÉRER UNE CONVERSATION
// =====================================================

router.post("/", authConversation, conversationController.creerConversation);

// =====================================================
// RÉCUPÉRER LES MESSAGES
// =====================================================

router.get(
  "/:conversationId/messages/unread-count",
  authConversation,
  conversationController.compterMessagesNonLus,
);

router.get(
  "/:conversationId/messages",
  authConversation,
  conversationController.recupererMessages,
);

// =====================================================
// ENVOYER UN MESSAGE
// =====================================================

router.post(
  "/:conversationId/messages",
  authConversation,
  conversationController.envoyerMessage,
);

// =====================================================
// MARQUER LES MESSAGES COMME LUS
// =====================================================

router.patch(
  "/:conversationId/messages/read",
  authConversation,
  conversationController.marquerMessagesCommeLus,
);

// =====================================================
// SUPPRIMER UN MESSAGE
// =====================================================

router.delete(
  "/:conversationId/messages/:messageId",
  authConversation,
  conversationController.supprimerMessage,
);

module.exports = router;
