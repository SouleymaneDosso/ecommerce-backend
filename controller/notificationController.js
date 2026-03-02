// notificationController.js
const SibApiV3Sdk = require("sib-api-v3-sdk");
const User = require("../models/User");
// 🔹 Configuration Brevo
const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi(client);

// Fonction générique pour envoyer un email
const sendEmail = async (toEmail, templateId, params) => {
  try {
    const sendSmtpEmail = {
      to: [{ email: toEmail }],
      templateId,
      params,
      sender: { name: "NUMA", email: "contact@numa.luxe" },
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email envoyé (${templateId}) à ${toEmail}`);
  } catch (err) {
    console.error(
      "❌ Erreur envoi email Brevo:",
      err?.response?.body || err.message,
    );
  }
};

// ======= FONCTIONS PAR TEMPLATE =======

// 1️⃣ Bienvenue / création de compte
const sendWelcomeEmail = async (email, username) => {
  await sendEmail(email, 7, { username });
};

// 2️⃣ Nouvelle commande
const sendNewOrderEmail = async (email, commande) => {
  try {
    if (!commande) {
      console.error("❌ commande manquante");
      return;
    }

    // 🔒 Sécuriser accès user
    const userId = commande?.client?.userId || commande?.userId || null;

    let username = "Client";

    if (userId) {
      const user = await User.findById(userId);
      if (user) username = user.username;
    }

    // 🔒 Sécuriser panier
    const panierHTML = Array.isArray(commande.panier)
      ? commande.panier
          .map(
            (item) =>
              `- ${item.nom || item.title} (${item.quantite || 1} x ${
                item.prix || item.price
              } FCFA)`,
          )
          .join("<br>")
      : "Aucun produit";

    const params = {
      nom: username,
      commandeId: commande._id?.toString() || "",
      total: commande.total || 0,
      panierHTML,
    };

    console.log("📦 PARAMS ENVOYÉS VERS BREVO :", params);
    console.log("ENVOI EMAIL NOUVELLE COMMANDE:", {
      to: email,
      params,
    });
    await sendEmail(email, 3, params);
  } catch (error) {
    console.error("❌ Erreur sendNewOrderEmail:", error);
  }
};

// 3️⃣ Paiement soumis par le client
const sendPaymentSubmittedEmail = async (
  email,
  step,
  montant,
  commandeId,
  username,
) => {
  await sendEmail(email, 4, { step, montant, commandeId, username });
};

// 4️⃣ Paiement confirmé par admin
const sendPaymentConfirmedEmail = async (
  email,
  step,
  montant,
  commandeId,
  username,
) => {
  await sendEmail(email, 5, { step, montant, commandeId, username });
};

// 5️⃣ Paiement rejeté par admin
const sendPaymentRejectedEmail = async (
  email,
  step,
  montant,
  commandeId,
  reason = "Le paiement a été rejeté par l'administrateur. Veuillez vérifier les informations fournies ou contacter le support pour plus d'assistance.",
  username,
) => {
  await sendEmail(email, 6, { step, montant, commandeId, reason, username });
};

module.exports = {
  sendWelcomeEmail,
  sendNewOrderEmail,
  sendPaymentSubmittedEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
};
